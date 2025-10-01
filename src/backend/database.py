import sqlite3
import json
import time
import uuid
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import config

class DatabaseManager:
    def __init__(self, db_path: str = None):
        """初始化数据库管理器"""
        self.db_path = db_path or getattr(config, 'DATABASE_PATH', 'data/mailbox.db')
        self.ensure_database_exists()
        self.init_tables()
    
    def ensure_database_exists(self):
        """确保数据库目录存在"""
        db_dir = os.path.dirname(self.db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
    
    def get_connection(self) -> sqlite3.Connection:
        """获取数据库连接"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # 使结果可以像字典一样访问
        return conn
    
    def init_tables(self):
        """初始化数据库表"""
        with self.get_connection() as conn:
            # 用户表
            conn.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT,
                    password_hash TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    created_by_ip TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    last_login INTEGER
                )
            ''')

            # 用户邮箱关联表
            conn.execute('''
                CREATE TABLE IF NOT EXISTS users_mailboxes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    mailbox_id TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY (mailbox_id) REFERENCES mailboxes (id) ON DELETE CASCADE,
                    UNIQUE(user_id, mailbox_id)
                )
            ''')

            # 邮箱表
            conn.execute('''
                CREATE TABLE IF NOT EXISTS mailboxes (
                    id TEXT PRIMARY KEY,
                    address TEXT UNIQUE NOT NULL,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL,
                    retention_days INTEGER DEFAULT 7,
                    is_active BOOLEAN DEFAULT 1,
                    sender_whitelist TEXT DEFAULT '[]',
                    whitelist_enabled BOOLEAN DEFAULT 0,
                    created_by_ip TEXT,
                    access_token TEXT,
                    last_accessed INTEGER
                )
            ''')

            # 检查并添加邮箱密钥字段（如果不存在）
            try:
                conn.execute('ALTER TABLE mailboxes ADD COLUMN mailbox_key TEXT')
                print("Added mailbox_key column to mailboxes table")
            except sqlite3.OperationalError:
                # 字段已存在，忽略错误
                pass

            # 检查并添加白名单启用字段（如果不存在）
            try:
                conn.execute('ALTER TABLE mailboxes ADD COLUMN whitelist_enabled BOOLEAN DEFAULT 0')
                print("Added whitelist_enabled column to mailboxes table")
            except sqlite3.OperationalError:
                # 字段已存在，忽略错误
                pass

            # 添加管理员更新字段
            try:
                conn.execute('ALTER TABLE mailboxes ADD COLUMN updated_by_admin TEXT')
                print("Added updated_by_admin column to mailboxes table")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute('ALTER TABLE mailboxes ADD COLUMN updated_at INTEGER')
                print("Added updated_at column to mailboxes table")
            except sqlite3.OperationalError:
                pass

            # 添加允许域名字段
            try:
                conn.execute('ALTER TABLE mailboxes ADD COLUMN allowed_domains TEXT DEFAULT "[]"')
                print("Added allowed_domains column to mailboxes table")
            except sqlite3.OperationalError:
                pass



            # 邮件表
            conn.execute('''
                CREATE TABLE IF NOT EXISTS emails (
                    id TEXT PRIMARY KEY,
                    mailbox_id TEXT NOT NULL,
                    from_address TEXT NOT NULL,
                    to_address TEXT NOT NULL,
                    subject TEXT,
                    body TEXT,
                    content_type TEXT DEFAULT 'Text',
                    timestamp INTEGER NOT NULL,
                    sent_formatted TEXT,
                    is_read BOOLEAN DEFAULT 0,
                    FOREIGN KEY (mailbox_id) REFERENCES mailboxes (id) ON DELETE CASCADE
                )
            ''')
            
            # 邀请码表
            conn.execute('''
                CREATE TABLE IF NOT EXISTS invite_codes (
                    id TEXT PRIMARY KEY,
                    code TEXT UNIQUE NOT NULL,
                    created_by INTEGER,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER,
                    is_used BOOLEAN DEFAULT 0,
                    used_by INTEGER,
                    used_at INTEGER,
                    max_uses INTEGER DEFAULT 1,
                    current_uses INTEGER DEFAULT 0,
                    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
                    FOREIGN KEY (used_by) REFERENCES users (id) ON DELETE SET NULL
                )
            ''')

            # 审计日志表
            conn.execute('''
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id TEXT PRIMARY KEY,
                    timestamp INTEGER NOT NULL,
                    action TEXT NOT NULL,
                    mailbox_id TEXT,
                    admin_user TEXT,
                    changes TEXT,
                    ip_address TEXT,
                    FOREIGN KEY (mailbox_id) REFERENCES mailboxes (id) ON DELETE SET NULL
                )
            ''')

            # 创建索引
            conn.execute('CREATE INDEX IF NOT EXISTS idx_mailboxes_address ON mailboxes (address)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_mailboxes_expires ON mailboxes (expires_at)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_emails_mailbox ON emails (mailbox_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_emails_timestamp ON emails (timestamp)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes (code)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_invite_codes_used ON invite_codes (is_used)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_audit_logs_mailbox ON audit_logs (mailbox_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp)')

            conn.commit()
    
    def create_mailbox(self, address: str, retention_days: int = 7, 
                      sender_whitelist: List[str] = None, 
                      created_by_ip: str = None) -> Dict:
        """创建新邮箱"""
        mailbox_id = str(uuid.uuid4())
        access_token = str(uuid.uuid4())
        mailbox_key = str(uuid.uuid4())  # 生成邮箱密钥
        current_time = int(time.time())
        expires_at = current_time + (retention_days * 24 * 60 * 60)

        if sender_whitelist is None:
            sender_whitelist = []

        with self.get_connection() as conn:
            conn.execute('''
                INSERT INTO mailboxes
                (id, address, created_at, expires_at, retention_days,
                 sender_whitelist, whitelist_enabled, created_by_ip, access_token, mailbox_key, last_accessed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                mailbox_id, address, current_time, expires_at, retention_days,
                json.dumps(sender_whitelist), False, created_by_ip, access_token, mailbox_key, current_time
            ))
            conn.commit()

        return {
            'id': mailbox_id,
            'address': address,
            'created_at': current_time,
            'expires_at': expires_at,
            'retention_days': retention_days,
            'sender_whitelist': sender_whitelist,
            'whitelist_enabled': False,
            'access_token': access_token,
            'mailbox_key': mailbox_key,  # 返回邮箱密钥
            'is_active': True
        }
    
    def get_mailbox_by_address(self, address: str) -> Optional[Dict]:
        """根据地址获取邮箱信息"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT id, address, created_at, expires_at, retention_days, is_active,
                       sender_whitelist, whitelist_enabled, created_by_ip, access_token,
                       mailbox_key, last_accessed
                FROM mailboxes WHERE address = ? AND is_active = 1
            ''', (address,))
            row = cursor.fetchone()
            
            if row:
                return {
                    'id': row['id'],
                    'address': row['address'],
                    'created_at': row['created_at'],
                    'expires_at': row['expires_at'],
                    'retention_days': row['retention_days'],
                    'sender_whitelist': json.loads(row['sender_whitelist'] or '[]'),
                    'whitelist_enabled': bool(row['whitelist_enabled']),
                    'access_token': row['access_token'],
                    'is_active': bool(row['is_active']),
                    'created_by_ip': row['created_by_ip'],
                    'last_accessed': row['last_accessed']
                }
            return None
    
    def get_mailbox_by_token(self, access_token: str) -> Optional[Dict]:
        """根据访问令牌获取邮箱信息"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT id, address, created_at, expires_at, retention_days, is_active,
                       sender_whitelist, whitelist_enabled, created_by_ip, access_token,
                       mailbox_key, last_accessed
                FROM mailboxes WHERE access_token = ? AND is_active = 1
            ''', (access_token,))
            row = cursor.fetchone()
            
            if row:
                return {
                    'id': row['id'],
                    'address': row['address'],
                    'created_at': row['created_at'],
                    'expires_at': row['expires_at'],
                    'retention_days': row['retention_days'],
                    'sender_whitelist': json.loads(row['sender_whitelist'] or '[]'),
                    'whitelist_enabled': bool(row['whitelist_enabled']),
                    'access_token': row['access_token'],
                    'is_active': bool(row['is_active']),
                    'created_by_ip': row['created_by_ip'],
                    'last_accessed': row['last_accessed']
                }
            return None
    
    def update_mailbox_access(self, mailbox_id: str):
        """更新邮箱最后访问时间"""
        current_time = int(time.time())
        with self.get_connection() as conn:
            conn.execute('''
                UPDATE mailboxes SET last_accessed = ? WHERE id = ?
            ''', (current_time, mailbox_id))
            conn.commit()
    
    def is_mailbox_expired(self, mailbox: Dict) -> bool:
        """检查邮箱是否过期"""
        current_time = int(time.time())
        return current_time > mailbox['expires_at']
    
    def is_sender_allowed(self, mailbox: Dict, sender: str) -> bool:
        """检查发件人是否在白名单中"""
        # 如果白名单功能未启用，允许所有发件人
        if not mailbox.get('whitelist_enabled', False):
            return True

        # 如果启用了白名单功能，检查发件人是否在白名单中
        whitelist = mailbox.get('sender_whitelist', [])
        if not whitelist:
            return True  # 空白名单表示允许所有发件人

        for allowed in whitelist:
            if allowed.startswith('@'):
                # 域名匹配
                if sender.endswith(allowed):
                    return True
            else:
                # 完整邮箱匹配
                if sender == allowed:
                    return True
        return False

    def add_email(self, mailbox_id: str, email_data: Dict) -> str:
        """添加邮件到邮箱"""
        email_id = email_data.get('id', str(uuid.uuid4()))

        with self.get_connection() as conn:
            conn.execute('''
                INSERT INTO emails
                (id, mailbox_id, from_address, to_address, subject, body,
                 content_type, timestamp, sent_formatted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                email_id, mailbox_id, email_data['From'], email_data['To'],
                email_data.get('Subject', ''), email_data.get('Body', ''),
                email_data.get('ContentType', 'Text'), email_data['Timestamp'],
                email_data.get('Sent', '')
            ))
            conn.commit()

        return email_id

    def get_emails_by_mailbox(self, mailbox_id: str, limit: int = None) -> List[Dict]:
        """获取邮箱的所有邮件"""
        query = '''
            SELECT * FROM emails
            WHERE mailbox_id = ?
            ORDER BY timestamp DESC
        '''
        params = [mailbox_id]

        if limit:
            query += ' LIMIT ?'
            params.append(limit)

        with self.get_connection() as conn:
            cursor = conn.execute(query, params)
            rows = cursor.fetchall()

            emails = []
            for row in rows:
                emails.append({
                    'id': row['id'],
                    'From': row['from_address'],
                    'To': row['to_address'],
                    'Subject': row['subject'],
                    'Body': row['body'],
                    'ContentType': row['content_type'],
                    'Timestamp': row['timestamp'],
                    'Sent': row['sent_formatted'],
                    'is_read': bool(row['is_read'])
                })

            return emails

    def get_email_by_id(self, email_id: str) -> Optional[Dict]:
        """根据ID获取邮件"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT * FROM emails WHERE id = ?
            ''', (email_id,))
            row = cursor.fetchone()

            if row:
                return {
                    'id': row['id'],
                    'From': row['from_address'],
                    'To': row['to_address'],
                    'Subject': row['subject'],
                    'Body': row['body'],
                    'ContentType': row['content_type'],
                    'Timestamp': row['timestamp'],
                    'Sent': row['sent_formatted'],
                    'is_read': bool(row['is_read'])
                }
            return None

    def clean_expired_mailboxes(self):
        """清理过期的邮箱"""
        current_time = int(time.time())
        with self.get_connection() as conn:
            # 删除过期邮箱的邮件
            conn.execute('''
                DELETE FROM emails
                WHERE mailbox_id IN (
                    SELECT id FROM mailboxes WHERE expires_at < ?
                )
            ''', (current_time,))

            # 删除过期邮箱
            cursor = conn.execute('''
                DELETE FROM mailboxes WHERE expires_at < ?
            ''', (current_time,))

            deleted_count = cursor.rowcount
            conn.commit()

            return deleted_count

    def clean_old_emails(self, retention_days: int = None):
        """清理旧邮件"""
        if retention_days is None:
            retention_days = getattr(config, 'EMAIL_RETENTION_DAYS', 7)

        cutoff_time = int(time.time()) - (retention_days * 24 * 60 * 60)

        with self.get_connection() as conn:
            cursor = conn.execute('''
                DELETE FROM emails WHERE timestamp < ?
            ''', (cutoff_time,))

            deleted_count = cursor.rowcount
            conn.commit()

            return deleted_count

    def get_mailbox_stats(self, mailbox_id: str) -> Dict:
        """获取邮箱统计信息"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT
                    COUNT(*) as total_emails,
                    COUNT(CASE WHEN is_read = 0 THEN 1 END) as unread_emails,
                    MAX(timestamp) as last_email_time
                FROM emails
                WHERE mailbox_id = ?
            ''', (mailbox_id,))

            row = cursor.fetchone()

            return {
                'total_emails': row['total_emails'],
                'unread_emails': row['unread_emails'],
                'last_email_time': row['last_email_time']
            }

    def migrate_from_json(self, json_file_path: str) -> Dict:
        """从JSON文件迁移数据到数据库"""
        if not os.path.exists(json_file_path):
            return {'migrated_mailboxes': 0, 'migrated_emails': 0, 'errors': []}

        try:
            with open(json_file_path, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
        except Exception as e:
            return {'migrated_mailboxes': 0, 'migrated_emails': 0, 'errors': [f'Failed to read JSON: {str(e)}']}

        migrated_mailboxes = 0
        migrated_emails = 0
        errors = []

        for address, mailbox_data in json_data.items():
            try:
                # 检查是否已存在
                existing = self.get_mailbox_by_address(address)
                if existing:
                    continue

                # 处理旧格式和新格式
                if isinstance(mailbox_data, list):
                    # 旧格式：直接是邮件列表
                    emails = mailbox_data
                    current_time = int(time.time())
                    mailbox_info = {
                        'created_at': current_time,
                        'expires_at': current_time + (7 * 24 * 60 * 60),
                        'sender_whitelist': []
                    }
                else:
                    # 新格式：包含邮箱信息
                    emails = mailbox_data.get('emails', [])
                    mailbox_info = {
                        'created_at': mailbox_data.get('created_at', int(time.time())),
                        'expires_at': mailbox_data.get('expires_at', int(time.time()) + (7 * 24 * 60 * 60)),
                        'sender_whitelist': mailbox_data.get('sender_whitelist', [])
                    }

                # 创建邮箱
                retention_days = (mailbox_info['expires_at'] - mailbox_info['created_at']) // (24 * 60 * 60)
                mailbox = self.create_mailbox(
                    address=address,
                    retention_days=max(1, retention_days),
                    sender_whitelist=mailbox_info['sender_whitelist']
                )

                # 更新创建时间和过期时间
                with self.get_connection() as conn:
                    conn.execute('''
                        UPDATE mailboxes
                        SET created_at = ?, expires_at = ?
                        WHERE id = ?
                    ''', (mailbox_info['created_at'], mailbox_info['expires_at'], mailbox['id']))
                    conn.commit()

                migrated_mailboxes += 1

                # 迁移邮件
                for email in emails:
                    try:
                        # 确保邮件有必要的字段
                        if not email.get('id'):
                            email['id'] = str(uuid.uuid4())

                        self.add_email(mailbox['id'], email)
                        migrated_emails += 1
                    except Exception as e:
                        errors.append(f'Failed to migrate email {email.get("id", "unknown")}: {str(e)}')

            except Exception as e:
                errors.append(f'Failed to migrate mailbox {address}: {str(e)}')

        return {
            'migrated_mailboxes': migrated_mailboxes,
            'migrated_emails': migrated_emails,
            'errors': errors
        }

    def export_to_json(self, output_file_path: str) -> Dict:
        """导出数据库数据到JSON文件"""
        try:
            export_data = {}

            with self.get_connection() as conn:
                # 获取所有邮箱
                cursor = conn.execute('SELECT id, address, created_at, expires_at, retention_days, is_active, sender_whitelist, whitelist_enabled, created_by_ip, access_token, mailbox_key, last_accessed FROM mailboxes WHERE is_active = 1')
                mailboxes = cursor.fetchall()

                for mailbox in mailboxes:
                    # 获取邮箱的邮件
                    emails = self.get_emails_by_mailbox(mailbox['id'])

                    export_data[mailbox['address']] = {
                        'created_at': mailbox['created_at'],
                        'expires_at': mailbox['expires_at'],
                        'sender_whitelist': json.loads(mailbox['sender_whitelist'] or '[]'),
                        'whitelist_enabled': bool(mailbox.get('whitelist_enabled', 0)),
                        'is_active': bool(mailbox['is_active']),
                        'emails': emails
                    }

            with open(output_file_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=4, ensure_ascii=False)

            return {'success': True, 'exported_mailboxes': len(export_data)}

        except Exception as e:
            return {'success': False, 'error': str(e)}

    def mark_email_as_read(self, email_id: str):
        """标记邮件为已读"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                UPDATE emails SET is_read = 1 WHERE id = ?
            ''', (email_id,))
            conn.commit()

    def mark_email_as_unread(self, email_id: str):
        """标记邮件为未读"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                UPDATE emails SET is_read = 0 WHERE id = ?
            ''', (email_id,))
            conn.commit()

    def delete_email(self, email_id: str) -> int:
        """删除邮件，返回删除的数量"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute('''
                DELETE FROM emails WHERE id = ?
            ''', (email_id,))
            conn.commit()
            return cursor.rowcount

    def mark_all_emails_read(self, mailbox_id: str) -> int:
        """标记邮箱所有邮件为已读，返回更新的数量"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute('''
                UPDATE emails SET is_read = 1 WHERE mailbox_id = ? AND is_read = 0
            ''', (mailbox_id,))
            conn.commit()
            return cursor.rowcount

    def add_sender_to_whitelist(self, address: str, sender: str) -> bool:
        """添加发件人到白名单"""
        try:
            mailbox = self.get_mailbox_by_address(address)
            if not mailbox:
                return False

            # 解析现有白名单
            whitelist = json.loads(mailbox['sender_whitelist'])
            if sender not in whitelist:
                whitelist.append(sender)

                # 更新数据库
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute('''
                        UPDATE mailboxes SET sender_whitelist = ? WHERE address = ?
                    ''', (json.dumps(whitelist), address))
                    conn.commit()

            return True
        except Exception:
            return False

    def remove_sender_from_whitelist(self, address: str, sender: str) -> bool:
        """从白名单移除发件人"""
        try:
            mailbox = self.get_mailbox_by_address(address)
            if not mailbox:
                return False

            # 解析现有白名单
            whitelist = json.loads(mailbox['sender_whitelist'])
            if sender in whitelist:
                whitelist.remove(sender)

                # 更新数据库
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute('''
                        UPDATE mailboxes SET sender_whitelist = ? WHERE address = ?
                    ''', (json.dumps(whitelist), address))
                    conn.commit()

            return True
        except Exception:
            return False

    def update_mailbox_retention(self, address: str, retention_days: int) -> bool:
        """更新邮箱保留时间"""
        try:
            # 计算新的过期时间
            current_time = int(time.time())
            new_expires_at = current_time + (retention_days * 24 * 60 * 60)

            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute('''
                    UPDATE mailboxes
                    SET retention_days = ?, expires_at = ?
                    WHERE address = ?
                ''', (retention_days, new_expires_at, address))
                conn.commit()
                return cursor.rowcount > 0
        except Exception:
            return False

    def regenerate_mailbox_key(self, address: str, current_key: str) -> Optional[str]:
        """重新生成邮箱密钥"""
        try:
            mailbox = self.get_mailbox_by_address(address)
            if not mailbox or mailbox.get('mailbox_key') != current_key:
                return None

            # 生成新密钥
            new_key = str(uuid.uuid4())

            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    UPDATE mailboxes SET mailbox_key = ? WHERE address = ?
                ''', (new_key, address))
                conn.commit()

            return new_key
        except Exception:
            return None




    def create_user(self, username: str, email: str = None, password_hash: str = None,
                   created_by_ip: str = None) -> Dict:
        """创建新用户"""
        current_time = int(time.time())

        with self.get_connection() as conn:
            cursor = conn.execute('''
                INSERT INTO users (username, email, password_hash, created_at, created_by_ip)
                VALUES (?, ?, ?, ?, ?)
            ''', (username, email, password_hash, current_time, created_by_ip))

            user_id = cursor.lastrowid
            conn.commit()

        return {
            'id': user_id,
            'username': username,
            'email': email,
            'created_at': current_time,
            'is_active': True
        }

    def get_user_by_username(self, username: str) -> Optional[Dict]:
        """根据用户名获取用户信息"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT * FROM users WHERE username = ? AND is_active = 1
            ''', (username,))
            row = cursor.fetchone()

            if row:
                return {
                    'id': row['id'],
                    'username': row['username'],
                    'email': row['email'],
                    'password_hash': row['password_hash'],
                    'created_at': row['created_at'],
                    'created_by_ip': row['created_by_ip'],
                    'last_login': row['last_login'],
                    'is_active': bool(row['is_active'])
                }
            return None

    def get_user_by_id(self, user_id: int) -> Optional[Dict]:
        """根据用户ID获取用户信息"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT * FROM users WHERE id = ? AND is_active = 1
            ''', (user_id,))
            row = cursor.fetchone()

            if row:
                return {
                    'id': row['id'],
                    'username': row['username'],
                    'email': row['email'],
                    'password_hash': row['password_hash'],
                    'created_at': row['created_at'],
                    'created_by_ip': row['created_by_ip'],
                    'last_login': row['last_login'],
                    'is_active': bool(row['is_active'])
                }
            return None

    def associate_user_mailbox(self, user_id: int, mailbox_id: str) -> bool:
        """关联用户和邮箱"""
        try:
            current_time = int(time.time())
            with self.get_connection() as conn:
                conn.execute('''
                    INSERT OR IGNORE INTO users_mailboxes (user_id, mailbox_id, created_at)
                    VALUES (?, ?, ?)
                ''', (user_id, mailbox_id, current_time))
                conn.commit()
            return True
        except Exception:
            return False

    def get_user_mailboxes(self, user_id: int) -> List[Dict]:
        """获取用户的所有邮箱"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT m.id, m.address, m.created_at, m.expires_at, m.retention_days, m.is_active,
                       m.sender_whitelist, m.whitelist_enabled, m.created_by_ip, m.access_token,
                       m.mailbox_key, m.last_accessed
                FROM mailboxes m
                INNER JOIN users_mailboxes um ON m.id = um.mailbox_id
                WHERE um.user_id = ? AND m.is_active = 1
                ORDER BY m.created_at DESC
            ''', (user_id,))
            rows = cursor.fetchall()

            mailboxes = []
            for row in rows:
                mailboxes.append({
                    'id': row['id'],
                    'address': row['address'],
                    'created_at': row['created_at'],
                    'expires_at': row['expires_at'],
                    'retention_days': row['retention_days'],
                    'sender_whitelist': json.loads(row['sender_whitelist'] or '[]'),
                    'whitelist_enabled': bool(row.get('whitelist_enabled', 0)),
                    'access_token': row['access_token'],
                    'is_active': bool(row['is_active'])
                })

            return mailboxes

    def create_invite_code(self, created_by: int = None, expires_at: int = None,
                          max_uses: int = 1) -> str:
        """创建邀请码"""
        import random
        import string

        # 生成随机邀请码
        code_length = 16
        characters = string.ascii_letters + string.digits
        invite_code = ''.join(random.choices(characters, k=code_length))

        current_time = int(time.time())

        with self.get_connection() as conn:
            conn.execute('''
                INSERT INTO invite_codes (id, code, created_by, created_at, expires_at, max_uses)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                str(uuid.uuid4()), invite_code, created_by, current_time,
                expires_at, max_uses
            ))
            conn.commit()

        return invite_code

    def validate_invite_code(self, code: str) -> bool:
        """验证邀请码是否有效"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT * FROM invite_codes
                WHERE code = ? AND is_used = 0
                AND (expires_at IS NULL OR expires_at > ?)
                AND (max_uses IS NULL OR current_uses < max_uses)
            ''', (code, int(time.time())))

            row = cursor.fetchone()
            return row is not None

    def mark_invite_code_used(self, code: str, used_by: int = None) -> bool:
        """标记邀请码为已使用"""
        current_time = int(time.time())

        with self.get_connection() as conn:
            cursor = conn.execute('''
                UPDATE invite_codes
                SET is_used = 1, used_by = ?, used_at = ?, current_uses = current_uses + 1
                WHERE code = ? AND is_used = 0
                AND (expires_at IS NULL OR expires_at > ?)
                AND (max_uses IS NULL OR current_uses < max_uses)
            ''', (used_by, current_time, code, current_time))

            conn.commit()
            return cursor.rowcount > 0

    def get_invite_codes(self, limit: int = 50) -> List[Dict]:
        """获取邀请码列表"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT ic.*, u.username as created_by_username
                FROM invite_codes ic
                LEFT JOIN users u ON ic.created_by = u.id
                ORDER BY ic.created_at DESC
                LIMIT ?
            ''', (limit,))

            rows = cursor.fetchall()
            codes = []

            for row in rows:
                codes.append({
                    'id': row['id'],
                    'code': row['code'],
                    'created_by': row['created_by'],
                    'created_by_username': row['created_by_username'],
                    'created_at': row['created_at'],
                    'expires_at': row['expires_at'],
                    'is_used': bool(row['is_used']),
                    'used_by': row['used_by'],
                    'used_at': row['used_at'],
                    'max_uses': row['max_uses'],
                    'current_uses': row['current_uses']
                })

            return codes

# 全局数据库实例
db_manager = DatabaseManager()
