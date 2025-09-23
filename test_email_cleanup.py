#!/usr/bin/env python3
"""
测试邮件自动删除功能的脚本
"""

import json
import time
import os
from src.backend import inbox_handler
import config

def create_test_emails():
    """创建测试邮件数据"""
    current_time = int(time.time())
    
    # 创建不同时间的测试邮件
    test_emails = {
        "test1@localhost": [
            {
                "From": "sender1@example.com",
                "To": "test1@localhost",
                "Subject": "新邮件 - 应该保留",
                "Timestamp": current_time,  # 当前时间
                "Sent": "刚刚",
                "Body": "这是一封新邮件，应该被保留",
                "ContentType": "Text"
            },
            {
                "From": "sender2@example.com", 
                "To": "test1@localhost",
                "Subject": "8天前的邮件 - 应该删除",
                "Timestamp": current_time - (8 * 24 * 60 * 60),  # 8天前
                "Sent": "8天前",
                "Body": "这是一封8天前的邮件，应该被删除",
                "ContentType": "Text"
            },
            {
                "From": "sender3@example.com",
                "To": "test1@localhost", 
                "Subject": "5天前的邮件 - 应该保留",
                "Timestamp": current_time - (5 * 24 * 60 * 60),  # 5天前
                "Sent": "5天前",
                "Body": "这是一封5天前的邮件，应该被保留",
                "ContentType": "Text"
            }
        ],
        "test2@localhost": [
            {
                "From": "sender4@example.com",
                "To": "test2@localhost",
                "Subject": "10天前的邮件 - 应该删除",
                "Timestamp": current_time - (10 * 24 * 60 * 60),  # 10天前
                "Sent": "10天前", 
                "Body": "这是一封10天前的邮件，应该被删除",
                "ContentType": "Text"
            }
        ]
    }
    
    return test_emails

def print_inbox_status(inbox, title):
    """打印收件箱状态"""
    print(f"\n=== {title} ===")
    if not inbox:
        print("收件箱为空")
        return
        
    for address, emails in inbox.items():
        print(f"\n邮箱: {address}")
        print(f"邮件数量: {len(emails)}")
        for i, email in enumerate(emails, 1):
            days_ago = (time.time() - email['Timestamp']) / (24 * 60 * 60)
            print(f"  {i}. {email['Subject']} (时间戳: {email['Timestamp']}, {days_ago:.1f}天前)")

def test_cleanup():
    """测试清理功能"""
    print("开始测试邮件自动删除功能...")
    print(f"当前配置: 保留 {config.EMAIL_RETENTION_DAYS} 天")
    
    # 1. 创建测试数据
    test_data = create_test_emails()
    inbox_handler.write_inbox(test_data)
    print_inbox_status(test_data, "创建测试数据后")
    
    # 2. 读取数据并显示清理前状态
    inbox_before = inbox_handler.read_inbox()
    print_inbox_status(inbox_before, "清理前")
    
    # 3. 执行清理
    print("\n执行清理...")
    cleaned_inbox = inbox_handler.clean_expired_emails(inbox_before)
    
    # 4. 显示清理后状态
    print_inbox_status(cleaned_inbox, "清理后")
    
    # 5. 统计结果
    total_before = sum(len(emails) for emails in inbox_before.values())
    total_after = sum(len(emails) for emails in cleaned_inbox.values())
    deleted_count = total_before - total_after
    
    print(f"\n=== 清理结果统计 ===")
    print(f"清理前邮件总数: {total_before}")
    print(f"清理后邮件总数: {total_after}")
    print(f"删除邮件数量: {deleted_count}")
    
    # 6. 验证结果
    expected_remaining = [
        "新邮件 - 应该保留",
        "5天前的邮件 - 应该保留"
    ]
    
    remaining_subjects = []
    for emails in cleaned_inbox.values():
        for email in emails:
            remaining_subjects.append(email['Subject'])
    
    print(f"\n=== 验证结果 ===")
    print("应该保留的邮件:")
    for subject in expected_remaining:
        if subject in remaining_subjects:
            print(f"  ✓ {subject}")
        else:
            print(f"  ✗ {subject} (未找到!)")
    
    print("应该删除的邮件:")
    deleted_subjects = ["8天前的邮件 - 应该删除", "10天前的邮件 - 应该删除"]
    for subject in deleted_subjects:
        if subject not in remaining_subjects:
            print(f"  ✓ {subject} (已删除)")
        else:
            print(f"  ✗ {subject} (未删除!)")

def test_quick_cleanup():
    """快速测试 - 创建1分钟前的邮件并设置很短的保留时间"""
    print("\n" + "="*50)
    print("快速测试模式 (模拟短时间过期)")
    print("="*50)
    
    # 临时修改保留时间为1秒
    original_retention = config.EMAIL_RETENTION_DAYS
    config.EMAIL_RETENTION_DAYS = 1 / (24 * 60 * 60)  # 1秒
    
    current_time = int(time.time())
    quick_test_data = {
        "quick@localhost": [
            {
                "From": "test@example.com",
                "To": "quick@localhost", 
                "Subject": "刚创建的邮件",
                "Timestamp": current_time,
                "Sent": "刚刚",
                "Body": "这封邮件刚创建",
                "ContentType": "Text"
            },
            {
                "From": "test@example.com",
                "To": "quick@localhost",
                "Subject": "2秒前的邮件 - 应该删除", 
                "Timestamp": current_time - 2,
                "Sent": "2秒前",
                "Body": "这封邮件2秒前创建，应该被删除",
                "ContentType": "Text"
            }
        ]
    }
    
    inbox_handler.write_inbox(quick_test_data)
    print_inbox_status(quick_test_data, "快速测试 - 创建数据后")
    
    print("等待2秒...")
    time.sleep(2)
    
    cleaned = inbox_handler.clean_expired_emails(quick_test_data)
    print_inbox_status(cleaned, "快速测试 - 2秒后清理结果")
    
    # 恢复原始配置
    config.EMAIL_RETENTION_DAYS = original_retention

if __name__ == "__main__":
    # 备份原始数据
    backup_file = "inbox_backup.json"
    if os.path.exists(config.INBOX_FILE_NAME):
        with open(config.INBOX_FILE_NAME, 'r') as f:
            original_data = f.read()
        with open(backup_file, 'w') as f:
            f.write(original_data)
        print(f"已备份原始数据到 {backup_file}")
    
    try:
        # 运行测试
        test_cleanup()
        test_quick_cleanup()
        
    finally:
        # 恢复原始数据
        if os.path.exists(backup_file):
            with open(backup_file, 'r') as f:
                original_data = f.read()
            with open(config.INBOX_FILE_NAME, 'w') as f:
                f.write(original_data)
            os.remove(backup_file)
            print(f"\n已恢复原始数据")
