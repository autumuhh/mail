# TempMail API 文档

## 概述

TempMail 是一个功能完整的自托管临时邮箱服务，提供 RESTful API 接口。

### 主要功能
- 🌐 多域名支持
- ⏰ 邮件生命周期管理
- 🔒 发送方白名单控制
- 🛡️ IP 访问控制
- 📧 实时邮件接收
- 🔧 管理员控制面板

### 基础信息
- **基础URL**: `http://your-domain:port`
- **API版本**: v1
- **数据格式**: JSON
- **字符编码**: UTF-8

## 全局配置

### 认证机制

#### IP 白名单验证
所有 API 请求都会进行 IP 白名单检查（如果启用）。

#### 管理员认证
管理员接口需要在请求头中提供认证信息：
```
Authorization: your-admin-password
```

### 通用响应格式

#### 成功响应
```json
{
  "data": {},
  "message": "操作成功"
}
```

#### 错误响应
```json
{
  "error": "错误描述",
  "code": "ERROR_CODE"
}
```

## 邮箱管理接口

### 1. 生成随机邮箱地址

生成一个包含6位随机字符的邮箱地址。

#### 请求信息
- **方法**: `GET`
- **路径**: `/get_random_address`
- **认证**: 需要IP白名单验证

#### 请求参数
无

#### 响应参数
| 字段 | 类型 | 描述 |
|------|------|------|
| `address` | string | 生成的邮箱地址 |
| `available_domains` | array | 可用域名列表 |

#### 响应示例
```json
{
  "address": "abc123@domain.com",
  "available_domains": [
    "aegis.sch.quest",
    "apex.sch.quest",
    "atlas.sch.pics"
  ]
}
```

#### 错误码
| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 403 | IP不在白名单中 |

### 2. 创建受限邮箱

创建一个只接收特定发送方邮件的邮箱。

#### 请求信息
- **方法**: `POST`
- **路径**: `/create_mailbox`
- **认证**: 需要IP白名单验证
- **Content-Type**: `application/json`

#### 请求参数
| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `address` | string | 否 | 自动生成 | 自定义邮箱名称（不含@域名部分） |
| `sender_whitelist` | array | 是 | - | 允许的发送方列表 |
| `retention_days` | integer | 否 | 30 | 邮箱保留天数 |

#### 白名单规则
| 格式 | 示例 | 描述 |
|------|------|------|
| 精确匹配 | `"user@domain.com"` | 只接收该确切邮箱 |
| 域名匹配 | `"@domain.com"` | 接收该域名下所有邮箱 |
| 通配符匹配 | `"*@domain.com"` | 同域名匹配 |

#### 请求示例
```json
{
  "address": "work-reports",
  "sender_whitelist": [
    "boss@company.com",
    "@gmail.com",
    "*@notifications.service.com"
  ],
  "retention_days": 30
}
```

#### 响应参数
| 字段 | 类型 | 描述 |
|------|------|------|
| `address` | string | 完整邮箱地址 |
| `created_at` | integer | 创建时间戳 |
| `expires_at` | integer | 过期时间戳 |
| `sender_whitelist` | array | 发送方白名单 |
| `retention_days` | integer | 保留天数 |
| `message` | string | 操作结果消息 |

#### 响应示例
```json
{
  "address": "work-reports@aegis.sch.quest",
  "created_at": 1695123456,
  "expires_at": 1697715456,
  "sender_whitelist": [
    "boss@company.com",
    "@gmail.com"
  ],
  "retention_days": 30,
  "message": "Mailbox created successfully"
}
```

#### 错误码
| 状态码 | 描述 |
|--------|------|
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 403 | IP不在白名单中 |
| 409 | 邮箱已存在 |
| 500 | 服务器内部错误 |

### 3. 获取邮箱信息

获取指定邮箱的详细信息，包括创建时间、过期时间、白名单等。

#### 请求信息
- **方法**: `GET`
- **路径**: `/mailbox_info`
- **认证**: 需要IP白名单验证

