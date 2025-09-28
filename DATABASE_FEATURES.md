# TempMail 数据库功能说明

## 概述

TempMail 现在支持使用 SQLite 数据库存储邮箱和邮件数据，提供更好的性能、数据完整性和高级功能。

## 新功能特性

### 🗄️ 数据库存储
- 使用 SQLite 数据库替代 JSON 文件存储
- 更好的数据完整性和并发处理
- 支持复杂查询和统计
- 自动索引优化查询性能

### 🔑 邮箱访问令牌
- 每个邮箱自动生成唯一的 UUID 访问令牌
- 支持通过令牌访问邮箱，无需暴露邮箱地址
- 增强安全性和隐私保护

### ⏰ 自定义创建时间
- 支持在创建邮箱时指定自定义创建时间
- 便于数据迁移和测试场景
- 自动计算过期时间

### 📊 增强的邮箱信息
- 邮件统计（总数、未读数）
- 最后邮件时间
- 邮箱状态（活跃/过期）
- 访问记录

## 原有 API 接口（保持不变）

### 1. 获取随机邮箱地址
```http
GET /get_random_address
```

**响应示例：**
```json
{
  "address": "abc123def456@localhost",
  "available_domains": ["localhost", "test.local"]
}
```

### 2. 创建邮箱（原版）
```http
POST /create_mailbox
Content-Type: application/json

{
  "address": "myemail",                    // 可选：自定义邮箱前缀
  "sender_whitelist": ["@gmail.com"],      // 可选：发件人白名单
  "retention_days": 7                      // 可选：保留天数
}
```

**响应示例：**
```json
{
  "address": "myemail@localhost",
  "created_at": 1640995200,
  "expires_at": 1641600000,
  "sender_whitelist": ["@gmail.com"],
  "retention_days": 7,
  "message": "Mailbox created successfully"
}
```

### 3. 获取邮箱邮件
```http
GET /get_inbox?address=myemail@localhost
```

**响应示例：**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "From": "sender@example.com",
    "To": "myemail@localhost",
    "Subject": "测试邮件",
    "Timestamp": 1640995200,
    "Sent": "Jan 01 at 12:00:00",
    "Body": "邮件内容...",
    "ContentType": "Text"
  }
]
```

### 4. 获取单个邮件
```http
GET /get_email?address=myemail@localhost&id=EMAIL_ID
```

### 5. 获取邮箱信息（原版）
```http
GET /mailbox_info?address=myemail@localhost
```

**响应示例：**
```json
{
  "address": "myemail@localhost",
  "created_at": 1640995200,
  "expires_at": 1641600000,
  "sender_whitelist": ["@gmail.com"],
  "email_count": 5,
  "is_expired": false
}
```

### 6. 获取域名
```http
GET /get_domain
```

### 7. 发送测试邮件
```http
POST /send_test_email
Content-Type: application/json

{
  "to": "myemail@localhost",
  "from": "sender@example.com",
  "subject": "测试邮件",
  "body": "邮件内容"
}
```

### 8. 管理员登录
```http
POST /admin_login
Content-Type: application/json

{
  "password": "admin123"
}
```

### 9. 检查管理员状态
```http
GET /admin_check
```

### 10. 管理员添加发件人白名单
```http
POST /admin_add_sender
Content-Type: application/json

{
  "address": "myemail@localhost",
  "sender": "@gmail.com"
}
```

### 11. 管理员移除发件人白名单
```http
POST /admin_remove_sender
Content-Type: application/json

{
  "address": "myemail@localhost",
  "sender": "@gmail.com"
}
```

### 12. 管理员延长邮箱
```http
POST /admin_extend_mailbox
Content-Type: application/json

{
  "address": "myemail@localhost",
  "days": 7
}
```

### 13. 管理员删除邮箱
```http
POST /admin_delete_mailbox
Content-Type: application/json

{
  "address": "myemail@localhost"
}
```

### 14. 清理过期数据
```http
POST /cleanup_expired
```

### 15. 获取邮箱统计
```http
GET /get_stats
```

**响应示例：**
```json
{
  "total_mailboxes": 10,
  "active_mailboxes": 8,
  "expired_mailboxes": 2,
  "total_emails": 25,
  "storage_type": "json"
}
```

## API 接口对比

### 功能对比表

| 功能 | 原有接口 | 新增V2接口 | 主要区别 |
|------|----------|------------|----------|
| 创建邮箱 | `POST /create_mailbox` | `POST /create_mailbox_v2` | V2支持UUID令牌、自定义时间、数据库存储 |
| 获取邮箱信息 | `GET /mailbox_info` | `GET /mailbox_info_v2` | V2支持令牌访问、更详细统计信息 |
| 数据存储 | JSON文件 | SQLite数据库 | 数据库提供更好性能和完整性 |
| 访问方式 | 仅邮箱地址 | 地址 + UUID令牌 | 令牌提供更好的安全性 |
| 时间参数 | 固定当前时间 | 支持自定义创建时间 | 便于数据迁移和测试 |
| 数据迁移 | 无 | `POST /migrate_to_database` | 平滑迁移JSON到数据库 |
| 数据导出 | 无 | `POST /export_from_database` | 数据库导出为JSON备份 |

### 兼容性说明

- ✅ **完全向后兼容**: 所有原有接口保持不变
- ✅ **平滑升级**: 可以逐步迁移到V2接口
- ✅ **数据互通**: JSON和数据库数据可以相互转换
- ✅ **配置切换**: 通过 `USE_DATABASE` 配置选择存储方式

## 新增 API 接口（V2版本）

### 1. 创建邮箱 V2
```http
POST /create_mailbox_v2
Content-Type: application/json

