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
from ip_blocker import ip_blocker

bp = Blueprint('admin_api', __name__)
mailbox_service = MailboxService(db_manager)

def check_admin_auth():
    """检查管理员权限，并记录失败尝试"""
    client_ip = get_client_ip()

    # 检查IP是否被封禁
    if ip_blocker.is_blocked(client_ip):
        remaining = ip_blocker.get_remaining_block_time(client_ip)
        return False, f'IP已被临时封禁，剩余 {remaining} 秒'

    auth_header = request.headers.get('Authorization')
    if not auth_header:
        ip_blocker.record_failed_attempt(client_ip)
        return False, '缺少Authorization请求头'

    # 简单的密码验证（实际应用中应使用更安全的方式）
    password = auth_header.replace('Bearer ', '')
    if password != config.PASSWORD:
        # 记录失败尝试
        is_blocked = ip_blocker.record_failed_attempt(client_ip)
        if is_blocked:
            return False, f'认证失败次数过多，IP已被封禁 {ip_blocker.block_duration} 秒'
        return False, '认证失败'

    return True, None

def get_client_ip():
    """获取客户端IP"""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0]
    return request.remote_addr

@bp.route('/mailboxes', methods=['GET'])
def list_mailboxes():
    """获取邮箱列表"""
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401

    try:
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 20))
        search = request.args.get('search', '')
        status = request.args.get('status', 'all')
        source = request.args.get('source', 'all')

        result = mailbox_service.list_mailboxes(
            page=page,
            page_size=page_size,
            search=search if search else None,
            status=status if status != 'all' else None,
            source=source if source != 'all' else None
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
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401
    
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
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401

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
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401
    
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
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401
    
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
    """获取邮箱审证日志"""
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401
    
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
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401
    
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
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401
    
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

@bp.route('/mailboxes/batch-delete', methods=['POST'])
def batch_delete_mailboxes():
    """批量删除邮箱"""
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401

    try:
        data = request.get_json()
        mailbox_ids = data.get('mailbox_ids', [])
        soft_delete = data.get('soft_delete', True)

        if not mailbox_ids:
            return jsonify({'success': False, 'error': '未提供邮箱ID'}), 400

        success_count = 0
        failed_count = 0
        errors = []

        for mailbox_id in mailbox_ids:
            success, message = mailbox_service.delete_mailbox(
                mailbox_id=mailbox_id,
                soft_delete=soft_delete,
                admin_user='admin',
                ip_address=get_client_ip()
            )

            if success:
                success_count += 1
            else:
                failed_count += 1
                errors.append({'mailbox_id': mailbox_id, 'error': message})

        return jsonify({
            'success': True,
            'message': f'成功删除 {success_count} 个邮箱，失败 {failed_count} 个',
            'success_count': success_count,
            'failed_count': failed_count,
            'errors': errors
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/mailboxes/<mailbox_id>/reset-token', methods=['POST'])
def reset_mailbox_token(mailbox_id):
    """重置邮箱访问令牌"""
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401

    try:
        import uuid
        new_token = str(uuid.uuid4())

        # 更新数据库中的token
        with db_manager.get_connection() as conn:
            conn.execute('''
                UPDATE mailboxes SET access_token = ? WHERE id = ?
            ''', (new_token, mailbox_id))
            conn.commit()

        # 记录审计日志
        mailbox_service._log_audit(
            action='RESET_TOKEN',
            mailbox_id=mailbox_id,
            admin_user='admin',
            changes={'new_token': new_token},
            ip_address=get_client_ip()
        )

        return jsonify({
            'success': True,
            'message': '令牌重置成功',
            'data': {
                'mailbox_id': mailbox_id,
                'new_token': new_token
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/mailboxes/<mailbox_id>/enable', methods=['POST'])
def enable_mailbox(mailbox_id):
    """恢复（启用）邮箱 - 用于恢复被软删除的邮箱"""
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401

    try:
        with db_manager.get_connection() as conn:
            conn.execute('''
                UPDATE mailboxes SET is_active = 1 WHERE id = ?
            ''', (mailbox_id,))
            conn.commit()

        # 记录审计日志
        mailbox_service._log_audit(
            action='RESTORE',
            mailbox_id=mailbox_id,
            admin_user='admin',
            changes={'is_active': True},
            ip_address=get_client_ip()
        )

        return jsonify({
            'success': True,
            'message': '邮箱已恢复'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/blocked-ips', methods=['GET'])
def get_blocked_ips():
    """获取被封禁的IP列表"""
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401

    try:
        blocked_ips = ip_blocker.get_blocked_ips()
        return jsonify({
            'success': True,
            'data': {
                'blocked_ips': [
                    {'ip': ip, 'remaining_seconds': remaining}
                    for ip, remaining in blocked_ips.items()
                ],
                'total': len(blocked_ips)
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/blocked-ips/<ip>', methods=['DELETE'])
def unblock_ip(ip):
    """手动解除IP封禁"""
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401

    try:
        ip_blocker.unblock_ip(ip)
        return jsonify({
            'success': True,
            'message': f'IP {ip} 已解除封禁'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/source-stats', methods=['GET'])
def get_source_stats():
    """获取邮箱创建来源统计"""
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401

    try:
        with db_manager.get_connection() as conn:
            # 按创建来源统计
            cursor = conn.execute('''
                SELECT created_source, COUNT(*) as count
                FROM mailboxes
                GROUP BY created_source
            ''')
            source_stats = {row['created_source'] or 'unknown': row['count'] for row in cursor.fetchall()}

        return jsonify({
            'success': True,
            'data': source_stats
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/security-config', methods=['GET'])
def get_security_config():
    """获取安全配置"""
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401

    try:
        config = ip_blocker.get_config()
        return jsonify({
            'success': True,
            'data': config
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/security-config', methods=['PUT'])
def update_security_config():
    """更新安全配置"""
    auth_ok, error_msg = check_admin_auth()
    if not auth_ok:
        return jsonify({'success': False, 'error': error_msg or '未授权'}), 401

    try:
        data = request.get_json()

        # 验证参数
        block_duration = data.get('block_duration')
        max_attempts = data.get('max_attempts')
        attempt_window = data.get('attempt_window')

        if block_duration is not None:
            if not isinstance(block_duration, int) or block_duration < 60 or block_duration > 86400:
                return jsonify({'success': False, 'error': '封禁时长必须在60-86400秒之间'}), 400

        if max_attempts is not None:
            if not isinstance(max_attempts, int) or max_attempts < 1 or max_attempts > 10:
                return jsonify({'success': False, 'error': '最大失败次数必须在1-10次之间'}), 400

        if attempt_window is not None:
            if not isinstance(attempt_window, int) or attempt_window < 30 or attempt_window > 600:
                return jsonify({'success': False, 'error': '尝试窗口时间必须在30-600秒之间'}), 400

        # 更新配置
        ip_blocker.update_config(
            block_duration=block_duration,
            max_attempts=max_attempts,
            attempt_window=attempt_window
        )

        # 记录审计日志
        client_ip = get_client_ip()
        mailbox_service._log_audit(
            action='UPDATE_CONFIG',
            mailbox_id=None,
            admin_user='admin',
            changes=data,
            ip_address=client_ip
        )

        return jsonify({
            'success': True,
            'message': '配置已更新',
            'data': ip_blocker.get_config()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

