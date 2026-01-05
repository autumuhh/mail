# Maildrop 部署与使用报告

本文档详细介绍了 Maildrop 临时邮箱系统的部署流程、配置说明及使用方法。

## 1. 项目概述

Maildrop 是一个自托管的临时邮箱服务，允许用户在其自定义域名上接收电子邮件。V2 版本引入了 SQLite 数据库支持、双重身份验证机制、更完善的 API 和管理面板。

### 核心特性
- **多域名支持**：可在多个域名下同时运行。
- **SQLite 存储**：提供更可靠的数据管理。
- **管理面板**：可视化管理邮箱、查看审计日志和安全配置。
- **生命周期管理**：自定义邮件和邮箱的保留期限。
- **API V2**：完善的 RESTful 接口，方便集成。

---

## 2. 部署指南

### 2.1 环境准备
- **操作系统**：Linux (推荐 Ubuntu 20.04+)
- **Python 环境**：Python 3.8+
- **网络要求**：必须开放 **25 端口** (SMTP) 和 **5000 端口** (HTTP)。
  - *注意：许多云服务商（如 AWS, GCP, 阿里云）默认屏蔽 25 端口，需申请解封。*

### 2.2 域名配置 (关键步骤)
为了接收邮件，必须正确配置域名的 DNS 记录：
1. **A 记录**：将 `mail.yourdomain.com` 指向服务器的公网 IP。
2. **MX 记录**：将根域名 `yourdomain.com` 的 MX 记录指向 `mail.yourdomain.com`，优先级设为 10。

### 2.3 方式一：本地 Python 部署
1. **克隆代码**：
   ```bash
   git clone https://github.com/autumuhh/mail.git
   cd mail
   ```
2. **创建虚拟环境**：
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows 使用 venv\Scripts\activate
   ```
3. **安装依赖**：
   ```bash
   pip install -r requirements.txt
   ```
4. **配置环境变量**：
   复制 `.env.example` 为 `.env` 并根据实际情况修改（详见第 3 节）。
5. **运行应用**：
   ```bash
   # 必须使用 root 权限以绑定 25 端口
   sudo venv/bin/python app.py
   ```

### 2.4 方式二：Docker Compose 部署 (推荐)
1. **准备 `docker-compose.yml`**：
   确保目录下已有该文件。
2. **启动容器**：
   ```bash
   docker-compose up -d
   ```
   该命令会自动构建镜像并启动 Flask 和 SMTP 服务。

---

## 3. 配置说明 (.env)

| 变量名 | 说明 | 示例值 |
| :--- | :--- | :--- |
| `FLASK_PORT` | Web 界面端口 | `5000` |
| `SMTP_PORT` | SMTP 接收端口 | `25` |
| `PASSWORD` | 管理员登录密码 | `your_secure_password` |
| `DOMAINS` | 支持的域名列表 (逗号分隔) | `domain1.com,domain2.com` |
| `USE_DATABASE` | 是否启用 SQLite 存储 | `true` |
| `EMAIL_RETENTION_DAYS` | 邮件保留天数 | `7` |
| `MAILBOX_RETENTION_DAYS`| 邮箱保留天数 | `30` |

---

## 4. 使用说明

### 4.1 管理员功能
- **访问地址**：`http://your-ip:5000/admin/mailboxes`
- **登录**：使用 `.env` 中设置的 `PASSWORD` 进行验证。
- **功能**：
  - **仪表板**：查看全站统计数据。
  - **邮箱管理**：创建、禁用或硬删除邮箱地址。
  - **审计日志**：追踪系统关键操作。
  - **安全监控**：查看被封禁的 IP 列表及解封。

### 4.2 用户功能
- **注册邮箱**：管理员可在管理面板或 `/register` 页面为用户手动创建邮箱。
- **登录查看**：用户通过 `邮箱地址` + `邮箱密钥 (Mailbox Key)` 访问其收件箱。
- **API 测试**：访问 `/api-test` 页面可在线测试各项接口。

---

## 5. 维护与排调

- **查看日志**：
  - Docker 模式：`docker-compose logs -f`
  - 物理部署：查看控制台输出。
- **数据库位置**：默认存储在 `./data/mailbox.db`。建议定期备份此文件。
- **清理任务**：系统会自动启动一个后台线程，根据配置的保留期限清理过期数据。

---
*报告更新日期：2026-01-05*
