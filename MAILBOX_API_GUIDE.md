# 临时邮箱API使用指南

## 概述

本指南详细介绍临时邮箱系统的两个核心功能：
1. **创建邮箱** - 创建临时邮箱用于接收邮件
2. **接收邮件** - 获取邮箱中的邮件列表

这两个功能是临时邮箱系统的基础，涵盖了从邮箱创建到邮件接收的完整流程。

## 核心接口

### 1. 创建邮箱接口

#### 1.1 基础创建接口
```http
POST /create_mailbox
Content-Type: application/json

{
  "address": "myemail",                    // 可选：邮箱前缀
  "sender_whitelist": ["@gmail.com"],      // 可选：发件人白名单
  "retention_days": 7                      // 可选：保留天数
}
```

**功能特点：**
- 简单快速创建临时邮箱
- 支持自定义邮箱地址
- 支持发件人白名单设置
- 支持自定义保留时间

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

#### 1.2 高级创建接口（推荐）
```http
POST /create_mailbox_v2
Content-Type: application/json

{
  "address": "myemail",                    // 可选：邮箱前缀
  "sender_whitelist": ["@gmail.com"],      // 可选：发件人白名单
  "retention_days": 7,                     // 可选：保留天数（1-30）
  "created_at": 1640995200                 // 可选：自定义创建时间戳
}
```

**高级功能：**
- 支持数据库存储
- 提供邮箱密钥和访问令牌
- 支持UUID和时间戳管理
- 更安全和可扩展

**响应示例：**
```json
{
  "success": true,
  "address": "myemail@localhost",
  "mailbox_id": "550e8400-e29b-41d4-a716-446655440000",
  "mailbox_key": "mailbox-key-12345",
  "created_at": 1640995200,
  "expires_at": 1641600000,
  "sender_whitelist": ["@gmail.com"],
  "retention_days": 7,
  "available_domains": ["localhost", "test.local"],
  "storage_type": "database",
  "message": "Mailbox created successfully. Please save your mailbox key securely."
}
```

#### 1.3 用户注册接口
```http
POST /register
Content-Type: application/json

{
  "email": "myemail@example.com",          // 必需：完整邮箱地址或前缀
  "retention_days": 7                      // 可选：保留天数（1-30天）
}
```

**使用说明：**
- **完整邮箱**：`myemail@example.com`（使用指定域名）
- **仅前缀**：`myemail`（系统自动分配域名）

**响应示例：**
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

### 2. 接收邮件接口

#### 2.1 基础接收邮件接口
```http
GET /get_inbox?address={邮箱地址}
```

**功能特点：**
- 获取指定邮箱的所有邮件
- 自动更新访问时间
- 支持邮件数量限制
- 完整的状态验证流程

**响应格式：**

**成功响应（HTTP 200）：**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "From": "sender@example.com",
    "To": "myemail@example.com",
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

**错误响应：**

**邮箱已过期（HTTP 410）：**
```json
{
  "error": "Mailbox expired"
}
```

**IP受限（HTTP 403）：**
```json
{
  "error": "Access denied - IP not whitelisted"
}
```

## 完整使用流程

### 流程1：创建邮箱 → 接收邮件

