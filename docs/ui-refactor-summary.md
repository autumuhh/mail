# Maildrop UI 重构总结

## 1. 目标与选型

本次重构在不引入前端构建链的前提下，统一公开登录、收件箱、邮箱注册、只读 API 调试台和管理后台的视觉与交互。实现继续使用 Flask 模板、原生 CSS 和原生 JavaScript，避免为现有项目增加不必要的框架与运行时依赖。

视觉方案采用低饱和浅色渐变与 Soft UI（柔和拟物）语言：

- 大圆角表面配合亮、暗双阴影，形成克制的浮雕层次；
- Hover 上浮、Active 内凹，统一使用 180ms 柔和动效；
- 以绿色主色强调主要操作，状态色仅用于成功、警告和错误反馈；
- 使用系统字体栈和本地 SVG sprite，不加载 Font Awesome、外部字体或图标 CDN；
- 保留亮色、暗色和跟随系统三种主题，并尊重减少动态效果的系统偏好。

## 2. 共享基础

| 资源 | 职责 |
| --- | --- |
| `src/frontend/static/styles/ui_foundation.css` | 设计令牌、Soft UI 表面、按钮、表单、表格、Toast、Dialog、焦点态、响应式规则和减少动效规则 |
| `src/frontend/static/icons/maildrop-icons.svg` | 全站线性图标 sprite，替代第三方图标字体 |
| `src/frontend/static/scripts/theme.js` | `auto / light / dark` 主题初始化与切换；偏好仅写入当前标签页的 `sessionStorage` |
| `src/frontend/static/scripts/ui_components.js` | 暴露 `MaildropUI`，统一图标、Toast、Dialog 和 Busy 状态 |

`MaildropUI` 的稳定接口如下：

- `MaildropUI.icon(name, className = '')`
- `MaildropUI.toast(message, type = 'info', options = {})`
- `MaildropUI.openDialog(dialog, opener = document.activeElement)`
- `MaildropUI.closeDialog(dialog)`
- `MaildropUI.setBusy(element, busy, label = '')`

所有页面先加载共享基础样式，再加载页面样式；脚本按 `theme.js`、`ui_components.js`、页面脚本的顺序加载，确保页面逻辑只依赖已经初始化的共享能力。

## 3. 页面与组件映射

| 页面 | 路由 | 主要组件 | 保留的业务边界 |
| --- | --- | --- | --- |
| 邮箱登录 | `/`、`/web` | 凭据表单、密码可见性、主题切换、状态提示 | 只生成 `/web/<编码邮箱>----<编码密钥>` |
| 收件箱 | `/web/<邮箱>----<密钥>` | 几何居中的邮箱地址、邮件列表、详情、批量操作、空状态、切换邮箱 | 仅收件、查看、标记和删除，不提供写信能力 |
| 邮箱注册 | `/register` | 管理员验证、注册表单、域名选择、结果提示 | 使用现有管理员授权注册接口 |
| API 调试台 | `/api-test` | 凭据交换、邮箱信息、收件箱只读输出 | 凭据仅保存在运行时内存，不提供写接口 |
| 管理后台 | `/admin` | 登录、统计卡片、邮箱创建、邮箱表格、审计、配置、子管理员和分级 Dialog | 保留 `register` 内部标识与 `/api/admin/*` 契约 |

管理端“邮箱创建”支持两种批量策略：默认从英文名、英文姓和四位数字组成不同用户名，并将去重后的全部可用域名逐轮洗牌分配；也可继续使用“前缀 + 序号”。批量操作先展示前 3 条确定性预览，再按该预览方案逐个调用既有创建接口，显示“已完成 x/y”和每条成功/失败结果，不引入新的批量 API。

## 4. 安全与可访问性约束

- 邮箱访问链接不兼容旧 `/mailbox?address=...&token=...` 形式，只使用固定的 `/web/<邮箱>----<密钥>` 路由。
- 新建、迁移补齐和手动轮换的邮箱密钥统一为 10 位大小写英文字母与数字，并保证至少包含大写、小写和数字；数据库中既有 UUID 密钥不做批量轮换且继续可用。
- 邮箱访问令牌通过 `Authorization: Bearer` 发送，不写入查询参数；邮箱密钥不写入 Web Storage。
- API 调试台只调用密钥交换、邮箱信息和收件箱查询接口，所有输出使用纯文本方式渲染。
- 公开收件箱与调试台不包含写信、回复、转发、发件箱或测试发信入口。
- 管理端继续使用现有 Bearer 管理鉴权；动态服务端数据必须转义或通过 `textContent / value` 写入 DOM。
- 交互控件提供 `:focus-visible` 焦点提示，关键按钮保持可触达尺寸；Dialog 按紧凑 `420px`、中等 `560px`、宽版 `760px` 分档，由共享组件补充可访问名称并处理焦点约束、Escape 关闭和焦点恢复。
- 复制、刷新、删除、已读等短操作统一使用按内容收缩的 Toast，最大宽度 `320px`；收件箱页清除共享顶部定位并固定在右下角，避免 `top` 与 `bottom` 同时生效造成整屏拉伸。
- `prefers-reduced-motion: reduce` 下压缩动画与过渡；共享样式在 768px 和 480px 提供响应式降级。
- `/web/...` 中的邮箱密钥属于敏感凭据，部署时仍需对反向代理和可观测性访问日志进行脱敏。

