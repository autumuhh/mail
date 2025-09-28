#!/usr/bin/env python3
"""
数据库内容查看工具
"""

import sys
import os
import json
from datetime import datetime

# 添加路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'src', 'backend'))

def view_mailboxes():
    """查看所有邮箱"""
    print("📧 邮箱列表")
    print("=" * 60)
    
    try:
        from database import db_manager
        
        with db_manager.get_connection() as conn:
            cursor = conn.execute('''
                SELECT m.*, COUNT(e.id) as email_count
                FROM mailboxes m 
                LEFT JOIN emails e ON m.id = e.mailbox_id 
                GROUP BY m.id
                ORDER BY m.created_at DESC
            ''')
            mailboxes = cursor.fetchall()
            
            if not mailboxes:
                print("📭 暂无邮箱")
                return
            
            for i, mailbox in enumerate(mailboxes, 1):
                created = datetime.fromtimestamp(mailbox['created_at'])
                expires = datetime.fromtimestamp(mailbox['expires_at'])
                is_expired = mailbox['expires_at'] < int(datetime.now().timestamp())
                
                print(f"\n{i}. 邮箱地址: {mailbox['address']}")
                print(f"   ID: {mailbox['id']}")
                print(f"   访问令牌: {mailbox['access_token']}")
                print(f"   创建时间: {created.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"   过期时间: {expires.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"   状态: {'🔴 已过期' if is_expired else '🟢 活跃'}")
                print(f"   保留天数: {mailbox['retention_days']} 天")
                print(f"   邮件数量: {mailbox['email_count']}")
                print(f"   创建IP: {mailbox['created_by_ip'] or 'N/A'}")
                
                # 解析白名单
                try:
                    whitelist = json.loads(mailbox['sender_whitelist'])
                    if whitelist:
                        print(f"   白名单: {', '.join(whitelist)}")
                    else:
                        print(f"   白名单: 无限制")
                except:
                    print(f"   白名单: 解析错误")
                
                print("-" * 60)
                
    except Exception as e:
        print(f"❌ 查看邮箱失败: {e}")

def view_emails(mailbox_address=None):
    """查看邮件"""
    if mailbox_address:
        print(f"📨 邮箱 {mailbox_address} 的邮件")
    else:
        print("📨 所有邮件")
    print("=" * 60)
    
    try:
        from database import db_manager
        
        query = '''
            SELECT e.*, m.address as mailbox_address
            FROM emails e
            JOIN mailboxes m ON e.mailbox_id = m.id
        '''
        params = []
        
        if mailbox_address:
            query += ' WHERE m.address = ?'
            params.append(mailbox_address)
        
        query += ' ORDER BY e.timestamp DESC'
        
        with db_manager.get_connection() as conn:
            cursor = conn.execute(query, params)
            emails = cursor.fetchall()
            
            if not emails:
                print("📭 暂无邮件")
                return
            
            for i, email in enumerate(emails, 1):
                timestamp = datetime.fromtimestamp(email['timestamp'])
                
                print(f"\n{i}. 邮件ID: {email['id']}")
                print(f"   邮箱: {email['mailbox_address']}")
                print(f"   发件人: {email['from_address']}")
                print(f"   收件人: {email['to_address']}")
                print(f"   主题: {email['subject']}")
                print(f"   时间: {timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"   状态: {'📖 已读' if email['is_read'] else '📩 未读'}")
                print(f"   类型: {email['content_type']}")
                
                # 显示邮件内容预览
                body = email['body'] or ''
                if len(body) > 100:
                    preview = body[:100] + "..."
                else:
                    preview = body
                print(f"   内容预览: {preview}")
                
                print("-" * 60)
                
    except Exception as e:
        print(f"❌ 查看邮件失败: {e}")

def view_statistics():
    """查看统计信息"""
    print("📊 数据库统计")
    print("=" * 60)
    
    try:
        from database import db_manager
        
        with db_manager.get_connection() as conn:
            # 邮箱统计
            cursor = conn.execute('''
                SELECT 
                    COUNT(*) as total_mailboxes,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_mailboxes,
                    COUNT(CASE WHEN expires_at < ? THEN 1 END) as expired_mailboxes
                FROM mailboxes
            ''', (int(datetime.now().timestamp()),))
            mailbox_stats = cursor.fetchone()
            
            # 邮件统计
            cursor = conn.execute('''
                SELECT 
                    COUNT(*) as total_emails,
                    COUNT(CASE WHEN is_read = 0 THEN 1 END) as unread_emails,
                    MIN(timestamp) as oldest_email,
                    MAX(timestamp) as newest_email
                FROM emails
            ''')
            email_stats = cursor.fetchone()
            
            # 域名统计
            cursor = conn.execute('''
                SELECT 
                    SUBSTR(address, INSTR(address, '@') + 1) as domain,
                    COUNT(*) as count
                FROM mailboxes 
                GROUP BY domain
                ORDER BY count DESC
            ''')
            domain_stats = cursor.fetchall()
            
            print(f"📧 邮箱统计:")
            print(f"   总数: {mailbox_stats['total_mailboxes']}")
            print(f"   活跃: {mailbox_stats['active_mailboxes']}")
            print(f"   过期: {mailbox_stats['expired_mailboxes']}")
            
            print(f"\n📨 邮件统计:")
            print(f"   总数: {email_stats['total_emails']}")
            print(f"   未读: {email_stats['unread_emails']}")
            
            if email_stats['oldest_email']:
                oldest = datetime.fromtimestamp(email_stats['oldest_email'])
                print(f"   最早: {oldest.strftime('%Y-%m-%d %H:%M:%S')}")
            
            if email_stats['newest_email']:
                newest = datetime.fromtimestamp(email_stats['newest_email'])
                print(f"   最新: {newest.strftime('%Y-%m-%d %H:%M:%S')}")
            
            print(f"\n🌐 域名统计:")
            for domain in domain_stats:
                print(f"   {domain['domain']}: {domain['count']} 个邮箱")
            
            # 数据库文件大小
            import config
            if os.path.exists(config.DATABASE_PATH):
                size = os.path.getsize(config.DATABASE_PATH)
                print(f"\n💾 数据库大小: {size / 1024 / 1024:.2f} MB")
                
    except Exception as e:
        print(f"❌ 查看统计失败: {e}")

def main():
    """主函数"""
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == "mailboxes":
            view_mailboxes()
        elif command == "emails":
            mailbox = sys.argv[2] if len(sys.argv) > 2 else None
            view_emails(mailbox)
        elif command == "stats":
            view_statistics()
        else:
            print("❌ 未知命令")
            show_help()
    else:
        # 默认显示所有信息
        view_statistics()
        print("\n")
        view_mailboxes()
        print("\n")
        view_emails()

def show_help():
    """显示帮助信息"""
    print("TempMail 数据库查看工具")
    print("=" * 40)
    print("用法:")
    print("  python view_database.py                    # 查看所有信息")
    print("  python view_database.py mailboxes          # 查看邮箱列表")
    print("  python view_database.py emails             # 查看所有邮件")
    print("  python view_database.py emails <address>   # 查看指定邮箱的邮件")
    print("  python view_database.py stats              # 查看统计信息")
    print("\n示例:")
    print("  python view_database.py emails test@localhost")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ["-h", "--help", "help"]:
        show_help()
    else:
        main()
