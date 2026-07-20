# Maildrop 页面与 API 文档

本文档描述当前公开页面、邮箱凭据流和主要 API。所有示例默认服务地址为
`http://127.0.0.1:5000`。

## 页面路由

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/` | 公开邮箱登录页 |
| `GET` | `/login` | 重定向到 `/` |
| `GET` | `/web` | 公开邮箱登录页 |
| `GET` | `/web/<编码邮箱>----<编码密钥>` | 收件箱页面，刷新时重新校验密钥 |
| `GET` | `/admin` | 唯一管理后台入口 |
| `GET` | `/register` | 管理员授权的邮箱注册页 |
| `GET` | `/api-test` | 只读 API 调试台 |

`/mailbox` 携带旧 address/token 查询参数的访问方式与 `/admin/mailboxes` 不保留兼容
路由，访问应返回 `404`。生成页面链接时必须分别对邮箱和密钥执行 URL 编码：

```text
/web/user%40example.com----mailbox-key
```

> `/web/...` 按产品要求将邮箱密钥保留在地址栏。该密钥可能进入浏览器历史、书签、
> 截图与反向代理访问日志；页面虽使用禁止缓存、禁止引用和禁止索引响应头，仍应将完整
> URL 视为敏感凭据。

`/api-test` 只提供以下调试流程：用邮箱地址与 `mailbox_key` 调用
`POST /api/get_mailbox_token`，再以 Bearer 令牌读取 `/api/mailbox_info_v2` 和
`/api/get_inbox`。调试页不创建或修改数据，不提供发信功能；密钥与令牌只保存在页面
内存，响应统一经 `<pre>.textContent` 输出。

## 邮箱认证流程

公开 API 仍会先应用项目配置的 IP 白名单；未放行的来源返回 `403`。

### 1. 用邮箱密钥换取访问令牌

```http
POST /api/get_mailbox_token
Content-Type: application/json
```

```json
{
  "address": "user@example.com",
  "mailbox_key": "your-mailbox-key"
}
```

成功响应：

```json
{
  "success": true,
  "address": "user@example.com",
  "access_token": "generated-access-token",
  "mailbox_id": "mailbox-uuid",
  "expires_at": 1678886400
}
```

### 2. 调用邮箱 API

后续邮箱 API 仅接受 Bearer 令牌，不接受 query string 中的旧 `token` 参数：

```http
Authorization: Bearer generated-access-token
```

公开页面只把访问令牌保存到当前会话的 `sessionStorage['maildrop_access_token']` 与内存；
邮箱密钥不写入 Web Storage。

典型错误状态：

- `401`：凭据或访问令牌无效；
- `403`：令牌不属于目标邮箱；
- `404`：邮箱或邮件不存在；
- `410`：邮箱已过期；
- `423`：邮箱已禁用。

## 公开与注册 API

### 基础信息

| 方法 | 端点 | 说明 |
| --- | --- | --- |
| `GET` | `/api/get_random_address` | 获取随机邮箱地址与可用域名 |
| `GET` | `/api/get_domain` | 获取域名配置 |
| `POST` | `/api/get_mailbox_token` | 邮箱地址 + 邮箱密钥换取访问令牌 |

### 创建邮箱

#### 管理员密码注册

```http
POST /api/register
Authorization: <ADMIN_PASSWORD>
Content-Type: application/json
```

#### 子管理员令牌注册

```http
POST /api/register_with_token
X-Sub-Admin-Token: <SUB_ADMIN_TOKEN>
Content-Type: application/json
```

请求可包含 `email`、`retention_days` 和发件人白名单等字段。创建成功响应会同时返回
`access_token` 与 `mailbox_key`；公开页面链接只能使用 `mailbox_key`：

```json
{
  "success": true,
  "mailbox_created": true,
  "mailbox_address": "user@example.com",
  "access_token": "generated-access-token",
  "mailbox_key": "generated-mailbox-key",
  "retention_days": 30
}
```

### 收件箱与邮箱设置

以下接口均要求 `Authorization: Bearer <access_token>`，并校验目标邮箱归属：

| 方法 | 端点 | 说明 |
| --- | --- | --- |
| `GET` | `/api/mailbox_info_v2` | 从 Bearer 令牌推导并返回邮箱信息；响应不返回访问令牌或邮箱密钥 |
| `GET` | `/api/get_inbox?address=<邮箱>` | 获取邮件列表 |
| `GET` | `/api/get_email?address=<邮箱>&id=<邮件ID>` | 获取单封邮件 |
| `POST` | `/api/mark_email_read` | 标记单封邮件已读 |
| `POST` | `/api/mark_all_read` | 全部标记已读 |
| `POST` | `/api/delete_email` | 删除单封邮件 |
| `POST` | `/api/delete_emails_batch` | 批量删除邮件 |
| `POST` | `/api/add_sender_whitelist` | 添加发件人白名单项 |
| `POST` | `/api/remove_sender_whitelist` | 删除发件人白名单项 |
| `POST` | `/api/update_retention` | 更新保留天数 |
| `POST` | `/api/regenerate_mailbox_key` | 重新生成邮箱密钥 |
| `POST` | `/api/toggle_mailbox_status` | 启用或禁用邮箱 |
| `POST` | `/api/toggle_whitelist` | 启用或禁用白名单 |

`get_inbox` 使用 `address` 查询参数，`get_email` 使用 `address` 与 `id` 查询参数；地址型
写接口在 JSON 中提交 `address`，邮件型写接口提交 `email_id` 或 `email_ids`。这些参数
只用于定位资源，不能替代 Bearer 鉴权。

示例：

```bash
curl "http://127.0.0.1:5000/api/get_inbox?address=user%40example.com" \
  -H "Authorization: Bearer generated-access-token"