#### 请求参数
| 参数 | 类型 | 必需 | 位置 | 描述 |
|------|------|------|------|------|
| `address` | string | 是 | Query | 邮箱地址 |

#### 请求示例
```
GET /mailbox_info?address=test@aegis.sch.quest
```

#### 响应参数
| 字段 | 类型 | 描述 |
|------|------|------|
| `address` | string | 邮箱地址 |
| `created_at` | integer/null | 创建时间戳 |
| `expires_at` | integer/null | 过期时间戳 |
| `sender_whitelist` | array | 发送方白名单 |
| `email_count` | integer | 邮件数量 |
| `is_expired` | boolean | 是否已过期 |

#### 响应示例
```json
{
  "address": "test@aegis.sch.quest",
  "created_at": 1695123456,
  "expires_at": 1697715456,
  "sender_whitelist": ["@gmail.com", "boss@company.com"],
  "email_count": 5,
  "is_expired": false
}
```

#### 错误码
| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 400 | 缺少邮箱地址参数 |
| 403 | IP不在白名单中 |
| 404 | 邮箱不存在 |

### 4. 延长邮箱有效期

延长指定邮箱的有效期。

#### 请求信息
- **方法**: `POST`
- **路径**: `/extend_mailbox`
- **认证**: 需要IP白名单验证
- **Content-Type**: `application/json`

#### 请求参数
| 参数 | 类型 | 必需 | 位置 | 默认值 | 描述 |
|------|------|------|------|--------|------|
| `address` | string | 是 | Query | - | 邮箱地址 |
| `days` | integer | 否 | Body | 30 | 延长天数 |

#### 请求示例
```
POST /extend_mailbox?address=test@aegis.sch.quest
Content-Type: application/json

{
  "days": 30
}
```

#### 响应参数
| 字段 | 类型 | 描述 |
|------|------|------|
| `message` | string | 操作结果消息 |
| `new_expires_at` | integer | 新的过期时间戳 |

#### 响应示例
```json
{
  "message": "Mailbox extended successfully",
  "new_expires_at": 1700307456
}
```

#### 错误码
| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 400 | 缺少邮箱地址参数 |
| 403 | IP不在白名单中 |
| 404 | 邮箱不存在 |

## 邮件管理接口

### 5. 获取邮件列表

获取指定邮箱中的所有邮件。

#### 请求信息
- **方法**: `GET`
- **路径**: `/get_inbox`
- **认证**: 需要IP白名单验证

#### 请求参数
| 参数 | 类型 | 必需 | 位置 | 描述 |
|------|------|------|------|------|
| `address` | string | 是 | Query | 邮箱地址 |

#### 请求头
| 头部 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `Authorization` | string | 否 | 受保护邮箱的密码 |

#### 请求示例
```
GET /get_inbox?address=test@aegis.sch.quest
Authorization: your-password
```

#### 响应参数
返回邮件数组，每个邮件包含以下字段：

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 邮件唯一标识符 |
| `From` | string | 发件人邮箱 |
| `To` | string | 收件人邮箱 |
| `Subject` | string | 邮件主题 |
| `Timestamp` | integer | 接收时间戳 |
| `Sent` | string | 格式化的发送时间 |
| `Body` | string | 邮件正文内容 |
| `ContentType` | string | 内容类型 |

