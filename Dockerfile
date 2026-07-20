FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 数据含邮件正文与访问令牌，仅允许容器内 root 读取。
RUN mkdir -p /app/data && \
    chmod 700 /app/data

# 设置环境变量
ENV PYTHONPATH=/app
ENV INBOX_FILE_NAME=/app/data/inbox.json

# 暴露端口 (SMTP: 25, Web: 5000)
EXPOSE 25 5000

# 丢弃响应体，避免 Docker 健康日志每 30 秒重复保存整页 HTML。
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -fsS -o /dev/null http://localhost:5000/ || exit 1

# 启动应用
# 注意：由于需要监听 25 端口，容器内应用需要 root 权限
CMD ["python", "app.py"]