```javascript
class TempMailClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.mailbox = null;
    }

    // 1. 创建临时邮箱
    async createMailbox(emailInput, retentionDays = 7) {
        const response = await fetch(`${this.baseUrl}/create_mailbox_v2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: emailInput,
                retention_days: retentionDays,
                sender_whitelist: []
            })
        });

        const result = await response.json();
        if (result.success) {
            this.mailbox = result;
            console.log(`✓ 邮箱创建成功: ${result.address}`);
            console.log(`✓ 邮箱密钥: ${result.mailbox_key}`);
            console.log(`✓ 访问令牌: ${result.access_token}`);
            return result;
        } else {
            throw new Error(result.error);
        }
    }

    // 2. 接收邮件
    async getInboxEmails() {
        if (!this.mailbox) {
            throw new Error('请先创建邮箱');
        }

        const response = await fetch(
            `${this.baseUrl}/get_inbox?address=${encodeURIComponent(this.mailbox.address)}`
        );

        if (response.status === 200) {
            const emails = await response.json();
            console.log(`✓ 获取到 ${emails.length} 封邮件`);
            return emails;
        } else if (response.status === 410) {
            throw new Error('邮箱已过期');
        } else if (response.status === 403) {
            throw new Error('IP访问被拒绝');
        } else {
            const error = await response.json();
            throw new Error(error.error || '获取邮件失败');
        }
    }

    // 3. 轮询检查新邮件
    async waitForEmails(maxAttempts = 60, intervalSeconds = 5) {
        console.log('🔄 开始轮询检查新邮件...');

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const emails = await this.getInboxEmails();

                if (emails.length > 0) {
                    console.log(`🎉 发现 ${emails.length} 封新邮件！`);
                    return emails;
                }

                console.log(`第 ${attempt}/${maxAttempts} 次检查 - 暂无新邮件`);
                await this.sleep(intervalSeconds * 1000);

            } catch (error) {
                if (error.message.includes('过期')) {
                    throw new Error('邮箱已过期，请重新创建');
                } else if (error.message.includes('IP访问被拒绝')) {
                    throw new Error('IP访问被拒绝，请检查网络环境');
                } else {
                    console.log(`第 ${attempt} 次检查失败: ${error.message}`);
                    await this.sleep(intervalSeconds * 1000);
                }
            }
        }

        throw new Error('检查超时');
    }

    // 辅助方法
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 使用示例
async function completeWorkflow() {
    const client = new TempMailClient('http://localhost:5000');

    try {
        // 1. 创建邮箱
        console.log('=== 1. 创建临时邮箱 ===');
        await client.createMailbox('test123', 7);

        // 2. 轮询等待邮件
        console.log('\n=== 2. 等待接收邮件 ===');
        const emails = await client.waitForEmails(120, 3); // 120次检查，每次间隔3秒

        // 3. 处理邮件
        console.log('\n=== 3. 处理邮件 ===');
        emails.forEach((email, index) => {
            console.log(`\n--- 邮件 ${index + 1} ---`);
            console.log(`发件人: ${email.From}`);
            console.log(`主题: ${email.Subject}`);
            console.log(`时间: ${email.Sent}`);
            console.log(`内容: ${email.Body.substring(0, 100)}...`);
        });

        console.log('\n✅ 工作流程完成！');

    } catch (error) {
        console.error('❌ 工作流程失败:', error.message);
    }
}