#### 响应示例
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "From": "sender@example.com",
    "To": "test@aegis.sch.quest",
    "Subject": "重要通知",
    "Timestamp": 1695123456,
    "Sent": "Sep 19 at 12:30:56",
    "Body": "这是一封重要的邮件内容...",
    "ContentType": "Text"
  }
]
```

#### 错误码
| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 401 | 受保护邮箱认证失败 |
| 403 | IP不在白名单中 |
| 410 | 邮箱已过期 |

### 6. 获取单个邮件详情

获取指定邮件的完整详细信息。

#### 请求信息
- **方法**: `GET`
- **路径**: `/get_email`
- **认证**: 需要IP白名单验证

#### 请求参数
| 参数 | 类型 | 必需 | 位置 | 描述 |
|------|------|------|------|------|
| `address` | string | 是 | Query | 邮箱地址 |
| `id` | string | 是 | Query | 邮件ID |

#### 请求头
| 头部 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `Authorization` | string | 否 | 受保护邮箱的密码 |

#### 请求示例
```
GET /get_email?address=test@aegis.sch.quest&id=550e8400-e29b-41d4-a716-446655440000
```

#### 响应参数
| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 邮件唯一标识符 |
| `From` | string | 发件人邮箱 |
| `To` | string | 收件人邮箱 |
| `Subject` | string | 邮件主题 |
| `Timestamp` | integer | 接收时间戳 |
| `Sent` | string | 格式化的发送时间 |
| `Body` | string | 完整邮件正文内容 |
| `ContentType` | string | 内容类型 |

#### 响应示例
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "From": "sender@example.com",
  "To": "test@aegis.sch.quest",
  "Subject": "重要通知",
  "Timestamp": 1695123456,
  "Sent": "Sep 19 at 12:30:56",
  "Body": "这是完整的邮件内容，包含所有详细信息...",
  "ContentType": "Text"
}
```

#### 错误码
| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 400 | 缺少必需参数 |
| 401 | 受保护邮箱认证失败 |
| 403 | IP不在白名单中 |
| 404 | 邮箱或邮件不存在 |
| 410 | 邮箱已过期 |

## 白名单管理接口

### 7. 管理发送方白名单

添加或删除指定邮箱的发送方白名单。

#### 请求信息
- **方法**: `POST`
- **路径**: `/mailbox_whitelist`
- **认证**: 需要IP白名单验证
- **Content-Type**: `application/json`

#### 请求参数
| 参数 | 类型 | 必需 | 位置 | 描述 |
|------|------|------|------|------|
| `address` | string | 是 | Query | 邮箱地址 |
| `action` | string | 是 | Body | 操作类型：`add` 或 `remove` |
| `sender` | string | 是 | Body | 发送方规则 |

#### 请求示例
```
POST /mailbox_whitelist?address=test@aegis.sch.quest
Content-Type: application/json

{
  "action": "add",
  "sender": "@gmail.com"
}
```

#### 响应参数
| 字段 | 类型 | 描述 |
|------|------|------|
| `message` | string | 操作结果消息 |
| `whitelist` | array | 更新后的白名单 |

#### 响应示例
```json
{
  "message": "Sender added to whitelist",
  "whitelist": ["@gmail.com", "boss@company.com"]
}
```

#### 错误码
| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 403 | IP不在白名单中 |
| 404 | 邮箱不存在 |

## 测试工具接口

### 8. 发送测试邮件

通过内置SMTP服务器发送测试邮件。

#### 请求信息
- **方法**: `POST`
- **路径**: `/send_test_email`
- **认证**: 需要IP白名单验证
- **Content-Type**: `application/json`

#### 请求参数
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `to` | string | 是 | 收件人邮箱地址 |
| `from` | string | 是 | 发件人邮箱地址 |
| `subject` | string | 是 | 邮件主题 |
| `body` | string | 否 | 邮件正文内容 |

#### 请求示例
```json
{
  "to": "test@aegis.sch.quest",
  "from": "sender@example.com",
  "subject": "测试邮件",
  "body": "这是一封测试邮件的内容"
}
```

#### 响应参数
| 字段 | 类型 | 描述 |
|------|------|------|
| `message` | string | 发送结果消息 |

#### 响应示例
```json
{
  "message": "Email sent successfully"
}
```

#### 错误码
| 状态码 | 描述 |
|--------|------|
| 200 | 发送成功 |
| 400 | 请求参数错误 |
| 403 | IP不在白名单中 |
| 500 | 发送失败 |

## 系统信息接口

### 9. 获取域名信息

获取系统默认域名。

