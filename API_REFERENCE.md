# TempMail API 参考文档

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

### 用户管理接口

#### 5. 创建临时邮箱
```http
POST /register
Content-Type: application/json

{
  "email": "myemail@example.com",   // 必需：完整邮箱地址或邮箱前缀
  "retention_days": 7               // 可选：保留天数（1-30天，默认7天）
}
```

**输入说明：**
- **完整邮箱**：`myemail@example.com`（系统将使用您指定的域名）
- **仅前缀**：`myemail`（系统将自动从可用域名中随机分配一个）

**响应**:
```json
{
  "success": true,
  "mailbox_created": true,
  "mailbox_address": "myemail@example.com",
  "access_token": "access-token-12345",
  "created_at": 1640995200,
  "expires_at": 1641600000,
  "retention_days": 7,
  "message": "Temporary mailbox created successfully"
}
```

#### 6. 用户登录
```http
POST /user_login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**响应**:
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "created_at": 1640995200,
    "last_login": 1640995200
  },
  "mailboxes": [
    {
      "id": "mailbox-id-1",
      "address": "user@example.com",
      "access_token": "access-token-12345",
      "created_at": 1640995200,
      "expires_at": 1641600000,
      "retention_days": 7,
      "sender_whitelist": ["@gmail.com"],
      "whitelist_enabled": false,
      "is_active": true,
      "email_count": 5,
      "unread_count": 2,
      "last_email_time": 1641000000
    }
  ],
  "message": "Login successful. You have 1 active mailboxes."
}
```

### 邮件获取接口

#### 7. 获取邮箱邮件列表
```http
GET /get_inbox?address={邮箱地址}
```

**功能描述：**
获取指定邮箱地址的所有邮件列表。该接口实现了 `get_inbox_emails` 函数的核心功能，包括邮箱验证、过期检查、访问时间更新等完整流程。

**请求参数：**
| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| `address` | string | 是 | 邮箱地址，例如：`user@example.com` |

**请求头（可选）：**
| 头名称 | 值 | 描述 |
|--------|-----|------|
| `Authorization` | 管理员密码 | 访问受保护邮箱时需要提供管理员密码 |

**响应格式：**

**成功响应（HTTP 200）：**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "From": "sender@example.com",
    "To": "user@example.com",
    "Subject": "邮件标题",
    "Body": "邮件正文内容",
    "ContentType": "text/plain",
    "Timestamp": 1640995200,
    "Sent": "1小时前",
    "is_read": false,
    "attachments": [],
    "headers": {
      "Message-ID": "<msg-123@example.com>",
      "Date": "Mon, 01 Jan 2024 12:00:00 +0800"
    }
  }
]
```

**邮箱不存在或无邮件时（HTTP 200）：**
```json
[]
```

**错误响应：**

**邮箱已过期（HTTP 410）：**
```json
{
  "error": "Mailbox expired"
}
```

**IP未在白名单中（HTTP 403）：**
```json
{
  "error": "Access denied - IP not whitelisted"
}
```

**未授权访问受保护邮箱（HTTP 401）：**
```json
{
  "error": "Unauthorized"
}
```

**服务器内部错误（HTTP 500）：**
```json
{
  "error": "Failed to get inbox"
}
```

**接口逻辑：**
1. **IP白名单检查**：验证请求IP是否在允许列表中
2. **邮箱存在性验证**：检查邮箱是否在系统中存在
3. **过期状态检查**：验证邮箱是否已过期
4. **激活状态检查**：确认邮箱是否处于激活状态
5. **访问时间更新**：更新邮箱的最后访问时间戳
6. **邮件数量限制**：根据配置限制返回的邮件数量
7. **邮件列表返回**：返回符合条件的邮件列表

**支持的存储模式：**
- **数据库模式**：使用数据库存储邮箱和邮件数据
- **JSON文件模式**：使用JSON文件存储（兼容旧版本）

**注意事项：**
- 该接口会自动更新邮箱的访问时间
- 邮件按时间倒序排列（最新的在前）
- 最大返回邮件数量受 `config.MAX_EMAILS_PER_ADDRESS` 配置限制
- 受保护邮箱需要提供管理员密码才能访问

#### 8. 标记邮件为已读
```http
POST /mark_email_read
Content-Type: application/json

