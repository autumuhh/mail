# TempMail 安全工作流程

## 概述

为了提高安全性，TempMail V2 API 采用了**邮箱密钥**验证机制：
1. **创建邮箱** - 返回邮箱密钥（mailbox_key），不返回访问令牌
2. **获取令牌** - 用户需要提供邮箱地址和邮箱密钥才能获取访问令牌

这种设计确保只有拥有邮箱密钥的用户才能访问邮箱，提供真正的安全保护。

## 🔐 安全工作流程

### 步骤 1: 创建邮箱
```http
POST /create_mailbox_v2
Content-Type: application/json

{
  "address": "myemail",
  "sender_whitelist": ["@gmail.com"],
  "retention_days": 7
}
```

**响应（包含邮箱密钥）**:
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
  "available_domains": ["localhost"],
  "storage_type": "database",
  "message": "Mailbox created successfully. Please save your mailbox key securely."
}
```

⚠️ **重要**: 请妥善保存 `mailbox_key`，这是访问邮箱的唯一凭证！

### 步骤 2: 获取访问令牌
```http
POST /get_mailbox_token
Content-Type: application/json

{
  "address": "myemail@localhost",
  "mailbox_key": "abc12345-def6-7890-ghij-klmnopqrstuv"
}
```

**响应（包含令牌）**:
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

### 步骤 3: 使用令牌访问邮箱
```http
GET /mailbox_info_v2?token=123e4567-e89b-12d3-a456-426614174000
```

## 🛡️ 安全优势

### 1. **邮箱密钥保护**
- 创建邮箱时生成唯一的邮箱密钥
- 只有拥有密钥的用户才能获取访问令牌
- 密钥丢失则无法访问邮箱，确保安全性

### 2. **双重验证**
- 需要邮箱地址 + 邮箱密钥才能获取令牌
- 防止仅通过邮箱地址就能访问
- 支持IP白名单额外保护

### 3. **访问控制**
- 邮箱密钥作为第一层验证
- 访问令牌作为第二层验证
- 可以记录所有访问尝试

## 📱 前端集成示例

### JavaScript 示例
```javascript
class TempMailClient {
  constructor(baseUrl = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.mailboxKey = null;
  }

  // 步骤1: 创建邮箱
  async createMailbox(address, options = {}) {
    const response = await fetch(`${this.baseUrl}/create_mailbox_v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        ...options
      })
    });
    
    const result = await response.json();
    if (result.success) {
      this.mailboxAddress = result.address;
      this.mailboxId = result.mailbox_id;
      this.mailboxKey = result.mailbox_key;  // 保存邮箱密钥
    }
    return result;
  }

  // 步骤2: 获取访问令牌
  async getAccessToken() {
    if (!this.mailboxAddress || !this.mailboxKey) {
      throw new Error('No mailbox created yet or missing mailbox key');
    }

    const response = await fetch(`${this.baseUrl}/get_mailbox_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: this.mailboxAddress,
        mailbox_key: this.mailboxKey  // 提供邮箱密钥
      })
    });
    
    const result = await response.json();
    if (result.success) {
      this.accessToken = result.access_token;
    }
    return result;
  }

  // 步骤3: 获取邮箱信息
  async getMailboxInfo() {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    const response = await fetch(
      `${this.baseUrl}/mailbox_info_v2?token=${this.accessToken}`
    );
    return await response.json();
  }

  // 获取邮件列表
  async getEmails() {
    if (!this.mailboxAddress) {
      throw new Error('No mailbox created yet');
    }

    const response = await fetch(
      `${this.baseUrl}/get_inbox?address=${this.mailboxAddress}`
    );
    return await response.json();
  }
}

// 使用示例
async function example() {
  const client = new TempMailClient();
  
  // 创建邮箱
  const mailbox = await client.createMailbox('test123', {
    sender_whitelist: ['@gmail.com'],
    retention_days: 7
  });
  console.log('邮箱创建:', mailbox);
  
  // 获取令牌（在需要时）
  const token = await client.getAccessToken();
  console.log('访问令牌:', token.access_token);
  
  // 获取邮箱信息
  const info = await client.getMailboxInfo();
  console.log('邮箱信息:', info);
  
  // 获取邮件
  const emails = await client.getEmails();
  console.log('邮件列表:', emails);
}
```

### Python 示例
```python
import requests
import json

class TempMailClient:
    def __init__(self, base_url='http://localhost:5000'):
        self.base_url = base_url
        self.access_token = None
        self.mailbox_address = None
        self.mailbox_id = None

    def create_mailbox(self, address, **options):
        """创建邮箱"""
        response = requests.post(f'{self.base_url}/create_mailbox_v2', 
                               json={'address': address, **options})
        result = response.json()
        
        if result.get('success'):
            self.mailbox_address = result['address']
            self.mailbox_id = result['mailbox_id']
        
        return result

    def get_access_token(self):
        """获取访问令牌"""
        if not self.mailbox_address:
            raise ValueError('No mailbox created yet')
        
        response = requests.post(f'{self.base_url}/get_mailbox_token',
                               json={'address': self.mailbox_address})
        result = response.json()
        
        if result.get('success'):
            self.access_token = result['access_token']
        
        return result

    def get_mailbox_info(self):
        """获取邮箱信息"""
        if not self.access_token:
            self.get_access_token()
        
        response = requests.get(f'{self.base_url}/mailbox_info_v2',
                              params={'token': self.access_token})
        return response.json()

    def get_emails(self):
        """获取邮件列表"""
        if not self.mailbox_address:
            raise ValueError('No mailbox created yet')
        
        response = requests.get(f'{self.base_url}/get_inbox',
                              params={'address': self.mailbox_address})
        return response.json()

# 使用示例
if __name__ == '__main__':
    client = TempMailClient()
    
    # 创建邮箱
    mailbox = client.create_mailbox('test123', 
                                  sender_whitelist=['@gmail.com'],
                                  retention_days=7)
    print('邮箱创建:', json.dumps(mailbox, indent=2, ensure_ascii=False))
    
    # 获取令牌
    token = client.get_access_token()
    print('访问令牌:', token.get('access_token'))
    
    # 获取邮箱信息
    info = client.get_mailbox_info()
    print('邮箱信息:', json.dumps(info, indent=2, ensure_ascii=False))
```

## 🔄 迁移指南

### 从原有API迁移到V2

**原有方式**:
```javascript
// 一步创建并获取所有信息
const response = await fetch('/create_mailbox', {
  method: 'POST',
  body: JSON.stringify({address: 'test'})
});
const mailbox = await response.json();
// 直接使用 mailbox.address
```

**V2方式**:
```javascript
// 两步式安全创建
const mailbox = await fetch('/create_mailbox_v2', {
  method: 'POST',
  body: JSON.stringify({address: 'test'})
}).then(r => r.json());

// 需要时获取令牌
const token = await fetch('/get_mailbox_token', {
  method: 'POST',
  body: JSON.stringify({address: mailbox.address})
}).then(r => r.json());

// 使用令牌访问
const info = await fetch(`/mailbox_info_v2?token=${token.access_token}`)
  .then(r => r.json());
```

## 🎯 最佳实践

1. **令牌管理**: 将访问令牌安全存储，避免在URL中传递
2. **错误处理**: 处理令牌过期和邮箱不存在的情况
3. **缓存策略**: 合理缓存令牌，避免频繁请求
4. **日志记录**: 记录令牌获取和使用情况
5. **安全传输**: 在生产环境中使用HTTPS

这种设计提供了更好的安全性和灵活性，同时保持了API的简洁性。
