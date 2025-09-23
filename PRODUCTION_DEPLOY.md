# 生产环境部署指南

本指南基于本仓库内置的 Dockerfile 与 docker-compose.yml/.env.production，提供一套可复用、可验证的生产部署流程。

## 🚀 服务器部署步骤

### 1. 服务器准备
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker 与 Docker Compose 插件
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 将当前用户加入 docker 组（重新登录生效）
sudo usermod -aG docker $USER
```

### 2. 域名与 DNS 配置
在你的 DNS 服务商处创建以下记录：
```
A  记录: mail.yourdomain.com  ->  <你的服务器公网IP>
MX 记录: yourdomain.com       ->  mail.yourdomain.com  (优先级 10)
A  记录: yourdomain.com       ->  <你的服务器公网IP> (可选，用于 Web 访问)
```

### 3. 防火墙放行
```bash
# Ubuntu/Debian
sudo ufw allow 25/tcp     # SMTP
sudo ufw allow 8080/tcp   # Web 界面
sudo ufw allow 22/tcp     # SSH
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=25/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

### 4. 部署应用
```bash
# 克隆代码到服务器
git clone <your-repo> maildrop
cd maildrop

# 准备环境变量（生产示例已提供）
cp .env.production .env
nano .env   # 修改 DOMAIN 与 PASSWORD 等关键参数

# 使用 Docker Compose 启动
docker compose up -d      # 首次会自动构建镜像

# 查看状态与日志
docker compose ps
docker compose logs -f
```

说明：
- 本仓库内置 docker-compose.yml 将 Web 暴露为宿主 8080 端口（映射容器 5000），SMTP 暴露为宿主 25 端口。
- 邮件数据持久化在宿主目录 `./data`（容器内为 `/app/data`）。

## 🌐 访问地址

- Web 界面: http://yourdomain.com:8080
- API 测试页: http://yourdomain.com:8080/api-test
- 管理面板: http://yourdomain.com:8080/admin

## 📧 邮件测试

部署完成后，可从外部邮箱向以下地址发送邮件进行验证：
- `test@yourdomain.com`
- `anything@yourdomain.com`

同时也可以在服务器上使用 `sendmail`/`swaks`/`telnet` 等工具测试 SMTP 投递到 `mail.yourdomain.com:25`。

## 🔧 生产优化建议

### 1. 配置 SSL（推荐）
如需 HTTPS 与反向代理，请在服务器上部署 Nginx/Traefik 并签发证书（以 Certbot 为例）：
```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d yourdomain.com -d mail.yourdomain.com

# 自动续期
sudo crontab -e
# 添加一行：
0 12 * * * /usr/bin/certbot renew --quiet
```

Nginx 示例（将 80/443 转发到本服务 8080；SMTP 25 直接映射，不经反代）：
```
# 参考：server { listen 80/443; proxy_pass http://127.0.0.1:8080; }
# 注：本仓库未内置 nginx compose 配置，如需容器化 nginx，可自行新增 service。
```

### 2. 监控与日志
```bash
docker compose logs -f
docker stats
```

### 3. 重要注意事项
1) 端口 25：容器内绑定 25，无需容器提权；宿主需确保 25 端口未被占用且已放行。
2) 域名解析：MX 指向 `mail.yourdomain.com`；建议为 Web 同时配置 `yourdomain.com` A 记录。
3) 安全：务必修改 `.env` 中默认 `PASSWORD` 值；可开启并收紧 `IP_WHITELIST`（默认允许本地与私网）。
4) 数据：定期备份 `./data` 目录；升级前先备份。
5) 留存策略：生产建议使用 `EMAIL_RETENTION_DAYS`（天级），不要使用秒级测试配置。

## 🛠️ 故障排除

### SMTP 无法收信
```bash
# 检查宿主端口是否监听/转发
sudo ss -tlnp | grep :25 || sudo netstat -tlnp | grep :25

# 检查域名 MX 解析
nslookup -type=MX yourdomain.com

# 从外部测试 SMTP 25 连接
telnet mail.yourdomain.com 25
```

### Web 无法访问
```bash
docker compose ps
docker compose port maildrop 5000
docker compose logs maildrop
```

## 📊 性能与伸缩

### 1. 资源限制（可选）
```yaml
# 在 docker-compose.yml 中添加
services:
  maildrop:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
```

### 2. 清理策略
在 `.env` 中调整：
```bash
EMAIL_RETENTION_DAYS=7        # 邮件保留 7 天
MAILBOX_RETENTION_DAYS=30     # 邮箱保留 30 天
# 或用于测试：EMAIL_RETENTION_SECONDS=86400  # 1 天（秒）
```

### 3. 水平扩展（需前置负载均衡）
```bash
# 仅示例：Compose 原地扩容
docker compose up --scale maildrop=3 -d
# 注意：需要前置负载均衡（如 Nginx/HAProxy/LB）对 Web 层做轮询；
# SMTP 25 端口通常由单实例接收或通过外部 MTA 路由。
```

