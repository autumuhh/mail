import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def _get_int_env(key: str, default: int, min_val: int = None, max_val: int = None) -> int:
    """安全获取并限制整数环境变量。"""
    try:
        value = int(os.getenv(key, default))
    except (TypeError, ValueError):
        logger.warning("Invalid integer for %s, using default %s", key, default)
        return default

    if min_val is not None and value < min_val:
        logger.warning("Config %s=%s is below minimum %s, using %s", key, value, min_val, min_val)
        return min_val
    if max_val is not None and value > max_val:
        logger.warning("Config %s=%s is above maximum %s, using %s", key, value, max_val, max_val)
        return max_val
    return value


def _get_bool_env(key: str, default: bool) -> bool:
    """安全获取布尔环境变量。"""
    return os.getenv(key, str(default).lower()).strip().lower() == "true"


FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
FLASK_PORT = _get_int_env("FLASK_PORT", 5000, min_val=1, max_val=65535)
# 仅在确认入口经过固定反向代理时启用；默认不信任客户端可伪造的转发头。
TRUST_PROXY_HOPS = _get_int_env("TRUST_PROXY_HOPS", 0, min_val=0, max_val=10)

SMTP_HOST = os.getenv("SMTP_HOST", "0.0.0.0")
SMTP_PORT = _get_int_env("SMTP_PORT", 25, min_val=1, max_val=65535)

INBOX_FILE_NAME = os.getenv("INBOX_FILE_NAME", "inbox.json")
MAX_INBOX_SIZE = _get_int_env("MAX_INBOX_SIZE", 100000000, min_val=1000)

# Database settings
DATABASE_PATH = os.getenv("DATABASE_PATH", "data/mailbox.db")
USE_DATABASE = _get_bool_env("USE_DATABASE", True)

PROTECTED_ADDRESSES = os.getenv("PROTECTED_ADDRESSES", "^admin.*")

# 管理密码缺失时必须拒绝认证，避免部署遗漏 .env 后落入公开默认口令。
PASSWORD = os.getenv("PASSWORD", "").strip()

# 支持多域名配置
DOMAINS_STR = os.getenv("DOMAINS", os.getenv("DOMAIN", "localhost"))
DOMAINS = [domain.strip() for domain in DOMAINS_STR.split(",")]
DOMAIN = DOMAINS[0]  # 默认域名（向后兼容）  # 本地测试用localhost

# Email retention settings
# Support both seconds (for testing) and days (for production)
EMAIL_RETENTION_SECONDS = _get_int_env("EMAIL_RETENTION_SECONDS", 0, min_val=0)
EMAIL_RETENTION_DAYS = _get_int_env("EMAIL_RETENTION_DAYS", 7, min_val=1, max_val=365)

# Use seconds if specified, otherwise convert days to seconds
if EMAIL_RETENTION_SECONDS > 0:
    EMAIL_RETENTION_TIME = EMAIL_RETENTION_SECONDS
else:
    EMAIL_RETENTION_TIME = EMAIL_RETENTION_DAYS * 24 * 60 * 60

MAX_EMAILS_PER_ADDRESS = _get_int_env("MAX_EMAILS_PER_ADDRESS", 50, min_val=1, max_val=1000)

# IP whitelist settings
ENABLE_IP_WHITELIST = _get_bool_env("ENABLE_IP_WHITELIST", False)
IP_WHITELIST = os.getenv("IP_WHITELIST", "127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8")

# Mailbox lifecycle settings
MAILBOX_RETENTION_DAYS = _get_int_env("MAILBOX_RETENTION_DAYS", 30, min_val=1)
MAX_RETENTION_DAYS = _get_int_env("MAX_RETENTION_DAYS", 36500, min_val=1)
ENABLE_SENDER_WHITELIST = _get_bool_env("ENABLE_SENDER_WHITELIST", False)

# Mailbox storage limits
MAX_MAILBOX_SIZE_MB = _get_int_env("MAX_MAILBOX_SIZE_MB", 3, min_val=1, max_val=100)
MAX_MAILBOX_SIZE_BYTES = MAX_MAILBOX_SIZE_MB * 1024 * 1024  # 转换为字节
MAX_EMAIL_SIZE_MB = _get_int_env("MAX_EMAIL_SIZE_MB", 2, min_val=1, max_val=50)
MAX_EMAIL_SIZE_BYTES = MAX_EMAIL_SIZE_MB * 1024 * 1024  # 转换为字节

# 测试用：快速过期时间（单位：天，可以设置小数）
# EMAIL_RETENTION_DAYS = 0.001  # 约1.4分钟，用于测试

# IP封禁配置
IP_BLOCK_DURATION = _get_int_env("IP_BLOCK_DURATION", 300, min_val=60, max_val=86400)
IP_MAX_FAILED_ATTEMPTS = _get_int_env("IP_MAX_FAILED_ATTEMPTS", 3, min_val=1, max_val=100)
IP_ATTEMPT_WINDOW = _get_int_env("IP_ATTEMPT_WINDOW", 60, min_val=10, max_val=3600)