{
  "email_id": "550e8400-e29b-41d4-a716-446655440000",
  "is_read": true
}
```

**响应**:
```json
{
  "success": true,
  "message": "Email status updated"
}
```

#### 8. 删除单个邮件
```http
POST /delete_email
Content-Type: application/json

{
  "email_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Email deleted"
}
```

#### 9. 批量删除邮件
```http
POST /delete_emails_batch
Content-Type: application/json

{
  "email_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ]
}
```

**响应**:
```json
{
  "success": true,
  "message": "Deleted 2 emails"
}
```

#### 10. 标记所有邮件为已读
```http
POST /mark_all_read
Content-Type: application/json

{
  "address": "user@example.com"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Marked 3 emails as read"
}
```

### 白名单管理接口

#### 11. 添加发件人白名单
```http
POST /add_sender_whitelist
Content-Type: application/json

{
  "address": "user@example.com",
  "sender": "@gmail.com"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Sender added to whitelist"
}
```

#### 12. 移除发件人白名单
```http
POST /remove_sender_whitelist
Content-Type: application/json

{
  "address": "user@example.com",
  "sender": "@gmail.com"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Sender removed from whitelist"
}
```

#### 13. 切换白名单启用状态
```http
POST /toggle_whitelist
Content-Type: application/json

{
  "address": "user@example.com",
  "enabled": true
}
```

**响应**:
```json
{
  "success": true,
  "whitelist_enabled": true,
  "whitelist": ["@gmail.com", "boss@company.com"],
  "message": "Whitelist enabled successfully"
}
```

### 邮箱管理接口

#### 14. 更新邮箱保留时间
```http
POST /update_retention
Content-Type: application/json

{
  "address": "user@example.com",
  "retention_days": 14
}
```

**响应**:
```json
{
  "success": true,
  "message": "Retention period updated"
}
```

#### 15. 重新生成邮箱密钥
```http
POST /regenerate_mailbox_key
Content-Type: application/json

{
  "address": "user@example.com",
  "current_key": "old-mailbox-key-12345"
}
```

**响应**:
```json
{
  "success": true,
  "new_key": "new-mailbox-key-67890",
  "message": "Mailbox key regenerated"
}
```

#### 16. 切换邮箱状态
```http
POST /toggle_mailbox_status
Content-Type: application/json

{
  "address": "user@example.com"
}
```

**响应**:
```json
{
  "success": true,
  "is_active": false,
  "message": "Mailbox disabled successfully"
}
```

### 演示接口

#### 17. 演示模式获取令牌
```http
POST /demo/get_token
```

**响应**:
```json
{
  "success": true,
  "address": "demo@localhost",
  "access_token": "demo-token-12345",
  "mailbox_id": "demo-mailbox-id",
  "expires_at": 1641600000,
  "message": "演示模式访问令牌"
}
```

#### 18. 演示模式获取邮箱信息
```http
GET /demo/mailbox_info
```

**响应**:
```json
{
  "success": true,
  "mailbox": {
    "id": "demo-mailbox-id",
    "address": "demo@localhost",
    "created_at": 1640995200,
    "expires_at": 1641600000,
    "retention_days": 7,
    "sender_whitelist": ["@gmail.com", "@outlook.com"],
    "whitelist_enabled": false,
    "is_active": true,
    "email_count": 5,
    "unread_count": 2,
    "last_email_time": 1641000000
  }
}
```

#### 19. 演示模式获取邮件列表
```http
GET /demo/emails
```

**响应**:
```json
[
  {
    "id": "demo-email-1",
    "From": "welcome@example.com",
    "To": "demo@localhost",
    "Subject": "欢迎使用临时邮箱服务！",
    "Body": "感谢您使用我们的临时邮箱服务...",
    "ContentType": "text/plain",
    "Timestamp": 1640995200,
    "Sent": "1小时前",
    "is_read": false
  }
]
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

