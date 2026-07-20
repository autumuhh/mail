# 公开邮箱体验优化说明

**更新日期：** 2026-07-19
**范围：** 公开登录、收件箱、管理端入口、凭据链路、出站功能下线与验证方法。

## 1. 严格页面路由

| 路径 | 行为 |
| --- | --- |
| `/` | 公开邮箱登录页 |
| `/login` | 重定向至 `/`，仅保留登录入口别名 |
| `/web` | 公开邮箱登录页 |
| `/web/<编码邮箱>----<编码密钥>` | 收件箱；刷新时使用地址中的密钥重新换取访问令牌 |
| `/admin` | 唯一管理后台入口 |
| `/register` | 管理员授权注册页 |
| `/api-test` | 只读 API 调试台 |

以下旧入口不兼容，也不重定向：

- `/mailbox` 及其旧 address/token 查询参数访问方式；
- `/admin/mailboxes`。

生成访问路径时，邮箱和密钥必须分别调用 `encodeURIComponent`，再用 `----` 连接：

```javascript
const path = `/web/${encodeURIComponent(address)}----${encodeURIComponent(mailboxKey)}`;
```

## 2. 凭据链路与风险

收件箱页面从 `/web/<邮箱>----<密钥>` 拆出两段凭据，调用
`POST /api/get_mailbox_token`。密钥不写入 Web Storage；成功后只把 `access_token` 保存到
`sessionStorage['maildrop_access_token']` 与运行时内存。刷新固定 URL 时重新执行密钥交换。
后续邮箱 API 使用：

```http
Authorization: Bearer <access_token>
```

不再把 `access_token` 写进页面 URL，也不接受旧 query token 兼容。

### 地址栏密钥风险

产品要求访问地址永久保留邮箱密钥，因此完整 URL 属于敏感凭据，可能出现在：

- 浏览器历史、书签和截图；
- 浏览器或代理扩展；
- Web 服务器、反向代理和可观测性平台的访问日志；
- 用户主动复制或分享的文本。

页面响应应使用以下缓解措施，但这些措施不能消除日志与主动分享风险：

- `Cache-Control: no-store` 与 `Pragma: no-cache`；
- `Referrer-Policy: no-referrer`；
- `X-Robots-Tag: noindex, nofollow, noarchive`；
- `X-Frame-Options: DENY` 与限制性 CSP；
- 不生成包含凭据的二维码或第三方分享链接。

## 3. API 约束

- `POST /api/get_mailbox_token`：邮箱地址 + `mailbox_key` 换取 `access_token`；
- 邮箱信息、读取、已读、删除和设置接口：Bearer 鉴权并校验邮箱归属；
- `/api/mailbox_info_v2`：不得按邮箱地址匿名返回 `access_token` 或 `mailbox_key`；
- `/api/register`、`/api/register_with_token` 与 `POST /api/admin/mailboxes`：创建响应返回
  `mailbox_key`，用于生成 `/web/...----...` 页面地址；
- `/api/admin/*`：严格使用 `Authorization: Bearer <PASSWORD>`，不与公开邮箱凭据混用；
- 未配置 `PASSWORD` 时管理认证保持关闭，不再使用公开默认口令；
- 已删除无人使用、明文比对密码并批量返回令牌的旧 `/api/user_login` 第二认证链。
- 已删除不再被管理页面使用、且会直接改写 `.env` 的旧管理配置 API。

完整端点索引与请求示例见仓库根目录 `API_DOCUMENTATION.md`。

## 4. 仅收件产品边界

站内不提供出站邮件能力：

- 删除写信、回复、转发、已发送等入口；
- 删除 API 测试页中的发信表单和脚本；
- 删除旧测试发信 API，请求应返回 `404`；
- 删除未使用且可由请求指定文件路径的旧迁移、导出 API，收口公开攻击面；
- 删除已无路由引用的旧首页模板及其脚本、样式、语言资源，避免残留假入口；
- SMTP 组件只接收邮件并写入存储。

API 调试台同样遵循只读边界：只调用密钥换令牌、邮箱信息与收件箱查询接口；不提供
创建、修改、删除或发信操作。调试凭据只保存在页面内存，所有响应通过
`<pre>.textContent` 输出，邮件中的 HTML 不会进入页面 DOM。

## 5. UI 设计令牌

公开登录与收件页面采用低饱和雾青新拟态风格：

