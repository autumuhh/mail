#!/usr/bin/env python3
"""
检查inbox.json中邮件的时间戳
"""

import json
import time
from datetime import datetime
import config

def check_email_timestamps():
    """检查邮件时间戳"""
    try:
        with open(config.INBOX_FILE_NAME, 'r') as f:
            inbox = json.load(f)
    except:
        print("没有找到inbox.json文件")
        return
    
    current_time = time.time()
    retention_seconds = config.EMAIL_RETENTION_DAYS * 24 * 60 * 60
    
    print(f"当前时间: {datetime.fromtimestamp(current_time)}")
    print(f"保留期限: {config.EMAIL_RETENTION_DAYS} 天")
    print(f"删除阈值: {datetime.fromtimestamp(current_time - retention_seconds)}")
    print("\n" + "="*60)
    
    for address, emails in inbox.items():
        print(f"\n邮箱: {address}")
        print(f"邮件数量: {len(emails)}")
        
        for i, email in enumerate(emails, 1):
            timestamp = email.get('Timestamp', 0)
            email_time = datetime.fromtimestamp(timestamp)
            age_days = (current_time - timestamp) / (24 * 60 * 60)
            
            status = "🟢 保留" if age_days <= config.EMAIL_RETENTION_DAYS else "🔴 应删除"
            
            print(f"  {i}. {email.get('Subject', 'No Subject')}")
            print(f"     时间: {email_time}")
            print(f"     年龄: {age_days:.1f} 天")
            print(f"     状态: {status}")

if __name__ == "__main__":
    check_email_timestamps()