### 详细错误码说明

#### HTTP状态码

| 状态码 | 名称 | 描述 | 常见场景 |
|--------|------|------|----------|
| `200` | OK | 请求成功 | 所有成功响应，包括空邮件列表 |
| `201` | Created | 资源创建成功 | 创建邮箱、注册用户 |
| `400` | Bad Request | 请求参数错误 | 参数缺失、格式错误、验证失败 |
| `401` | Unauthorized | 未授权访问 | 管理员密码错误、邮箱密钥无效 |
| `403` | Forbidden | 访问被拒绝 | IP不在白名单中 |
| `404` | Not Found | 资源不存在 | 邮箱或邮件不存在 |
| `409` | Conflict | 资源冲突 | 邮箱已存在、用户名重复 |
| `410` | Gone | 资源已过期 | 邮箱已过期（get_inbox_emails函数的核心检查） |
| `422` | Unprocessable Entity | 无法处理的实体 | 数据验证失败、业务规则违规 |
| `500` | Internal Server Error | 服务器内部错误 | 数据库连接失败、文件操作错误 |

#### get_inbox_emails函数专用错误码

| 错误场景 | HTTP状态码 | 错误信息 | 解决建议 |
|----------|------------|----------|----------|
| 邮箱地址为空 | 400 | "No address provided" | 提供有效的邮箱地址参数 |
| 邮箱不存在 | 200 | 返回空数组 `[]` | 检查邮箱地址是否正确 |
| 邮箱已过期 | 410 | "Mailbox expired" | 延长邮箱有效期或创建新邮箱 |
| 邮箱未激活 | 200 | 返回空数组 `[]` | 激活邮箱或检查邮箱状态 |
| IP未在白名单 | 403 | "Access denied - IP not whitelisted" | 添加IP到白名单或联系管理员 |
| 数据库连接失败 | 500 | "Failed to get inbox" | 检查数据库配置和连接 |
| 访问受保护邮箱 | 401 | "Unauthorized" | 提供管理员密码访问受保护邮箱 |

#### 业务错误码

| 错误码 | 描述 | 解决建议 |
|--------|------|----------|
| `INVALID_PARAMETER` | 请求参数无效 | 检查参数格式和类型 |
| `MISSING_PARAMETER` | 缺少必需参数 | 补充必需的参数字段 |
| `MAILBOX_NOT_FOUND` | 邮箱不存在 | 检查邮箱地址是否正确 |
| `MAILBOX_EXPIRED` | 邮箱已过期 | 延长邮箱有效期或创建新邮箱 |
| `MAILBOX_ALREADY_EXISTS` | 邮箱已存在 | 使用不同的邮箱地址 |
| `INVALID_EMAIL_FORMAT` | 邮箱格式无效 | 检查邮箱地址格式 |
| `INVALID_RETENTION_DAYS` | 保留天数无效 | 保留天数必须在1-30之间 |
| `INVALID_EMAIL` | 邮箱格式无效 | 检查邮箱地址格式 |
| `INVALID_CREDENTIALS` | 凭据无效 | 检查邮箱和密码 |
| `INVALID_MAILBOX_KEY` | 邮箱密钥无效 | 检查邮箱密钥是否正确 |
| `WHITELIST_VIOLATION` | 白名单违规 | 检查发件人是否在白名单中 |
| `DATABASE_ERROR` | 数据库错误 | 检查数据库连接和配置 |
| `FILE_OPERATION_ERROR` | 文件操作错误 | 检查文件权限和路径 |
| `IP_NOT_WHITELISTED` | IP不在白名单中 | 添加IP到白名单或联系管理员 |
| `ADMIN_AUTH_REQUIRED` | 需要管理员权限 | 提供管理员密码 |
| `STORAGE_NOT_ENABLED` | 存储功能未启用 | 检查配置文件中的存储设置 |
| `MIGRATION_FAILED` | 数据迁移失败 | 检查数据格式和目标存储 |
| `EXPORT_FAILED` | 数据导出失败 | 检查输出路径和权限 |

