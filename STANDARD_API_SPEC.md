# 临时邮箱系统 - 标准API接口规范

## 概述

本文档定义了临时邮箱系统的标准API接口规范，包括域名管理、邮箱创建、邮件接收等核心功能的完整技术规范。

## 域名配置规范

### 1. 域名配置方式

**域名是动态读取的**，不是写死的。系统通过以下方式实现域名的动态配置：

#### 1.1 环境变量配置（后端）
```python
# config.py - 域名配置
DOMAINS_STR = os.getenv("DOMAINS", os.getenv("DOMAIN", "localhost"))
DOMAINS = [domain.strip() for domain in DOMAINS_STR.split(",")]
DOMAIN = DOMAINS[0]  # 默认域名（向后兼容）
```

**环境变量说明：**
- `DOMAINS`: 支持多个域名的逗号分隔列表，如：`localhost,test.local,example.com`
- `DOMAIN`: 单个域名配置（向后兼容），如：`localhost`
- 默认值：`localhost`

#### 1.2 前端动态获取
```javascript
// register.js - 动态加载域名
async loadAvailableDomains() {
    try {
        const response = await fetch('/api/get_random_address');
        const result = await response.json();

        if (response.ok && result.available_domains) {
            this.displayDomains(result.available_domains);
        } else {
            this.displayDomains(['localhost', 'test.local']);
        }
    } catch (error) {
        console.error('加载域名失败:', error);
        this.displayDomains(['localhost', 'test.local']);
    }
}
```

### 2. 域名获取API接口

#### 2.1 获取随机地址接口
```http
GET /api/get_random_address
```

**功能描述：**
- 生成随机邮箱前缀
- 返回当前可用的所有域名列表
- 支持IP白名单验证

**请求参数：**
无

**响应格式：**
```json
{
  "address": "随机生成的邮箱前缀@域名",
  "available_domains": ["localhost", "test.local", "example.com"]
}
```

**错误响应：**
```json
{
  "error": "Access denied - IP not whitelisted"
}
```

**实现代码：**
```python
@bp.route('/get_random_address')
def get_random_address():
    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    random_string = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
    random_domain = random.choice(config.DOMAINS)
    return jsonify({
        "address": f"{random_string}@{random_domain}",
        "available_domains": config.DOMAINS
    }), 200
```

## 核心API接口规范

### 3. 邮箱创建接口规范

```http
POST /api/create_mailbox_v2
Content-Type: application/json

{
  "address": "邮箱前缀或完整地址",
  "sender_whitelist": ["@gmail.com"],
  "retention_days": 7,
  "created_at": 1640995200
}
```

**高级参数：**
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `created_at` | number | 否 | 自定义创建时间戳，支持时间管理 |

### 4. 邮件接收接口规范

#### 4.1 获取邮件接口
```http
GET /api/get_inbox?address={邮箱地址}
```

**功能规范：**
- **邮箱验证**：检查邮箱是否存在、是否过期、是否激活
- **访问更新**：自动更新邮箱最后访问时间
- **数量限制**：根据`MAX_EMAILS_PER_ADDRESS`配置限制返回数量
- **状态管理**：完整的邮箱状态检查流程

**响应数据结构：**
```json
[
  {
    "id": "邮件唯一ID",
    "From": "发件人地址",
    "To": "收件人地址",
    "Subject": "邮件主题",
    "Body": "邮件正文",
    "ContentType": "text/plain",
    "Timestamp": 1640995200,
    "Sent": "相对时间显示",
    "is_read": false,
    "attachments": [],
    "headers": {
      "Message-ID": "消息ID",
      "Date": "邮件日期"
    }
  }
]
```

### 5. 用户注册接口规范

#### 5.1 用户注册接口
```http
POST /api/register
Content-Type: application/json

{
  "email": "邮箱前缀或完整地址",
  "retention_days": 7
}
```

**输入规范：**
- **完整邮箱**：`myemail@example.com`（使用指定域名）
- **仅前缀**：`myemail`（系统自动从`DOMAINS`中选择）

## 环境配置规范

### 6. 环境变量规范

#### 6.1 必需环境变量
```bash
# Flask配置
FLASK_HOST=0.0.0.0
FLASK_PORT=5000

# 数据库配置
USE_DATABASE=true
DATABASE_PATH=data/mailbox.db

# 域名配置（核心）
DOMAINS=localhost,test.local,example.com
# 或
DOMAIN=localhost

# 安全配置
PASSWORD=your_admin_password
ENABLE_IP_WHITELIST=false
IP_WHITELIST=127.0.0.1,::1
```

#### 6.2 可选环境变量
```bash
# 邮箱配置
MAX_EMAILS_PER_ADDRESS=50
MAILBOX_RETENTION_DAYS=30
EMAIL_RETENTION_DAYS=7

# 发件人白名单
ENABLE_SENDER_WHITELIST=false

# 文件存储
INBOX_FILE_NAME=inbox.json
MAX_INBOX_SIZE=100000000
```

## 错误码规范

### 7. HTTP状态码规范

| 状态码 | 说明 | 使用场景 |
|--------|------|----------|
| `200` | 成功 | 所有成功响应，包括空结果 |
| `201` | 已创建 | 邮箱创建成功 |
| `400` | 错误请求 | 参数格式错误、验证失败 |
| `401` | 未授权 | 管理员密码错误、访问令牌无效 |
| `403` | 禁止访问 | IP不在白名单中 |
| `404` | 未找到 | 邮箱或邮件不存在 |
| `409` | 冲突 | 邮箱已存在 |
| `410` | 已过期 | 邮箱已过期 |
| `500` | 服务器错误 | 数据库连接失败、系统异常 |

