from flask import Blueprint, request, jsonify, render_template
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
import os
import time

bp = Blueprint('api', __name__)

# 邮箱登录页面路由
@bp.route('/login')
def mailbox_login():
    """邮箱登录页面"""
    return render_template('mailbox_login.html')

# 邮箱管理页面路由
@bp.route('/mailbox')
def mailbox_manager():
    """邮箱管理页面"""
    return render_template('mailbox_manager.html')

# 演示页面路由
@bp.route('/mailbox/demo')
def mailbox_demo():
    """邮箱演示页面"""
    return render_template('mailbox_manager.html')

# API测试页面路由
@bp.route('/api-test')
def api_test():
    """API测试页面"""
    return render_template('api_test.html')

# 演示数据API
@bp.route('/demo/get_token', methods=['POST'])
def demo_get_token():
    """演示模式获取令牌"""
    return jsonify({
        "success": True,
        "address": "demo@localhost",
        "access_token": "demo-token-12345",
        "mailbox_id": "demo-mailbox-id",
        "expires_at": int(time.time()) + 86400,  # 24小时后过期
        "message": "演示模式访问令牌"
    }), 200

@bp.route('/demo/mailbox_info', methods=['GET'])
def demo_mailbox_info():
    """演示模式邮箱信息"""
    return jsonify({
        "success": True,
        "mailbox": {
            "id": "demo-mailbox-id",
            "address": "demo@localhost",
            "created_at": int(time.time()) - 3600,  # 1小时前创建
            "expires_at": int(time.time()) + 86400,  # 24小时后过期
            "retention_days": 7,
            "sender_whitelist": ["@gmail.com", "@outlook.com"],
            "whitelist_enabled": False,  # 演示模式默认关闭白名单
            "is_active": True,  # 演示模式默认开启邮箱
            "email_count": 5,
            "unread_count": 2,
            "last_email_time": int(time.time()) - 300  # 5分钟前
        }
    }), 200

@bp.route('/demo/emails', methods=['GET'])
def demo_emails():
    """演示模式邮件列表"""
    current_time = int(time.time())
    demo_emails = [
        {
            "id": "demo-email-1",
            "From": "welcome@example.com",
            "To": "demo@localhost",
            "Subject": "欢迎使用临时邮箱服务！",
            "Body": "感谢您使用我们的临时邮箱服务。这是一个演示邮件，展示了邮箱的基本功能。\n\n您可以：\n- 接收邮件\n- 查看邮件详情\n- 管理邮箱设置\n- 设置发件人白名单\n\n祝您使用愉快！",
            "ContentType": "text/plain",
            "Timestamp": current_time - 3600,
            "Sent": "1小时前",
            "is_read": False
        },
        {
            "id": "demo-email-2",
            "From": "noreply@github.com",
            "To": "demo@localhost",
            "Subject": "GitHub 通知：新的提交",
            "Body": "您关注的仓库有新的提交：\n\n提交者：开发者\n提交信息：修复邮件显示问题\n\n点击查看详情：https://github.com/example/repo",
            "ContentType": "text/plain",
            "Timestamp": current_time - 1800,
            "Sent": "30分钟前",
            "is_read": True
        },
        {
            "id": "demo-email-3",
            "From": "support@service.com",
            "To": "demo@localhost",
            "Subject": "账户安全提醒",
            "Body": "我们检测到您的账户有异常登录活动。\n\n如果这是您本人的操作，请忽略此邮件。\n如果不是，请立即更改密码。\n\n登录时间：2025-09-27 18:00\n登录地点：北京",
            "ContentType": "text/plain",
            "Timestamp": current_time - 900,
            "Sent": "15分钟前",
            "is_read": False
        },
        {
            "id": "demo-email-4",
            "From": "newsletter@tech.com",
            "To": "demo@localhost",
            "Subject": "技术周刊 #42",
            "Body": "本周技术要闻：\n\n1. 新的JavaScript框架发布\n2. AI技术最新进展\n3. 云计算趋势分析\n4. 开源项目推荐\n\n阅读全文：https://tech.com/newsletter/42",
            "ContentType": "text/plain",
            "Timestamp": current_time - 7200,
            "Sent": "2小时前",
            "is_read": True
        },
        {
            "id": "demo-email-5",
            "From": "admin@localhost",
            "To": "demo@localhost",
            "Subject": "系统维护通知",
            "Body": "尊敬的用户：\n\n我们将在今晚23:00-01:00进行系统维护，期间服务可能暂时中断。\n\n维护内容：\n- 数据库优化\n- 安全更新\n- 性能提升\n\n感谢您的理解与支持！",
            "ContentType": "text/plain",
            "Timestamp": current_time - 10800,
            "Sent": "3小时前",
            "is_read": True
        }
    ]

    return jsonify(demo_emails), 200

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