#### 错误响应示例

```json
// 参数错误
{
  "success": false,
  "error": "INVALID_PARAMETER",
  "message": "sender_whitelist must be an array"
}

// 邮箱不存在
{
  "success": false,
  "error": "MAILBOX_NOT_FOUND",
  "message": "Mailbox not found"
}

// 权限错误
{
  "success": false,
  "error": "IP_NOT_WHITELISTED",
  "message": "Access denied - IP not whitelisted"
}

// 数据库错误
{
  "success": false,
  "error": "DATABASE_ERROR",
  "message": "Failed to connect to database"
}

// 保留天数错误
{
  "success": false,
  "error": "INVALID_RETENTION_DAYS",
  "message": "Retention days must be between 1 and 30"
}

// 邮箱格式错误
{
  "success": false,
  "error": "INVALID_EMAIL_FORMAT",
  "message": "Invalid email address format"
}
```

## 使用示例

### cURL 示例

```bash
# 创建临时邮箱（保留14天）
# 方式1：指定完整邮箱地址
curl -X POST http://localhost:5000/register \
  -H "Content-Type: application/json" \
  -d '{"email":"myemail@example.com","retention_days":14}'

# 方式2：只输入前缀，系统自动分配域名
curl -X POST http://localhost:5000/register \
  -H "Content-Type: application/json" \
  -d '{"email":"myemail","retention_days":14}'

# 获取邮箱信息
curl "http://localhost:5000/mailbox_info_v2?address=test123@localhost"

# 获取邮件列表（核心接口）
curl "http://localhost:5000/get_inbox?address=test123@localhost"

# 获取受保护邮箱的邮件（需要管理员密码）
curl -H "Authorization: admin_password" \
  "http://localhost:5000/get_inbox?address=protected@localhost"

# 批量获取多个邮箱的邮件
curl "http://localhost:5000/get_inbox?address=user1@example.com" > user1_emails.json
curl "http://localhost:5000/get_inbox?address=user2@example.com" > user2_emails.json
```

### JavaScript 示例

```javascript
// 创建临时邮箱（保留14天）
// 方式1：指定完整邮箱地址
const response = await fetch('/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'myemail@example.com',
    retention_days: 14
  })
});
const mailbox = await response.json();

// 获取邮箱信息
const infoResponse = await fetch(`/mailbox_info_v2?token=${mailbox.access_token}`);
const info = await infoResponse.json();

// 获取邮件列表 - get_inbox_emails函数的核心API
async function getInboxEmails(address) {
  try {
    const response = await fetch(`/get_inbox?address=${encodeURIComponent(address)}`);

    if (response.status === 200) {
      const emails = await response.json();
      console.log(`获取到 ${emails.length} 封邮件`);

      // 处理邮件列表
      emails.forEach(email => {
        console.log(`邮件ID: ${email.id}`);
        console.log(`发件人: ${email.From}`);
        console.log(`主题: ${email.Subject}`);
        console.log(`时间: ${email.Sent}`);
        console.log(`已读: ${email.is_read ? '是' : '否'}`);
        console.log('---');
      });

      return emails;
    } else if (response.status === 410) {
      console.error('邮箱已过期');
      return [];
    } else {
      const error = await response.json();
      console.error('获取邮件失败:', error.error);
      return [];
    }
  } catch (error) {
    console.error('网络错误:', error);
    return [];
  }
}

// 使用示例
await getInboxEmails('myemail@example.com');
```

### 完整工作流程示例

