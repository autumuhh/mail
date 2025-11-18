# API 文档 (V2)

本文档详细描述了项目的所有 API 端点，包括参数、请求示例和响应格式。

## 用户 API (`src/backend/routes/api.py`)

这些 API 主要面向最终用户，用于邮箱的创建、管理和邮件收发。

---

### 1. 获取随机邮箱地址

- **功能:** 生成一个随机的临时邮箱地址。
- **端点:** `GET /api/get_random_address`
- **认证:** 需要请求的 IP 地址在白名单中。
- **请求示例:**
  ```bash
  curl -X GET http://127.0.0.1:5000/api/get_random_address
  ```
- **成功响应 (200):**
  ```json
  {
    "address": "a1b2c3d4e5f6g7h8@example.com",
    "available_domains": ["example.com", "maildrop.cc"]
  }
  ```
- **失败响应 (403):**
  ```json
  {
    "error": "Access denied - IP not whitelisted"
  }
  ```

---

### 2. 获取邮箱访问令牌

- **功能:** 使用邮箱地址和邮箱密钥进行身份验证，以获取用于后续 API 调用的访问令牌。
- **端点:** `POST /api/get_mailbox_token`
- **认证:** 需要请求的 IP 地址在白名单中。
- **请求体 (JSON):**
  ```json
  {
    "address": "user@example.com",
    "mailbox_key": "your-secret-mailbox-key"
  }
  ```
- **请求示例:**
  ```bash
  curl -X POST http://127.0.0.1:5000/api/get_mailbox_token \
  -H "Content-Type: application/json" \
  -d '{
    "address": "user@example.com",
    "mailbox_key": "your-secret-mailbox-key"
  }'
  ```
- **成功响应 (200):**
  ```json
  {
    "success": true,
    "address": "user@example.com",
    "access_token": "generated-access-token",
    "mailbox_id": "a-mailbox-uuid",
    "expires_at": 1678886400,
    "message": "Access token retrieved successfully"
  }
  ```
- **失败响应 (401):**
  ```json
  {
    "error": "Invalid mailbox key"
  }
  ```

---

### 3. 用户登录

- **功能:** 使用用户名和密码验证注册用户，并返回其个人资料及关联的邮箱列表。
- **端点:** `POST /api/user_login`
- **认证:** 需要请求的 IP 地址在白名单中。
- **请求体 (JSON):**
  ```json
  {
    "username": "testuser",
    "password": "password123"
  }
  ```
- **请求示例:**
  ```bash
  curl -X POST http://127.0.0.1:5000/api/user_login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
  ```
- **成功响应 (200):**
  ```json
  {
    "success": true,
    "user": {
      "id": "user-uuid",
      "username": "testuser",
      "email": "testuser@email.com",
      "created_at": 1678880000,
      "last_login": 1678886400
    },
    "mailboxes": [
      {
        "id": "mailbox-uuid-1",
        "address": "box1@example.com",
        "access_token": "token-for-box1",
        "expires_at": 1679886400
      }
    ],
    "message": "Login successful. You have 1 active mailboxes."
  }
  ```
- **失败响应 (401):**
  ```json
  {
    "error": "Invalid username or password"
  }
  ```

---

### 4. 使用子管理员令牌注册邮箱

- **功能:** 允许拥有子管理员权限的用户创建新的临时邮箱。
- **端点:** `POST /api/register_with_token`
- **认证:**
  - 请求头中必须包含 `X-Sub-Admin-Token`。
  - 需要请求的 IP 地址在白名单中。
- **请求体 (JSON):**
  ```json
  {
    "email": "new_mailbox_prefix",
    "retention_days": 7
  }
  ```
- **请求示例:**
  ```bash
  curl -X POST http://127.0.0.1:5000/api/register_with_token \
  -H "Content-Type: application/json" \
  -H "X-Sub-Admin-Token: sub-admin-secret-token" \
  -d '{
    "email": "new_mailbox_prefix",
    "retention_days": 7
  }'
  ```
- **成功响应 (201):**
  ```json
  {
    "success": true,
    "mailbox_created": true,
    "mailbox_address": "new_mailbox_prefix@allowed-domain.com",
    "access_token": "generated-access-token",
    "created_at": 1678886400,
    "expires_at": 1679491200,
    "retention_days": 7,
    "message": "Temporary mailbox created successfully"
  }
  ```
- **失败响应 (401):**
  ```json
  {
    "error": "Invalid token"
  }
  ```

---

### 5. 获取收件箱

- **功能:** 获取指定邮箱地址的邮件列表。
- **端点:** `GET /api/get_inbox`
- **认证:**
  1.  **令牌认证 (推荐):** 在 URL 参数中提供 `access_token`。
  2.  **密码认证:** 在请求头中提供 `Authorization` 管理员密码。
- **请求示例 (令牌认证):**
  ```bash
  curl -X GET "http://127.0.0.1:5000/api/get_inbox?address=user@example.com&token=user-access-token"
  ```
- **请求示例 (密码认证):**
  ```bash
  curl -X GET "http://127.0.0.1:5000/api/get_inbox?address=user@example.com" \
  -H "Authorization: your_admin_password"
  ```
- **成功响应 (200):**
  ```json
  [
    {
      "id": "email-uuid-1",
      "From": "sender@domain.com",
      "To": "user@example.com",
      "Subject": "Hello World",
      "Body": "This is the email body.",
      "Timestamp": 1678886400,
      "is_read": false
    }
  ]
  ```
- **失败响应 (410):**
  ```json
  {
    "error": "Mailbox expired"
  }
  ```

---

### 6. 删除邮件

- **功能:** 从邮箱中删除一封或多封邮件。
- **端点:**
  - `POST /api/delete_email` (删除单封)
  - `POST /api/delete_emails_batch` (批量删除)