# Create a mailbox with sender whitelist (API) - 原有接口保持不变
@bp.route('/create_mailbox', methods=['POST'])
def create_mailbox():
    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Get parameters
    custom_address = data.get('address', '')
    sender_whitelist = data.get('sender_whitelist', [])
    retention_days = data.get('retention_days', config.MAILBOX_RETENTION_DAYS)

    # Generate address if not provided
    if not custom_address:
        random_string = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
        address = f"{random_string}@{config.DOMAIN}"
    else:
        # Validate custom address
        if '@' not in custom_address:
            address = f"{custom_address}@{config.DOMAIN}"
        else:
            address = custom_address

    # Validate sender whitelist
    if not isinstance(sender_whitelist, list):
        return jsonify({"error": "sender_whitelist must be an array"}), 400

    try:
        # Create mailbox
        current_time = int(time.time())
        inbox = inbox_handler.read_inbox()

        # Check if mailbox already exists
        if address in inbox:
            return jsonify({"error": "Mailbox already exists"}), 409

        # Create new mailbox with whitelist
        mailbox_data = {
            "created_at": current_time,
            "expires_at": current_time + (retention_days * 24 * 60 * 60),
            "sender_whitelist": sender_whitelist,
            "emails": []
        }

        inbox[address] = mailbox_data
        inbox_handler.write_inbox(inbox)

        return jsonify({
            "address": address,
            "created_at": current_time,
            "expires_at": mailbox_data["expires_at"],
            "sender_whitelist": sender_whitelist,
            "retention_days": retention_days,
            "message": "Mailbox created successfully"
        }), 201

    except Exception as e:
        return jsonify({"error": f"Failed to create mailbox: {str(e)}"}), 500

# 新增：创建数据库邮箱接口（支持时间参数和UUID）
@bp.route('/create_mailbox_v2', methods=['POST'])
def create_mailbox_v2():
    """
    创建邮箱 V2 版本 - 支持数据库存储、自定义时间和UUID
    """
    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Get parameters
    custom_address = data.get('address', '')
    sender_whitelist = data.get('sender_whitelist', [])
    retention_days = data.get('retention_days', config.MAILBOX_RETENTION_DAYS)
    custom_created_time = data.get('created_at')  # 自定义创建时间

    # Generate address if not provided
    if not custom_address:
        random_string = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
        # 从多个域名中随机选择一个
        random_domain = random.choice(config.DOMAINS)
        address = f"{random_string}@{random_domain}"
    else:
        # Validate custom address
        if '@' not in custom_address:
            # 如果没有指定域名，使用默认域名
            address = f"{custom_address}@{config.DOMAIN}"
        else:
            address = custom_address

    # Validate parameters
    if not isinstance(sender_whitelist, list):
        return jsonify({"error": "sender_whitelist must be an array"}), 400

    if retention_days <= 0:
        return jsonify({"error": "retention_days must be positive"}), 400

    # Validate custom created time
    if custom_created_time is not None:
        if not isinstance(custom_created_time, int) or custom_created_time <= 0:
            return jsonify({"error": "created_at must be a positive integer timestamp"}), 400

    try:
        if config.USE_DATABASE:
            # 使用数据库
            # 检查邮箱是否已存在
            existing_mailbox = inbox_handler.get_mailbox_info(address)
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
                address=address,
                retention_days=retention_days,
                sender_whitelist=sender_whitelist,
                created_by_ip=client_ip
            )

            # 如果指定了自定义创建时间，更新它
            if custom_created_time is not None:
                expires_at = custom_created_time + (retention_days * 24 * 60 * 60)
                from database import db_manager
                with db_manager.get_connection() as conn:
                    conn.execute('''
                        UPDATE mailboxes
                        SET created_at = ?, expires_at = ?
                        WHERE id = ?
                    ''', (custom_created_time, expires_at, mailbox['id']))
                    conn.commit()
                mailbox['created_at'] = custom_created_time
                mailbox['expires_at'] = expires_at

            return jsonify({
                "success": True,
                "address": address,
                "mailbox_id": mailbox['id'],
                "mailbox_key": mailbox['mailbox_key'],  # 返回邮箱密钥
                "created_at": mailbox['created_at'],
                "expires_at": mailbox['expires_at'],
                "sender_whitelist": sender_whitelist,
                "retention_days": retention_days,
                "available_domains": config.DOMAINS,
                "storage_type": "database",
                "message": "Mailbox created successfully. Please save your mailbox key securely."
            }), 201

        else:
            return jsonify({
                "error": "Database storage not enabled. Use /create_mailbox for JSON storage."
            }), 400

    except Exception as e:
        return jsonify({"error": f"Failed to create mailbox: {str(e)}"}), 500

