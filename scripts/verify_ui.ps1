[CmdletBinding()]
param(
    [switch]$Build
)

# Windows PowerShell 5.1 默认输出编码不固定，显式使用 UTF-8 以保证中文日志可读。
$utf8Output = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8Output
$OutputEncoding = $utf8Output

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$compileCache = Join-Path ([System.IO.Path]::GetTempPath()) ("maildrop-compile-{0}" -f [guid]::NewGuid())
$temporaryEnvPath = Join-Path $repoRoot '.env'
$createdTemporaryEnv = $false
$previousPycachePrefix = $env:PYTHONPYCACHEPREFIX
$previousDontWriteBytecode = $env:PYTHONDONTWRITEBYTECODE

function Invoke-CheckedStep {
    param(
        [Parameter(Mandatory)]
        [string]$Name,

        [Parameter(Mandatory)]
        [scriptblock]$Command
    )

    Write-Host "`n==> $Name" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name 失败，退出码：$LASTEXITCODE"
    }
}

Push-Location $repoRoot
try {
    # 将编译缓存放入系统临时目录，避免验证过程污染工作区。
    New-Item -ItemType Directory -Path $compileCache -Force | Out-Null
    $env:PYTHONPYCACHEPREFIX = $compileCache
    Invoke-CheckedStep '检查 Python 语法' {
        python -m compileall -q app.py config.py src tests
    }

    Write-Host "`n==> 检查全部前端 JavaScript 语法" -ForegroundColor Cyan
    $scriptFiles = @(Get-ChildItem -Path 'src/frontend/static/scripts' -Filter '*.js' -File -Recurse | Sort-Object FullName)
    if ($scriptFiles.Count -eq 0) {
        throw '未找到可验证的 JavaScript 文件'
    }
    foreach ($scriptFile in $scriptFiles) {
        node --check $scriptFile.FullName
        if ($LASTEXITCODE -ne 0) {
            throw "JavaScript 语法检查失败：$($scriptFile.FullName)"
        }
    }

    # 测试数据库与缓存均由测试夹具隔离，不读取或修改工作区 data/。
    $env:PYTHONDONTWRITEBYTECODE = '1'
    Invoke-CheckedStep '运行 pytest 回归测试' {
        python -m pytest -q
    }

    # 仓库内执行时同时检查补丁空白，避免混合修改在提交阶段才暴露格式问题。
    if (Test-Path -LiteralPath (Join-Path $repoRoot '.git')) {
        Invoke-CheckedStep '检查 Git 差异空白' {
            git diff --check
        }
    }

    # Compose 声明了必需的 .env；仓库无生产配置时仅创建本次校验使用的无敏感占位文件。
    if (-not (Test-Path -LiteralPath $temporaryEnvPath)) {
        [System.IO.File]::WriteAllLines($temporaryEnvPath, @(
            'PASSWORD=verification-only-placeholder'
            'DOMAINS=example.test'
            'DOMAIN=example.test'
            'DATABASE_PATH=data/mailbox.db'
            'USE_DATABASE=true'
            'ENABLE_IP_WHITELIST=false'
        ), $utf8Output)
        $createdTemporaryEnv = $true
    }

    # --quiet 仅校验 Compose 配置，避免把 .env 展开结果打印到终端。
    Invoke-CheckedStep '校验 Docker Compose 配置' {
        docker compose config --quiet
    }

    if ($Build) {
        Invoke-CheckedStep '构建 Docker 镜像' {
            docker compose build
        }
    }

    Write-Host "`n邮箱创建与 UI 重构验证全部通过。" -ForegroundColor Green
}
finally {
    Pop-Location

    if ($null -eq $previousPycachePrefix) {
        Remove-Item Env:PYTHONPYCACHEPREFIX -ErrorAction SilentlyContinue
    }
    else {
        $env:PYTHONPYCACHEPREFIX = $previousPycachePrefix
    }

    if ($null -eq $previousDontWriteBytecode) {
        Remove-Item Env:PYTHONDONTWRITEBYTECODE -ErrorAction SilentlyContinue
    }
    else {
        $env:PYTHONDONTWRITEBYTECODE = $previousDontWriteBytecode
    }

    if (Test-Path -LiteralPath $compileCache) {
        Remove-Item -LiteralPath $compileCache -Recurse -Force
    }

    # 只删除由本脚本创建的占位文件，绝不触碰用户已有的 .env。
    if ($createdTemporaryEnv -and (Test-Path -LiteralPath $temporaryEnvPath)) {
        Remove-Item -LiteralPath $temporaryEnvPath -Force
    }
}