#### 请求信息
- **方法**: `GET`
- **路径**: `/get_domain`
- **认证**: 需要IP白名单验证

#### 请求参数
无

#### 响应参数
| 字段 | 类型 | 描述 |
|------|------|------|
| `domain` | string | 默认域名 |

#### 响应示例
```json
{
  "domain": "aegis.sch.quest"
}
```

#### 错误码
| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 403 | IP不在白名单中 |

## 管理员接口

### 10. 获取IP白名单设置

获取当前IP白名单配置信息。

#### 请求信息
- **方法**: `GET`
- **路径**: `/admin/whitelist`
- **认证**: 需要管理员密码

#### 请求头
| 头部 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `Authorization` | string | 是 | 管理员密码 |

#### 请求示例
```
GET /admin/whitelist
Authorization: your-admin-password
```

#### 响应参数
| 字段 | 类型 | 描述 |
|------|------|------|
| `enabled` | boolean | 是否启用IP白名单 |
| `whitelist` | string | IP白名单（换行分隔） |
| `current_ip` | string | 当前请求IP |

#### 响应示例
```json
{
  "enabled": true,
  "whitelist": "127.0.0.1\n::1\n192.168.0.0/16\n10.0.0.0/8",
  "current_ip": "127.0.0.1"
}
```

#### 错误码
| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 401 | 认证失败 |

### 11. 更新IP白名单设置

更新IP白名单配置并保存到配置文件。

#### 请求信息
- **方法**: `POST`
- **路径**: `/admin/whitelist`
- **认证**: 需要管理员密码
- **Content-Type**: `application/json`

#### 请求头
| 头部 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `Authorization` | string | 是 | 管理员密码 |

#### 请求参数
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `enabled` | boolean | 是 | 是否启用IP白名单 |
| `whitelist` | string | 是 | IP白名单（换行分隔） |

#### 请求示例
```
POST /admin/whitelist
Authorization: your-admin-password
Content-Type: application/json

{
  "enabled": true,
  "whitelist": "127.0.0.1\n::1\n192.168.0.0/16\n10.0.0.0/8"
}
```

#### 响应参数
| 字段 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 操作是否成功 |
| `message` | string | 操作结果消息 |

#### 响应示例
```json
{
  "success": true,
  "message": "Settings updated. Restart required for full effect."
}
```

#### 错误码
| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 认证失败 |
| 500 | 更新失败 |

### 12. 测试IP白名单

测试指定IP是否在白名单中。

#### 请求信息
- **方法**: `POST`
- **路径**: `/admin/test_ip`
- **认证**: 需要管理员密码
- **Content-Type**: `application/json`

#### 请求头
| 头部 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `Authorization` | string | 是 | 管理员密码 |

#### 请求参数
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `ip` | string | 是 | 要测试的IP地址 |

#### 请求示例
```
POST /admin/test_ip
Authorization: your-admin-password
Content-Type: application/json

{
  "ip": "192.168.1.100"
}
```

#### 响应参数
| 字段 | 类型 | 描述 |
|------|------|------|
| `ip` | string | 测试的IP地址 |
| `allowed` | boolean | 是否被允许 |
| `message` | string | 测试结果消息 |

#### 响应示例
```json
{
  "ip": "192.168.1.100",
  "allowed": true,
  "message": "IP is allowed"
}
```

#### 错误码
| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 400 | 缺少IP参数 |
| 401 | 认证失败 |

## 页面路由接口

### 13. 主页

返回临时邮箱服务的主页面。

#### 请求信息
- **方法**: `GET`
- **路径**: `/`
- **认证**: 无

#### 响应
返回HTML页面

### 14. 管理页面

返回IP白名单管理页面。

#### 请求信息
- **方法**: `GET`
- **路径**: `/admin`
- **认证**: 无（页面内需要密码认证）

#### 响应
返回HTML管理页面

### 15. API测试页面

返回API功能测试界面。

