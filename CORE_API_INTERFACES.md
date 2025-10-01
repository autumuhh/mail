# 临时邮箱系统 - 核心接口API文档

## 概述

本文档详细定义了临时邮箱系统的两个核心API接口：
1. **V2邮箱创建接口** (`/api/create_mailbox_v2`)
2. **查看邮箱邮件接口** (`/api/get_inbox`)

这两个接口是临时邮箱系统的基石，涵盖了完整的邮箱生命周期管理。

## 接口详细规范

---

## 1. V2邮箱创建接口

### 1.1 接口概览

**接口路径：** `POST /api/create_mailbox_v2`

**功能描述：**
- 创建高级临时邮箱（支持数据库存储）
- 提供UUID和密钥管理
- 支持自定义创建时间
- 完整的邮箱生命周期管理

**支持的存储模式：**
- 数据库模式（推荐）
- JSON文件模式（兼容）

### 1.2 请求规范

#### 请求头
```http
Content-Type: application/json
```

#### 请求参数
| 参数 | 类型 | 必需 | 说明 | 示例 |
|------|------|------|------|------|
| `address` | string | 否 | 邮箱前缀或完整地址 | `"myemail"` 或 `"myemail@example.com"` |
| `sender_whitelist` | array | 否 | 发件人白名单 | `["@gmail.com", "@company.com"]` |
| `retention_days` | number | 否 | 保留天数（1-30） | `7` |
| `created_at` | number | 否 | 自定义创建时间戳 | `1640995200` |

#### 请求示例
```bash
# 基础创建
curl -X POST http://localhost:5000/api/create_mailbox_v2 \
  -H "Content-Type: application/json" \
  -d '{
    "address": "myemail",
    "retention_days": 7
  }'

# 高级创建（包含白名单和自定义时间）
curl -X POST http://localhost:5000/api/create_mailbox_v2 \
  -H "Content-Type: application/json" \
  -d '{
    "address": "myemail",
    "sender_whitelist": ["@gmail.com"],
    "retention_days": 14,
    "created_at": 1640995200
  }'
```

### 1.3 响应规范

#### 成功响应（HTTP 201）
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

#### 错误响应

**参数错误（HTTP 400）**
```json
{
  "error": "sender_whitelist must be an array"
}
```

**邮箱已存在（HTTP 409）**
```json
{
  "error": "Mailbox already exists",
  "existing_mailbox": {
    "address": "myemail@localhost",
    "mailbox_id": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": 1640995200,
    "expires_at": 1641600000
  }
}
```

**数据库未启用（HTTP 400）**
```json
{
  "error": "Database storage not enabled. Use /create_mailbox for JSON storage."
}
```

### 1.4 核心实现逻辑

```python
@bp.route('/create_mailbox_v2', methods=['POST'])
def create_mailbox_v2():
    """
    创建邮箱 V2 版本 - 支持数据库存储、自定义时间和UUID
    """
    # 1. IP白名单验证
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    # 2. 参数验证
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # 3. 地址处理
    custom_address = data.get('address', '')
    if not custom_address:
        # 自动生成地址
        random_string = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
        random_domain = random.choice(config.DOMAINS)
        address = f"{random_string}@{random_domain}"
    else:
        # 处理自定义地址
        if '@' not in custom_address:
            address = f"{custom_address}@{config.DOMAIN}"
        else:
            address = custom_address

    # 4. 数据库创建
    if config.USE_DATABASE:
        # 检查邮箱是否存在
        existing_mailbox = inbox_handler.get_mailbox_info(address)
        if existing_mailbox and not existing_mailbox['is_expired']:
            return jsonify({"error": "Mailbox already exists"}), 409

        # 创建邮箱
        mailbox = inbox_handler.create_or_get_mailbox(
            address=address,
            retention_days=retention_days,
            sender_whitelist=sender_whitelist,
            created_by_ip=client_ip
        )

        # 处理自定义创建时间
        if custom_created_time is not None:
            expires_at = custom_created_time + (retention_days * 24 * 60 * 60)
            # 更新数据库记录

        return jsonify({
            "success": True,
            "address": address,
            "mailbox_id": mailbox['id'],
            "mailbox_key": mailbox['mailbox_key'],
            "created_at": mailbox['created_at'],
            "expires_at": mailbox['expires_at'],
            "sender_whitelist": sender_whitelist,
            "retention_days": retention_days,
            "available_domains": config.DOMAINS,
            "storage_type": "database",
            "message": "Mailbox created successfully. Please save your mailbox key securely."
        }), 201
```

