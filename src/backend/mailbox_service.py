"""
邮箱生命周期管理服务层
提供邮箱的CRUD操作、校验、审计等功能
"""

import time
import uuid
import json
import re
from typing import Dict, List, Optional, Tuple
from database import DatabaseManager
import config

class MailboxService:
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
        self.max_retention_days = getattr(config, 'MAX_RETENTION_DAYS', 90)
        self.default_retention_days = getattr(config, 'MAILBOX_RETENTION_DAYS', 30)
        
    def _validate_email_address(self, address: str) -> Tuple[bool, str]:
        """验证邮箱地址格式"""
        if not address:
            return False, "邮箱地址不能为空"
        
        # 基本邮箱格式验证
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, address):
            return False, "邮箱地址格式不正确"
        
        # 检查是否是保护的地址
        protected_pattern = getattr(config, 'PROTECTED_ADDRESSES', '^admin.*')
        if re.match(protected_pattern, address.split('@')[0]):
            return False, "该邮箱地址受保护，无法创建"
        
        return True, ""
    
    def _validate_retention_days(self, days: int) -> Tuple[bool, str]:
        """验证保留天数"""
        if days < 1:
            return False, "保留天数必须大于0"
        if days > self.max_retention_days:
            return False, f"保留天数不能超过{self.max_retention_days}天"
        return True, ""
    
    def _validate_sender_whitelist(self, whitelist: List[str]) -> Tuple[bool, str]:
        """验证发件人白名单"""
        if not isinstance(whitelist, list):
            return False, "白名单必须是列表格式"
        
        for sender in whitelist:
            if not sender:
                continue
            # 验证域名格式 @domain.com 或完整邮箱
            if sender.startswith('@'):
                domain = sender[1:]
                if not re.match(r'^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', domain):
                    return False, f"域名格式不正确: {sender}"
            else:
                valid, msg = self._validate_email_address(sender)
                if not valid:
                    return False, f"邮箱地址格式不正确: {sender}"
        
        return True, ""
    
    def _log_audit(self, action: str, mailbox_id: str, admin_user: str, 
                   changes: Dict = None, ip_address: str = None):
        """记录审计日志"""
        try:
            audit_entry = {
                'timestamp': int(time.time()),
                'action': action,
                'mailbox_id': mailbox_id,
                'admin_user': admin_user,
                'changes': changes or {},
                'ip_address': ip_address
            }
            
            with self.db.get_connection() as conn:
                conn.execute('''
                    INSERT INTO audit_logs 
                    (id, timestamp, action, mailbox_id, admin_user, changes, ip_address)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    str(uuid.uuid4()),
                    audit_entry['timestamp'],
                    audit_entry['action'],
                    audit_entry['mailbox_id'],
                    audit_entry['admin_user'],
                    json.dumps(audit_entry['changes']),
                    audit_entry['ip_address']
                ))
                conn.commit()
        except Exception as e:
            print(f"审计日志记录失败: {e}")
    
    def list_mailboxes(self, page: int = 1, page_size: int = 20,
                      search: str = None, status: str = None, source: str = None) -> Dict:
        """
        获取邮箱列表（分页）
        status: 'active', 'expired', 'disabled', 'all'
        source: 'admin', 'register', 'api_v2', 'unknown', 'all'
        """
        offset = (page - 1) * page_size
        current_time = int(time.time())

        # 构建查询条件
        where_clauses = []
        params = []

        if search:
            where_clauses.append("(address LIKE ? OR id LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])

        if status == 'active':
            where_clauses.append("is_active = 1 AND expires_at > ?")
            params.append(current_time)
        elif status == 'expired':
            where_clauses.append("expires_at <= ?")
            params.append(current_time)
        elif status == 'disabled':
            where_clauses.append("is_active = 0")

        if source:
            where_clauses.append("created_source = ?")
            params.append(source)

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
        
        with self.db.get_connection() as conn:
            # 获取总数
            count_query = f"SELECT COUNT(*) as total FROM mailboxes WHERE {where_sql}"
            total = conn.execute(count_query, params).fetchone()['total']
            
            # 获取数据
            query = f'''
                SELECT id, address, created_at, expires_at, retention_days,
                       is_active, sender_whitelist, whitelist_enabled,
                       created_by_ip, last_accessed, updated_by_admin, updated_at,
                       created_source
                FROM mailboxes
                WHERE {where_sql}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            '''
            params.extend([page_size, offset])
            
            cursor = conn.execute(query, params)
            rows = cursor.fetchall()

            # 安全获取字段值的辅助函数
            def safe_get(row, key, default=None):
                try:
                    return row[key]
                except (KeyError, IndexError):
                    return default

            mailboxes = []
            for row in rows:
                # 获取邮件统计
                stats = self.db.get_mailbox_stats(row['id'])

                mailboxes.append({
                    'id': row['id'],
                    'address': row['address'],
                    'created_at': row['created_at'],
                    'expires_at': row['expires_at'],
                    'retention_days': row['retention_days'],
                    'is_active': bool(row['is_active']),
                    'is_expired': row['expires_at'] <= current_time,
                    'sender_whitelist': json.loads(row['sender_whitelist'] or '[]'),
                    'whitelist_enabled': bool(safe_get(row, 'whitelist_enabled', 0)),
                    'created_by_ip': safe_get(row, 'created_by_ip'),
                    'last_accessed': safe_get(row, 'last_accessed'),
                    'updated_by_admin': safe_get(row, 'updated_by_admin'),
                    'updated_at': safe_get(row, 'updated_at'),
                    'created_source': safe_get(row, 'created_source', 'unknown'),
                    'email_count': stats['total_emails'],
                    'unread_count': stats['unread_emails']
                })
            
            return {
                'mailboxes': mailboxes,
                'total': total,
                'page': page,
                'page_size': page_size,
                'total_pages': (total + page_size - 1) // page_size
            }
    
    def get_mailbox_detail(self, mailbox_id: str) -> Optional[Dict]:
        """获取邮箱详细信息"""
        with self.db.get_connection() as conn:
            cursor = conn.execute('''
                SELECT * FROM mailboxes WHERE id = ?
            ''', (mailbox_id,))
            row = cursor.fetchone()

            if not row:
                return None

            stats = self.db.get_mailbox_stats(mailbox_id)
            current_time = int(time.time())

            # 安全获取字段值，兼容旧数据库
            def safe_get(key, default=None):
                try:
                    return row[key]
                except (KeyError, IndexError):
                    return default

            return {
                'id': row['id'],
                'address': row['address'],
                'created_at': row['created_at'],
                'expires_at': row['expires_at'],
                'retention_days': row['retention_days'],
                'is_active': bool(row['is_active']),
                'is_expired': row['expires_at'] <= current_time,
                'sender_whitelist': json.loads(row['sender_whitelist'] or '[]'),
                'whitelist_enabled': bool(safe_get('whitelist_enabled', 0)),
                'created_by_ip': safe_get('created_by_ip'),
                'access_token': safe_get('access_token'),
                'mailbox_key': safe_get('mailbox_key'),
                'last_accessed': safe_get('last_accessed'),
                'updated_by_admin': safe_get('updated_by_admin'),
                'updated_at': safe_get('updated_at'),
                'email_count': stats['total_emails'],
                'unread_count': stats['unread_emails'],
                'last_email_time': stats['last_email_time'],
                'storage_used': stats.get('storage_used', 0),
                'storage_limit': stats.get('storage_limit', 52428800),
                'storage_used_mb': stats.get('storage_used_mb', 0),
                'storage_limit_mb': stats.get('storage_limit_mb', 50),
                'storage_percent': stats.get('storage_percent', 0),
                'allowed_domains': json.loads(safe_get('allowed_domains') or '[]') if safe_get('allowed_domains') else []
            }
    
    def create_mailbox(self, address: str, retention_days: int = None,
                      sender_whitelist: List[str] = None, admin_user: str = None,
                      ip_address: str = None) -> Tuple[bool, str, Optional[Dict]]:
        """
        创建邮箱
        返回: (成功标志, 消息, 邮箱数据)
        注意: access_token只在创建时返回一次
        """
        # 验证邮箱地址
        valid, msg = self._validate_email_address(address)
        if not valid:
            return False, msg, None
        
        # 检查是否已存在
        existing = self.db.get_mailbox_by_address(address)
        if existing and not self.db.is_mailbox_expired(existing):
            return False, "邮箱地址已存在", None
        
        # 验证保留天数
        if retention_days is None:
            retention_days = self.default_retention_days
        valid, msg = self._validate_retention_days(retention_days)
        if not valid:
            return False, msg, None
        
        # 验证白名单
        if sender_whitelist:
            valid, msg = self._validate_sender_whitelist(sender_whitelist)
            if not valid:
                return False, msg, None
        
        try:
            # 创建邮箱
            mailbox = self.db.create_mailbox(
                address=address,
                retention_days=retention_days,
                sender_whitelist=sender_whitelist or [],
                created_by_ip=ip_address,
                created_source="admin"
            )

            # 记录审计日志
            self._log_audit(
                action='CREATE',
                mailbox_id=mailbox['id'],
                admin_user=admin_user or 'system',
                changes={'address': address, 'retention_days': retention_days},
                ip_address=ip_address
            )

            return True, "邮箱创建成功", mailbox

        except Exception as e:
            return False, f"创建失败: {str(e)}", None

    def update_mailbox(self, mailbox_id: str, updates: Dict,
                      admin_user: str = None, ip_address: str = None) -> Tuple[bool, str]:
        """
        更新邮箱信息
        updates可包含: retention_days, sender_whitelist, whitelist_enabled, is_active
        """
        # 获取现有邮箱
        mailbox = self.get_mailbox_detail(mailbox_id)
        if not mailbox:
            return False, "邮箱不存在"

        changes = {}

        try:
            with self.db.get_connection() as conn:
                update_fields = []
                params = []

                # 更新保留天数
                if 'retention_days' in updates:
                    new_days = updates['retention_days']
                    valid, msg = self._validate_retention_days(new_days)
                    if not valid:
                        return False, msg

                    # 重新计算过期时间
                    current_time = int(time.time())
                    new_expires_at = current_time + (new_days * 24 * 60 * 60)

                    update_fields.extend(['retention_days = ?', 'expires_at = ?'])
                    params.extend([new_days, new_expires_at])
                    changes['retention_days'] = {'old': mailbox['retention_days'], 'new': new_days}

                # 更新白名单
                if 'sender_whitelist' in updates:
                    new_whitelist = updates['sender_whitelist']
                    valid, msg = self._validate_sender_whitelist(new_whitelist)
                    if not valid:
                        return False, msg

                    update_fields.append('sender_whitelist = ?')
                    params.append(json.dumps(new_whitelist))
                    changes['sender_whitelist'] = {
                        'old': mailbox['sender_whitelist'],
                        'new': new_whitelist
                    }

                # 更新白名单启用状态
                if 'whitelist_enabled' in updates:
                    new_enabled = bool(updates['whitelist_enabled'])
                    update_fields.append('whitelist_enabled = ?')
                    params.append(new_enabled)
                    changes['whitelist_enabled'] = {
                        'old': mailbox['whitelist_enabled'],
                        'new': new_enabled
                    }

                # 更新激活状态
                if 'is_active' in updates:
                    new_active = bool(updates['is_active'])
                    update_fields.append('is_active = ?')
                    params.append(new_active)
                    changes['is_active'] = {
                        'old': mailbox['is_active'],
                        'new': new_active
                    }

                # 更新允许的域名
                if 'allowed_domains' in updates:
                    new_domains = updates['allowed_domains']
                    update_fields.append('allowed_domains = ?')
                    params.append(json.dumps(new_domains))
                    old_domains = mailbox.get('allowed_domains', [])
                    changes['allowed_domains'] = {
                        'old': old_domains,
                        'new': new_domains
                    }

                if not update_fields:
                    return False, "没有需要更新的字段"

                # 添加更新元数据
                update_fields.extend(['updated_by_admin = ?', 'updated_at = ?'])
                params.extend([admin_user or 'system', int(time.time())])

                # 执行更新
                params.append(mailbox_id)
                sql = f"UPDATE mailboxes SET {', '.join(update_fields)} WHERE id = ?"
                conn.execute(sql, params)
                conn.commit()

            # 记录审计日志
            self._log_audit(
                action='UPDATE',
                mailbox_id=mailbox_id,
                admin_user=admin_user or 'system',
                changes=changes,
                ip_address=ip_address
            )

            return True, "更新成功"

        except Exception as e:
            return False, f"更新失败: {str(e)}"

    def delete_mailbox(self, mailbox_id: str, soft_delete: bool = True,
                      admin_user: str = None, ip_address: str = None) -> Tuple[bool, str]:
        """
        删除邮箱
        soft_delete=True: 软删除（设置is_active=False）
        soft_delete=False: 硬删除（从数据库删除）
        """
        mailbox = self.get_mailbox_detail(mailbox_id)
        if not mailbox:
            return False, "邮箱不存在"

        try:
            if soft_delete:
                # 软删除
                with self.db.get_connection() as conn:
                    conn.execute('''
                        UPDATE mailboxes
                        SET is_active = 0, updated_by_admin = ?, updated_at = ?
                        WHERE id = ?
                    ''', (admin_user or 'system', int(time.time()), mailbox_id))
                    conn.commit()

                action = 'SOFT_DELETE'
                message = "邮箱已禁用"
            else:
                # 硬删除
                with self.db.get_connection() as conn:
                    # 删除邮件
                    conn.execute('DELETE FROM emails WHERE mailbox_id = ?', (mailbox_id,))
                    # 删除邮箱
                    conn.execute('DELETE FROM mailboxes WHERE id = ?', (mailbox_id,))
                    conn.commit()

                action = 'HARD_DELETE'
                message = "邮箱已删除"

            # 记录审计日志
            self._log_audit(
                action=action,
                mailbox_id=mailbox_id,
                admin_user=admin_user or 'system',
                changes={'address': mailbox['address']},
                ip_address=ip_address
            )

            return True, message

        except Exception as e:
            return False, f"删除失败: {str(e)}"

    def get_audit_logs(self, mailbox_id: str = None, limit: int = 50) -> List[Dict]:
        """获取审计日志"""
        try:
            with self.db.get_connection() as conn:
                if mailbox_id:
                    query = '''
                        SELECT * FROM audit_logs
                        WHERE mailbox_id = ?
                        ORDER BY timestamp DESC
                        LIMIT ?
                    '''
                    cursor = conn.execute(query, (mailbox_id, limit))
                else:
                    query = '''
                        SELECT * FROM audit_logs
                        ORDER BY timestamp DESC
                        LIMIT ?
                    '''
                    cursor = conn.execute(query, (limit,))

                rows = cursor.fetchall()
                logs = []
                for row in rows:
                    logs.append({
                        'id': row['id'],
                        'timestamp': row['timestamp'],
                        'action': row['action'],
                        'mailbox_id': row['mailbox_id'],
                        'admin_user': row['admin_user'],
                        'changes': json.loads(row['changes'] or '{}'),
                        'ip_address': row['ip_address']
                    })

                return logs
        except Exception:
            return []