## 5. 验证

在仓库根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify_ui.ps1
```

脚本依次执行：

1. Python `compileall` 语法检查；
2. `src/frontend/static/scripts/` 下全部 JavaScript 的 `node --check`；
3. `pytest` 回归测试；
4. Git 工作树存在时执行 `git diff --check`；
5. `docker compose config --quiet` 配置校验。

需要同时验证镜像构建时运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify_ui.ps1 -Build
```

### 最终结果

| 检查项 | 结果 |
| --- | --- |
| Python compileall | 通过 |
| 全部 JavaScript `node --check` | 通过 |
| pytest | `37 passed, 139 subtests passed` |
| Docker Compose 配置 | 通过 |
| Docker 镜像构建 | 在目标服务器通过 |
| 桌面与移动端浏览器验收 | 通过；1536px 下顶栏与工作区均为 1240px 且邮箱地址居中，390px 下无横向溢出 |
| 收件箱 Toast 浏览器验收 | 复制成功提示约 `201 × 46px`，右下角内容自适应，无横向溢出 |

### 生产部署验证（2026-07-20）

- 生产入口：`https://tempmail.dearmer.xyz/`；部署目录：`/root/maildrop-master`；功能镜像构建自提交 `70c7013fc66c5b95f10071ade9b667e877b4109d`，最终归档版本以服务器内 `.deploy-version` 与 `.deploy-commit` 为准；
- 部署前新建一致性回滚备份 `/root/maildrop-master-backups/20260719-234647-before-e45a113`，SQLite 在线备份、源码、生产 `.env`、反代配置和 TLS 私钥均已写入校验清单并通过 `sha256sum -c`；备份根目录、备份目录和数据目录权限均为 `700`；
- 数据库部署前后均为 `quick_check=ok`、`143` 个邮箱、`112` 封邮件、`906` 条审计日志和 `2` 个子管理员，没有因部署丢失数据；
- 目标服务器完成 Docker 镜像构建，Compose 服务 `tempmail` 为 `running/healthy`；宿主源码、容器源码和 Git 归档中六个关键文件的 SHA-256 完全一致；
- 生产 `.env` 与数据库权限为 `600`，邮件数据目录权限为 `700`；Web 仅绑定 `127.0.0.1:8081`，公网直连 `8081` 失败，SMTP `25` 继续绑定 `0.0.0.0`；
- OpenResty 上游继续使用 `127.0.0.1:8081`；HTTPS 返回 `200` 并包含 HSTS；`/`、`/web`、`/admin`、`/register`、`/api-test` 与本地图标均返回 `200`；
- 旧 `/mailbox?address=...&token=...` 与不含 `----` 的 `/web/...` 均返回 `404`；容器内连续生成 `200` 个新密钥全部满足 10 位大小写字母和数字规则且无重复；
- 上线后容器日志未匹配 `error / exception / traceback / critical`，上传归档与校验文件已从服务器清理。

## 6. 部署步骤

1. 准备 `.env`，仅在部署环境配置域名、管理密码、数据库路径和网络策略；不要把 `.env` 或数据文件提交到版本库。使用同机单层 HTTPS 反向代理时设置 `WEB_BIND_HOST=127.0.0.1` 和 `TRUST_PROXY_HOPS=1`，防止公网通过 `8081` 绕过 TLS，并只信任这一跳写入的客户端 IP；无受信代理时保持 `TRUST_PROXY_HOPS=0`。
2. 执行不带 `-Build` 的验证脚本，先确认源码、测试和 Compose 配置有效。
3. 执行带 `-Build` 的验证脚本，或单独运行 `docker compose build`。
4. 使用 `docker compose up -d` 启动服务。
5. 验证 `/`、`/web`、有效凭据链接、`/admin`、`/register` 和 `/api-test`，并确认旧页面与测试发信接口返回 `404`。
6. 将宿主机或 host-network 反向代理上游指向 `127.0.0.1:8081`，检查其覆盖 `X-Forwarded-For`、日志脱敏、HSTS 与缓存策略，并确认应用记录真实客户端 IP、公网无法直连 `8081` 后再开放访问。bridge 网络中的代理应改用受控共享网络，不可照搬 loopback 上游。
