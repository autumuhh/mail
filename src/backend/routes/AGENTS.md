# 路由知识库

**Generated:** 2026-01-25
**Commit:** e22c636
**Branch:** master

## 概览
路由层分为页面路由与 API 路由，统一通过 Blueprint 注册。

## 去哪里找
| 任务 | 位置 | 说明 |
| --- | --- | --- |
| 页面渲染 | src/backend/routes/pages.py | 管理端与邮箱页面 |
| 用户 API | src/backend/routes/api.py | `/api/*` 接口 |
| 管理 API | src/backend/routes/admin_api.py | `/api/admin/*` 接口 |

## 约定
- 用户 API Blueprint：`/api` 前缀。
- 管理 API Blueprint：`/api/admin` 前缀。
- 管理接口鉴权严格使用 `Authorization: Bearer <PASSWORD>`；未配置 `PASSWORD` 时保持关闭。
- 页面路由固定为：`/` 与 `/web` 登录、`/web/<邮箱>----<密钥>` 收件、`/admin` 管理后台。
- 邮箱地址与密钥通过 `POST /api/get_mailbox_token` 换取访问令牌；邮箱 API 仅接受 `Authorization: Bearer <access_token>`。
- 对外接口统一先做 IP 白名单检查。

## 反模式
- 不要恢复 `/api/create_mailbox_v2`（已移除且未注册）。
- 不要恢复会批量泄露访问令牌的旧 `/api/user_login`。
- 不要恢复直接改写 `.env` 的旧 `/api/admin/whitelist` 与 `/api/admin/test_ip`。
- 不要恢复 `/mailbox`、`/admin/mailboxes` 或测试发信 API。
- 不要绕过管理员鉴权或 IP 白名单。
- 若新增接口，避免与 `/api` 和 `/api/admin` 既有命名冲突。
