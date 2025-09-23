from flask import Blueprint, request, jsonify
from .. import inbox_handler
import config
import re
import random
import string
import os
import time

bp = Blueprint('api', __name__)

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

# Create a mailbox with sender whitelist (API)
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

    inbox = inbox_handler.read_inbox()

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
        smtp_server = smtplib.SMTP('localhost', config.SMTP_PORT)

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
