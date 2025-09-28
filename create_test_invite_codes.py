#!/usr/bin/env python3
"""
生成测试邀请码脚本
运行此脚本为系统生成一些测试邀请码
"""

import sys
import os
import time

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

def create_test_invite_codes():
    """创建测试邀请码"""
    print("正在创建测试邀请码...")

    # 创建一些测试邀请码
    test_codes = []

    # 1. 创建一个不过期的邀请码，可用一次
    code1 = db_manager.create_invite_code(
        created_by=None,
        expires_at=None,  # 永远不过期
        max_uses=1
    )
    test_codes.append(code1)
    print(f"创建邀请码: {code1} (不过期，限用1次)")

    # 2. 创建一个30天后过期的邀请码，可用3次
    future_time = int(time.time()) + (30 * 24 * 60 * 60)  # 30天后
    code2 = db_manager.create_invite_code(
        created_by=None,
        expires_at=future_time,
        max_uses=3
    )
    test_codes.append(code2)
    print(f"创建邀请码: {code2} (30天后过期，限用3次)")

    # 3. 创建一个7天后过期的邀请码，可用1次
    week_time = int(time.time()) + (7 * 24 * 60 * 60)  # 7天后
    code3 = db_manager.create_invite_code(
        created_by=None,
        expires_at=week_time,
        max_uses=1
    )
    test_codes.append(code3)
    print(f"创建邀请码: {code3} (7天后过期，限用1次)")

    print(f"\n成功创建了 {len(test_codes)} 个测试邀请码:")
    for i, code in enumerate(test_codes, 1):
        print(f"{i}. {code}")

    print("\n这些邀请码可以用于测试用户注册功能")
    print("在admin页面 -> 注册新用户 中使用这些邀请码进行测试")

if __name__ == "__main__":
    create_test_invite_codes()