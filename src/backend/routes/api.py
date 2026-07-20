from flask import Blueprint, request, jsonify
import config

# 根据配置选择使用数据库还是JSON文件
try:
    if config.USE_DATABASE:
        import sys
        import os
        # 添加backend目录到路径
        backend_dir = os.path.dirname(os.path.dirname(__file__))
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)
        from .. import db_inbox_handler as inbox_handler
    else:
        from .. import inbox_handler
except ImportError as e:
    # 如果数据库模块导入失败，回退到JSON处理器
    print(f"Warning: Database modules not available ({e}), falling back to JSON storage")
    from .. import inbox_handler
import re
import random
import string
import hmac

bp = Blueprint('api', __name__)


def _get_bearer_token():
    """只接受 Bearer 令牌，避免访问令牌再次出现在 URL 和日志中。"""
    authorization = request.headers.get('Authorization', '').strip()
    scheme, separator, token = authorization.partition(' ')
    if separator and scheme.lower() == 'bearer' and token.strip():
        return token.strip()
    return None


def _authenticate_mailbox(address=None, allow_disabled=False):
    """统一验证邮箱令牌、状态以及可选的地址归属。"""
    if not config.USE_DATABASE:
        return None, (jsonify({
            'error': 'Database storage not enabled',
            'message': 'Mailbox authentication requires database storage',
        }), 400)

    access_token = _get_bearer_token()
    if not access_token:
        return None, (jsonify({
            'error': 'Authentication required',
            'message': 'Provide an access token using the Authorization: Bearer header',
        }), 401)

    from database import db_manager
    mailbox = db_manager.get_mailbox_by_token(access_token)
    if not mailbox:
        return None, (jsonify({
            'error': 'Invalid access token',
            'message': 'The provided access token is invalid',
        }), 401)
    if db_manager.is_mailbox_expired(mailbox):
        return None, (jsonify({
            'error': 'Mailbox expired',
            'message': 'This mailbox has expired',
        }), 410)
    if not allow_disabled and not mailbox.get('is_active', True):
        return None, (jsonify({
            'error': 'Mailbox disabled',
            'message': 'This mailbox has been disabled',
        }), 423)
    if address is not None and mailbox['address'] != address:
        return None, (jsonify({
            'error': 'Permission denied',
            'message': 'The access token does not belong to the requested mailbox',
        }), 403)
    return mailbox, None


def _get_owned_email(mailbox, email_id):
    """先验证邮件归属再执行读取或写入，防止跨邮箱 ID 操作。"""
    from database import db_manager
    email = db_manager.get_email_by_id(email_id)
    if not email:
        return None, (jsonify({
            'error': 'Email not found',
            'message': 'The requested email does not exist',
        }), 404)
    if email['mailbox_id'] != mailbox['id']:
        return None, (jsonify({
            'error': 'Permission denied',
            'message': 'The email does not belong to the authenticated mailbox',
        }), 403)
    return email, None

# Make a random email containing 16 characters
@bp.route('/get_random_address')
def get_random_address():
    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403
    random_string = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
    # 从多个域名中随机选择一个
    print(f"[DEBUG] Available domains: {config.DOMAINS}")
    random_domain = random.choice(config.DOMAINS)
    print(f"[DEBUG] Selected domain: {random_domain}")
    return jsonify({
        "address": f"{random_string}@{random_domain}",
        "available_domains": config.DOMAINS
    }), 200

