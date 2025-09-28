#!/usr/bin/env python3
"""
检查邮箱发件人白名单脚本
用于诊断邮件发送失败的问题
"""

import sys
import os
import json

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

try:
    from src.backend.database import db_manager
    print("成功连接到数据库")
except ImportError as e:
    print(f"导入数据库模块失败: {e}")
    print("请确保项目结构正确且依赖已安装")
    sys.exit(1)

def check_mailbox_whitelist(address):
    """检查指定邮箱的发件人白名单"""
    print(f"正在检查邮箱: {address}")

    # 获取邮箱信息
    mailbox_info = db_manager.get_mailbox_by_address(address)

    if not mailbox_info:
        print(f"[ERROR] 邮箱 {address} 不存在")
        return None

    print("[OK] 邮箱信息:")
    print(f"  - ID: {mailbox_info['id']}")
    print(f"  - 地址: {mailbox_info['address']}")
    print(f"  - 创建时间: {mailbox_info['created_at']}")
    print(f"  - 过期时间: {mailbox_info['expires_at']}")
    print(f"  - 发件人白名单: {mailbox_info['sender_whitelist']}")

    return mailbox_info

def add_sender_to_whitelist(address, sender):
    """添加发件人到白名单"""
    print(f"正在将 {sender} 添加到 {address} 的白名单中...")

    success = db_manager.add_sender_to_whitelist(address, sender)

    if success:
        print(f"[OK] 成功添加 {sender} 到白名单")

        # 再次检查白名单
        mailbox_info = check_mailbox_whitelist(address)
        return True
    else:
        print(f"[ERROR] 添加失败")
        return False

def clear_sender_whitelist(address):
    """清空发件人白名单（允许所有发件人）"""
    print(f"正在清空 {address} 的发件人白名单...")

    try:
        # 获取当前白名单
        mailbox_info = db_manager.get_mailbox_by_address(address)
        if not mailbox_info:
            print(f"[ERROR] 邮箱 {address} 不存在")
            return False

        # 清空白名单
        with db_manager.get_connection() as conn:
            conn.execute('''
                UPDATE mailboxes SET sender_whitelist = ? WHERE address = ?
            ''', (json.dumps([]), address))
            conn.commit()

        print(f"[OK] 已清空 {address} 的发件人白名单")
        return True

    except Exception as e:
        print(f"[ERROR] 清空白名单失败: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法:")
        print("  python check_mailbox_whitelist.py <邮箱地址> [操作] [发件人]")
        print("")
        print("操作:")
        print("  check    - 检查邮箱白名单（默认）")
        print("  add      - 添加发件人到白名单")
        print("  clear    - 清空白名单（允许所有发件人）")
        print("")
        print("示例:")
        print("  python check_mailbox_whitelist.py uitest5a1b7eff@localhost")
        print("  python check_mailbox_whitelist.py uitest5a1b7eff@localhost add test@example.com")
        print("  python check_mailbox_whitelist.py uitest5a1b7eff@localhost clear")
        sys.exit(1)

    address = sys.argv[1]
    operation = sys.argv[2] if len(sys.argv) > 2 else "check"

    if operation == "check":
        check_mailbox_whitelist(address)
    elif operation == "add" and len(sys.argv) > 3:
        sender = sys.argv[3]
        add_sender_to_whitelist(address, sender)
    elif operation == "clear":
        clear_sender_whitelist(address)
    else:
        print("[ERROR] 无效的操作或参数不足")
        sys.exit(1)