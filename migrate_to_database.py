#!/usr/bin/env python3
"""
数据库迁移脚本
将现有的JSON文件数据迁移到SQLite数据库
"""

import os
import sys
import json
import time
from datetime import datetime

# 添加src/backend到路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'src', 'backend'))

import config
from database import db_manager
import db_inbox_handler

def main():
    print("=" * 60)
    print("TempMail 数据库迁移工具")
    print("=" * 60)
    
    # 检查配置
    print(f"数据库路径: {config.DATABASE_PATH}")
    print(f"JSON文件路径: {config.INBOX_FILE_NAME}")
    print(f"使用数据库: {config.USE_DATABASE}")
    
    if not config.USE_DATABASE:
        print("\n⚠️  警告: USE_DATABASE 设置为 False")
        print("请在配置文件中设置 USE_DATABASE=true 以启用数据库存储")
        response = input("是否继续迁移? (y/N): ")
        if response.lower() != 'y':
            print("迁移已取消")
            return
    
    # 检查JSON文件是否存在
    if not os.path.exists(config.INBOX_FILE_NAME):
        print(f"\n❌ JSON文件不存在: {config.INBOX_FILE_NAME}")
        print("没有数据需要迁移")
        return
    
    # 检查JSON文件内容
    try:
        with open(config.INBOX_FILE_NAME, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        if not json_data:
            print("\n📭 JSON文件为空，没有数据需要迁移")
            return
        
        print(f"\n📊 发现 {len(json_data)} 个邮箱需要迁移")
        
        # 统计邮件数量
        total_emails = 0
        for address, mailbox_data in json_data.items():
            if isinstance(mailbox_data, list):
                total_emails += len(mailbox_data)
            else:
                total_emails += len(mailbox_data.get('emails', []))
        
        print(f"📧 总共 {total_emails} 封邮件需要迁移")
        
    except Exception as e:
        print(f"\n❌ 读取JSON文件失败: {e}")
        return
    
    # 确认迁移
    print("\n" + "=" * 40)
    print("迁移确认")
    print("=" * 40)
    print("此操作将:")
    print("1. 创建SQLite数据库")
    print("2. 迁移所有邮箱和邮件数据")
    print("3. 保留原JSON文件不变")
    print("4. 为每个邮箱生成访问令牌")
    
    response = input("\n确认开始迁移? (y/N): ")
    if response.lower() != 'y':
        print("迁移已取消")
        return
    
    # 开始迁移
    print("\n🚀 开始迁移...")
    start_time = time.time()
    
    try:
        # 执行迁移
        result = db_manager.migrate_from_json(config.INBOX_FILE_NAME)
        
        end_time = time.time()
        duration = end_time - start_time
        
        print("\n" + "=" * 40)
        print("迁移完成!")
        print("=" * 40)
        print(f"✅ 成功迁移邮箱: {result['migrated_mailboxes']}")
        print(f"✅ 成功迁移邮件: {result['migrated_emails']}")
        print(f"⏱️  耗时: {duration:.2f} 秒")
        
        if result['errors']:
            print(f"\n⚠️  遇到 {len(result['errors'])} 个错误:")
            for error in result['errors'][:5]:  # 只显示前5个错误
                print(f"   - {error}")
            if len(result['errors']) > 5:
                print(f"   ... 还有 {len(result['errors']) - 5} 个错误")
        
        # 验证迁移结果
        print("\n🔍 验证迁移结果...")
        
        # 检查数据库中的数据
        with db_manager.get_connection() as conn:
            cursor = conn.execute('SELECT COUNT(*) FROM mailboxes')
            db_mailboxes = cursor.fetchone()[0]
            
            cursor = conn.execute('SELECT COUNT(*) FROM emails')
            db_emails = cursor.fetchone()[0]
        
        print(f"📊 数据库中的邮箱数: {db_mailboxes}")
        print(f"📧 数据库中的邮件数: {db_emails}")
        
        # 创建备份
        backup_file = f"inbox_backup_{int(time.time())}.json"
        try:
            import shutil
            shutil.copy2(config.INBOX_FILE_NAME, backup_file)
            print(f"\n💾 已创建JSON文件备份: {backup_file}")
        except Exception as e:
            print(f"\n⚠️  创建备份失败: {e}")
        
        print("\n🎉 迁移成功完成!")
        print("\n📝 后续步骤:")
        print("1. 更新配置文件设置 USE_DATABASE=true")
        print("2. 重启应用程序")
        print("3. 使用新的API接口 /create_mailbox_v2")
        print("4. 测试数据库功能是否正常")
        
    except Exception as e:
        print(f"\n❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()

def show_database_info():
    """显示数据库信息"""
    print("\n" + "=" * 40)
    print("数据库信息")
    print("=" * 40)
    
    if not os.path.exists(config.DATABASE_PATH):
        print("❌ 数据库文件不存在")
        return
    
    try:
        with db_manager.get_connection() as conn:
            # 邮箱统计
            cursor = conn.execute('''
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active,
                    COUNT(CASE WHEN expires_at < ? THEN 1 END) as expired
                FROM mailboxes
            ''', (int(time.time()),))
            mailbox_stats = cursor.fetchone()
            
            # 邮件统计
            cursor = conn.execute('SELECT COUNT(*) FROM emails')
            email_count = cursor.fetchone()[0]
            
            # 最新邮件时间
            cursor = conn.execute('SELECT MAX(timestamp) FROM emails')
            latest_email = cursor.fetchone()[0]
            
            print(f"📊 邮箱总数: {mailbox_stats['total']}")
            print(f"✅ 活跃邮箱: {mailbox_stats['active']}")
            print(f"⏰ 过期邮箱: {mailbox_stats['expired']}")
            print(f"📧 邮件总数: {email_count}")
            
            if latest_email:
                latest_time = datetime.fromtimestamp(latest_email)
                print(f"🕐 最新邮件: {latest_time.strftime('%Y-%m-%d %H:%M:%S')}")
            
            # 数据库文件大小
            db_size = os.path.getsize(config.DATABASE_PATH)
            print(f"💾 数据库大小: {db_size / 1024 / 1024:.2f} MB")
            
    except Exception as e:
        print(f"❌ 获取数据库信息失败: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "info":
        show_database_info()
    else:
        main()
