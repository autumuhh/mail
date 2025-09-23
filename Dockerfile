FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 创建数据目录和设置权限
RUN mkdir -p /app/data && \
    chmod 755 /app/data

# 设置环境变量
ENV PYTHONPATH=/app
ENV INBOX_FILE_NAME=/app/data/inbox.json

# 暴露端口 (SMTP: 25, Web: 5000)
EXPOSE 25 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/ || exit 1

# 创建非root用户
RUN useradd -m -u 1000 tempmail && \
    chown -R tempmail:tempmail /app

USER tempmail

# 启动应用
CMD ["python", "app.py"]
