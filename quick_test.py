#!/usr/bin/env python3
"""
快速功能验证脚本
"""

import sys
import os
import time
import json

# 添加路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'src', 'backend'))

def test_database_functions():
    """测试数据库基本功能"""
    print("🧪 测试数据库基本功能...")
    
    try:
        from database import db_manager
        
        # 1. 测试创建邮箱
        print("1. 创建测试邮箱...")
        mailbox = db_manager.create_mailbox(
            address='test123@localhost',
            retention_days=7,
            sender_whitelist=['@gmail.com', 'admin@test.com'],
            created_by_ip='127.0.0.1'
        )
        
        print(f"   ✅ 邮箱ID: {mailbox['id'][:8]}...")
        print(f"   ✅ 访问令牌: {mailbox['access_token'][:8]}...")
        print(f"   ✅ 地址: {mailbox['address']}")
        
        # 2. 测试获取邮箱
        print("2. 获取邮箱信息...")
        retrieved = db_manager.get_mailbox_by_address('test123@localhost')
        print(f"   ✅ 通过地址获取: {'成功' if retrieved else '失败'}")
        
        token_retrieved = db_manager.get_mailbox_by_token(mailbox['access_token'])
        print(f"   ✅ 通过令牌获取: {'成功' if token_retrieved else '失败'}")
        
        # 3. 测试添加邮件
        print("3. 添加测试邮件...")
        email_data = {
            'id': 'test-email-001',
            'From': 'admin@test.com',
            'To': 'test123@localhost',
            'Subject': '测试邮件',
            'Body': '这是一封测试邮件',
            'Timestamp': int(time.time()),
            'Sent': '2024-01-01 12:00:00'
        }
        
        email_id = db_manager.add_email(mailbox['id'], email_data)
        print(f"   ✅ 邮件ID: {email_id}")
        
        # 4. 测试获取邮件
        print("4. 获取邮件列表...")
        emails = db_manager.get_emails_by_mailbox(mailbox['id'])
        print(f"   ✅ 邮件数量: {len(emails)}")
        
        # 5. 测试统计
        print("5. 获取统计信息...")
        stats = db_manager.get_mailbox_stats(mailbox['id'])
        print(f"   ✅ 总邮件数: {stats['total_emails']}")
        print(f"   ✅ 未读邮件数: {stats['unread_emails']}")
        
        return True
        
    except Exception as e:
        print(f"   ❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_inbox_handler():
    """测试邮箱处理器"""
    print("\n📧 测试邮箱处理器...")
    
    try:
        import db_inbox_handler
        
        # 1. 测试创建邮箱
        print("1. 创建邮箱...")
        mailbox = db_inbox_handler.create_or_get_mailbox(
            address='handler-test@localhost',
            retention_days=5,
            sender_whitelist=['@example.com'],
            created_by_ip='192.168.1.1'
        )
        print(f"   ✅ 邮箱创建成功: {mailbox['address']}")
        
        # 2. 测试接收邮件
        print("2. 接收邮件...")
        email_json = {
            'id': 'handler-email-001',
            'From': 'sender@example.com',
            'To': 'handler-test@localhost',
            'Subject': '处理器测试邮件',
            'Body': '这是通过处理器发送的邮件',
            'Timestamp': int(time.time()),
            'Sent': '2024-01-01 13:00:00'
        }
        
        result = db_inbox_handler.recv_email(email_json)
        print(f"   ✅ 接收结果: {result}")
        
        # 3. 测试获取邮件
        print("3. 获取邮件...")
        emails = db_inbox_handler.get_inbox_emails('handler-test@localhost')
        print(f"   ✅ 邮件数量: {len(emails)}")
        
        # 4. 测试邮箱信息
        print("4. 获取邮箱信息...")
        info = db_inbox_handler.get_mailbox_info('handler-test@localhost')
        if info:
            print(f"   ✅ 邮箱信息获取成功")
            print(f"   📊 邮件总数: {info['email_count']}")
            print(f"   📊 未读数量: {info['unread_count']}")
        
        return True
        
    except Exception as e:
        print(f"   ❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_config():
    """测试配置"""
    print("\n⚙️ 测试配置...")
    
    try:
        import config
        
        print(f"   USE_DATABASE: {config.USE_DATABASE}")
        print(f"   DATABASE_PATH: {config.DATABASE_PATH}")
        print(f"   DOMAINS: {config.DOMAINS}")
        print(f"   MAILBOX_RETENTION_DAYS: {config.MAILBOX_RETENTION_DAYS}")
        
        return True
        
    except Exception as e:
        print(f"   ❌ 配置测试失败: {e}")
        return False

def main():
    print("TempMail 数据库功能快速验证")
    print("=" * 50)
    
    # 测试配置
    config_ok = test_config()
    
    # 测试数据库
    db_ok = test_database_functions()
    
    # 测试处理器
    handler_ok = test_inbox_handler()
    
    # 总结
    print("\n" + "=" * 50)
    print("验证结果:")
    print("=" * 50)
    
    if config_ok and db_ok and handler_ok:
        print("🎉 所有功能验证通过！")
        print("\n✨ 数据库功能已就绪，可以开始使用：")
        print("1. 启动服务器: python app.py")
        print("2. 测试新API: python test_database_api.py")
        print("3. 查看文档: DATABASE_FEATURES.md")
    else:
        print("⚠️ 部分功能验证失败")
        print("请检查上述错误信息并修复问题")

if __name__ == "__main__":
    main()
