# 静态资源知识库

**Generated:** 2026-01-25
**Commit:** e22c636
**Branch:** master

## 概览
静态资源以原生 JS/CSS 为主，直接由模板加载。

## 去哪里找
| 任务 | 位置 | 说明 |
| --- | --- | --- |
| 邮箱登录 | src/frontend/static/scripts/mailbox_login.js | 邮箱地址 + 密钥登录 |
| 邮箱管理 | src/frontend/static/scripts/mailbox_manager.js | 用户收件箱界面 |
| 管理邮箱 | src/frontend/static/scripts/admin_mailbox.js | 邮箱列表与审计 |
| 注册流程 | src/frontend/static/scripts/register.js | 管理员验证与注册 |
| API 测试 | src/frontend/static/scripts/api_test.js | 邮箱密钥鉴权与只读查询调试 |
| 管理端主题 | src/frontend/static/scripts/theme.js | 管理页面主题切换 |

## 约定
- fetch 调用使用相对路径 `/api` 与 `/api/admin`。
- 主题等非敏感偏好按页面约定写入 `sessionStorage`；公开邮箱密钥不得写入 Web Storage，访问令牌只写入 `sessionStorage['maildrop_access_token']` 与运行时内存，不得写入 `localStorage`。
- 没有打包工具，不使用 import/require 进行模块化。
- 页面凭据链接统一使用 `/web/<编码邮箱>----<编码密钥>`，不得生成旧 token 查询链接。

## 反模式
- `/api/create_mailbox_v2` 已移除且未注册；不要恢复该接口或测试发信 API。
- 不要恢复已无路由引用的旧 `index.html`、`main.js`、`api.js`、`language.js` 与 `style.css`。
- 不要在脚本中硬编码域名，使用后端返回的 `available_domains`。
