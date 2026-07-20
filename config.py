import os
import logging
from dotenv import load_dotenv

load_dotenv()

# 配置日志
logger = logging.getLogger(__name__)

# ============================================
# 配置验证函数
# ============================================
def _get_int_env(key: str, default: int, min_val: int = None, max_val: int = None) -> int:
    """安全获取整数环境变量"""
    try:
        value = int(os.getenv(key, default))
        if min_val is not None and value < min_val:
            logger.warning(f"Config {key}={value} is below minimum {min_val}, using {min_val}")
            return min_val
        if max_val is not None and value > max_val:
            logger.warning(f"Config {key}={value} is above maximum {max_val}, using {max_val}")
            return max_val
        return value
    except ValueError:
        logger.warning(f"Invalid integer for {key}, using default {default}")
        return default

def _get_bool_env(key: str, default: bool) -> bool:
    """安全获取布尔环境变量"""
    return os.getenv(key, str(default).lower()).lower() == "true"

# ============================================
# 服务器配置
# ============================================
FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
FLASK_PORT = _get_int_env("FLASK_PORT", 5000, min_val=1, max_val=65535)

SMTP_HOST = os.getenv("SMTP_HOST", "0.0.0.0")
SMTP_PORT = _get_int_env("SMTP_PORT", 25, min_val=1, max_val=65535)

# ============================================
# 存储配置
# ============================================
INBOX_FILE_NAME = os.getenv("INBOX_FILE_NAME", "inbox.json")
MAX_INBOX_SIZE = _get_int_env("MAX_INBOX_SIZE", 100000000, min_val=1000)

# Database settings
DATABASE_PATH = os.getenv("DATABASE_PATH", "data/mailbox.db")
USE_DATABASE = _get_bool_env("USE_DATABASE", True)

# ============================================
# 安全配置
# ============================================
PROTECTED_ADDRESSES = os.getenv("PROTECTED_ADDRESSES", "^admin.*")
PASSWORD = os.getenv("PASSWORD", "password")

# 安全警告：检查默认密码
if PASSWORD == "password":
    logger.warning("SECURITY WARNING: Using default password. Set PASSWORD environment variable in production!")

# ============================================
# 域名配置
# ============================================
DOMAINS_STR = os.getenv("DOMAINS", os.getenv("DOMAIN", "localhost"))
DOMAINS = [domain.strip() for domain in DOMAINS_STR.split(",")]
DOMAIN = DOMAINS[0]  # 默认域名（向后兼容）

# ============================================
# 邮件保留配置
# ============================================
EMAIL_RETENTION_SECONDS = _get_int_env("EMAIL_RETENTION_SECONDS", 0, min_val=0)
EMAIL_RETENTION_DAYS = _get_int_env("EMAIL_RETENTION_DAYS", 7, min_val=1, max_val=365)

# Use seconds if specified, otherwise convert days to seconds
if EMAIL_RETENTION_SECONDS > 0:
    EMAIL_RETENTION_TIME = EMAIL_RETENTION_SECONDS
else:
    EMAIL_RETENTION_TIME = EMAIL_RETENTION_DAYS * 24 * 60 * 60

MAX_EMAILS_PER_ADDRESS = _get_int_env("MAX_EMAILS_PER_ADDRESS", 50, min_val=1, max_val=1000)

# ============================================
# IP白名单配置
# ============================================
ENABLE_IP_WHITELIST = _get_bool_env("ENABLE_IP_WHITELIST", False)
IP_WHITELIST = os.getenv("IP_WHITELIST", "127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8")

# ============================================
# 邮箱生命周期配置
# ============================================
MAILBOX_RETENTION_DAYS = _get_int_env("MAILBOX_RETENTION_DAYS", 30, min_val=1)
MAX_RETENTION_DAYS = _get_int_env("MAX_RETENTION_DAYS", 36500, min_val=1)
ENABLE_SENDER_WHITELIST = _get_bool_env("ENABLE_SENDER_WHITELIST", False)

# ============================================
# 存储限制配置
# ============================================
MAX_MAILBOX_SIZE_MB = _get_int_env("MAX_MAILBOX_SIZE_MB", 3, min_val=1, max_val=100)
MAX_MAILBOX_SIZE_BYTES = MAX_MAILBOX_SIZE_MB * 1024 * 1024
MAX_EMAIL_SIZE_MB = _get_int_env("MAX_EMAIL_SIZE_MB", 2, min_val=1, max_val=50)
MAX_EMAIL_SIZE_BYTES = MAX_EMAIL_SIZE_MB * 1024 * 1024

# ============================================
# IP封禁配置
# ============================================
IP_BLOCK_DURATION = _get_int_env("IP_BLOCK_DURATION", 300, min_val=60, max_val=86400)
IP_MAX_FAILED_ATTEMPTS = _get_int_env("IP_MAX_FAILED_ATTEMPTS", 3, min_val=1, max_val=100)
IP_ATTEMPT_WINDOW = _get_int_env("IP_ATTEMPT_WINDOW", 60, min_val=10, max_val=3600)