# 新增：通过邮箱密钥获取访问令牌
@bp.route('/get_mailbox_token', methods=['POST'])
def get_mailbox_token():
    """
    获取邮箱访问令牌 - 用户通过邮箱地址和密钥获取访问令牌
    """
    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address', '').strip()
    mailbox_key = data.get('mailbox_key', '').strip()

    if not address:
        return jsonify({"error": "Address is required"}), 400

    if not mailbox_key:
        return jsonify({"error": "Mailbox key is required"}), 400

    # 验证邮箱地址格式
    if '@' not in address:
        return jsonify({"error": "Invalid email address format"}), 400

    try:
        if config.USE_DATABASE:
            # 获取邮箱信息
            mailbox_info = inbox_handler.get_mailbox_info(address)
            if not mailbox_info:
                return jsonify({"error": "Mailbox not found"}), 404

            if mailbox_info['is_expired']:
                return jsonify({"error": "Mailbox has expired"}), 410

            # 验证邮箱密钥
            if mailbox_info.get('mailbox_key') != mailbox_key:
                return jsonify({"error": "Invalid mailbox key"}), 401

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
                "error": "Database storage not enabled. This endpoint requires database storage."
            }), 400

    except Exception as e:
        return jsonify({"error": f"Failed to get access token: {str(e)}"}), 500