```

## 管理员 API

管理员 Blueprint 统一使用 `/api/admin` 前缀，并严格要求
`Authorization: Bearer <ADMIN_PASSWORD>`。部署未配置 `PASSWORD` 时管理认证保持关闭。

### 邮箱与统计

| 方法 | 端点 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/mailboxes` | 分页查询邮箱 |
| `GET` | `/api/admin/mailboxes/<mailbox_id>` | 获取邮箱详情 |
| `POST` | `/api/admin/mailboxes` | 创建邮箱 |
| `PUT` | `/api/admin/mailboxes/<mailbox_id>` | 更新邮箱 |
| `DELETE` | `/api/admin/mailboxes/<mailbox_id>` | 删除或软删除邮箱 |
| `POST` | `/api/admin/mailboxes/batch-delete` | 批量删除邮箱 |
| `POST` | `/api/admin/mailboxes/<mailbox_id>/reset-token` | 重置访问令牌 |
| `POST` | `/api/admin/mailboxes/<mailbox_id>/enable` | 恢复邮箱 |
| `GET` | `/api/admin/mailboxes/<mailbox_id>/audit-logs` | 查询邮箱审计日志 |
| `GET` | `/api/admin/audit-logs` | 查询全局审计日志 |
| `GET` | `/api/admin/stats` | 系统统计 |
| `GET` | `/api/admin/source-stats` | 创建来源统计 |

管理员创建邮箱成功时，`data` 包含 `address`、`access_token` 与 `mailbox_key`。管理端
生成的公开链接格式同样只能是 `/web/<编码邮箱>----<编码密钥>`。

### 安全配置与子管理员

| 方法 | 端点 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/blocked-ips` | 查询被封禁 IP |
| `DELETE` | `/api/admin/blocked-ips/<ip>` | 解除 IP 封禁 |
| `GET` | `/api/admin/security-config` | 查询安全配置 |
| `PUT` | `/api/admin/security-config` | 更新安全配置 |
| `GET` | `/api/admin/sub-admins` | 查询子管理员 |
| `POST` | `/api/admin/sub-admins` | 创建子管理员 |
| `PUT` | `/api/admin/sub-admins/<sub_admin_id>` | 更新子管理员 |
| `DELETE` | `/api/admin/sub-admins/<sub_admin_id>` | 删除子管理员 |

## 已移除或不兼容

- 旧测试发信 API 已删除，服务不提供写信、回复、转发或测试发信能力；
- 未使用且允许请求指定文件路径的旧迁移、导出 API 已删除；
- `/api/create_mailbox_v2` 已移除且未注册，请求返回 `404`；
- 无调用方且会批量返回访问令牌的 `/api/user_login` 已移除，请求返回 `404`；
- 会直接改写 `.env` 的旧 `/api/admin/whitelist` 与 `/api/admin/test_ip` 已移除；
- `/mailbox` 旧 token 页面链接不兼容；
- `/admin/mailboxes` 旧管理页面入口不兼容。

Maildrop 的 SMTP 组件只负责接收邮件并写入存储，不承担站内出站邮件发送。
