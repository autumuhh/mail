# 后端知识库

**Generated:** 2026-01-25
**Commit:** e22c636
**Branch:** master

## 概览
后端包含 SMTP 接收、邮件解析、存储与 API 业务逻辑。

## 目录结构
```
src/backend/
├── flask_app.py          # Flask 应用与 Blueprint 注册
├── smtp_server.py        # SMTP 服务入口
├── email_parser.py       # 邮件解析为 JSON
├── inbox_handler.py      # JSON 存储处理
├── db_inbox_handler.py   # SQLite 存储处理
├── database.py           # 数据库管理与迁移
├── mailbox_service.py    # 管理端邮箱业务与审计
├── ip_blocker.py         # IP 封禁与频控
└── routes/               # API 路由
```

## 去哪里找
| 任务 | 位置 | 说明 |
| --- | --- | --- |
| SMTP 接收入口 | src/backend/smtp_server.py | aiosmtpd Controller |
| 邮件解析 | src/backend/email_parser.py | BytesParser + 头部解码 |
| JSON 存储 | src/backend/inbox_handler.py | inbox.json 读写 |
| SQLite 存储 | src/backend/db_inbox_handler.py | 通过 db_manager 操作 |
| 数据库结构 | src/backend/database.py | 表与迁移逻辑 |
| 管理端业务 | src/backend/mailbox_service.py | CRUD + 审计 |

## 约定
- `config.USE_DATABASE` 决定使用 SQLite 或 JSON 处理器。
- 邮件解析结果统一使用 `From/To/Subject/Body/Timestamp` 字段。
- IP 白名单检查在 SMTP 与 API 层都要做一次。
- 路由层为方便导入，部分文件会把 backend 目录加入 `sys.path`。

## 反模式
- 不要在数据库模式下直接写 `inbox.json`。
- 不要移除 IP 白名单与封禁检查。
- 不要在路由层静默吞掉异常，保持日志输出。
