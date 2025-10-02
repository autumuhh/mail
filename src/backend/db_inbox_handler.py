"""
数据库版本的邮箱处理器
替代原来的JSON文件处理方式
"""

import time
import json
import ipaddress
import config
from database import db_manager
from typing import Dict, List, Optional

def is_ip_whitelisted(client_ip: str) -> bool:
    """检查IP是否在白名单中"""
    if not config.ENABLE_IP_WHITELIST:
        return True
    
    if client_ip in ['unknown', 'localhost', '127.0.0.1', '::1']:
        return True
    
    try:
        client_addr = ipaddress.ip_address(client_ip)
        whitelist = config.IP_WHITELIST.split(',')
        
        for allowed in whitelist:
            allowed = allowed.strip()
            if '/' in allowed:
                # CIDR notation
                if client_addr in ipaddress.ip_network(allowed, strict=False):
                    return True
            else:
                # Single IP
                if client_addr == ipaddress.ip_address(allowed):
                    return True
        return False
    except ValueError:
        return False

def create_or_get_mailbox(address: str, retention_days: int = None,
                         sender_whitelist: List[str] = None,
                         created_by_ip: str = None,
                         created_source: str = "unknown") -> Dict:
    """创建或获取邮箱"""
    if retention_days is None:
        retention_days = config.MAILBOX_RETENTION_DAYS

    # 尝试获取现有邮箱
    mailbox = db_manager.get_mailbox_by_address(address)

    if mailbox:
        # 检查是否过期
        if db_manager.is_mailbox_expired(mailbox):
            # 邮箱过期，创建新的
            return db_manager.create_mailbox(
                address=address,
                retention_days=retention_days,
                sender_whitelist=sender_whitelist or [],
                created_by_ip=created_by_ip,
                created_source=created_source
            )
        else:
            # 更新访问时间
            db_manager.update_mailbox_access(mailbox['id'])
            return mailbox
    else:
        # 创建新邮箱
        return db_manager.create_mailbox(
            address=address,
            retention_days=retention_days,
            sender_whitelist=sender_whitelist or [],
            created_by_ip=created_by_ip,
            created_source=created_source
        )

def recv_email(email_json: Dict) -> str:
    """接收邮件"""
    recipient = email_json.get('To')
    sender = email_json.get('From')

    if not recipient:
        return "No recipient specified"

    # 检查IP白名单
    client_ip = "127.0.0.1"  # SMTP服务器本地调用，默认为白名单IP
    if not is_ip_whitelisted(client_ip):
        return "Access denied - IP not whitelisted"

    # 清理过期数据
    clean_expired_data()

    # 只获取邮箱，不自动创建
    mailbox = db_manager.get_mailbox_by_address(recipient)

    # 如果邮箱不存在，拒绝接收
    if not mailbox:
        return f"Mailbox {recipient} does not exist"

    # 检查邮箱是否过期
    if db_manager.is_mailbox_expired(mailbox):
        return f"Mailbox {recipient} has expired"

    # 检查邮箱是否激活
    if not mailbox.get('is_active', True):
        return f"Mailbox {recipient} is disabled"

    # 检查发件人白名单
    if not db_manager.is_sender_allowed(mailbox, sender):
        return f"Sender {sender} not allowed for mailbox {recipient}"

    # 更新访问时间
    db_manager.update_mailbox_access(mailbox['id'])

    # 添加邮件
    try:
        email_id = db_manager.add_email(mailbox['id'], email_json)

        # 限制每个邮箱的邮件数量
        limit_emails_per_mailbox(mailbox['id'])

        return "Email accepted"
    except Exception as e:
        return f"Failed to save email: {str(e)}"

def get_inbox_emails(address: str) -> List[Dict]:
    """获取邮箱的邮件列表"""
    mailbox = db_manager.get_mailbox_by_address(address)
    
    if not mailbox:
        return []
    
    if db_manager.is_mailbox_expired(mailbox):
        return []

    # 检查邮箱是否激活
    if not mailbox.get('is_active', True):
        return []

    # 更新访问时间
    db_manager.update_mailbox_access(mailbox['id'])
    
    # 获取邮件
    emails = db_manager.get_emails_by_mailbox(
        mailbox['id'], 
        limit=config.MAX_EMAILS_PER_ADDRESS
    )
    
    return emails

def get_email_by_id(address: str, email_id: str) -> Optional[Dict]:
    """根据ID获取单个邮件"""
    mailbox = db_manager.get_mailbox_by_address(address)
    
    if not mailbox:
        return None
    
    if db_manager.is_mailbox_expired(mailbox):
        return None

    # 检查邮箱是否激活
    if not mailbox.get('is_active', True):
        return None

    # 更新访问时间
    db_manager.update_mailbox_access(mailbox['id'])
    
    # 获取邮件
    email = db_manager.get_email_by_id(email_id)
    
    # 验证邮件属于该邮箱
    if email and email['To'] == address:
        # 标记为已读
        db_manager.mark_email_as_read(email_id)
        return email
    
    return None

def get_mailbox_info(address: str) -> Optional[Dict]:
    """获取邮箱信息"""
    mailbox = db_manager.get_mailbox_by_address(address)

    if not mailbox:
        return None

    # 获取统计信息
    stats = db_manager.get_mailbox_stats(mailbox['id'])

    return {
        'id': mailbox['id'],
        'address': mailbox['address'],
        'created_at': mailbox['created_at'],
        'expires_at': mailbox['expires_at'],
        'retention_days': mailbox['retention_days'],
        'sender_whitelist': mailbox['sender_whitelist'],
        'whitelist_enabled': mailbox.get('whitelist_enabled', False),
        'access_token': mailbox['access_token'],
        'is_active': mailbox.get('is_active', True),
        'is_expired': db_manager.is_mailbox_expired(mailbox),
        'email_count': stats['total_emails'],
        'unread_count': stats['unread_emails'],
        'last_email_time': stats['last_email_time']
    }