# 新增：用户注册接口
@bp.route('/register', methods=['POST'])
def register():
    """
    用户注册接口 - 创建用户账户，可选择同时创建临时邮箱
    """
    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Get parameters
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    invite_code = data.get('invite_code', '').strip()

    # Validate required fields
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    # Validate invite code
    if not invite_code:
        return jsonify({"error": "Invite code is required"}), 400

    # Validate username format
    if len(username) < 3 or len(username) > 20:
        return jsonify({"error": "Username must be between 3 and 20 characters"}), 400

    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return jsonify({"error": "Username can only contain letters, numbers, and underscores"}), 400

    # Validate password strength
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long"}), 400

    # Validate email if provided
    if email and not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        return jsonify({"error": "Invalid email address format"}), 400

    try:
        if config.USE_DATABASE:
            # 导入数据库管理器
            from database import db_manager

            # 验证邀请码
            if not db_manager.validate_invite_code(invite_code):
                return jsonify({"error": "Invalid or expired invite code"}), 400

            # 检查用户名是否已存在
            existing_user = db_manager.get_user_by_username(username)
            if existing_user:
                return jsonify({"error": "Username already exists"}), 409

            # 创建用户账户
            user = db_manager.create_user(
                username=username,
                email=email if email else None,
                password_hash=password,  # 实际项目中应该使用密码哈希
                created_by_ip=client_ip
            )

            # 消耗邀请码（设为已使用）
            db_manager.mark_invite_code_used(invite_code)

            result_data = {
                "success": True,
                "user_id": user['id'],
                "username": user['username'],
                "created_at": user['created_at'],
                "message": "User account created successfully"
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
    """
    通过访问令牌获取邮箱信息 V2 版本
    """
    access_token = request.args.get("token", "")
    address = request.args.get("address", "")

    if not access_token and not address:
        return jsonify({"error": "Either token or address is required"}), 400

    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    try:
        if config.USE_DATABASE:
            if access_token:
                # 通过令牌获取
                from database import db_manager
                mailbox = db_manager.get_mailbox_by_token(access_token)
            else:
                # 通过地址获取
                mailbox_info = inbox_handler.get_mailbox_info(address)
                if mailbox_info:
                    mailbox = {
                        'id': mailbox_info['id'],
                        'address': mailbox_info['address'],
                        'created_at': mailbox_info['created_at'],
                        'expires_at': mailbox_info['expires_at'],
                        'retention_days': mailbox_info['retention_days'],
                        'sender_whitelist': mailbox_info['sender_whitelist'],
                        'whitelist_enabled': mailbox_info.get('whitelist_enabled', False),
                        'access_token': mailbox_info['access_token'],
                        'is_active': mailbox_info.get('is_active', True)
                    }
                else:
                    mailbox = None

            if not mailbox:
                return jsonify({"error": "Mailbox not found"}), 404

            # 检查是否过期
            from database import db_manager
            is_expired = db_manager.is_mailbox_expired(mailbox)

            # 获取统计信息
            stats = db_manager.get_mailbox_stats(mailbox['id'])

            return jsonify({
                "success": True,
                "mailbox": {
                    "id": mailbox['id'],
                    "address": mailbox['address'],
                    "access_token": mailbox['access_token'],
                    "created_at": mailbox['created_at'],
                    "expires_at": mailbox['expires_at'],
                    "retention_days": mailbox['retention_days'],
                    "sender_whitelist": mailbox['sender_whitelist'],
                    "is_expired": is_expired,
                    "email_count": stats['total_emails'],
                    "unread_count": stats['unread_emails'],
                    "last_email_time": stats['last_email_time']
                },
                "storage_type": "database"
            }), 200

        else:
            return jsonify({
                "error": "Database storage not enabled. Use /mailbox_info for JSON storage."
            }), 400

    except Exception as e:
        return jsonify({"error": f"Failed to get mailbox info: {str(e)}"}), 500

# 新增：数据迁移接口
@bp.route('/migrate_to_database', methods=['POST'])
def migrate_to_database():
    """
    将JSON文件数据迁移到数据库
    """
    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json() or {}
    json_file_path = data.get('json_file_path', config.INBOX_FILE_NAME)

    try:
        if not config.USE_DATABASE:
            return jsonify({
                "error": "Database storage not enabled. Set USE_DATABASE=true in config."
            }), 400

        # 执行迁移
        result = inbox_handler.migrate_from_json_file(json_file_path)

        return jsonify({
            "success": True,
            "migration_result": result,
            "message": f"Migrated {result['migrated_mailboxes']} mailboxes and {result['migrated_emails']} emails"
        }), 200

    except Exception as e:
        return jsonify({"error": f"Migration failed: {str(e)}"}), 500

# 新增：数据导出接口
@bp.route('/export_from_database', methods=['POST'])
def export_from_database():
    """
    将数据库数据导出到JSON文件
    """
    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json() or {}
    output_file_path = data.get('output_file_path')

    try:
        if not config.USE_DATABASE:
            return jsonify({
                "error": "Database storage not enabled."
            }), 400

        # 执行导出
        result = inbox_handler.export_to_json_file(output_file_path)

        if result['success']:
            return jsonify({
                "success": True,
                "export_result": result,
                "message": f"Exported {result['exported_mailboxes']} mailboxes"
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": result['error']
            }), 500

    except Exception as e:
        return jsonify({"error": f"Export failed: {str(e)}"}), 500

# Get an email domain
@bp.route('/get_domain')
def get_domain():
    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    return jsonify({"domain": config.DOMAIN}), 200

# The main route that serves the website
@bp.route('/get_inbox')
def get_inbox():
    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    addr = request.args.get("address", "")
    password = request.headers.get("Authorization", None)

    if re.match(config.PROTECTED_ADDRESSES, addr) and password != config.PASSWORD:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        if config.USE_DATABASE:
            # 数据库模式
            mailbox_info = inbox_handler.get_mailbox_info(addr)
            if not mailbox_info:
                return jsonify([]), 200  # Return empty array if mailbox not found

            if mailbox_info['is_expired']:
                return jsonify({"error": "Mailbox expired"}), 410

            # 获取邮件列表
            emails = inbox_handler.get_emails_by_mailbox(mailbox_info['id'])
            return jsonify(emails), 200
        else:
            # JSON文件模式（原有逻辑）
            # inbox = inbox_handler.read_inbox()  # 注释掉这行，因为数据库模式不需要

            # Clean expired emails and mailboxes before returning
            inbox = inbox_handler.clean_expired_emails(inbox)
            inbox = inbox_handler.clean_expired_mailboxes(inbox)
            inbox_handler.write_inbox(inbox)

            # Get mailbox data
            mailbox_data = inbox.get(addr, {})
            print(f"[DEBUG] Getting inbox for {addr}, found: {type(mailbox_data)}")

            if not mailbox_data:
                print(f"[DEBUG] Mailbox {addr} not found")
                return jsonify([]), 200  # Return empty array instead of error

            if isinstance(mailbox_data, list):  # Old format compatibility
                print(f"[DEBUG] Old format mailbox with {len(mailbox_data)} emails")
                address_inbox = mailbox_data
            else:  # New format
                if inbox_handler.is_mailbox_expired(mailbox_data):
                    print(f"[DEBUG] Mailbox {addr} expired")
                    return jsonify({"error": "Mailbox expired"}), 410
                address_inbox = mailbox_data.get("emails", [])
                print(f"[DEBUG] New format mailbox with {len(address_inbox)} emails")

            return jsonify(address_inbox), 200
    except Exception as e:
        print(f"[ERROR] Failed to get inbox for {addr}: {str(e)}")
        return jsonify({"error": "Failed to get inbox"}), 500

# Get single email details by ID
@bp.route('/get_email')
def get_email():
    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    addr = request.args.get("address", "")
    email_id = request.args.get("id", "")
    password = request.headers.get("Authorization", None)

    if not addr or not email_id:
        return jsonify({"error": "Missing address or email ID"}), 400

    if re.match(config.PROTECTED_ADDRESSES, addr) and password != config.PASSWORD:
        return jsonify({"error": "Unauthorized"}), 401

    inbox = inbox_handler.read_inbox()
    mailbox_data = inbox.get(addr, {})

    if not mailbox_data:
        return jsonify({"error": "Mailbox not found"}), 404

    # Get emails list
    if isinstance(mailbox_data, list):  # Old format
        emails = mailbox_data
    else:  # New format
        if inbox_handler.is_mailbox_expired(mailbox_data):
            return jsonify({"error": "Mailbox expired"}), 410
        emails = mailbox_data.get("emails", [])

    # Find email by ID
    for email in emails:
        if email.get("id") == email_id:
            return jsonify(email), 200

    # 如果没有找到匹配的ID，尝试按索引查找（备用方案）
    if email_id.startswith("email-") and "-" in email_id:
        try:
            parts = email_id.split("-")
            if len(parts) >= 2:
                index = int(parts[1])
                if 0 <= index < len(emails):
                    email = emails[index]
                    # 确保邮件有ID
                    if not email.get("id"):
                        email["id"] = email_id
                    return jsonify(email), 200
        except (ValueError, IndexError):
            pass

    return jsonify({"error": "Email not found"}), 404

# Admin login endpoint
@bp.route('/admin_login', methods=['POST'])
def admin_login():
    try:
        data = request.get_json()
        password = data.get('password', '')
        client_ip = request.environ.get('REMOTE_ADDR', 'unknown')

        # Check IP whitelist
        if not inbox_handler.is_ip_whitelisted(client_ip):
            return jsonify({"success": False, "message": "IP not whitelisted"}), 403

        # Check admin password
        if password != config.PASSWORD:
            return jsonify({"success": False, "message": "Invalid password"}), 401

        return jsonify({"success": True, "message": "Login successful"})
    except Exception as e:
        return jsonify({"success": False, "message": "Server error"}), 500

# 邮件管理API接口
@bp.route('/mark_email_read', methods=['POST'])
def mark_email_read():
    """标记邮件为已读/未读"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    email_id = data.get('email_id')
    is_read = data.get('is_read', True)

    if not email_id:
        return jsonify({"error": "Email ID is required"}), 400

    try:
        if config.USE_DATABASE:
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
    """删除单个邮件"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    email_id = data.get('email_id')

    if not email_id:
        return jsonify({"error": "Email ID is required"}), 400

    try:
        if config.USE_DATABASE:
            deleted_count = inbox_handler.delete_email(email_id)
            if deleted_count > 0:
                return jsonify({"success": True, "message": "Email deleted"}), 200
            else:
                return jsonify({"error": "Email not found"}), 404
        else:
            return jsonify({"error": "Database storage not enabled"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to delete email: {str(e)}"}), 500

@bp.route('/delete_emails_batch', methods=['POST'])
def delete_emails_batch():
    """批量删除邮件"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    email_ids = data.get('email_ids', [])

    if not email_ids:
        return jsonify({"error": "Email IDs are required"}), 400

    try:
        if config.USE_DATABASE:
            deleted_count = 0
            for email_id in email_ids:
                deleted_count += inbox_handler.delete_email(email_id)
            return jsonify({"success": True, "message": f"Deleted {deleted_count} emails"}), 200
        else:
            return jsonify({"error": "Database storage not enabled"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to delete emails: {str(e)}"}), 500

@bp.route('/mark_all_read', methods=['POST'])
def mark_all_read():
    """标记所有邮件为已读"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address')

    if not address:
        return jsonify({"error": "Address is required"}), 400

    try:
        if config.USE_DATABASE:
            mailbox_info = inbox_handler.get_mailbox_info(address)
            if not mailbox_info:
                return jsonify({"error": "Mailbox not found"}), 404

            updated_count = inbox_handler.mark_all_emails_read(mailbox_info['id'])
            return jsonify({"success": True, "message": f"Marked {updated_count} emails as read"}), 200
        else:
            return jsonify({"error": "Database storage not enabled"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to mark emails as read: {str(e)}"}), 500

@bp.route('/add_sender_whitelist', methods=['POST'])
def add_sender_whitelist():
    """添加发件人白名单"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address')
    sender = data.get('sender')

    if not address or not sender:
        return jsonify({"error": "Address and sender are required"}), 400

    try:
        if config.USE_DATABASE:
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
    """移除发件人白名单"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address')
    sender = data.get('sender')

    if not address or not sender:
        return jsonify({"error": "Address and sender are required"}), 400

    try:
        if config.USE_DATABASE:
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
    """更新邮箱保留时间"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address')
    retention_days = data.get('retention_days')

    if not address or retention_days is None:
        return jsonify({"error": "Address and retention_days are required"}), 400

    if not isinstance(retention_days, int) or retention_days < 1 or retention_days > 30:
        return jsonify({"error": "Retention days must be between 1 and 30"}), 400

    try:
        if config.USE_DATABASE:
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
    """重新生成邮箱密钥"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address')
    current_key = data.get('current_key')

    if not address or not current_key:
        return jsonify({"error": "Address and current_key are required"}), 400

    try:
        if config.USE_DATABASE:
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
    """切换邮箱开启/关闭状态"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address')

    if not address:
        return jsonify({"error": "Address is required"}), 400

    try:
        if config.USE_DATABASE:
            # 获取当前邮箱状态
            mailbox_info = inbox_handler.get_mailbox_info(address)
            if not mailbox_info:
                return jsonify({"error": "Mailbox not found"}), 404

            # 切换状态
            new_status = not mailbox_info.get('is_active', True)
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
    """切换白名单启用/禁用状态"""
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    address = data.get('address')
    enabled = data.get('enabled', False)

    if not address:
        return jsonify({"error": "Address is required"}), 400

    try:
        if config.USE_DATABASE:
            # 获取当前邮箱信息
            mailbox_info = inbox_handler.get_mailbox_info(address)
            if not mailbox_info:
                return jsonify({"error": "Mailbox not found"}), 404

            # 更新白名单启用状态
            success = inbox_handler.update_whitelist_status(address, enabled)

            if success:
                return jsonify({
                    "success": True,
                    "whitelist_enabled": enabled,
                    "whitelist": mailbox_info.get('sender_whitelist', []),
                    "message": f"Whitelist {'enabled' if enabled else 'disabled'} successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to update whitelist status"}), 400
        else:
            return jsonify({"error": "Database storage not enabled"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to toggle whitelist: {str(e)}"}), 500

# Admin authentication check
def check_admin_auth():
    password = request.headers.get("Authorization", None)
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')

    # Check IP whitelist
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return False, "IP not whitelisted"

    # Check admin password
    if password != config.PASSWORD:
        return False, "Invalid password"

    return True, "OK"

# Get current whitelist settings
@bp.route('/admin/whitelist', methods=['GET'])
def get_whitelist():
    is_auth, msg = check_admin_auth()
    if not is_auth:
        return jsonify({"error": msg}), 401

    # Convert comma-separated to line-separated format
    whitelist_lines = config.IP_WHITELIST.replace(',', '\n').strip()

    return jsonify({
        "enabled": config.ENABLE_IP_WHITELIST,
        "whitelist": whitelist_lines,
        "current_ip": request.environ.get('REMOTE_ADDR', 'unknown')
    }), 200

# Update whitelist settings
@bp.route('/admin/whitelist', methods=['POST'])
def update_whitelist():
    is_auth, msg = check_admin_auth()
    if not is_auth:
        return jsonify({"error": msg}), 401

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    try:
        # Convert line-separated format to comma-separated for storage
        whitelist_input = data.get("whitelist", "")
        whitelist_lines = [line.strip() for line in whitelist_input.split('\n') if line.strip()]
        whitelist_comma_separated = ','.join(whitelist_lines)

        # Update .env file
        env_path = '.env'
        if os.path.exists(env_path):
            # Always read .env as UTF-8; fallback to system encoding
            try:
                with open(env_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
            except UnicodeDecodeError:
                with open(env_path, 'r', encoding='utf-8-sig') as f:
                    lines = f.readlines()

            # Update the lines
            for i, line in enumerate(lines):
                if line.startswith('ENABLE_IP_WHITELIST'):
                    lines[i] = f'ENABLE_IP_WHITELIST = {str(data.get("enabled", True)).lower()}\n'
                elif line.startswith('IP_WHITELIST'):
                    lines[i] = f'IP_WHITELIST = "{whitelist_comma_separated}"\n'

            # Ensure keys exist in case they were missing
            if not any(l.startswith('ENABLE_IP_WHITELIST') for l in lines):
                lines.append(f'ENABLE_IP_WHITELIST = {str(data.get("enabled", True)).lower()}\n')
            if not any(l.startswith('IP_WHITELIST') for l in lines):
                lines.append(f'IP_WHITELIST = "{whitelist_comma_separated}"\n')

            # Write back using UTF-8 to preserve non-ASCII comments
            with open(env_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)

            # Update config in memory (requires restart to fully take effect)
            config.ENABLE_IP_WHITELIST = data.get("enabled", True)
            config.IP_WHITELIST = whitelist_comma_separated

            return jsonify({"success": True, "message": "Settings updated. Restart required for full effect."}), 200
        else:
            return jsonify({"error": ".env file not found"}), 500

    except Exception as e:
        return jsonify({"error": f"Failed to update settings: {str(e)}"}), 500

# Test IP whitelist
@bp.route('/admin/test_ip', methods=['POST'])
def test_ip():
    is_auth, msg = check_admin_auth()
    if not is_auth:
        return jsonify({"error": msg}), 401

    data = request.get_json()
    test_ip = data.get('ip', '') if data else ''

    if not test_ip:
        return jsonify({"error": "No IP provided"}), 400

    try:
        # Temporarily update config for testing
        original_whitelist = config.IP_WHITELIST
        original_enabled = config.ENABLE_IP_WHITELIST

        # Convert line-separated format to comma-separated for testing
        whitelist_input = data.get('whitelist', config.IP_WHITELIST)
        whitelist_lines = [line.strip() for line in whitelist_input.split('\n') if line.strip()]
        whitelist_comma_separated = ','.join(whitelist_lines)

        config.IP_WHITELIST = whitelist_comma_separated
        config.ENABLE_IP_WHITELIST = data.get('enabled', config.ENABLE_IP_WHITELIST)

        is_allowed = inbox_handler.is_ip_whitelisted(test_ip)

        # Restore original config
        config.IP_WHITELIST = original_whitelist
        config.ENABLE_IP_WHITELIST = original_enabled

        return jsonify({
            "ip": test_ip,
            "allowed": is_allowed,
            "message": "IP is allowed" if is_allowed else "IP is blocked"
        }), 200

    except Exception as e:
        return jsonify({"error": f"Test failed: {str(e)}"}), 500

# Get mailbox info
@bp.route('/mailbox_info')
def get_mailbox_info():
    addr = request.args.get("address", "")
    if not addr:
        return jsonify({"error": "No address provided"}), 400

    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    inbox = inbox_handler.read_inbox()
    mailbox_data = inbox.get(addr, {})

    if not mailbox_data:
        return jsonify({"error": "Mailbox not found"}), 404

    if isinstance(mailbox_data, list):  # Old format
        return jsonify({
            "address": addr,
            "created_at": None,
            "expires_at": None,
            "sender_whitelist": [],
            "email_count": len(mailbox_data),
            "is_expired": False
        }), 200

    return jsonify({
        "address": addr,
        "created_at": mailbox_data.get("created_at"),
        "expires_at": mailbox_data.get("expires_at"),
        "sender_whitelist": mailbox_data.get("sender_whitelist", []),
        "email_count": len(mailbox_data.get("emails", [])),
        "is_expired": inbox_handler.is_mailbox_expired(mailbox_data)
    }), 200

# Manage sender whitelist
@bp.route('/mailbox_whitelist', methods=['POST'])
def manage_sender_whitelist():
    addr = request.args.get("address", "")
    if not addr:
        return jsonify({"error": "No address provided"}), 400

    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    action = data.get("action")  # "add" or "remove"
    sender = data.get("sender", "").strip()

    if not sender:
        return jsonify({"error": "No sender provided"}), 400

    if action == "add":
        success = inbox_handler.add_sender_to_whitelist(addr, sender)
        if success:
            return jsonify({"message": f"Added {sender} to whitelist"}), 200
        else:
            return jsonify({"error": "Failed to add sender"}), 500
    elif action == "remove":
        success = inbox_handler.remove_sender_from_whitelist(addr, sender)
        if success:
            return jsonify({"message": f"Removed {sender} from whitelist"}), 200
        else:
            return jsonify({"error": "Failed to remove sender"}), 500
    else:
        return jsonify({"error": "Invalid action"}), 400

# Extend mailbox expiration
@bp.route('/extend_mailbox', methods=['POST'])
def extend_mailbox():
    addr = request.args.get("address", "")
    if not addr:
        return jsonify({"error": "No address provided"}), 400

    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    days = data.get("days", config.MAILBOX_RETENTION_DAYS) if data else config.MAILBOX_RETENTION_DAYS

    inbox = inbox_handler.read_inbox()
    if addr not in inbox:
        return jsonify({"error": "Mailbox not found"}), 404

    mailbox_data = inbox[addr]
    if isinstance(mailbox_data, list):  # Old format - convert first
        current_time = int(time.time())
        mailbox_data = {
            "created_at": current_time,
            "expires_at": current_time + (days * 24 * 60 * 60),
            "sender_whitelist": [],
            "emails": mailbox_data
        }
    else:
        # Extend expiration
        current_time = int(time.time())
        mailbox_data["expires_at"] = current_time + (days * 24 * 60 * 60)

    inbox[addr] = mailbox_data
    inbox_handler.write_inbox(inbox)

    return jsonify({
        "message": f"Mailbox extended for {days} days",
        "expires_at": mailbox_data["expires_at"]
    }), 200

# Send test email via API
@bp.route('/send_test_email', methods=['POST'])
def send_test_email():
    # Check IP whitelist
    client_ip = request.environ.get('REMOTE_ADDR', 'unknown')
    if not inbox_handler.is_ip_whitelisted(client_ip):
        return jsonify({"error": "Access denied - IP not whitelisted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    to_email = data.get('to', '').strip()
    from_email = data.get('from', '').strip()
    subject = data.get('subject', '').strip()
    body = data.get('body', '').strip()

    if not all([to_email, from_email, subject]):
        return jsonify({"error": "Missing required fields: to, from, subject"}), 400

    try:
        import smtplib
        from email.mime.text import MIMEText

        # 连接到本地SMTP服务器
        print(f"[DEBUG] Connecting to SMTP server at localhost:{config.SMTP_PORT}")
        smtp_server = smtplib.SMTP('localhost', config.SMTP_PORT)
        print(f"[DEBUG] Connected to SMTP server successfully")

        # 创建邮件
        msg = MIMEText(body, 'plain', 'utf-8')
        msg['Subject'] = subject
        msg['From'] = from_email
        msg['To'] = to_email

        # 发送邮件
        smtp_server.send_message(msg)
        smtp_server.quit()

        return jsonify({"message": "Email sent successfully"}), 200

    except Exception as e:
        return jsonify({"error": f"Failed to send email: {str(e)}"}), 500
