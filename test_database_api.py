#!/usr/bin/env python3
"""
测试数据库API的脚本
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:5000"

def test_create_mailbox_v2():
    """测试创建邮箱 V2 API"""
    print("=" * 50)
    print("测试创建邮箱 V2 API")
    print("=" * 50)
    
    # 测试1: 创建基本邮箱
    print("\n1. 创建基本邮箱...")
    data = {
        "address": "test123",
        "sender_whitelist": ["@gmail.com", "admin@example.com"],
        "retention_days": 7
    }
    
    response = requests.post(f"{BASE_URL}/create_mailbox_v2", json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, indent=2, ensure_ascii=False)}")
    
    if response.status_code == 201:
        mailbox_id = result['mailbox_id']
        address = result['address']
        mailbox_key = result['mailbox_key']  # 获取邮箱密钥

        # 获取访问令牌（需要邮箱密钥）
        print("\n2.1. 获取访问令牌（使用邮箱密钥）...")
        token_data = {
            "address": address,
            "mailbox_key": mailbox_key
        }
        token_response = requests.post(f"{BASE_URL}/get_mailbox_token", json=token_data)
        print(f"状态码: {token_response.status_code}")
        token_result = token_response.json()
        print(f"响应: {json.dumps(token_result, indent=2, ensure_ascii=False)}")

        access_token = token_result.get('access_token') if token_response.status_code == 200 else None

        # 测试错误的邮箱密钥
        print("\n2.2. 测试错误的邮箱密钥...")
        wrong_token_data = {
            "address": address,
            "mailbox_key": "wrong-key-12345"
        }
        wrong_response = requests.post(f"{BASE_URL}/get_mailbox_token", json=wrong_token_data)
        print(f"状态码: {wrong_response.status_code}")
        wrong_result = wrong_response.json()
        print(f"响应: {json.dumps(wrong_result, indent=2, ensure_ascii=False)}")
        
        # 测试3: 创建带自定义时间的邮箱
        print("\n3. 创建带自定义时间的邮箱...")
        custom_time = int(time.time()) - 3600  # 1小时前
        data2 = {
            "address": "test456",
            "sender_whitelist": ["@outlook.com"],
            "retention_days": 3,
            "created_at": custom_time
        }

        response2 = requests.post(f"{BASE_URL}/create_mailbox_v2", json=data2)
        print(f"状态码: {response2.status_code}")
        result2 = response2.json()
        print(f"响应: {json.dumps(result2, indent=2, ensure_ascii=False)}")

        # 测试4: 通过访问令牌获取邮箱信息
        if access_token:
            print("\n4. 通过访问令牌获取邮箱信息...")
            response3 = requests.get(f"{BASE_URL}/mailbox_info_v2?token={access_token}")
            print(f"状态码: {response3.status_code}")
            result3 = response3.json()
            print(f"响应: {json.dumps(result3, indent=2, ensure_ascii=False)}")

        # 测试5: 通过地址获取邮箱信息
        print("\n5. 通过地址获取邮箱信息...")
        response4 = requests.get(f"{BASE_URL}/mailbox_info_v2?address={address}")
        print(f"状态码: {response4.status_code}")
        result4 = response4.json()
        print(f"响应: {json.dumps(result4, indent=2, ensure_ascii=False)}")
        
        return {
            'mailbox_id': mailbox_id,
            'access_token': access_token,
            'address': address
        }
    
    return None

def test_migration():
    """测试数据迁移API"""
    print("\n" + "=" * 50)
    print("测试数据迁移 API")
    print("=" * 50)
    
    # 测试迁移
    print("\n1. 执行数据迁移...")
    response = requests.post(f"{BASE_URL}/migrate_to_database")
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, indent=2, ensure_ascii=False)}")
    
    # 测试导出
    print("\n2. 导出数据到JSON...")
    data = {
        "output_file_path": f"export_test_{int(time.time())}.json"
    }
    response2 = requests.post(f"{BASE_URL}/export_from_database", json=data)
    print(f"状态码: {response2.status_code}")
    result2 = response2.json()
    print(f"响应: {json.dumps(result2, indent=2, ensure_ascii=False)}")

def test_send_email(address):
    """测试发送邮件"""
    print(f"\n5. 发送测试邮件到 {address}...")
    data = {
        "to": address,
        "from": "admin@example.com",
        "subject": "测试邮件",
        "body": "这是一封测试邮件，用于验证数据库功能。"
    }
    
    response = requests.post(f"{BASE_URL}/send_test_email", json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, indent=2, ensure_ascii=False)}")

def test_get_emails(address):
    """测试获取邮件"""
    print(f"\n6. 获取邮箱 {address} 的邮件...")
    response = requests.get(f"{BASE_URL}/get_inbox?address={address}")
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        emails = response.json()
        print(f"邮件数量: {len(emails)}")
        for i, email in enumerate(emails):
            print(f"邮件 {i+1}:")
            print(f"  ID: {email.get('id', 'N/A')}")
            print(f"  发件人: {email.get('From', 'N/A')}")
            print(f"  主题: {email.get('Subject', 'N/A')}")
            print(f"  时间: {email.get('Sent', 'N/A')}")
    else:
        result = response.json()
        print(f"错误: {json.dumps(result, indent=2, ensure_ascii=False)}")

def show_api_examples():
    """显示API使用示例"""
    print("\n" + "=" * 50)
    print("API 使用示例")
    print("=" * 50)
    
    examples = {
        "创建邮箱 V2": {
            "method": "POST",
            "url": "/create_mailbox_v2",
            "body": {
                "address": "myemail",
                "sender_whitelist": ["@gmail.com", "boss@company.com"],
                "retention_days": 7,
                "created_at": 1640995200  # 可选：自定义创建时间
            }
        },
        "获取邮箱访问令牌": {
            "method": "POST",
            "url": "/get_mailbox_token",
            "body": {
                "address": "myemail@domain.com"
            }
        },
        "获取邮箱信息 V2 (通过令牌)": {
            "method": "GET",
            "url": "/mailbox_info_v2?token=YOUR_ACCESS_TOKEN"
        },
        "获取邮箱信息 V2 (通过地址)": {
            "method": "GET",
            "url": "/mailbox_info_v2?address=myemail@domain.com"
        },
        "数据迁移": {
            "method": "POST",
            "url": "/migrate_to_database",
            "body": {
                "json_file_path": "inbox.json"  # 可选
            }
        },
        "数据导出": {
            "method": "POST",
            "url": "/export_from_database",
            "body": {
                "output_file_path": "backup.json"  # 可选
            }
        }
    }
    
    for name, example in examples.items():
        print(f"\n{name}:")
        print(f"  {example['method']} {BASE_URL}{example['url']}")
        if 'body' in example:
            print(f"  Body: {json.dumps(example['body'], indent=4, ensure_ascii=False)}")

def main():
    print("TempMail 数据库API测试工具")
    print("确保服务器正在运行在 http://localhost:5000")
    
    try:
        # 检查服务器是否运行
        response = requests.get(f"{BASE_URL}/get_domain", timeout=5)
        if response.status_code != 200:
            print("❌ 服务器未正常响应")
            return
    except requests.exceptions.RequestException:
        print("❌ 无法连接到服务器，请确保服务器正在运行")
        return
    
    print("✅ 服务器连接正常")
    
    # 显示API示例
    show_api_examples()
    
    # 执行测试
    mailbox_info = test_create_mailbox_v2()
    
    if mailbox_info:
        # 发送测试邮件
        test_send_email(mailbox_info['address'])
        
        # 等待一下让邮件处理
        time.sleep(1)
        
        # 获取邮件
        test_get_emails(mailbox_info['address'])
    
    # 测试迁移功能
    test_migration()
    
    print("\n🎉 测试完成!")

if __name__ == "__main__":
    main()