@bp.route('/get_mailbox_token', methods=['POST'])
def get_mailbox_token():
    """使用邮箱地址和密钥换取仅在请求头中使用的访问令牌。"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({
            "error": "Access denied - IP not whitelisted",
            "message": "Your IP address is not allowed",
        }), 403

    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not data:
        return jsonify({"error": "No data provided", "message": "Request JSON is required"}), 400

    # 在调用 strip 前限定字符串类型，避免畸形 JSON 把认证失败放大为 500。
    address_raw = data.get('address', '')
    mailbox_key_raw = data.get('mailbox_key', '')
    if not isinstance(address_raw, str) or not isinstance(mailbox_key_raw, str):
        return jsonify({
            "error": "Invalid credential types",
            "message": "Mailbox address and key must be strings",
        }), 400

    address = address_raw.strip()
    mailbox_key = mailbox_key_raw.strip()

    if not address:
        return jsonify({"error": "Address is required", "message": "Mailbox address is required"}), 400

    if not mailbox_key:
        return jsonify({"error": "Mailbox key is required", "message": "Mailbox key is required"}), 400

    # 验证邮箱地址格式
    if '@' not in address:
        return jsonify({"error": "Invalid email address format", "message": "Mailbox address is invalid"}), 400

    try:
        if config.USE_DATABASE:
            mailbox_info = inbox_handler.get_mailbox_info(address)
            if not mailbox_info:
                return jsonify({"error": "Mailbox not found", "message": "Mailbox does not exist"}), 404

            stored_key = mailbox_info.get('mailbox_key') or ''
            if not hmac.compare_digest(stored_key, mailbox_key):
                return jsonify({"error": "Invalid mailbox key", "message": "Mailbox key is incorrect"}), 401
            if mailbox_info['is_expired']:
                return jsonify({"error": "Mailbox has expired", "message": "This mailbox has expired"}), 410
            if not mailbox_info.get('is_active', True):
                return jsonify({"error": "Mailbox disabled", "message": "This mailbox has been disabled"}), 423

            return jsonify({
                "success": True,
                "address": address,
                "access_token": mailbox_info['access_token'],
                "mailbox_id": mailbox_info['id'],
                "expires_at": mailbox_info['expires_at'],
                "message": "Access token retrieved successfully"
            }), 200
        else:
            return jsonify({
                "error": "Database storage not enabled",
                "message": "This endpoint requires database storage",
            }), 400

    except Exception as e:
        print(f"[ERROR] 获取邮箱访问令牌失败: {e}")
        return jsonify({"error": "Failed to get access token", "message": "Unable to authenticate mailbox"}), 500

# 使用子管理员token创建邮箱
@bp.route('/register_with_token', methods=['POST'])
def register_with_token():
    """
    使用子管理员token创建邮箱
    需要在请求头中提供 X-Sub-Admin-Token
    """
    # 导入IP封禁器
    from ip_blocker import ip_blocker

    # 获取客户端IP
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')

    # 检查IP是否被封禁
    if ip_blocker.is_blocked(client_ip):
        remaining = ip_blocker.get_remaining_block_time(client_ip)
        return jsonify({
            "error": "IP blocked",
            "message": f"IP已被临时封禁，剩余 {remaining} 秒"
        }), 403

    # 检查token
    token = request.headers.get("X-Sub-Admin-Token", None)
    if not token:
        ip_blocker.record_failed_attempt(client_ip)
        return jsonify({
            "error": "Authentication required",
            "message": "Sub-admin token required in X-Sub-Admin-Token header"
        }), 401

    # 验证token
    if not config.USE_DATABASE:
        return jsonify({"error": "Database not enabled"}), 500

    from database import db_manager

    sub_admin = db_manager.get_sub_admin_by_token(token)
    if not sub_admin:
        is_blocked = ip_blocker.record_failed_attempt(client_ip)
        if is_blocked:
            return jsonify({
                "error": "Too many failed attempts",
                "message": f"认证失败次数过多，IP已被封禁 {ip_blocker.block_duration} 秒"
            }), 403
        return jsonify({"error": "Invalid token"}), 401

    if not sub_admin['is_active']:
        return jsonify({"error": "Sub-admin is disabled"}), 403

    # 获取子管理员的权限
    allowed_domains = sub_admin['domains']
    sender_whitelist = sub_admin['sender_whitelist']
    max_retention_days = sub_admin.get('max_retention_days', 30)

    # 检查IP白名单
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not data:
        return jsonify({"error": "No data provided"}), 400

    # Get parameters
    email_input_raw = data.get('email', '')
    if not isinstance(email_input_raw, str):
        return jsonify({"error": "Email address or prefix must be a string"}), 400
    email_input = email_input_raw.strip()
    retention_days = data.get('retention_days', config.MAILBOX_RETENTION_DAYS)

    # Validate required fields
    if not email_input:
        return jsonify({"error": "Email address or prefix is required"}), 400

    # Check if user provided full email or just prefix
    if '@' in email_input:
        # User provided full email address
        email = email_input

        local_part, email_domain = email.rsplit('@', 1) if email.count('@') == 1 else ('', '')
        # 子管理员输入会在主管理后台展示，严格字符集可从源头阻断存储型 XSS。
        if (not re.fullmatch(r'[a-zA-Z0-9_]{3,20}', local_part)
                or not re.fullmatch(r'[a-zA-Z0-9.-]+', email_domain)):
            return jsonify({"error": "Invalid email address format"}), 400

        # 验证域名是否在允许的范围内
        if email_domain not in allowed_domains:
            return jsonify({
                "error": "Domain not allowed",
                "message": f"只能使用以下域名: {', '.join(allowed_domains)}"
            }), 403
    else:
        # User provided only prefix, add random domain from allowed domains
        email_prefix = email_input

        # Validate email prefix format
        if not re.fullmatch(r'[a-zA-Z0-9_]{3,20}', email_prefix):
            return jsonify({"error": "Email prefix must be 3-20 characters, letters, numbers, and underscores only"}), 400

        # Generate full email address with random domain from allowed domains
        random_domain = random.choice(allowed_domains)
        email = f"{email_prefix}@{random_domain}"

    # Validate retention days
    if not isinstance(retention_days, int) or retention_days < 1 or retention_days > 365:
        return jsonify({"error": "Retention days must be between 1 and 365"}), 400

    # 检查是否超过子管理员的最长保留天数限制
    if retention_days > max_retention_days:
        return jsonify({
            "error": "Retention days exceeds limit",
            "message": f"保留天数不能超过 {max_retention_days} 天"
        }), 400

    try:
        # 检查邮箱是否已存在
        existing_mailbox = inbox_handler.get_mailbox_info(email)
        if existing_mailbox and not existing_mailbox['is_expired']:
            return jsonify({
                "error": "Mailbox already exists",
                "existing_mailbox": {
                    "address": existing_mailbox['address'],
                    "created_at": existing_mailbox['created_at'],
                    "expires_at": existing_mailbox['expires_at']
                }
            }), 409

        # 创建邮箱，并设置发件人白名单
        mailbox = inbox_handler.create_or_get_mailbox(
            address=email,
            retention_days=retention_days,
            sender_whitelist=sender_whitelist,
            created_by_ip=client_ip,
            created_source="sub_admin_token"
        )

        return jsonify({
            "success": True,
            "mailbox_created": True,
            "mailbox_address": email,
            "access_token": mailbox['access_token'],
            "mailbox_key": mailbox['mailbox_key'],
            "created_at": mailbox['created_at'],
            "expires_at": mailbox['expires_at'],
            "retention_days": retention_days,
            "message": "Temporary mailbox created successfully"
        }), 201
    except Exception as e:
        return jsonify({"error": f"Failed to create mailbox: {str(e)}"}), 500


# 新增：用户注册接口
@bp.route('/register', methods=['POST'])
def register():
    """
    用户注册接口 - 创建用户账户，可选择同时创建临时邮箱
    需要Authorization请求头验证管理员密码
    """
    # 导入IP封禁器
    from ip_blocker import ip_blocker

    # 获取客户端IP
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')

    # 检查IP是否被封禁
    if ip_blocker.is_blocked(client_ip):
        remaining = ip_blocker.get_remaining_block_time(client_ip)
        return jsonify({
            "error": "IP blocked",
            "message": f"IP已被临时封禁，剩余 {remaining} 秒"
        }), 403

    # Check Authorization header (admin password required for registration)
    admin_password = request.headers.get("Authorization", None)
    if not config.PASSWORD:
        return jsonify({"error": "Admin password is not configured"}), 503
    if not admin_password:
        ip_blocker.record_failed_attempt(client_ip)
        return jsonify({
            "error": "Authentication required",
            "message": "Registration requires admin password in Authorization header"
        }), 401

    if not hmac.compare_digest(admin_password, config.PASSWORD):
        is_blocked = ip_blocker.record_failed_attempt(client_ip)
        if is_blocked:
            return jsonify({
                "error": "Too many failed attempts",
                "message": f"认证失败次数过多，IP已被封禁 {ip_blocker.block_duration} 秒"
            }), 403
        return jsonify({"error": "Invalid admin password"}), 401

    # Check IP whitelist
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not data:
        return jsonify({"error": "No data provided"}), 400

    # Get parameters
    email_input_raw = data.get('email', '')
    if not isinstance(email_input_raw, str):
        return jsonify({"error": "Email address or prefix must be a string"}), 400
    email_input = email_input_raw.strip()
    retention_days = data.get('retention_days', config.MAILBOX_RETENTION_DAYS)

    # Validate required fields
    if not email_input:
        return jsonify({"error": "Email address or prefix is required"}), 400

    # Check if user provided full email or just prefix
    if '@' in email_input:
        # User provided full email address
        email = email_input

        local_part, email_domain = email.rsplit('@', 1) if email.count('@') == 1 else ('', '')
        # 即使调用者是管理员，也要保证落库地址可安全显示且可被 SMTP 域名处理。
        if (not re.fullmatch(r'[a-zA-Z0-9_]{3,20}', local_part)
                or not re.fullmatch(r'[a-zA-Z0-9.-]+', email_domain)):
            return jsonify({"error": "Invalid email address format"}), 400
    else:
        # User provided only prefix, add random domain
        email_prefix = email_input

        # Validate email prefix format (only if it's not a full email)
        if not re.fullmatch(r'[a-zA-Z0-9_]{3,20}', email_prefix):
            return jsonify({"error": "Email prefix must be 3-20 characters, letters, numbers, and underscores only"}), 400

        # Generate full email address with random domain
        random_domain = random.choice(config.DOMAINS)
        email = f"{email_prefix}@{random_domain}"

    # Validate retention days
    if not isinstance(retention_days, int) or retention_days < 1 or retention_days > 365:
        return jsonify({"error": "Retention days must be between 1 and 365"}), 400

    try:
        if config.USE_DATABASE:
            # 导入数据库管理器
            from database import db_manager

            # 检查邮箱是否已存在
            existing_mailbox = inbox_handler.get_mailbox_info(email)
            if existing_mailbox and not existing_mailbox['is_expired']:
                return jsonify({
                    "error": "Mailbox already exists",
                    "existing_mailbox": {
                        "address": existing_mailbox['address'],
                        "mailbox_id": existing_mailbox['id'],
                        "created_at": existing_mailbox['created_at'],
                        "expires_at": existing_mailbox['expires_at']
                    }
                }), 409

            # 创建邮箱
            mailbox = inbox_handler.create_or_get_mailbox(
                address=email,
                retention_days=retention_days,
                sender_whitelist=[],
                created_by_ip=client_ip,
                created_source="register"
            )

            result_data = {
                "success": True,
                "mailbox_created": True,
                "mailbox_address": email,
                "access_token": mailbox['access_token'],
                "mailbox_key": mailbox['mailbox_key'],
                "created_at": mailbox['created_at'],
                "expires_at": mailbox['expires_at'],
                "retention_days": retention_days,
                "message": "Temporary mailbox created successfully"
            }

            return jsonify(result_data), 201

        else:
            return jsonify({
                "error": "Database storage not enabled. User registration requires database storage."
            }), 400

    except Exception as e:
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500

# 新增：通过访问令牌获取邮箱信息
@bp.route('/mailbox_info_v2')
def get_mailbox_info_v2():
    """返回当前 Bearer 令牌对应的邮箱公开信息，不回传任何秘密。"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({
            "error": "Access denied - IP not whitelisted",
            "message": "Your IP address is not allowed",
        }), 403

    try:
        mailbox, auth_error = _authenticate_mailbox()
        if auth_error:
            return auth_error

        from database import db_manager
        stats = db_manager.get_mailbox_stats(mailbox['id'])
        return jsonify({
            "success": True,
            "mailbox": {
                "id": mailbox['id'],
                "address": mailbox['address'],
                "created_at": mailbox['created_at'],
                "expires_at": mailbox['expires_at'],
                "retention_days": mailbox['retention_days'],
                "sender_whitelist": mailbox['sender_whitelist'],
                "whitelist_enabled": mailbox.get('whitelist_enabled', False),
                "is_active": mailbox.get('is_active', True),
                "is_expired": False,
                "email_count": stats['total_emails'],
                "unread_count": stats['unread_emails'],
                "last_email_time": stats['last_email_time'],
                "storage_used": stats.get('storage_used', 0),
                "storage_limit": stats.get('storage_limit', 0),
            },
            "storage_type": "database",
        }), 200

    except Exception as e:
        print(f"[ERROR] 获取邮箱信息失败: {e}")
        return jsonify({
            "error": "Failed to get mailbox info",
            "message": "Unable to load mailbox information",
        }), 500