### 8. 业务错误码规范

| 错误码 | 说明 | 解决建议 |
|--------|------|----------|
| `INVALID_PARAMETER` | 参数无效 | 检查参数格式和类型 |
| `MAILBOX_NOT_FOUND` | 邮箱不存在 | 检查邮箱地址拼写 |
| `MAILBOX_EXPIRED` | 邮箱过期 | 创建新邮箱或延长过期时间 |
| `IP_NOT_WHITELISTED` | IP受限 | 添加IP到白名单 |
| `DOMAIN_NOT_AVAILABLE` | 域名不可用 | 检查域名配置 |

## 接口设计规范

### 9. RESTful设计原则

#### 9.1 资源命名规范
```http
# 邮箱资源
GET    /api/mailboxes           # 获取邮箱列表
POST   /api/mailboxes           # 创建邮箱
GET    /api/mailboxes/{id}      # 获取特定邮箱
PUT    /api/mailboxes/{id}      # 更新邮箱
DELETE /api/mailboxes/{id}      # 删除邮箱

# 邮件资源
GET    /api/emails              # 获取邮件列表
GET    /api/emails/{id}         # 获取特定邮件
DELETE /api/emails/{id}         # 删除邮件
```

#### 9.2 请求方法规范
- `GET`: 查询资源
- `POST`: 创建资源
- `PUT`: 更新资源
- `DELETE`: 删除资源

#### 9.3 响应格式规范
```json
// 成功响应
{
  "success": true,
  "data": { },
  "message": "操作成功"
}

// 错误响应
{
  "success": false,
  "error": "错误代码",
  "message": "错误描述"
}
```

## 安全性规范

### 10. 安全措施

#### 10.1 IP白名单机制
```python
# IP验证中间件
def check_ip_whitelist():
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403
```

#### 10.2 管理员认证
```python
# 管理员密码验证
def check_admin_auth():
    password = request.headers.get("Authorization", None)
    if password != config.PASSWORD:
        return False, "Invalid password"
    return True, "OK"
```

#### 10.3 输入验证
```javascript
// 前端输入验证
validateEmail() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput)) {
        this.showToast('请输入有效的邮箱地址格式', 'warning');
        return false;
    }
    return true;
}
```

## 性能优化规范

### 11. 性能考虑

#### 11.1 数据库优化
```python
# 索引优化
CREATE INDEX idx_mailbox_address ON mailboxes(address);
CREATE INDEX idx_email_mailbox_id ON emails(mailbox_id);
CREATE INDEX idx_email_timestamp ON emails(timestamp);
```

#### 11.2 缓存策略
```python
# Redis缓存配置
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CACHE_TTL = int(os.getenv("CACHE_TTL", 300))  # 5分钟缓存
```

#### 11.3 分页优化
```python
# 大数据集分页
GET /api/emails?page=1&per_page=20
```

## 测试规范

### 12. API测试标准

#### 12.1 单元测试
```python
def test_create_mailbox():
    """测试邮箱创建功能"""
    response = client.post('/api/create_mailbox_v2', json={
        'address': 'test@example.com',
        'retention_days': 7
    })
    assert response.status_code == 201
    assert 'mailbox_id' in response.json
```

#### 12.2 集成测试
```python
def test_mailbox_workflow():
    """测试完整邮箱工作流程"""
    # 1. 创建邮箱
    # 2. 发送邮件
    # 3. 验证接收
    # 4. 清理资源
```

#### 12.3 性能测试
```python
def test_api_performance():
    """测试API性能指标"""
    # 响应时间 < 100ms
    # 并发处理 > 1000 req/s
    # 内存使用 < 512MB
```

## 部署规范

### 13. 部署配置

#### 13.1 Docker部署
```dockerfile
FROM python:3.9-slim
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "app.py"]
```

#### 13.2 环境配置
```yaml
# docker-compose.yml
version: '3.8'
services:
  tempmail:
    build: .
    environment:
      - DOMAINS=localhost,test.local,example.com
      - USE_DATABASE=true
      - ENABLE_IP_WHITELIST=false
    ports:
      - "5000:5000"
```

## 监控和日志规范

### 14. 监控指标

#### 14.1 关键指标
- API响应时间
- 错误率统计
- 邮箱创建数量
- 邮件接收数量
- 系统资源使用

#### 14.2 日志格式
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "INFO",
  "module": "api",
  "action": "create_mailbox",
  "ip": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "duration": 150,
  "status": 201
}
```

## 版本管理规范

### 15. API版本控制

#### 15.1 版本号规范
```http
# URL版本控制
/api/v1/mailboxes
/api/v2/mailboxes

# 请求头版本控制
X-API-Version: v2
```

#### 15.2 向后兼容
- 保留旧版本API至少6个月
- 新版本默认，旧版本标记为deprecated
- 重大变更提前公告

## 总结

本规范定义了临时邮箱系统的完整技术标准，包括：

1. **动态域名配置**：支持多域名动态配置和获取
2. **标准RESTful API**：统一的接口设计和响应格式
3. **完善的安全机制**：IP白名单、管理员认证、输入验证
4. **性能优化策略**：数据库优化、缓存策略、分页处理
5. **测试和部署标准**：完整的测试和部署规范
6. **监控和维护**：日志、监控和版本管理

遵循本规范可以确保系统的可扩展性、安全性和可维护性。