def get_emails_by_mailbox(mailbox_id: str, limit: int = None) -> List[Dict]:
    """获取邮箱的所有邮件"""
    return db_manager.get_emails_by_mailbox(mailbox_id, limit)

def mark_email_as_read(email_id: str) -> bool:
    """标记邮件为已读"""
    try:
        db_manager.mark_email_as_read(email_id)
        return True
    except Exception:
        return False

def mark_email_as_unread(email_id: str) -> bool:
    """标记邮件为未读"""
    try:
        db_manager.mark_email_as_unread(email_id)
        return True
    except Exception:
        return False

def delete_email(email_id: str) -> int:
    """删除邮件，返回删除的数量"""
    try:
        return db_manager.delete_email(email_id)
    except Exception:
        return 0

def mark_all_emails_read(mailbox_id: str) -> int:
    """标记邮箱所有邮件为已读，返回更新的数量"""
    try:
        return db_manager.mark_all_emails_read(mailbox_id)
    except Exception:
        return 0

def add_sender_to_whitelist(address: str, sender: str) -> bool:
    """添加发件人到白名单"""
    try:
        return db_manager.add_sender_to_whitelist(address, sender)
    except Exception:
        return False

def remove_sender_from_whitelist(address: str, sender: str) -> bool:
    """从白名单移除发件人"""
    try:
        return db_manager.remove_sender_from_whitelist(address, sender)
    except Exception:
        return False

def update_mailbox_retention(address: str, retention_days: int) -> bool:
    """更新邮箱保留时间"""
    try:
        return db_manager.update_mailbox_retention(address, retention_days)
    except Exception:
        return False

def regenerate_mailbox_key(address: str, current_key: str) -> Optional[str]:
    """重新生成邮箱密钥"""
    try:
        return db_manager.regenerate_mailbox_key(address, current_key)
    except Exception:
        return None

def update_mailbox_status(address: str, is_active: bool) -> bool:
    """更新邮箱状态"""
    try:
        mailbox = db_manager.get_mailbox_by_address(address)
        if not mailbox:
            return False

        with db_manager.get_connection() as conn:
            conn.execute('''
                UPDATE mailboxes SET is_active = ? WHERE id = ?
            ''', (is_active, mailbox['id']))
            conn.commit()
        return True
    except Exception:
        return False

def update_whitelist_status(address: str, enabled: bool) -> bool:
    """更新白名单启用状态"""
    try:
        mailbox = db_manager.get_mailbox_by_address(address)
        if not mailbox:
            return False

        with db_manager.get_connection() as conn:
            conn.execute('''
                UPDATE mailboxes SET whitelist_enabled = ? WHERE id = ?
            ''', (enabled, mailbox['id']))
            conn.commit()
        return True
    except Exception:
        return False

def limit_emails_per_mailbox(mailbox_id: str):
    """限制每个邮箱的邮件数量"""
    emails = db_manager.get_emails_by_mailbox(mailbox_id)
    
    if len(emails) > config.MAX_EMAILS_PER_ADDRESS:
        # 删除最旧的邮件
        emails_to_delete = emails[config.MAX_EMAILS_PER_ADDRESS:]
        
        with db_manager.get_connection() as conn:
            for email in emails_to_delete:
                conn.execute('DELETE FROM emails WHERE id = ?', (email['id'],))
            conn.commit()

def clean_expired_data():
    """清理过期数据"""
    # 清理过期邮箱
    db_manager.clean_expired_mailboxes()
    
    # 清理旧邮件
    db_manager.clean_old_emails()

def update_sender_whitelist(address: str, sender_whitelist: List[str]) -> bool:
    """更新发件人白名单"""
    mailbox = db_manager.get_mailbox_by_address(address)
    
    if not mailbox:
        return False
    
    try:
        with db_manager.get_connection() as conn:
            conn.execute('''
                UPDATE mailboxes 
                SET sender_whitelist = ? 
                WHERE id = ?
            ''', (json.dumps(sender_whitelist), mailbox['id']))
            conn.commit()
        return True
    except Exception:
        return False

def delete_mailbox(address: str) -> bool:
    """删除邮箱"""
    mailbox = db_manager.get_mailbox_by_address(address)
    
    if not mailbox:
        return False
    
    try:
        with db_manager.get_connection() as conn:
            # 删除邮件
            conn.execute('DELETE FROM emails WHERE mailbox_id = ?', (mailbox['id'],))
            # 删除邮箱
            conn.execute('DELETE FROM mailboxes WHERE id = ?', (mailbox['id'],))
            conn.commit()
        return True
    except Exception:
        return False

# 数据迁移函数
def migrate_from_json_file(json_file_path: str = None) -> Dict:
    """从JSON文件迁移数据"""
    if json_file_path is None:
        json_file_path = config.INBOX_FILE_NAME
    
    return db_manager.migrate_from_json(json_file_path)

def export_to_json_file(output_file_path: str = None) -> Dict:
    """导出数据到JSON文件"""
    if output_file_path is None:
        output_file_path = f"backup_{int(time.time())}.json"
    
    return db_manager.export_to_json(output_file_path)