```javascript
class TempMailManager {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.mailbox = null;
        this.token = null;
    }

    // 1. 创建临时邮箱
    async createMailbox(emailInput, retentionDays = 7) {
        try {
            const response = await fetch(`${this.baseUrl}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: emailInput,
                    retention_days: retentionDays
                })
            });

            const result = await response.json();
            if (result.success) {
                this.mailbox = result;
                this.token = result.access_token;
                console.log(`临时邮箱创建成功: ${result.mailbox_address} (保留${result.retention_days}天)`);
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('创建邮箱失败:', error.message);
            throw error;
        }
    }

    // 2. 获取邮箱信息
    async getMailboxInfo() {
        if (!this.token) throw new Error('未设置访问令牌');

        const response = await fetch(
            `${this.baseUrl}/mailbox_info_v2?token=${this.token}`
        );
        return await response.json();
    }

    // 3. 获取邮件列表 - 基于get_inbox_emails函数的完整实现
    async getEmails() {
        if (!this.mailbox) throw new Error('未设置邮箱');

        try {
            const response = await fetch(
                `${this.baseUrl}/get_inbox?address=${encodeURIComponent(this.mailbox.mailbox_address)}`
            );

            if (response.status === 200) {
                const emails = await response.json();
                console.log(`成功获取 ${emails.length} 封邮件`);
                return emails;
            } else if (response.status === 410) {
                throw new Error('邮箱已过期');
            } else if (response.status === 403) {
                throw new Error('IP访问被拒绝，请检查IP白名单设置');
            } else if (response.status === 401) {
                throw new Error('未授权访问，可能是受保护邮箱需要管理员密码');
            } else {
                const error = await response.json();
                throw new Error(`获取邮件失败: ${error.error}`);
            }
        } catch (error) {
            if (error.message.includes('fetch')) {
                console.error('网络连接错误:', error.message);
            } else {
                console.error('获取邮件时发生错误:', error.message);
            }
            throw error;
        }
    }

    // 4. 智能邮件轮询 - 自动处理邮箱过期等异常情况
    async waitForEmails(maxAttempts = 60, intervalSeconds = 5) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`第 ${attempt}/${maxAttempts} 次检查邮件...`);
                const emails = await this.getEmails();

                if (emails.length > 0) {
                    console.log(`发现 ${emails.length} 封新邮件！`);
                    return emails;
                }

                if (attempt < maxAttempts) {
                    console.log(`${intervalSeconds}秒后进行下次检查...`);
                    await this.sleep(intervalSeconds * 1000);
                }
            } catch (error) {
                if (error.message.includes('过期')) {
                    console.error('邮箱已过期，需要创建新邮箱');
                    break;
                } else if (error.message.includes('IP访问被拒绝')) {
                    console.error('IP访问被拒绝，请联系管理员添加IP到白名单');
                    break;
                } else {
                    console.error(`第 ${attempt} 次检查失败:`, error.message);
                    if (attempt < maxAttempts) {
                        await this.sleep(intervalSeconds * 1000);
                    }
                }
            }
        }
        throw new Error('邮件检查超时或遇到不可恢复的错误');
    }

    // 4. 轮询检查新邮件
    async waitForEmails(maxWaitTime = 300000, checkInterval = 5000) {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            try {
                const emails = await this.getEmails();
                if (emails.length > 0) {
                    console.log(`发现 ${emails.length} 封邮件`);
                    return emails;
                }
                console.log('等待新邮件...');
                await this.sleep(checkInterval);
            } catch (error) {
                console.error('检查邮件失败:', error);
                await this.sleep(checkInterval);
            }
        }
        throw new Error('等待超时');
    }

    // 5. 管理邮件
    async markAsRead(emailId) {
        const response = await fetch(`${this.baseUrl}/mark_email_read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email_id: emailId, is_read: true })
        });
        return await response.json();
    }

    async deleteEmail(emailId) {
        const response = await fetch(`${this.baseUrl}/delete_email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email_id: emailId })
        });
        return await response.json();
    }

    // 6. 管理白名单
    async addToWhitelist(sender) {
        if (!this.mailbox) throw new Error('未设置邮箱');

        const response = await fetch(`${this.baseUrl}/add_sender_whitelist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: this.mailbox.mailbox_address,
                sender: sender
            })
        });
        return await response.json();
    }

    // 5. 邮件处理和过滤
    async processEmails(filterUnread = false) {
        try {
            const emails = await this.getEmails();

            if (filterUnread) {
                const unreadEmails = emails.filter(email => !email.is_read);
                console.log(`找到 ${unreadEmails.length} 封未读邮件`);
                return unreadEmails;
            }

            return emails;
        } catch (error) {
            console.error('处理邮件时发生错误:', error.message);
            throw error;
        }
    }

    // 6. 批量操作示例
    async batchProcessMailboxes(addresses) {
        const results = {};

        for (const address of addresses) {
            try {
                console.log(`正在处理邮箱: ${address}`);
                const emails = await this.getEmailsByAddress(address);
                results[address] = {
                    success: true,
                    emailCount: emails.length,
                    emails: emails
                };
            } catch (error) {
                console.error(`处理邮箱 ${address} 失败:`, error.message);
                results[address] = {
                    success: false,
                    error: error.message
                };
            }
        }

        return results;
    }

    // 辅助方法
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 使用示例
async function example() {
    const manager = new TempMailManager('http://localhost:5000');

    try {
        // 创建临时邮箱（保留14天）
        // 方式1：指定完整邮箱地址
        await manager.createMailbox('myemail@example.com', 14);

        // 方式2：只输入前缀，系统自动分配域名
        await manager.createMailbox('myemail', 14);

        // 添加更多白名单
        await manager.addToWhitelist('notifications@github.com');

        // 等待邮件（5分钟超时）
        console.log('等待接收邮件...');
        const emails = await manager.waitForEmails(300000);

        // 处理邮件
        for (const email of emails) {
            console.log(`邮件: ${email.Subject} 来自 ${email.From}`);

            // 标记为已读
            await manager.markAsRead(email.id);
        }

        console.log('邮件处理完成');

    } catch (error) {
        console.error('操作失败:', error.message);
    }
}

// 专门演示get_inbox_emails函数的完整使用流程
async function demonstrateGetInboxEmails() {
    console.log('=== get_inbox_emails函数使用演示 ===\n');

    try {
        // 1. 创建测试邮箱
        console.log('1. 创建测试邮箱...');
        const createResponse = await fetch('http://localhost:5000/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@example.com',
                retention_days: 7
            })
        });

        const mailbox = await createResponse.json();
        if (!mailbox.success) {
            throw new Error(`创建邮箱失败: ${mailbox.error}`);
        }

        console.log(`✓ 邮箱创建成功: ${mailbox.mailbox_address}`);

        // 2. 立即获取邮件（应该为空）
        console.log('\n2. 立即获取邮件（预期为空）...');
        const emptyEmails = await getInboxEmails(mailbox.mailbox_address);
        console.log(`✓ 获取到 ${emptyEmails.length} 封邮件`);

        // 3. 模拟等待新邮件
        console.log('\n3. 等待新邮件中...');
        console.log('（在实际使用中，这里会等待真实的邮件发送）');

        // 4. 再次获取邮件
        console.log('\n4. 再次获取邮件...');
        const currentEmails = await getInboxEmails(mailbox.mailbox_address);
        console.log(`✓ 获取到 ${currentEmails.length} 封邮件`);

        // 5. 显示邮件详情
        if (currentEmails.length > 0) {
            console.log('\n5. 邮件详情:');
            currentEmails.forEach((email, index) => {
                console.log(`\n--- 邮件 ${index + 1} ---`);
                console.log(`ID: ${email.id}`);
                console.log(`发件人: ${email.From}`);
                console.log(`收件人: ${email.To}`);
                console.log(`主题: ${email.Subject}`);
                console.log(`时间: ${email.Sent}`);
                console.log(`已读: ${email.is_read ? '是' : '否'}`);
                console.log(`内容预览: ${email.Body.substring(0, 100)}...`);
            });
        }

        // 6. 错误处理演示
        console.log('\n6. 错误处理演示:');

        // 测试不存在的邮箱
        try {
            await getInboxEmails('nonexistent@example.com');
        } catch (error) {
            console.log(`✓ 不存在邮箱的处理: ${error.message}`);
        }

        // 测试已过期邮箱
        try {
            await getInboxEmails('expired@example.com');
        } catch (error) {
            console.log(`✓ 过期邮箱的处理: ${error.message}`);
        }

        console.log('\n=== 演示完成 ===');

    } catch (error) {
        console.error('演示过程中发生错误:', error.message);
    }
}

// 辅助函数：获取指定邮箱的邮件
async function getInboxEmails(address) {
    const response = await fetch(`http://localhost:5000/get_inbox?address=${encodeURIComponent(address)}`);

    if (response.status === 200) {
        return await response.json();
    } else if (response.status === 410) {
        throw new Error('邮箱已过期');
    } else if (response.status === 403) {
        throw new Error('IP访问被拒绝');
    } else if (response.status === 401) {
        throw new Error('未授权访问');
    } else {
        const error = await response.json();
        throw new Error(error.error || '获取邮件失败');
    }
}

// 运行演示
demonstrateGetInboxEmails();
```

### 用户注册和登录示例

```javascript
class UserManager {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.user = null;
        this.mailboxes = [];
    }

    // 创建临时邮箱
    async createMailbox(email) {
        const response = await fetch(`${this.baseUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email
            })
        });

        const result = await response.json();
        if (result.success) {
            console.log(`临时邮箱创建成功: ${result.mailbox_address}`);
            return result;
        } else {
            throw new Error(result.error);
        }
    }

    // 用户登录
    async login(email, password) {
        const response = await fetch(`${this.baseUrl}/user_login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const result = await response.json();
        if (result.success) {
            this.user = result.user;
            this.mailboxes = result.mailboxes;
            console.log(`登录成功，用户有 ${result.mailboxes.length} 个邮箱`);
            return result;
        } else {
            throw new Error(result.error);
        }
    }

    // 获取所有活跃邮箱
    getActiveMailboxes() {
        return this.mailboxes.filter(mb => mb.is_active && !mb.is_expired);
    }

    // 批量检查所有邮箱的邮件
    async checkAllMailboxes() {
        const results = {};
        const activeMailboxes = this.getActiveMailboxes();

        for (const mailbox of activeMailboxes) {
            try {
                const response = await fetch(
                    `${this.baseUrl}/get_inbox?address=${encodeURIComponent(mailbox.address)}`
                );
                const emails = await response.json();
                results[mailbox.address] = {
                    mailbox: mailbox,
                    emails: emails,
                    count: emails.length
                };
            } catch (error) {
                console.error(`检查邮箱 ${mailbox.address} 失败:`, error);
                results[mailbox.address] = {
                    error: error.message,
                    count: 0
                };
            }
        }

        return results;
    }
}

// 使用示例
async function userExample() {
    const userManager = new UserManager('http://localhost:5000');

    try {
        // 创建临时邮箱
        await userManager.createMailbox('test@example.com');

        // 重新登录（实际应用中应该保存token）
        await userManager.login('test@example.com', 'securepassword123');

        // 检查所有邮箱
        const results = await userManager.checkAllMailboxes();
        console.log('邮箱检查结果:', results);

    } catch (error) {
        console.error('用户操作失败:', error.message);
    }
}
```

### 演示模式示例

```javascript
// 演示模式使用
async function demoExample() {
    try {
        // 获取演示令牌
        const tokenResponse = await fetch('/demo/get_token', {
            method: 'POST'
        });
        const tokenData = await tokenResponse.json();

        if (tokenData.success) {
            // 获取演示邮箱信息
            const infoResponse = await fetch('/demo/mailbox_info');
            const infoData = await infoResponse.json();

            if (infoData.success) {
                console.log('演示邮箱信息:', infoData.mailbox);

                // 获取演示邮件
                const emailsResponse = await fetch('/demo/emails');
                const emails = await emailsResponse.json();

                console.log(`演示邮箱有 ${emails.length} 封邮件`);
                emails.forEach(email => {
                    console.log(`- ${email.Subject} 来自 ${email.From}`);
                });
            }
        }
    } catch (error) {
        console.error('演示模式错误:', error);
    }
}
```