---

## 2. 查看邮箱邮件接口

### 2.1 接口概览

**接口路径：** `GET /api/get_inbox?address={邮箱地址}`

**功能描述：**
- 获取指定邮箱的所有邮件列表
- 实现`get_inbox_emails`函数的完整功能
- 自动更新访问时间
- 完整的状态验证流程

**核心特性：**
- 邮箱存在性验证
- 过期状态检查
- 激活状态检查
- 访问时间更新
- 邮件数量限制

### 2.2 请求规范

#### 请求参数
| 参数 | 类型 | 必需 | 说明 | 示例 |
|------|------|------|------|------|
| `address` | string | 是 | 邮箱地址 | `myemail@example.com` |

#### 请求头（可选）
| 头名称 | 值 | 说明 |
|--------|-----|------|
| `Authorization` | 管理员密码 | 访问受保护邮箱时需要 |

#### 请求示例
```bash
# 基础请求
curl "http://localhost:5000/api/get_inbox?address=myemail@example.com"

# 受保护邮箱（需要管理员密码）
curl -H "Authorization: admin_password" \
  "http://localhost:5000/api/get_inbox?address=protected@example.com"
```

### 2.3 响应规范

#### 成功响应（HTTP 200）
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

#### 错误响应

**邮箱已过期（HTTP 410）**
```json
{
  "error": "Mailbox expired"
}
```

**IP受限（HTTP 403）**
```json
{
  "error": "Access denied - IP not whitelisted"
}
```

**未授权（HTTP 401）**
```json
{
  "error": "Unauthorized"
}
```

**服务器错误（HTTP 500）**
```json
{
  "error": "Failed to get inbox"
}
```

### 2.4 核心实现逻辑

```python
@bp.route('/get_inbox')
def get_inbox():
    """
    获取邮箱邮件列表 - 实现get_inbox_emails函数的核心功能
    """
    # 1. IP白名单验证
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    # 2. 获取请求参数
    addr = request.args.get("address", "")
    password = request.headers.get("Authorization", None)

    # 3. 受保护邮箱验证
    if re.match(config.PROTECTED_ADDRESSES, addr) and password != config.PASSWORD:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        if config.USE_DATABASE:
            # 数据库模式 - get_inbox_emails函数的核心逻辑
            mailbox_info = inbox_handler.get_mailbox_info(addr)
            if not mailbox_info:
                return jsonify([]), 200  # 邮箱不存在返回空数组

            if mailbox_info['is_expired']:
                return jsonify({"error": "Mailbox expired"}), 410

            # 获取邮件列表 - 对应get_inbox_emails函数
            emails = inbox_handler.get_emails_by_mailbox(mailbox_info['id'])
            return jsonify(emails), 200

        else:
            # JSON文件模式（兼容旧版本）
            # ... 实现逻辑
            return jsonify(address_inbox), 200

    except Exception as e:
        print(f"[ERROR] Failed to get inbox for {addr}: {str(e)}")
        return jsonify({"error": "Failed to get inbox"}), 500
```

---

## 完整使用示例

### 3. 基础使用流程

