import os
from dotenv import load_dotenv

load_dotenv()

FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
FLASK_PORT = int(os.getenv("FLASK_PORT", 5000))

SMTP_HOST = os.getenv("SMTP_HOST", "0.0.0.0")
SMTP_PORT = int(os.getenv("SMTP_PORT", 2525))  # 使用非特权端口

INBOX_FILE_NAME = os.getenv("INBOX_FILE_NAME", "inbox.json")
MAX_INBOX_SIZE = int(os.getenv("MAX_INBOX_SIZE", 100000000))

# Database settings
DATABASE_PATH = os.getenv("DATABASE_PATH", "data/mailbox.db")
USE_DATABASE = os.getenv("USE_DATABASE", "true").lower() == "true"

PROTECTED_ADDRESSES = os.getenv("PROTECTED_ADDRESSES", "^admin.*")

PASSWORD = os.getenv("PASSWORD", "password")

# 支持多域名配置
DOMAINS_STR = os.getenv("DOMAINS", os.getenv("DOMAIN", "localhost"))
DOMAINS = [domain.strip() for domain in DOMAINS_STR.split(",")]
DOMAIN = DOMAINS[0]  # 默认域名（向后兼容）  # 本地测试用localhost

# Email retention settings
# Support both seconds (for testing) and days (for production)
EMAIL_RETENTION_SECONDS = int(os.getenv("EMAIL_RETENTION_SECONDS", 0))
EMAIL_RETENTION_DAYS = int(os.getenv("EMAIL_RETENTION_DAYS", 7))

# Use seconds if specified, otherwise convert days to seconds
if EMAIL_RETENTION_SECONDS > 0:
    EMAIL_RETENTION_TIME = EMAIL_RETENTION_SECONDS
else:
    EMAIL_RETENTION_TIME = EMAIL_RETENTION_DAYS * 24 * 60 * 60

MAX_EMAILS_PER_ADDRESS = int(os.getenv("MAX_EMAILS_PER_ADDRESS", 50))

# IP whitelist settings
ENABLE_IP_WHITELIST = os.getenv("ENABLE_IP_WHITELIST", "false").lower() == "true"
IP_WHITELIST = os.getenv("IP_WHITELIST", "127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8")

# Mailbox lifecycle settings
MAILBOX_RETENTION_DAYS = int(os.getenv("MAILBOX_RETENTION_DAYS", 30))  # 邮箱保留天数
ENABLE_SENDER_WHITELIST = os.getenv("ENABLE_SENDER_WHITELIST", "false").lower() == "true"

# 测试用：快速过期时间（单位：天，可以设置小数）
# EMAIL_RETENTION_DAYS = 0.001  # 约1.4分钟，用于测试