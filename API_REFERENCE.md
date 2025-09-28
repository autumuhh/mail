# TempMail API 参考文档

## 概述

TempMail 提供两套API接口：
- **原有接口**: 基于JSON文件存储，保持完全兼容
- **V2接口**: 基于SQLite数据库，提供增强功能

## 基础信息

- **Base URL**: `http://localhost:5000`
- **Content-Type**: `application/json`
- **认证**: 管理员接口需要密码认证

## 原有 API 接口

### 邮箱管理

#### 1. 获取随机邮箱地址
```http
GET /get_random_address
```

**响应**:
```json
{
  "address": "abc123def456@localhost",
  "available_domains": ["localhost", "test.local"]
}
```

#### 2. 创建邮箱
```http
POST /create_mailbox
Content-Type: application/json

{
  "address": "myemail",                    // 可选：邮箱前缀
  "sender_whitelist": ["@gmail.com"],      // 可选：发件人白名单
  "retention_days": 7                      // 可选：保留天数
}
```

**响应**:
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

#### 3. 获取邮箱信息
```http
GET /mailbox_info?address=myemail@localhost
```

**响应**:
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

### 邮件管理

#### 4. 获取邮箱邮件
```http
GET /get_inbox?address=myemail@localhost
```

**响应**:
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

#### 5. 获取单个邮件
```http
GET /get_email?address=myemail@localhost&id=EMAIL_ID
```

#### 6. 发送测试邮件
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

### 系统接口

#### 7. 获取域名
```http
GET /get_domain
```

**响应**:
```json
{
  "domain": "localhost",
  "available_domains": ["localhost", "test.local"]
}
```

#### 8. 获取统计信息
```http
GET /get_stats
```

**响应**:
```json
{
  "total_mailboxes": 10,
  "active_mailboxes": 8,
  "expired_mailboxes": 2,
  "total_emails": 25,
  "storage_type": "json"
}
```

#### 9. 清理过期数据
```http
POST /cleanup_expired
```

### 管理员接口

#### 10. 管理员登录
```http
POST /admin_login
Content-Type: application/json

{
  "password": "admin123"
}
```

#### 11. 检查管理员状态
```http
GET /admin_check
```

#### 12. 添加发件人白名单
```http
POST /admin_add_sender
Content-Type: application/json

{
  "address": "myemail@localhost",
  "sender": "@gmail.com"
}
```

#### 13. 移除发件人白名单
```http
POST /admin_remove_sender
Content-Type: application/json

{
  "address": "myemail@localhost",
  "sender": "@gmail.com"
}
```

#### 14. 延长邮箱
```http
POST /admin_extend_mailbox
Content-Type: application/json

{
  "address": "myemail@localhost",
  "days": 7
}
```

#### 15. 删除邮箱
```http
POST /admin_delete_mailbox
Content-Type: application/json

{
  "address": "myemail@localhost"
}
```

## V2 API 接口（数据库版本）

### 邮箱管理 V2

#### 1. 创建邮箱 V2
```http
POST /create_mailbox_v2
Content-Type: application/json

{
  "address": "myemail",                    // 可选：邮箱前缀
  "sender_whitelist": ["@gmail.com"],      // 可选：发件人白名单
  "retention_days": 7,                     // 可选：保留天数
  "created_at": 1640995200                 // 可选：自定义创建时间戳
}
```

**响应**:
```json
{
  "success": true,
  "address": "myemail@localhost",
  "mailbox_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": 1640995200,
  "expires_at": 1641600000,
  "sender_whitelist": ["@gmail.com"],
  "retention_days": 7,
  "available_domains": ["localhost", "test.local"],
  "storage_type": "database",
  "message": "Mailbox created successfully"
}
```

#### 2. 获取邮箱访问令牌
```http
POST /get_mailbox_token
Content-Type: application/json

{
  "address": "myemail@localhost"
}
```

**响应**:
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

#### 3. 获取邮箱信息 V2
```http
# 通过访问令牌
GET /mailbox_info_v2?token=123e4567-e89b-12d3-a456-426614174000

# 通过邮箱地址
GET /mailbox_info_v2?address=myemail@localhost
```

**响应**:
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

### 数据管理 V2

#### 3. 数据迁移
```http
POST /migrate_to_database
Content-Type: application/json

{
  "json_file_path": "inbox.json"  // 可选：指定JSON文件路径
}
```

**响应**:
```json
{
  "success": true,
  "migrated_mailboxes": 10,
  "migrated_emails": 25,
  "errors": [],
  "message": "Migration completed successfully"
}
```

#### 4. 数据导出
```http
POST /export_from_database
Content-Type: application/json

{
  "output_file_path": "backup.json"  // 可选：指定输出文件路径
}
```

**响应**:
```json
{
  "success": true,
  "exported_mailboxes": 10,
  "exported_emails": 25,
  "output_file": "backup.json",
  "message": "Export completed successfully"
}
```

## 错误响应

所有接口在出错时返回统一格式：

```json
{
  "success": false,
  "error": "错误描述",
  "message": "详细错误信息"
}
```

常见HTTP状态码：
- `200` - 成功
- `201` - 创建成功
- `400` - 请求参数错误
- `401` - 未授权
- `403` - 访问被拒绝
- `404` - 资源不存在
- `500` - 服务器内部错误

## 使用示例

### cURL 示例

```bash
# 创建邮箱
curl -X POST http://localhost:5000/create_mailbox_v2 \
  -H "Content-Type: application/json" \
  -d '{"address":"test123","sender_whitelist":["@gmail.com"]}'

# 获取邮箱信息
curl "http://localhost:5000/mailbox_info_v2?address=test123@localhost"

# 获取邮件
curl "http://localhost:5000/get_inbox?address=test123@localhost"
```

### JavaScript 示例

```javascript
// 创建邮箱
const response = await fetch('/create_mailbox_v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: 'test123',
    sender_whitelist: ['@gmail.com'],
    retention_days: 7
  })
});
const mailbox = await response.json();

// 获取邮箱信息
const infoResponse = await fetch(`/mailbox_info_v2?token=${mailbox.access_token}`);
const info = await infoResponse.json();
```
