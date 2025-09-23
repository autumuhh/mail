# TempMail API 文档

## 创建受限邮箱 API

### 接口说明
通过API请求，生成只接收特定发送方邮件的邮箱。

### 请求信息
- **URL**: `POST /create_mailbox`
- **Content-Type**: `application/json`

### 请求参数

```json
{
    "address": "custom-name",           // 可选：自定义邮箱名称
    "sender_whitelist": [               // 必需：发送方白名单数组
        "boss@company.com",             // 精确邮箱匹配
        "@gmail.com",                   // 域名匹配
        "*@notifications.com"           // 通配符域名匹配
    ],
    "retention_days": 30                // 可选：邮箱保留天数，默认30天
}
```

### 参数说明

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `address` | string | 否 | 自定义邮箱地址。如果不提供，系统自动生成6位随机字符 |
| `sender_whitelist` | array | 是 | 允许的发送方列表，支持多种匹配规则 |
| `retention_days` | integer | 否 | 邮箱保留天数，默认为系统配置值 |

### 白名单匹配规则

1. **精确匹配**: `"user@domain.com"` - 只接收这个确切邮箱的邮件
2. **域名匹配**: `"@domain.com"` - 接收该域名下所有邮箱的邮件
3. **通配符匹配**: `"*@domain.com"` - 同域名匹配，另一种写法

### 响应示例

#### 成功响应 (201 Created)
```json
{
    "address": "abc123@localhost",
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

#### 错误响应
```json
{
    "error": "Mailbox already exists"
}
```

### 错误码说明

| 状态码 | 说明 |
|--------|------|
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 403 | IP不在白名单中 |
| 409 | 邮箱已存在 |
| 500 | 服务器内部错误 |

## 使用示例

### Python 示例

```python
import requests

# 创建只接收Gmail邮件的邮箱
data = {
    "sender_whitelist": ["@gmail.com"],
    "retention_days": 7
}

response = requests.post("http://localhost:5000/create_mailbox", json=data)
result = response.json()

if response.status_code == 201:
    print(f"邮箱创建成功: {result['address']}")
    print(f"白名单: {result['sender_whitelist']}")
else:
    print(f"创建失败: {result['error']}")
```

### cURL 示例

```bash
# 创建只接收特定邮箱的邮箱
curl -X POST http://localhost:5000/create_mailbox \
  -H "Content-Type: application/json" \
  -d '{
    "address": "work-reports",
    "sender_whitelist": ["boss@company.com", "hr@company.com"],
    "retention_days": 30
  }'
```

### JavaScript 示例

```javascript
// 创建受限邮箱
async function createRestrictedMailbox() {
    const data = {
        sender_whitelist: ["noreply@github.com", "@company.com"],
        retention_days: 14
    };
    
    try {
        const response = await fetch('/create_mailbox', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('邮箱创建成功:', result.address);
        } else {
            console.error('创建失败:', result.error);
        }
    } catch (error) {
        console.error('请求失败:', error);
    }
}
```

## 其他相关API

### 获取邮箱信息
- **URL**: `GET /mailbox_info?address=邮箱地址`
- **说明**: 获取邮箱的详细信息，包括创建时间、过期时间、白名单等

### 获取邮件列表
- **URL**: `GET /get_inbox?address=邮箱地址`
- **说明**: 获取邮箱中的所有邮件

### 管理白名单
- **URL**: `POST /mailbox_whitelist?address=邮箱地址`
- **说明**: 添加或删除白名单中的发送方

### 延长邮箱
- **URL**: `POST /extend_mailbox?address=邮箱地址`
- **说明**: 延长邮箱的有效期

## 实际应用场景

1. **工作邮件收集**: 创建只接收公司邮箱的临时邮箱
2. **服务通知**: 创建只接收特定服务通知的邮箱
3. **测试环境**: 创建只接收测试邮件的邮箱
4. **临时项目**: 为特定项目创建受限的邮件接收地址
