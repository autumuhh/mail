"""
管理员API路由
提供邮箱管理的CRUD接口
"""

from flask import Blueprint, request, jsonify
import config
import sys
import os

# 添加backend目录到路径
backend_dir = os.path.dirname(os.path.dirname(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import db_manager
from mailbox_service import MailboxService

bp = Blueprint('admin_api', __name__)
mailbox_service = MailboxService(db_manager)

def check_admin_auth():
    """检查管理员权限"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return False
    
    # 简单的密码验证（实际应用中应使用更安全的方式）
    password = auth_header.replace('Bearer ', '')
    return password == config.PASSWORD

def get_client_ip():
    """获取客户端IP"""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0]
    return request.remote_addr

@bp.route('/mailboxes', methods=['GET'])
def list_mailboxes():
    """获取邮箱列表"""
    if not check_admin_auth():
        return jsonify({'success': False, 'error': '未授权'}), 401
    
    try:
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 20))
        search = request.args.get('search', '')
        status = request.args.get('status', 'all')
        
        result = mailbox_service.list_mailboxes(
            page=page,
            page_size=page_size,
            search=search if search else None,
            status=status if status != 'all' else None
        )
        
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/mailboxes/<mailbox_id>', methods=['GET'])
def get_mailbox(mailbox_id):
    """获取邮箱详情"""
    if not check_admin_auth():
        return jsonify({'success': False, 'error': '未授权'}), 401
    
    try:
        mailbox = mailbox_service.get_mailbox_detail(mailbox_id)
        if not mailbox:
            return jsonify({'success': False, 'error': '邮箱不存在'}), 404
        
        return jsonify({
            'success': True,
            'data': mailbox
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/mailboxes', methods=['POST'])
def create_mailbox():
    """创建邮箱"""
    if not check_admin_auth():
        return jsonify({'success': False, 'error': '未授权'}), 401

    try:
        data = request.get_json()
        address = data.get('address')
        retention_days = data.get('retention_days')
        sender_whitelist = data.get('sender_whitelist', [])
        allowed_domains = data.get('allowed_domains', [])

        if not address:
            return jsonify({'success': False, 'error': '邮箱地址不能为空'}), 400

        success, message, mailbox = mailbox_service.create_mailbox(
            address=address,
            retention_days=retention_days,
            sender_whitelist=sender_whitelist,
            admin_user='admin',
            ip_address=get_client_ip()
        )

        if success and allowed_domains:
            # 更新允许的域名
            import json
            with db_manager.get_connection() as conn:
                conn.execute('''
                    UPDATE mailboxes SET allowed_domains = ? WHERE id = ?
                ''', (json.dumps(allowed_domains), mailbox['id']))
                conn.commit()

        if success:
            return jsonify({
                'success': True,
                'message': message,
                'data': mailbox
            })
        else:
            return jsonify({'success': False, 'error': message}), 400

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/mailboxes/<mailbox_id>', methods=['PUT'])
def update_mailbox(mailbox_id):
    """更新邮箱"""
    if not check_admin_auth():
        return jsonify({'success': False, 'error': '未授权'}), 401
    
    try:
        data = request.get_json()
        updates = {}

        if 'retention_days' in data:
            updates['retention_days'] = data['retention_days']
        if 'sender_whitelist' in data:
            updates['sender_whitelist'] = data['sender_whitelist']
        if 'whitelist_enabled' in data:
            updates['whitelist_enabled'] = data['whitelist_enabled']
        if 'is_active' in data:
            updates['is_active'] = data['is_active']
        if 'allowed_domains' in data:
            updates['allowed_domains'] = data['allowed_domains']

        success, message = mailbox_service.update_mailbox(
            mailbox_id=mailbox_id,
            updates=updates,
            admin_user='admin',
            ip_address=get_client_ip()
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': message
            })
        else:
            return jsonify({'success': False, 'error': message}), 400
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/mailboxes/<mailbox_id>', methods=['DELETE'])
def delete_mailbox(mailbox_id):
    """删除邮箱"""
    if not check_admin_auth():
        return jsonify({'success': False, 'error': '未授权'}), 401
    
    try:
        soft_delete = request.args.get('soft', 'true').lower() == 'true'
        
        success, message = mailbox_service.delete_mailbox(
            mailbox_id=mailbox_id,
            soft_delete=soft_delete,
            admin_user='admin',
            ip_address=get_client_ip()
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': message
            })
        else:
            return jsonify({'success': False, 'error': message}), 400
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/mailboxes/<mailbox_id>/audit-logs', methods=['GET'])
def get_mailbox_audit_logs(mailbox_id):
    """获取邮箱审计日志"""
    if not check_admin_auth():
        return jsonify({'success': False, 'error': '未授权'}), 401
    
    try:
        limit = int(request.args.get('limit', 50))
        logs = mailbox_service.get_audit_logs(mailbox_id=mailbox_id, limit=limit)
        
        return jsonify({
            'success': True,
            'data': logs
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/audit-logs', methods=['GET'])
def get_all_audit_logs():
    """获取所有审计日志"""
    if not check_admin_auth():
        return jsonify({'success': False, 'error': '未授权'}), 401
    
    try:
        limit = int(request.args.get('limit', 100))
        logs = mailbox_service.get_audit_logs(limit=limit)
        
        return jsonify({
            'success': True,
            'data': logs
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/stats', methods=['GET'])
def get_stats():
    """获取统计信息"""
    if not check_admin_auth():
        return jsonify({'success': False, 'error': '未授权'}), 401
    
    try:
        with db_manager.get_connection() as conn:
            # 总邮箱数
            total_mailboxes = conn.execute('SELECT COUNT(*) as count FROM mailboxes').fetchone()['count']
            
            # 活跃邮箱数
            active_mailboxes = conn.execute(
                'SELECT COUNT(*) as count FROM mailboxes WHERE is_active = 1 AND expires_at > ?',
                (int(__import__('time').time()),)
            ).fetchone()['count']
            
            # 过期邮箱数
            expired_mailboxes = conn.execute(
                'SELECT COUNT(*) as count FROM mailboxes WHERE expires_at <= ?',
                (int(__import__('time').time()),)
            ).fetchone()['count']
            
            # 禁用邮箱数
            disabled_mailboxes = conn.execute(
                'SELECT COUNT(*) as count FROM mailboxes WHERE is_active = 0'
            ).fetchone()['count']
            
            # 总邮件数
            total_emails = conn.execute('SELECT COUNT(*) as count FROM emails').fetchone()['count']
            
            # 未读邮件数
            unread_emails = conn.execute(
                'SELECT COUNT(*) as count FROM emails WHERE is_read = 0'
            ).fetchone()['count']
            
            return jsonify({
                'success': True,
                'data': {
                    'total_mailboxes': total_mailboxes,
                    'active_mailboxes': active_mailboxes,
                    'expired_mailboxes': expired_mailboxes,
                    'disabled_mailboxes': disabled_mailboxes,
                    'total_emails': total_emails,
                    'unread_emails': unread_emails
                }
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