- **认证:** URL 参数中必须提供 `token` (邮箱的 `access_token`)。
- **请求体 (删除单封):**
  ```json
  {
    "email_id": "email-uuid-to-delete"
  }
  ```
- **请求体 (批量删除):**
  ```json
  {
    "email_ids": ["email-uuid-1", "email-uuid-2"]
  }
  ```
- **请求示例 (删除单封):**
  ```bash
  curl -X POST "http://127.0.0.1:5000/api/delete_email?token=user-access-token" \
  -H "Content-Type: application/json" \
  -d '{"email_id": "email-uuid-to-delete"}'
  ```
- **成功响应 (200):**
  ```json
  {
    "success": true,
    "message": "Email deleted"
  }
  ```
- **失败响应 (401):**
  ```json
  {
    "error": "Invalid access token"
  }
  ```

---

## 管理员 API (`src/backend/routes/admin_api.py`)

这些 API 专为管理员设计，用于系统范围的管理和监控。所有请求都需要在 `Authorization` 请求头中提供管理员密码。

---

### 1. 获取邮箱列表

- **功能:** 列出系统中的所有邮箱，支持分页、搜索和状态过滤。
- **端点:** `GET /admin/mailboxes`
- **认证:** 管理员密码。
- **请求示例:**
  ```bash
  curl -X GET "http://127.0.0.1:5000/admin/mailboxes?page=1&page_size=10&status=active" \
  -H "Authorization: your_admin_password"
  ```
- **成功响应 (200):**
  ```json
  {
    "success": true,
    "data": {
      "mailboxes": [
        {
          "id": "mailbox-uuid",
          "address": "user@example.com",
          "is_active": true,
          "expires_at": 1679491200
        }
      ],
      "total": 100,
      "page": 1,
      "page_size": 10
    }
  }
  ```

---

### 2. 创建邮箱

- **功能:** 管理员直接创建一个新的邮箱。
- **端点:** `POST /admin/mailboxes`
- **认证:** 管理员密码。
- **请求体 (JSON):**
  ```json
  {
    "address": "newuser@example.com",
    "retention_days": 30,
    "sender_whitelist": ["@trusted.com"],
    "allowed_domains": ["example.com"]
  }
  ```
- **请求示例:**
  ```bash
  curl -X POST http://127.0.0.1:5000/admin/mailboxes \
  -H "Content-Type: application/json" \
  -H "Authorization: your_admin_password" \
  -d '{
    "address": "newuser@example.com",
    "retention_days": 30
  }'
  ```
- **成功响应 (200):**
  ```json
  {
    "success": true,
    "message": "Mailbox created successfully",
    "data": {
      "id": "new-mailbox-uuid",
      "address": "newuser@example.com",
      "access_token": "generated-access-token"
    }
  }
  ```

---

### 3. 更新邮箱

- **功能:** 更新指定邮箱的属性。
- **端点:** `PUT /admin/mailboxes/<mailbox_id>`
- **认证:** 管理员密码。
- **请求体 (JSON):**
  ```json
  {
    "retention_days": 60,
    "is_active": false
  }
  ```
- **请求示例:**
  ```bash
  curl -X PUT http://127.0.0.1:5000/admin/mailboxes/mailbox-uuid-to-update \
  -H "Content-Type: application/json" \
  -H "Authorization: your_admin_password" \
  -d '{
    "is_active": false
  }'
  ```
- **成功响应 (200):**
  ```json
  {
    "success": true,
    "message": "Mailbox updated successfully"
  }
  ```

---

### 4. 删除邮箱

- **功能:** 删除一个邮箱（支持软删除和硬删除）。
- **端点:** `DELETE /admin/mailboxes/<mailbox_id>`
- **认证:** 管理员密码。
- **请求示例 (软删除):**
  ```bash
  curl -X DELETE "http://127.0.0.1:5000/admin/mailboxes/mailbox-uuid-to-delete?soft=true" \
  -H "Authorization: your_admin_password"
  ```
- **成功响应 (200):**
  ```json
  {
    "success": true,
    "message": "Mailbox soft deleted"
  }
  ```

---

### 5. 获取系统统计信息

- **功能:** 获取关于邮箱和邮件的总体统计数据。
- **端点:** `GET /admin/stats`
- **认证:** 管理员密码。
- **请求示例:**
  ```bash
  curl -X GET http://127.0.0.1:5000/admin/stats \
  -H "Authorization: your_admin_password"
  ```
- **成功响应 (200):**
  ```json
  {
    "success": true,
    "data": {
      "total_mailboxes": 150,
      "active_mailboxes": 120,
      "expired_mailboxes": 20,
      "disabled_mailboxes": 10,
      "total_emails": 5000,
      "unread_emails": 300
    }
  }
  ```

---

### 6. 子管理员管理

- **功能:** 创建、更新和删除子管理员及其权限。
- **端点:**
  - `GET /admin/sub-admins`
  - `POST /admin/sub-admins`
  - `PUT /admin/sub-admins/<sub_admin_id>`
  - `DELETE /admin/sub-admins/<sub_admin_id>`
- **认证:** 管理员密码。
- **请求示例 (创建子管理员):**
  ```bash
  curl -X POST http://127.0.0.1:5000/admin/sub-admins \
  -H "Content-Type: application/json" \
  -H "Authorization: your_admin_password" \
  -d '{
    "token": "new-sub-admin-token",
    "domains": ["customer-domain.com"],
    "max_retention_days": 15,
    "notes": "Sub-admin for Customer X"
  }'
  ```
- **成功响应 (创建):**
  ```json
  {
    "success": true,
    "message": "子管理员创建成功",
    "data": {
      "id": "new-sub-admin-id",
      "token": "new-sub-admin-token"
    }
  }