```javascript
class TempMailCore {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
    }

    // 1. 创建邮箱（V2接口）
    async createMailboxV2(addressInput, options = {}) {
        const {
            retentionDays = 7,
            senderWhitelist = [],
            createdAt = null
        } = options;

        const payload = {
            address: addressInput,
            retention_days: retentionDays,
            sender_whitelist: senderWhitelist
        };

        if (createdAt) {
            payload.created_at = createdAt;
        }

        const response = await fetch(`${this.baseUrl}/api/create_mailbox_v2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            console.log('✓ 邮箱创建成功');
            console.log(`  地址: ${result.address}`);
            console.log(`  邮箱ID: ${result.mailbox_id}`);
            console.log(`  密钥: ${result.mailbox_key}`);
            console.log(`  过期时间: ${new Date(result.expires_at * 1000).toLocaleString()}`);
            return result;
        } else {
            throw new Error(result.error || '创建邮箱失败');
        }
    }

    // 2. 获取邮件（对应get_inbox_emails函数）
    async getInboxEmails(address) {
        const response = await fetch(
            `${this.baseUrl}/api/get_inbox?address=${encodeURIComponent(address)}`
        );

        if (response.status === 200) {
            const emails = await response.json();
            console.log(`✓ 获取到 ${emails.length} 封邮件`);
            return emails;
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

    // 3. 完整工作流程
    async completeWorkflow(emailInput) {
        try {
            console.log('=== 1. 创建邮箱 ===');
            const mailbox = await this.createMailboxV2(emailInput, {
                retentionDays: 7,
                senderWhitelist: ['@gmail.com']
            });

            console.log('\n=== 2. 轮询检查邮件 ===');
            const emails = await this.waitForEmails(mailbox.address, 60, 3000);

            console.log('\n=== 3. 处理邮件 ===');
            emails.forEach((email, index) => {
                console.log(`\n邮件 ${index + 1}:`);
                console.log(`  发件人: ${email.From}`);
                console.log(`  主题: ${email.Subject}`);
                console.log(`  时间: ${email.Sent}`);
                console.log(`  已读: ${email.is_read ? '是' : '否'}`);
            });

            return { mailbox, emails };

        } catch (error) {
            console.error('工作流程失败:', error.message);
            throw error;
        }
    }

    // 4. 智能轮询等待邮件
    async waitForEmails(address, maxAttempts = 60, intervalMs = 3000) {
        for (let i = 1; i <= maxAttempts; i++) {
            try {
                console.log(`检查邮件 ${i}/${maxAttempts}...`);
                const emails = await this.getInboxEmails(address);

                if (emails.length > 0) {
                    console.log(`🎉 发现 ${emails.length} 封邮件！`);
                    return emails;
                }

                if (i < maxAttempts) {
                    console.log(`等待 ${intervalMs/1000}秒...`);
                    await this.sleep(intervalMs);
                }
            } catch (error) {
                if (error.message.includes('过期')) {
                    throw new Error('邮箱已过期，请重新创建');
                } else if (error.message.includes('IP访问被拒绝')) {
                    throw new Error('IP访问被拒绝，请检查网络环境');
                } else {
                    console.log(`检查失败: ${error.message}`);
                    if (i < maxAttempts) {
                        await this.sleep(intervalMs);
                    }
                }
            }
        }
        throw new Error('等待超时');
    }

    // 辅助方法
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 使用示例
async function demo() {
    const client = new TempMailCore('http://localhost:5000');

    try {
        // 完整工作流程演示
        const result = await client.completeWorkflow('test@example.com');
        console.log('\n✅ 演示完成！');
    } catch (error) {
        console.error('❌ 演示失败:', error.message);
    }
}

// 运行演示
demo();
```

### 4. 高级使用示例

```javascript
// 批量邮箱管理
class AdvancedTempMailManager extends TempMailCore {
    async createMultipleMailboxes(prefixes, options = {}) {
        const results = [];

        for (const prefix of prefixes) {
            try {
                const mailbox = await this.createMailboxV2(
                    `${prefix}@example.com`,
                    options
                );
                results.push({ success: true, mailbox });
                await this.sleep(1000); // 避免请求过快
            } catch (error) {
                results.push({ success: false, prefix, error: error.message });
            }
        }

        return results;
    }

    async monitorMailbox(address) {
        try {
            const emails = await this.getInboxEmails(address);
            const stats = {
                total: emails.length,
                unread: emails.filter(e => !e.is_read).length,
                recent: emails.filter(e => e.Timestamp > Date.now()/1000 - 3600).length
            };

            console.log(`邮箱 ${address} 统计:`, stats);
            return { emails, stats };
        } catch (error) {
            console.error(`监控邮箱 ${address} 失败:`, error.message);
            return { error: error.message };
        }
    }
}

// 错误处理示例
function handleApiError(error, operation) {
    const errorMap = {
        'IP': '请检查网络环境或联系管理员添加IP到白名单',
        '过期': '邮箱已过期，请重新创建邮箱',
        '不存在': '邮箱不存在，请检查邮箱地址',
        '未授权': '需要管理员权限访问该邮箱',
        '网络': '网络连接错误，请检查网络连接'
    };

    let userMessage = '操作失败，请稍后重试';

    for (const [key, message] of Object.entries(errorMap)) {
        if (error.message.includes(key)) {
            userMessage = message;
            break;
        }
    }

    console.error(`${operation}失败:`, error.message);
    return userMessage;
}

// 完整应用示例
async function fullApplicationDemo() {
    const manager = new AdvancedTempMailManager('http://localhost:5000');

    try {
        // 1. 批量创建邮箱
        console.log('批量创建邮箱...');
        const prefixes = ['user1', 'user2', 'admin', 'test'];
        const createResults = await manager.createMultipleMailboxes(prefixes, {
            retentionDays: 7,
            senderWhitelist: ['@gmail.com']
        });

        console.log(`创建完成: ${createResults.filter(r => r.success).length}/${prefixes.length} 成功`);

        // 2. 监控所有邮箱
        console.log('\n监控所有邮箱...');
        for (const result of createResults) {
            if (result.success) {
                await manager.monitorMailbox(result.mailbox.address);
                await manager.sleep(2000);
            }
        }

        // 3. 演示邮件接收
        console.log('\n等待邮件接收...');
        const testMailbox = createResults[0].mailbox;
        const emails = await manager.waitForEmails(testMailbox.address, 30, 5000);

        console.log(`\n📧 接收到 ${emails.length} 封邮件！`);

    } catch (error) {
        const userMessage = handleApiError(error, '完整演示');
        alert(userMessage);
    }
}
```

---

## 接口对比分析

### 5. V1 vs V2 接口对比

| 特性 | V1接口 (`/create_mailbox`) | V2接口 (`/create_mailbox_v2`) |
|------|---------------------------|-----------------------------|
| 存储方式 | JSON文件 | 数据库（推荐） |
| 密钥管理 | 无 | UUID + 访问令牌 |
| 时间管理 | 基础 | 支持自定义创建时间 |
| 错误处理 | 基础 | 详细错误信息 |
| 扩展性 | 有限 | 高度可扩展 |

### 6. 邮件接口特性

| 特性 | 实现方式 | 优势 |
|------|----------|------|
| 状态验证 | 完整的邮箱状态检查 | 确保数据一致性 |
| 访问更新 | 自动更新最后访问时间 | 便于统计和监控 |
| 数量限制 | 根据配置限制返回数量 | 防止数据过载 |
| 错误处理 | 详细的错误分类 | 便于问题定位 |

---

## 测试用例

### 7. 单元测试示例

```javascript
// 测试V2邮箱创建接口
async function testCreateMailboxV2() {
    const testCases = [
        {
            name: '基础创建',
            payload: { address: 'test1' },
            expectStatus: 201
        },
        {
            name: '带白名单创建',
            payload: {
                address: 'test2',
                sender_whitelist: ['@gmail.com']
            },
            expectStatus: 201
        },
        {
            name: '重复创建',
            payload: { address: 'test1' },
            expectStatus: 409
        }
    ];

    for (const testCase of testCases) {
        try {
            const response = await fetch('/api/create_mailbox_v2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testCase.payload)
            });

            if (response.status === testCase.expectStatus) {
                console.log(`✅ ${testCase.name}: 通过`);
            } else {
                console.log(`❌ ${testCase.name}: 期望 ${testCase.expectStatus}, 实际 ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ ${testCase.name}: 异常 - ${error.message}`);
        }
    }
}

// 测试邮件获取接口
async function testGetInbox() {
    const testCases = [
        { address: 'nonexistent@example.com', expectStatus: 200, expectEmpty: true },
        { address: 'test1@example.com', expectStatus: 200, expectEmpty: true }
    ];

    for (const testCase of testCases) {
        try {
            const response = await fetch(`/api/get_inbox?address=${encodeURIComponent(testCase.address)}`);

            if (response.status === testCase.expectStatus) {
                const emails = await response.json();
                if (testCase.expectEmpty && emails.length === 0) {
                    console.log(`✅ ${testCase.address}: 通过 (空邮箱)`);
                } else if (!testCase.expectEmpty) {
                    console.log(`✅ ${testCase.address}: 通过 (有邮件)`);
                } else {
                    console.log(`❌ ${testCase.address}: 期望空，实际有 ${emails.length} 封邮件`);
                }
            } else {
                console.log(`❌ ${testCase.address}: 期望 ${testCase.expectStatus}, 实际 ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ ${testCase.address}: 异常 - ${error.message}`);
        }
    }
}
```

---

## 故障排除指南

### 8. 常见问题及解决方案

#### 8.1 创建邮箱问题

**Q: 创建时提示"IP not whitelisted"？**
```
A: 需要管理员将您的IP添加到白名单中
解决方法：
1. 检查当前IP: ${您的IP}
2. 联系管理员添加IP到环境变量 IP_WHITELIST
3. 或暂时禁用IP白名单: ENABLE_IP_WHITELIST=false
```

**Q: 创建时提示"Database storage not enabled"？**
```
A: 数据库存储未启用
解决方法：
1. 设置环境变量: USE_DATABASE=true
2. 确保数据库文件存在: DATABASE_PATH=data/mailbox.db
3. 检查数据库连接配置
```

#### 8.2 获取邮件问题

**Q: 获取时提示"Mailbox expired"？**
```
A: 邮箱已过期
解决方法：
1. 创建新邮箱: 使用 create_mailbox_v2 接口
2. 或延长现有邮箱时间: 使用 update_retention 接口
```

**Q: 获取时提示"Access denied - IP not whitelisted"？**
```
A: IP不在白名单中
解决方法：
1. 检查IP白名单配置
2. 联系管理员添加IP
3. 或使用管理员密码访问受保护邮箱
```

### 9. 调试技巧

```javascript
// 调试模式
const DEBUG = true;

class DebugTempMailClient extends TempMailCore {
    async request(url, options = {}) {
        if (DEBUG) {
            console.log(`[DEBUG] 请求: ${options.method || 'GET'} ${url}`);
            console.log(`[DEBUG] 参数:`, options.body);
        }

        const response = await fetch(url, options);

        if (DEBUG) {
            console.log(`[DEBUG] 响应状态: ${response.status}`);
            const responseText = await response.text();
            console.log(`[DEBUG] 响应内容:`, responseText);

            try {
                const responseJson = JSON.parse(responseText);
                return { ...response, json: () => Promise.resolve(responseJson) };
            } catch {
                return response;
            }
        }

        return response;
    }
}
```

---

## 性能优化建议

### 10. 性能优化

#### 10.1 批量操作优化
```javascript
// 批量获取多个邮箱邮件
async batchGetEmails(addresses) {
    const promises = addresses.map(addr =>
        this.getInboxEmails(addr).catch(error => ({ address: addr, error: error.message }))
    );

    const results = await Promise.allSettled(promises);

    return results.map((result, index) => ({
        address: addresses[index],
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
    }));
}
```

#### 10.2 缓存策略
```javascript
// 带缓存的邮件获取
class CachedTempMailClient extends TempMailCore {
    constructor(baseUrl, cacheTime = 30000) { // 30秒缓存
        super(baseUrl);
        this.cache = new Map();
        this.cacheTime = cacheTime;
    }

    async getInboxEmails(address) {
        const cacheKey = `inbox_${address}`;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheTime) {
            console.log('使用缓存数据');
            return cached.data;
        }

        const emails = await super.getInboxEmails(address);

        this.cache.set(cacheKey, {
            data: emails,
            timestamp: Date.now()
        });

        return emails;
    }
}
```

---

## 总结

### 核心接口总结

1. **V2邮箱创建接口** (`POST /api/create_mailbox_v2`)
   - 高级邮箱创建功能
   - 支持数据库存储和UUID管理
   - 完整的参数验证和错误处理

2. **查看邮箱邮件接口** (`GET /api/get_inbox`)
   - 实现`get_inbox_emails`函数的完整功能
   - 自动状态验证和访问时间更新
   - 支持邮件数量限制和格式化返回

### 使用建议

1. **优先使用V2接口**：更稳定和功能更全
2. **正确处理错误**：根据不同的HTTP状态码进行相应处理
3. **合理使用轮询**：避免过度频繁的API调用
4. **保存重要信息**：邮箱密钥和访问令牌需要安全保存
5. **监控邮箱状态**：定期检查邮箱是否过期

这两个核心接口构成了临时邮箱系统的完整功能，开发者可以基于此构建各种邮件处理应用。