#### 请求信息
- **方法**: `GET`
- **路径**: `/api-test`
- **认证**: 无

#### 响应
返回HTML测试页面

## HTTP状态码说明

| 状态码 | 名称 | 描述 |
|--------|------|------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 请求参数错误或格式不正确 |
| 401 | Unauthorized | 认证失败或密码错误 |
| 403 | Forbidden | IP地址不在白名单中 |
| 404 | Not Found | 请求的资源不存在 |
| 409 | Conflict | 资源冲突（如邮箱已存在） |
| 410 | Gone | 资源已过期（如邮箱过期） |
| 500 | Internal Server Error | 服务器内部错误 |

## 配置规则说明

### 发送方白名单规则

| 规则类型 | 格式 | 示例 | 描述 |
|----------|------|------|------|
| 精确匹配 | `user@domain.com` | `boss@company.com` | 只接收该确切邮箱地址 |
| 域名匹配 | `@domain.com` | `@gmail.com` | 接收该域名下所有邮箱 |
| 通配符匹配 | `*@domain.com` | `*@notifications.com` | 同域名匹配的另一种写法 |

### IP白名单规则

| 规则类型 | 格式 | 示例 | 描述 |
|----------|------|------|------|
| 单个IPv4 | `x.x.x.x` | `192.168.1.100` | 允许特定IPv4地址 |
| IPv4网段 | `x.x.x.x/n` | `192.168.0.0/16` | 允许IPv4网段 |
| 单个IPv6 | `::x` | `::1` | 允许特定IPv6地址 |
| 本地回环 | `127.0.0.1` | `127.0.0.1` | 本地访问 |

## SDK使用示例

### Python SDK示例

```python
import requests
import json

class TempMailClient:
    def __init__(self, base_url, admin_password=None):
        self.base_url = base_url.rstrip('/')
        self.admin_password = admin_password

    def create_mailbox(self, sender_whitelist, address=None, retention_days=30):
        """创建受限邮箱"""
        data = {
            'sender_whitelist': sender_whitelist,
            'retention_days': retention_days
        }
        if address:
            data['address'] = address

        response = requests.post(
            f'{self.base_url}/create_mailbox',
            json=data
        )
        return response.json()

    def get_emails(self, address):
        """获取邮件列表"""
        response = requests.get(
            f'{self.base_url}/get_inbox',
            params={'address': address}
        )
        return response.json()

    def get_random_address(self):
        """获取随机邮箱"""
        response = requests.get(f'{self.base_url}/get_random_address')
        return response.json()

# 使用示例
client = TempMailClient('http://localhost:5000')

# 创建只接收Gmail的邮箱
mailbox = client.create_mailbox(['@gmail.com'], retention_days=7)
print(f"创建邮箱: {mailbox['address']}")

# 获取邮件
emails = client.get_emails(mailbox['address'])
print(f"收到 {len(emails)} 封邮件")
```

### JavaScript SDK示例

```javascript
class TempMailClient {
    constructor(baseUrl, adminPassword = null) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.adminPassword = adminPassword;
    }

    async createMailbox(senderWhitelist, address = null, retentionDays = 30) {
        const data = {
            sender_whitelist: senderWhitelist,
            retention_days: retentionDays
        };
        if (address) data.address = address;

        const response = await fetch(`${this.baseUrl}/create_mailbox`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    }

    async getEmails(address) {
        const response = await fetch(
            `${this.baseUrl}/get_inbox?address=${encodeURIComponent(address)}`
        );
        return await response.json();
    }

    async getRandomAddress() {
        const response = await fetch(`${this.baseUrl}/get_random_address`);
        return await response.json();
    }

    async sendTestEmail(to, from, subject, body) {
        const response = await fetch(`${this.baseUrl}/send_test_email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, from, subject, body })
        });
        return await response.json();
    }
}

// 使用示例
const client = new TempMailClient('http://localhost:5000');

