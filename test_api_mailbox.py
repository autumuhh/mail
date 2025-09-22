#!/usr/bin/env python3
"""
API测试脚本：演示如何通过API创建只接收特定发送方邮件的邮箱
"""

import requests
import json
import time

# 配置
BASE_URL = "http://localhost:5000"

def create_restricted_mailbox(sender_whitelist, custom_address=None, retention_days=30):
    """
    创建一个只接收特定发送方邮件的邮箱
    
    Args:
        sender_whitelist: 允许的发送方列表
        custom_address: 自定义邮箱地址（可选）
        retention_days: 保留天数（可选）
    
    Returns:
        dict: 创建结果
    """
    url = f"{BASE_URL}/create_mailbox"
    
    data = {
        "sender_whitelist": sender_whitelist,
        "retention_days": retention_days
    }
    
    if custom_address:
        data["address"] = custom_address
    
    try:
        response = requests.post(url, json=data)
        return response.status_code, response.json()
    except Exception as e:
        return None, {"error": str(e)}

def get_mailbox_info(address):
    """获取邮箱信息"""
    url = f"{BASE_URL}/mailbox_info"
    params = {"address": address}
    
    try:
        response = requests.get(url, params=params)
        return response.status_code, response.json()
    except Exception as e:
        return None, {"error": str(e)}

def get_emails(address):
    """获取邮箱中的邮件"""
    url = f"{BASE_URL}/get_inbox"
    params = {"address": address}
    
    try:
        response = requests.get(url, params=params)
        return response.status_code, response.json()
    except Exception as e:
        return None, {"error": str(e)}

def format_time(timestamp):
    """格式化时间戳"""
    return time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp))

def main():
    print("=== API邮箱创建测试 ===\n")
    
    # 示例1：创建只接收Gmail邮件的邮箱
    print("1. 创建只接收Gmail邮件的邮箱")
    sender_whitelist = ["@gmail.com"]  # 只接收Gmail邮件
    
    status, result = create_restricted_mailbox(sender_whitelist)
    
    if status == 201:
        address = result["address"]
        print(f"✅ 邮箱创建成功: {address}")
        print(f"   创建时间: {format_time(result['created_at'])}")
        print(f"   过期时间: {format_time(result['expires_at'])}")
        print(f"   白名单: {result['sender_whitelist']}")
        
        # 获取邮箱详细信息
        print(f"\n📋 邮箱详细信息:")
        status2, info = get_mailbox_info(address)
        if status2 == 200:
            print(f"   邮件数量: {info['email_count']}")
            print(f"   是否过期: {info['is_expired']}")
        
    else:
        print(f"❌ 创建失败: {result}")
    
    print("\n" + "="*50 + "\n")
    
    # 示例2：创建只接收特定邮箱的邮箱
    print("2. 创建只接收特定邮箱邮件的邮箱")
    sender_whitelist = ["boss@company.com", "hr@company.com"]  # 只接收这两个邮箱
    custom_address = "work-reports"  # 自定义地址
    
    status, result = create_restricted_mailbox(sender_whitelist, custom_address)
    
    if status == 201:
        address = result["address"]
        print(f"✅ 邮箱创建成功: {address}")
        print(f"   白名单: {result['sender_whitelist']}")
    else:
        print(f"❌ 创建失败: {result}")
    
    print("\n" + "="*50 + "\n")
    
    # 示例3：创建支持通配符的邮箱
    print("3. 创建支持通配符的邮箱")
    sender_whitelist = [
        "noreply@github.com",      # 精确匹配
        "@company.com",            # 域名匹配
        "*@notifications.com"      # 通配符匹配
    ]
    
    status, result = create_restricted_mailbox(sender_whitelist, retention_days=7)
    
    if status == 201:
        address = result["address"]
        print(f"✅ 邮箱创建成功: {address}")
        print(f"   白名单规则: {result['sender_whitelist']}")
        print(f"   保留天数: {result['retention_days']}")
    else:
        print(f"❌ 创建失败: {result}")

if __name__ == "__main__":
    main()
