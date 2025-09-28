#!/usr/bin/env python3
"""
邮箱管理界面测试脚本
测试新的邮箱管理UI功能
"""

import sys
import os
sys.path.append('src/backend')

from database import db_manager
import time
import json

def test_mailbox_ui():
    """测试邮箱管理界面功能"""
    
    print("🧪 邮箱管理界面测试开始...")
    
    # 1. 创建测试邮箱
    print("\n1️⃣ 创建测试邮箱...")
    
    # 使用随机地址避免冲突
    import uuid
    random_id = str(uuid.uuid4())[:8]
    test_address = f"uitest{random_id}@localhost"

    test_mailbox = db_manager.create_mailbox(
        address=test_address,
        retention_days=7,
        sender_whitelist=["@gmail.com", "@outlook.com"],
        created_by_ip="127.0.0.1"
    )
    
    print(f"✅ 测试邮箱创建成功:")
    print(f"   地址: {test_mailbox['address']}")
    print(f"   ID: {test_mailbox['id']}")
    print(f"   密钥: {test_mailbox['mailbox_key']}")
    print(f"   访问令牌: {test_mailbox['access_token']}")
    
    # 2. 添加测试邮件
    print("\n2️⃣ 添加测试邮件...")
    
    test_emails = [
        {
            "From": "test1@gmail.com",
            "To": test_mailbox['address'],
            "Subject": "欢迎使用TempMail",
            "Body": "这是一封测试邮件，用于验证邮箱管理界面功能。\n\n邮件内容包含多行文本，\n用于测试邮件显示效果。",
            "Timestamp": int(time.time()) - 3600
        },
        {
            "From": "noreply@outlook.com",
            "To": test_mailbox['address'],
            "Subject": "系统通知",
            "Body": "<html><body><h2>HTML邮件测试</h2><p>这是一封<strong>HTML格式</strong>的邮件。</p><ul><li>支持HTML标签</li><li>支持富文本显示</li></ul></body></html>",
            "Timestamp": int(time.time()) - 1800
        },
        {
            "From": "admin@localhost",
            "To": test_mailbox['address'],
            "Subject": "重要通知：邮箱即将过期",
            "Body": "您的临时邮箱即将在7天后过期，请及时处理相关事务。\n\n如需延长使用时间，请联系管理员。",
            "Timestamp": int(time.time()) - 900
        }
    ]
    
    for i, email_data in enumerate(test_emails):
        email_id = db_manager.add_email(test_mailbox['id'], email_data)
        print(f"   ✅ 邮件 {i+1} 添加成功 (ID: {email_id})")
    
    # 3. 验证数据库状态
    print("\n3️⃣ 验证数据库状态...")

    mailbox_info = db_manager.get_mailbox_by_address(test_mailbox['address'])
    emails = db_manager.get_emails_by_mailbox(test_mailbox['id'])
    stats = db_manager.get_mailbox_stats(test_mailbox['id'])

    print(f"   邮箱信息: {json.dumps(mailbox_info, indent=2, ensure_ascii=False)}")
    print(f"   邮件数量: {len(emails)}")
    print(f"   统计信息: {json.dumps(stats, indent=2, ensure_ascii=False)}")
    
    # 4. 生成访问信息
    print("\n4️⃣ 生成访问信息...")
    
    access_info = {
        "邮箱地址": test_mailbox['address'],
        "邮箱密钥": test_mailbox['mailbox_key'],
        "访问令牌": test_mailbox['access_token'],
        "管理页面": f"http://localhost:5000/mailbox?address={test_mailbox['address']}&token={test_mailbox['access_token']}"
    }
    
    print("📋 测试邮箱访问信息:")
    for key, value in access_info.items():
        print(f"   {key}: {value}")
    
    # 5. 保存测试数据到文件
    print("\n5️⃣ 保存测试数据...")
    
    test_data = {
        "mailbox": test_mailbox,
        "emails": emails,
        "access_info": access_info,
        "test_time": time.time()
    }
    
    with open('mailbox_ui_test_data.json', 'w', encoding='utf-8') as f:
        json.dump(test_data, f, indent=2, ensure_ascii=False)
    
    print("   ✅ 测试数据已保存到 mailbox_ui_test_data.json")
    
    # 6. 测试指南
    print("\n📖 测试指南:")
    print("1. 启动服务器: python app.py")
    print("2. 访问首页: http://localhost:5000")
    print("3. 在'已有邮箱？访问管理界面'区域输入:")
    print(f"   邮箱地址: {test_mailbox['address']}")
    print(f"   邮箱密钥: {test_mailbox['mailbox_key']}")
    print("4. 点击'访问邮箱管理'按钮")
    print("5. 测试以下功能:")
    print("   - 查看邮件列表")
    print("   - 点击邮件查看详情")
    print("   - 切换不同视图(收件箱、设置、信息)")
    print("   - 测试响应式设计(调整浏览器窗口大小)")
    print("   - 测试移动端显示(F12开发者工具)")
    
    print("\n✅ 邮箱管理界面测试准备完成!")
    return test_mailbox

def cleanup_test_data():
    """清理测试数据"""
    print("\n🧹 清理测试数据...")

    # 直接删除测试邮箱
    try:
        mailbox = db_manager.get_mailbox_by_address('uitest@localhost')
        if mailbox:
            db_manager.delete_mailbox(mailbox['id'])
            print(f"   ✅ 删除测试邮箱: {mailbox['address']}")
    except Exception as e:
        print(f"   ℹ️ 测试邮箱不存在或已删除: {e}")

    # 删除测试文件
    if os.path.exists('mailbox_ui_test_data.json'):
        os.remove('mailbox_ui_test_data.json')
        print("   ✅ 删除测试数据文件")

    print("✅ 测试数据清理完成!")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='邮箱管理界面测试')
    parser.add_argument('--cleanup', action='store_true', help='清理测试数据')
    
    args = parser.parse_args()
    
    if args.cleanup:
        cleanup_test_data()
    else:
        test_mailbox = test_mailbox_ui()
        
        print(f"\n🎯 快速测试链接:")
        print(f"直接访问: http://localhost:5000/mailbox?address={test_mailbox['address']}&token={test_mailbox['access_token']}")