// 创建邮箱并发送测试邮件
async function example() {
    // 获取随机邮箱
    const randomMailbox = await client.getRandomAddress();
    console.log('随机邮箱:', randomMailbox.address);

    // 创建受限邮箱
    const restrictedMailbox = await client.createMailbox(
        ['@company.com', 'boss@example.com'],
        'work-reports',
        14
    );
    console.log('受限邮箱:', restrictedMailbox.address);

    // 发送测试邮件
    await client.sendTestEmail(
        restrictedMailbox.address,
        'boss@company.com',
        '工作报告',
        '这是本周的工作报告...'
    );

    // 获取邮件
    const emails = await client.getEmails(restrictedMailbox.address);
    console.log('收到邮件:', emails.length);
}
```

### cURL命令示例

```bash
#!/bin/bash

BASE_URL="http://localhost:5000"

# 1. 获取随机邮箱
echo "=== 获取随机邮箱 ==="
curl -s "$BASE_URL/get_random_address" | jq .

# 2. 创建受限邮箱
echo -e "\n=== 创建受限邮箱 ==="
MAILBOX=$(curl -s -X POST "$BASE_URL/create_mailbox" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "test-reports",
    "sender_whitelist": ["@gmail.com", "boss@company.com"],
    "retention_days": 7
  }')
echo "$MAILBOX" | jq .

# 提取邮箱地址
ADDRESS=$(echo "$MAILBOX" | jq -r '.address')

# 3. 发送测试邮件
echo -e "\n=== 发送测试邮件 ==="
curl -s -X POST "$BASE_URL/send_test_email" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"$ADDRESS\",
    \"from\": \"boss@company.com\",
    \"subject\": \"测试邮件\",
    \"body\": \"这是一封测试邮件\"
  }" | jq .

# 4. 获取邮件列表
echo -e "\n=== 获取邮件列表 ==="
curl -s "$BASE_URL/get_inbox?address=$ADDRESS" | jq .

# 5. 获取邮箱信息
echo -e "\n=== 获取邮箱信息 ==="
curl -s "$BASE_URL/mailbox_info?address=$ADDRESS" | jq .
```

### 管理员操作示例

```bash
#!/bin/bash

BASE_URL="http://localhost:5000"
ADMIN_PASSWORD="your-admin-password"

# 获取当前白名单设置
echo "=== 当前白名单设置 ==="
curl -s "$BASE_URL/admin/whitelist" \
  -H "Authorization: $ADMIN_PASSWORD" | jq .

# 更新白名单设置
echo -e "\n=== 更新白名单设置 ==="
curl -s -X POST "$BASE_URL/admin/whitelist" \
  -H "Authorization: $ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "whitelist": "127.0.0.1\n::1\n192.168.0.0/16\n10.0.0.0/8"
  }' | jq .

# 测试IP白名单
echo -e "\n=== 测试IP白名单 ==="
curl -s -X POST "$BASE_URL/admin/test_ip" \
  -H "Authorization: $ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"ip": "192.168.1.100"}' | jq .
```

## 最佳实践

### 1. 错误处理
```javascript
async function safeApiCall(apiFunction) {
    try {
        const result = await apiFunction();
        if (result.error) {
            console.error('API错误:', result.error);
            return null;
        }
        return result;
    } catch (error) {
        console.error('网络错误:', error.message);
        return null;
    }
}
```

### 2. 批量操作
```python
def batch_create_mailboxes(client, configs):
    """批量创建邮箱"""
    results = []
    for config in configs:
        try:
            result = client.create_mailbox(**config)
            results.append(result)
        except Exception as e:
            print(f"创建失败: {e}")
    return results
```

### 3. 定期清理
```python
import time

def monitor_mailboxes(client, addresses):
    """监控邮箱状态"""
    for address in addresses:
        info = client.get_mailbox_info(address)
        if info.get('is_expired'):
            print(f"邮箱已过期: {address}")
        else:
            remaining = info['expires_at'] - int(time.time())
            print(f"邮箱 {address} 还有 {remaining//86400} 天过期")
```