// 运行完整流程
completeWorkflow();
```

### 流程2：用户注册 → 邮箱管理

```javascript
class UserMailboxManager {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.user = null;
        this.mailboxes = [];
    }

    // 用户注册并创建邮箱
    async registerAndCreateMailbox(emailInput, retentionDays = 7) {
        console.log('=== 用户注册并创建邮箱 ===');

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
            console.log(`✓ 用户注册成功`);
            console.log(`✓ 邮箱创建成功: ${result.mailbox_address}`);
            console.log(`✓ 访问令牌: ${result.access_token}`);
            return result;
        } else {
            throw new Error(result.error);
        }
    }

    // 批量创建多个邮箱
    async createMultipleMailboxes(prefixes, retentionDays = 7) {
        const results = [];

        for (const prefix of prefixes) {
            try {
                console.log(`创建邮箱: ${prefix}`);
                const mailbox = await this.registerAndCreateMailbox(
                    `${prefix}@example.com`,
                    retentionDays
                );
                results.push(mailbox);
                await this.sleep(1000); // 避免请求过快
            } catch (error) {
                console.error(`创建邮箱 ${prefix} 失败:`, error.message);
                results.push({ prefix, error: error.message });
            }
        }

        return results;
    }

    // 批量检查所有邮箱
    async checkAllMailboxes() {
        const results = {};

        for (const mailbox of this.mailboxes) {
            try {
                const response = await fetch(
                    `${this.baseUrl}/get_inbox?address=${encodeURIComponent(mailbox.address)}`
                );
                const emails = await response.json();

                results[mailbox.address] = {
                    success: true,
                    emailCount: emails.length,
                    emails: emails
                };
            } catch (error) {
                results[mailbox.address] = {
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
async function userWorkflow() {
    const manager = new UserMailboxManager('http://localhost:5000');

    try {
        // 1. 注册并创建邮箱
        await manager.registerAndCreateMailbox('user123', 7);

        // 2. 批量创建多个邮箱
        console.log('\n批量创建邮箱...');
        const prefixes = ['work', 'personal', 'notification', 'test'];
        const mailboxes = await manager.createMultipleMailboxes(prefixes, 7);

        console.log(`\n成功创建 ${mailboxes.length} 个邮箱`);

        // 3. 等待邮件（模拟）
        console.log('\n等待邮件中...');
        await manager.sleep(5000);

        // 4. 检查所有邮箱
        const results = await manager.checkAllMailboxes();
        console.log('\n=== 邮箱检查结果 ===');

        Object.entries(results).forEach(([address, result]) => {
            if (result.success) {
                console.log(`${address}: ${result.emailCount} 封邮件`);
            } else {
                console.log(`${address}: 错误 - ${result.error}`);
            }
        });

    } catch (error) {
        console.error('用户工作流程失败:', error.message);
    }
}
```

## 错误处理指南

### 创建邮箱错误

| 错误场景 | HTTP状态码 | 错误信息 | 解决方法 |
|----------|------------|----------|----------|
| 参数格式错误 | 400 | "sender_whitelist must be an array" | 检查参数格式 |
| 邮箱已存在 | 409 | "Mailbox already exists" | 使用不同的邮箱地址 |
| 保留天数无效 | 400 | "retention_days must be between 1 and 30" | 设置1-30之间的天数 |
| IP受限 | 403 | "Access denied - IP not whitelisted" | 添加IP到白名单 |
| 数据库错误 | 500 | "Failed to create mailbox" | 检查数据库连接 |

### 接收邮件错误

| 错误场景 | HTTP状态码 | 错误信息 | 解决方法 |
|----------|------------|----------|----------|
| 邮箱不存在 | 200 | 返回空数组 `[]` | 检查邮箱地址是否正确 |
| 邮箱已过期 | 410 | "Mailbox expired" | 延长邮箱有效期或创建新邮箱 |
| 邮箱未激活 | 200 | 返回空数组 `[]` | 激活邮箱或检查邮箱状态 |
| IP受限 | 403 | "Access denied - IP not whitelisted" | 添加IP到白名单 |
| 数据库连接失败 | 500 | "Failed to get inbox" | 检查数据库配置 |

## 最佳实践

### 1. 邮箱创建建议

```javascript
// 推荐：使用高级创建接口
const mailbox = await createMailboxV2({
    address: 'myemail',
    retention_days: 7,
    sender_whitelist: ['@gmail.com', '@company.com']
});

// 保存重要信息
const credentials = {
    address: mailbox.address,
    mailbox_key: mailbox.mailbox_key,
    access_token: mailbox.access_token,
    expires_at: mailbox.expires_at
};

// 安全保存（实际应用中应该加密存储）
localStorage.setItem('temp_mailbox', JSON.stringify(credentials));
```

### 2. 邮件接收建议

```javascript
// 推荐：使用轮询检查
async function smartEmailPolling(address, options = {}) {
    const {
        maxAttempts = 60,
        intervalSeconds = 5,
        onEmailReceived = null
    } = options;

    for (let i = 0; i < maxAttempts; i++) {
        try {
            const emails = await getInboxEmails(address);

            if (emails.length > 0) {
                console.log(`发现 ${emails.length} 封邮件`);
                if (onEmailReceived) {
                    onEmailReceived(emails);
                }
                return emails;
            }

            console.log(`检查 ${i + 1}/${maxAttempts} - 暂无邮件`);
            await sleep(intervalSeconds * 1000);

        } catch (error) {
            if (error.message.includes('过期')) {
                throw new Error('邮箱已过期，请重新创建');
            }
            console.log(`检查失败: ${error.message}`);
            await sleep(intervalSeconds * 1000);
        }
    }

    throw new Error('检查超时');
}
```

### 3. 错误处理建议

```javascript
// 统一的错误处理
function handleApiError(error, operation) {
    console.error(`${operation} 失败:`, error.message);

    if (error.message.includes('IP')) {
        return '请检查网络环境或联系管理员';
    } else if (error.message.includes('过期')) {
        return '邮箱已过期，请重新创建';
    } else if (error.message.includes('不存在')) {
        return '邮箱不存在，请检查地址';
    } else {
        return '系统错误，请稍后重试';
    }
}

// 使用示例
try {
    const emails = await getInboxEmails(address);
} catch (error) {
    const userMessage = handleApiError(error, '获取邮件');
    alert(userMessage);
}
```

## 高级功能

### 1. 批量邮箱管理

```javascript
// 批量创建和管理邮箱
class MailboxManager {
    async createBulkMailboxes(count, retentionDays = 7) {
        const mailboxes = [];

        for (let i = 0; i < count; i++) {
            const mailbox = await this.createMailboxV2({
                address: `bulk${i + 1}`,
                retention_days: retentionDays
            });
            mailboxes.push(mailbox);
            await this.sleep(500); // 避免请求过快
        }

        return mailboxes;
    }

    async monitorAllMailboxes(mailboxes) {
        const results = {};

        for (const mailbox of mailboxes) {
            try {
                const emails = await this.getInboxEmails(mailbox.address);
                results[mailbox.address] = {
                    status: 'active',
                    emailCount: emails.length,
                    lastCheck: new Date().toISOString()
                };
            } catch (error) {
                results[mailbox.address] = {
                    status: 'error',
                    error: error.message,
                    lastCheck: new Date().toISOString()
                };
            }
        }

        return results;
    }
}
```

### 2. 智能邮件过滤

```javascript
// 邮件过滤和处理
function filterEmails(emails, criteria = {}) {
    let filtered = [...emails];

    if (criteria.unreadOnly) {
        filtered = filtered.filter(email => !email.is_read);
    }

    if (criteria.sender) {
        filtered = filtered.filter(email =>
            email.From.includes(criteria.sender)
        );
    }

    if (criteria.subjectKeyword) {
        filtered = filtered.filter(email =>
            email.Subject.includes(criteria.subjectKeyword)
        );
    }

    if (criteria.afterTimestamp) {
        filtered = filtered.filter(email =>
            email.Timestamp > criteria.afterTimestamp
        );
    }

    return filtered;
}

// 使用示例
const emails = await getInboxEmails(address);
const unreadEmails = filterEmails(emails, { unreadOnly: true });
const gmailEmails = filterEmails(emails, { sender: '@gmail.com' });
```

## 故障排除

### 常见问题

1. **Q: 创建邮箱时提示"IP not whitelisted"？**
   A: 需要管理员将您的IP添加到白名单中

2. **Q: 获取邮件时提示"Mailbox expired"？**
   A: 邮箱已过期，需要延长保留时间或创建新邮箱

3. **Q: 收件人白名单不生效？**
   A: 检查白名单格式，应该是完整的邮箱域名如"@gmail.com"

4. **Q: 邮件接收延迟？**
   A: 临时邮箱系统依赖SMTP服务器，建议使用轮询检查

### 调试技巧

```javascript
// 调试模式：详细日志
const DEBUG = true;

function debugLog(message, data = null) {
    if (DEBUG) {
        console.log(`[DEBUG] ${message}`);
        if (data) {
            console.log(data);
        }
    }
}

// 使用调试日志
async function getInboxEmails(address) {
    debugLog(`开始获取邮件: ${address}`);

    const response = await fetch(`/get_inbox?address=${encodeURIComponent(address)}`);
    debugLog(`API响应状态: ${response.status}`);

    if (response.status === 200) {
        const emails = await response.json();
        debugLog(`获取到 ${emails.length} 封邮件`);
        return emails;
    } else {
        const error = await response.json();
        debugLog('API错误响应:', error);
        throw new Error(error.error);
    }
}
```

## 总结

临时邮箱系统的核心功能包括：

1. **创建邮箱**：提供多种创建方式，满足不同需求
2. **接收邮件**：稳定可靠的邮件获取接口
3. **错误处理**：完善的错误处理和故障恢复机制
4. **扩展功能**：支持批量操作、智能过滤等高级功能

通过本指南，您可以快速集成临时邮箱功能到您的应用中，实现邮件的创建、接收和管理。