{
  "address": "myemail",                    // 可选：自定义邮箱前缀
  "sender_whitelist": ["@gmail.com"],      // 可选：发件人白名单
  "retention_days": 7,                     // 可选：保留天数
  "created_at": 1640995200                 // 可选：自定义创建时间戳
}
```

**响应示例：**
```json
{
  "success": true,
  "address": "myemail@localhost",
  "mailbox_id": "550e8400-e29b-41d4-a716-446655440000",
  "mailbox_key": "abc12345-def6-7890-ghij-klmnopqrstuv",
  "created_at": 1640995200,
  "expires_at": 1641600000,
  "sender_whitelist": ["@gmail.com"],
  "retention_days": 7,
  "available_domains": ["localhost", "test.local"],
  "storage_type": "database",
  "message": "Mailbox created successfully. Please save your mailbox key securely."
}
```

⚠️ **重要**: 请妥善保存 `mailbox_key`，这是访问邮箱的唯一凭证！

### 2. 获取邮箱访问令牌
```http
POST /get_mailbox_token
Content-Type: application/json

{
  "address": "myemail@localhost",
  "mailbox_key": "abc12345-def6-7890-ghij-klmnopqrstuv"
}
```

**响应示例：**
```json
{
  "success": true,
  "address": "myemail@localhost",
  "access_token": "123e4567-e89b-12d3-a456-426614174000",
  "mailbox_id": "550e8400-e29b-41d4-a716-446655440000",
  "expires_at": 1641600000,
  "message": "Access token retrieved successfully"
}
```

### 3. 获取邮箱信息 V2
```http
# 通过访问令牌
GET /mailbox_info_v2?token=123e4567-e89b-12d3-a456-426614174000

# 通过邮箱地址
GET /mailbox_info_v2?address=myemail@localhost
```

**响应示例：**
```json
{
  "success": true,
  "mailbox": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "address": "myemail@localhost",
    "access_token": "123e4567-e89b-12d3-a456-426614174000",
    "created_at": 1640995200,
    "expires_at": 1641600000,
    "retention_days": 7,
    "sender_whitelist": ["@gmail.com"],
    "is_expired": false,
    "email_count": 5,
    "unread_count": 2,
    "last_email_time": 1641000000
  },
  "storage_type": "database"
}
```

### 3. 数据迁移
```http
POST /migrate_to_database
Content-Type: application/json

{
  "json_file_path": "inbox.json"  // 可选：指定JSON文件路径
}
```

### 4. 数据导出
```http
POST /export_from_database
Content-Type: application/json

{
  "output_file_path": "backup.json"  // 可选：指定输出文件路径
}
```

## 配置说明

### 环境变量
```bash
# 启用数据库存储
USE_DATABASE=true

# 数据库文件路径
DATABASE_PATH=data/mailbox.db

# 支持多域名（逗号分隔）
DOMAINS=localhost,test.local,example.com
```

### 配置文件
- `.env.development` - 开发环境配置
- `.env.production` - 生产环境配置

## 数据迁移

### 自动迁移
使用迁移脚本将现有 JSON 数据迁移到数据库：

```bash
python migrate_to_database.py
```

### 手动迁移
通过 API 接口迁移：

```bash
curl -X POST http://localhost:5000/migrate_to_database
```

## 数据库结构

### 邮箱表 (mailboxes)
- `id` - 邮箱唯一标识符 (UUID)
- `address` - 邮箱地址
- `created_at` - 创建时间戳
- `expires_at` - 过期时间戳
- `retention_days` - 保留天数
- `sender_whitelist` - 发件人白名单 (JSON)
- `access_token` - 访问令牌 (UUID)
- `created_by_ip` - 创建者IP
- `last_accessed` - 最后访问时间

### 邮件表 (emails)
- `id` - 邮件唯一标识符 (UUID)
- `mailbox_id` - 所属邮箱ID
- `from_address` - 发件人地址
- `to_address` - 收件人地址
- `subject` - 邮件主题
- `body` - 邮件正文
- `timestamp` - 接收时间戳
- `is_read` - 是否已读

## 测试工具

### API 测试脚本
```bash
python test_database_api.py
```

### 数据库信息查看
```bash
python migrate_to_database.py info
```

## 兼容性

- ✅ 保持与现有 JSON API 的完全兼容
- ✅ 支持平滑迁移，无需停机
- ✅ 自动数据格式转换
- ✅ 向后兼容的 API 响应格式

## 性能优化

- 数据库索引优化查询性能
- 自动清理过期数据
- 连接池管理
- 批量操作支持

## 安全增强

- UUID 访问令牌
- IP 地址记录
- 访问时间跟踪
- 数据完整性约束

## 故障排除

### 常见问题

1. **数据库文件权限错误**
   ```bash
   chmod 666 data/mailbox.db
   ```

2. **迁移失败**
   - 检查 JSON 文件格式
   - 确保数据库目录可写
   - 查看错误日志

3. **API 返回 400 错误**
   - 确保 `USE_DATABASE=true`
   - 检查数据库文件是否存在

### 日志调试
启用详细日志：
```bash
export FLASK_DEBUG=true
```

## 升级指南

1. 备份现有数据
2. 更新配置文件
3. 运行迁移脚本
4. 测试新功能
5. 更新客户端代码使用新 API