# Get an email domain
@bp.route('/get_domain')
def get_domain():
    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    return jsonify({"domain": config.DOMAIN}), 200

@bp.route('/get_inbox')
def get_inbox():
    """获取 Bearer 令牌所属邮箱的邮件列表。"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({
            "error": "Access denied - IP not whitelisted",
            "message": "Your IP address is not allowed",
        }), 403

    addr = request.args.get("address", "")
    if not addr:
        return jsonify({
            "error": "Address is required",
            "message": "Mailbox address is required",
        }), 400

    try:
        mailbox, auth_error = _authenticate_mailbox(addr)
        if auth_error:
            return auth_error

        from database import db_manager
        db_manager.update_mailbox_access(mailbox['id'])
        emails = inbox_handler.get_emails_by_mailbox(mailbox['id'])
        return jsonify(emails), 200
    except Exception as e:
        print(f"[ERROR] 获取邮箱邮件列表失败: {e}")
        return jsonify({
            "error": "Failed to get inbox",
            "message": "Unable to load mailbox messages",
        }), 500

# Get single email details by ID
@bp.route('/get_email')
def get_email():
    """读取邮箱内的单封邮件，并在返回前验证邮件归属。"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({
            "error": "Access denied - IP not whitelisted",
            "message": "Your IP address is not allowed",
        }), 403

    addr = request.args.get("address", "")
    email_id = request.args.get("id", "")

    if not addr or not email_id:
        return jsonify({
            "error": "Missing address or email ID",
            "message": "Mailbox address and email ID are required",
        }), 400

    try:
        mailbox, auth_error = _authenticate_mailbox(addr)
        if auth_error:
            return auth_error
        email, email_error = _get_owned_email(mailbox, email_id)
        if email_error:
            return email_error

        inbox_handler.mark_email_as_read(email_id)
        email['is_read'] = True
        return jsonify(email), 200
    except Exception as e:
        print(f"[ERROR] 获取邮件详情失败: {e}")
        return jsonify({
            "error": "Failed to get email",
            "message": "Unable to load the requested email",
        }), 500