| 令牌 | 浅色值 | 说明 |
| --- | --- | --- |
| `--bg-start` | `#EEF3F1` | 背景渐变起点 |
| `--bg-end` | `#E5EDEA` | 背景渐变终点 |
| `--surface` | `#EDF2F0` | 雾面卡片表面 |
| `--primary` | `#2F746D` | 主操作与焦点色 |
| `--radius-xl`（登录页） | `28px` | 登录主卡片圆角 |
| `--radius-xl`（收件页） | `26px` | 收件主卡片圆角 |
| `--radius-lg` | `20px` | 次级卡片圆角 |
| `--radius-md` | `16px` | 输入与按钮圆角 |
| `--ease` | `180ms cubic-bezier(0.22, 0.61, 0.36, 1)` | Hover/Active 动效 |

阴影使用低透明度的亮暗双阴影，模糊半径不超过 24px；Hover 上浮约 2px，
Active 下沉并使用内阴影。深色主题使用低饱和石墨绿表面，并保留清晰的文本、焦点与状态
对比度。主题偏好只写入当前会话；`prefers-reduced-motion: reduce` 下关闭非必要位移动效。

## 6. 邮件内容隔离

- 纯文本正文使用 `textContent`，不得拼接进 `innerHTML`；
- HTML 正文先在惰性 `<template>` 片段内清理，再写入无权限 `sandbox` iframe 的 `srcdoc`；
- `srcdoc` 内 CSP 禁止脚本、连接、表单和嵌套框架，只允许内联样式及 `data:`/`cid:` 图片；
- 不允许表单提交、顶层导航或主动加载外部资源；
- 邮件列表与详情中的发件人、主题等字段统一按文本输出。

## 7. 验证命令

以下命令用于复验；本次实际执行结果见第 8 节：

```powershell
python -m unittest discover -s tests -v
python -m compileall app.py src tests

Get-ChildItem src/frontend/static/scripts -Filter *.js |
  ForEach-Object { node --check $_.FullName }

$legacyMailboxPrefix = '/mailbox' + '?'
git grep -n -F $legacyMailboxPrefix

$removedSendApi = 'send_' + 'test_email'
git grep -n -F $removedSendApi
git diff --check
```

运行时还应在隔离的临时数据库与独立端口验证：

1. `/`、`/web`、有效 `/web/<邮箱>----<密钥>` 与 `/admin`；
2. `/mailbox`、旧 token 链接与 `/admin/mailboxes` 返回 `404`；
3. 正确、错误、过期和禁用密钥的状态码与错误提示；
4. 刷新凭据 URL 后重新鉴权；
5. 桌面与 390×844 移动视口、浅色/深色/跟随系统和减少动态效果；
6. 恶意 HTML 邮件不能执行脚本、提交表单、顶层跳转或加载外部资源。

## 8. 本次验收结果

2026-07-19 已完成以下验证：

- `python -m unittest discover -s tests -v`：16 项测试全部通过；
- `python -m compileall -q app.py src tests`：通过；
- `src/frontend/static/scripts/*.js` 全量 `node --check`：通过；
- `git diff --check`：通过；
- 最终路由表与 Flask 测试客户端确认：`/`、`/web`、`/admin`、`/api-test` 返回 `200`，
  已移除页面、发信、迁移导出、旧用户登录与旧管理配置接口的 GET/POST 均返回 `404`；
- 隔离浏览器验证：登录后保持 `/web/<邮箱>----<密钥>`，连续刷新会重新执行密钥交换；
  收件、搜索、详情、Esc 返回、浅色/深色主题与 390×844 移动布局正常；
- 恶意 HTML 邮件验证：父页面脚本标记未被写入，隔离正文中脚本、表单、嵌套框架、远程
  `src` 与可导航链接均为 0，测试服务器收到的跟踪资源请求为 0；
- 管理端存储型 XSS 验证：恶意邮箱地址仅以文本显示，注入图片节点与执行标记均为 0；
- `/api-test` 验证：仅完成密钥换令牌及两个只读查询，令牌不回显，恶意邮件 HTML 未进入
  页面 DOM；本地应用控制台错误为 0。

自动化测试与浏览器验收均使用系统临时目录中的独立 SQLite 数据库，测试数据未写入工作区
`data/`。早期一次路由检查曾在未切换临时数据库前导入应用，因而触发现有
`data/mailbox.db` 的幂等启动迁移；未创建或删除测试邮箱、邮件，后续验证均已隔离。