# Admin login endpoint
@bp.route('/admin_login', methods=['POST'])
def admin_login():
    """验证管理密码，并复用统一 IP 封禁器限制暴力尝试。"""
    from ip_blocker import ip_blocker

    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if ip_blocker.is_blocked(client_ip):
        remaining = ip_blocker.get_remaining_block_time(client_ip)
        return jsonify({
            "success": False,
            "message": f"IP已被临时封禁，剩余 {remaining} 秒",
        }), 403
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"success": False, "message": "IP not whitelisted"}), 403
    if not config.PASSWORD:
        return jsonify({"success": False, "message": "Admin password is not configured"}), 503

    data = request.get_json(silent=True)
    password = data.get('password', '') if isinstance(data, dict) else ''
    if not isinstance(password, str) or not hmac.compare_digest(password, config.PASSWORD):
        blocked = ip_blocker.record_failed_attempt(client_ip)
        status = 403 if blocked else 401
        message = (
            f"认证失败次数过多，IP已被封禁 {ip_blocker.block_duration} 秒"
            if blocked else "Invalid password"
        )
        return jsonify({"success": False, "message": message}), status

    return jsonify({"success": True, "message": "Login successful"})

# 邮件管理API接口
@bp.route('/mark_email_read', methods=['POST'])
def mark_email_read():
    """标记当前邮箱内的邮件为已读或未读。"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400

    email_id = data.get('email_id')
    is_read = data.get('is_read', True)

    if not email_id:
        return jsonify({"error": "Email ID is required"}), 400

    try:
        if config.USE_DATABASE:
            mailbox, auth_error = _authenticate_mailbox()
            if auth_error:
                return auth_error
            _, email_error = _get_owned_email(mailbox, email_id)
            if email_error:
                return email_error

            if is_read:
                inbox_handler.mark_email_as_read(email_id)
            else:
                inbox_handler.mark_email_as_unread(email_id)
            return jsonify({"success": True, "message": "Email status updated"}), 200
        else:
            return jsonify({"error": "Database storage not enabled"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to update email status: {str(e)}"}), 500

@bp.route('/delete_email', methods=['POST'])
def delete_email():
    """删除当前邮箱内的单封邮件。"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400

    email_id = data.get('email_id')

    if not email_id:
        return jsonify({"error": "Email ID is required"}), 400

    try:
        if config.USE_DATABASE:
            mailbox, auth_error = _authenticate_mailbox()
            if auth_error:
                return auth_error
            _, email_error = _get_owned_email(mailbox, email_id)
            if email_error:
                return email_error

            # 删除邮件
            deleted_count = inbox_handler.delete_email(email_id)
            if deleted_count > 0:
                return jsonify({"success": True, "message": "Email deleted"}), 200
            else:
                return jsonify({"error": "Failed to delete email", "email_id": email_id}), 500
        else:
            return jsonify({"error": "Database storage not enabled"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to delete email: {str(e)}"}), 500

@bp.route('/delete_emails_batch', methods=['POST'])
def delete_emails_batch():
    """批量删除当前邮箱内的邮件。"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400

    email_ids = data.get('email_ids', [])

    if not email_ids:
        return jsonify({"error": "Email IDs are required"}), 400

    try:
        if config.USE_DATABASE:
            mailbox, auth_error = _authenticate_mailbox()
            if auth_error:
                return auth_error

            # 先验证整批归属，避免部分删除后才发现越权 ID。
            for email_id in email_ids:
                _, email_error = _get_owned_email(mailbox, email_id)
                if email_error:
                    return email_error

            deleted_count = sum(inbox_handler.delete_email(email_id) for email_id in email_ids)
            return jsonify({
                "success": True,
                "message": f"Deleted {deleted_count} emails",
            }), 200
        else:
            return jsonify({"error": "Database storage not enabled"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to delete emails: {str(e)}"}), 500

@bp.route('/mark_all_read', methods=['POST'])
def mark_all_read():
    """标记当前邮箱的所有邮件为已读。"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address')

    if not address:
        return jsonify({"error": "Address is required"}), 400

    try:
        if config.USE_DATABASE:
            mailbox, auth_error = _authenticate_mailbox(address)
            if auth_error:
                return auth_error

            updated_count = inbox_handler.mark_all_emails_read(mailbox['id'])
            return jsonify({"success": True, "message": f"Marked {updated_count} emails as read"}), 200
        else:
            return jsonify({"error": "Database storage not enabled"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to mark emails as read: {str(e)}"}), 500

@bp.route('/add_sender_whitelist', methods=['POST'])
def add_sender_whitelist():
    """向当前邮箱的发件人白名单添加规则。"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address')
    sender = data.get('sender')

    if not address or not sender:
        return jsonify({"error": "Address and sender are required"}), 400

    try:
        if config.USE_DATABASE:
            _, auth_error = _authenticate_mailbox(address)
            if auth_error:
                return auth_error
            success = inbox_handler.add_sender_to_whitelist(address, sender)
            if success:
                return jsonify({"success": True, "message": "Sender added to whitelist"}), 200
            else:
                return jsonify({"error": "Failed to add sender"}), 400
        else:
            return jsonify({"error": "Database storage not enabled"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to add sender: {str(e)}"}), 500

@bp.route('/remove_sender_whitelist', methods=['POST'])
def remove_sender_whitelist():
    """从当前邮箱的发件人白名单移除规则。"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address')
    sender = data.get('sender')

    if not address or not sender:
        return jsonify({"error": "Address and sender are required"}), 400

    try:
        if config.USE_DATABASE:
            _, auth_error = _authenticate_mailbox(address)
            if auth_error:
                return auth_error
            success = inbox_handler.remove_sender_from_whitelist(address, sender)
            if success:
                return jsonify({"success": True, "message": "Sender removed from whitelist"}), 200
            else:
                return jsonify({"error": "Failed to remove sender"}), 400
        else:
            return jsonify({"error": "Database storage not enabled"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to remove sender: {str(e)}"}), 500

@bp.route('/update_retention', methods=['POST'])
def update_retention():
    """更新当前邮箱的保留天数。"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address')
    retention_days = data.get('retention_days')

    if not address or retention_days is None:
        return jsonify({"error": "Address and retention_days are required"}), 400

    if not isinstance(retention_days, int) or retention_days < 1 or retention_days > 365:
        return jsonify({"error": "Retention days must be between 1 and 365"}), 400

    try:
        if config.USE_DATABASE:
            _, auth_error = _authenticate_mailbox(address)
            if auth_error:
                return auth_error
            success = inbox_handler.update_mailbox_retention(address, retention_days)
            if success:
                return jsonify({"success": True, "message": "Retention period updated"}), 200
            else:
                return jsonify({"error": "Failed to update retention"}), 400
        else:
            return jsonify({"error": "Database storage not enabled"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to update retention: {str(e)}"}), 500

@bp.route('/regenerate_mailbox_key', methods=['POST'])
def regenerate_mailbox_key():
    """重新生成当前邮箱密钥。"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address')
    current_key = data.get('current_key')

    if not address or not current_key:
        return jsonify({"error": "Address and current_key are required"}), 400

    try:
        if config.USE_DATABASE:
            _, auth_error = _authenticate_mailbox(address)
            if auth_error:
                return auth_error
            new_key = inbox_handler.regenerate_mailbox_key(address, current_key)
            if new_key:
                return jsonify({"success": True, "new_key": new_key, "message": "Mailbox key regenerated"}), 200
            else:
                return jsonify({"error": "Failed to regenerate key or invalid current key"}), 400
        else:
            return jsonify({"error": "Database storage not enabled"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to regenerate key: {str(e)}"}), 500

@bp.route('/toggle_mailbox_status', methods=['POST'])
def toggle_mailbox_status():
    """切换当前邮箱的启用状态。"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address')

    if not address:
        return jsonify({"error": "Address is required"}), 400

    try:
        if config.USE_DATABASE:
            # 该端点必须允许已禁用邮箱用原令牌重新启用；其他端点仍拒绝禁用邮箱。
            mailbox, auth_error = _authenticate_mailbox(address, allow_disabled=True)
            if auth_error:
                return auth_error

            # 切换状态
            new_status = not mailbox.get('is_active', True)
            success = inbox_handler.update_mailbox_status(address, new_status)

            if success:
                return jsonify({
                    "success": True,
                    "is_active": new_status,
                    "message": f"Mailbox {'enabled' if new_status else 'disabled'} successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to update mailbox status"}), 400
        else:
            return jsonify({"error": "Database storage not enabled"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to toggle mailbox status: {str(e)}"}), 500

@bp.route('/toggle_whitelist', methods=['POST'])
def toggle_whitelist():
    """切换当前邮箱的白名单启用状态。"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address')
    enabled = data.get('enabled', False)

    if not address:
        return jsonify({"error": "Address is required"}), 400

    try:
        if config.USE_DATABASE:
            mailbox, auth_error = _authenticate_mailbox(address)
            if auth_error:
                return auth_error

            # 更新白名单启用状态
            success = inbox_handler.update_whitelist_status(address, enabled)

            if success:
                return jsonify({
                    "success": True,
                    "whitelist_enabled": enabled,
                    "whitelist": mailbox.get('sender_whitelist', []),
                    "message": f"Whitelist {'enabled' if enabled else 'disabled'} successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to update whitelist status"}), 400
        else:
            return jsonify({"error": "Database storage not enabled"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to toggle whitelist: {str(e)}"}), 500
