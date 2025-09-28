#!/usr/bin/env python3
"""
检查数据库设置和模块导入的脚本
"""

import os
import sys

def check_imports():
    """检查模块导入"""
    print("🔍 检查模块导入...")
    
    try:
        # 添加路径
        sys.path.append(os.path.join(os.path.dirname(__file__), 'src', 'backend'))
        
        # 检查配置
        import config
        print(f"✅ config 模块导入成功")
        print(f"   USE_DATABASE: {getattr(config, 'USE_DATABASE', 'Not set')}")
        print(f"   DATABASE_PATH: {getattr(config, 'DATABASE_PATH', 'Not set')}")
        
        # 检查数据库模块
        from database import db_manager
        print(f"✅ database 模块导入成功")
        
        # 检查数据库处理器
        import db_inbox_handler
        print(f"✅ db_inbox_handler 模块导入成功")
        
        # 检查原有处理器
        import inbox_handler
        print(f"✅ inbox_handler 模块导入成功")
        
        return True
        
    except ImportError as e:
        print(f"❌ 导入失败: {e}")
        return False
    except Exception as e:
        print(f"❌ 其他错误: {e}")
        return False

def check_database():
    """检查数据库设置"""
    print("\n🗄️ 检查数据库设置...")
    
    try:
        sys.path.append(os.path.join(os.path.dirname(__file__), 'src', 'backend'))
        import config
        from database import db_manager
        
        # 检查数据库路径
        db_path = config.DATABASE_PATH
        print(f"   数据库路径: {db_path}")
        
        # 检查目录是否存在
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            print(f"   创建数据库目录: {db_dir}")
            os.makedirs(db_dir, exist_ok=True)
        
        # 测试数据库连接
        with db_manager.get_connection() as conn:
            cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            print(f"   数据库表: {tables}")
        
        print(f"✅ 数据库设置正常")
        return True
        
    except Exception as e:
        print(f"❌ 数据库检查失败: {e}")
        return False

def check_config_files():
    """检查配置文件"""
    print("\n⚙️ 检查配置文件...")
    
    config_files = [
        '.env.development',
        '.env.production',
        'config.py'
    ]
    
    for file_path in config_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path} 存在")
        else:
            print(f"❌ {file_path} 不存在")

def check_new_files():
    """检查新增文件"""
    print("\n📁 检查新增文件...")
    
    new_files = [
        'src/backend/database.py',
        'src/backend/db_inbox_handler.py',
        'migrate_to_database.py',
        'test_database_api.py',
        'DATABASE_FEATURES.md'
    ]
    
    for file_path in new_files:
        if os.path.exists(file_path):
            size = os.path.getsize(file_path)
            print(f"✅ {file_path} 存在 ({size} bytes)")
        else:
            print(f"❌ {file_path} 不存在")

def main():
    print("TempMail 数据库设置检查工具")
    print("=" * 50)
    
    # 检查配置文件
    check_config_files()
    
    # 检查新增文件
    check_new_files()
    
    # 检查模块导入
    imports_ok = check_imports()
    
    # 检查数据库
    if imports_ok:
        database_ok = check_database()
    else:
        database_ok = False
    
    # 总结
    print("\n" + "=" * 50)
    print("检查结果总结:")
    print("=" * 50)
    
    if imports_ok and database_ok:
        print("🎉 所有检查通过！数据库功能已准备就绪")
        print("\n📝 下一步:")
        print("1. 运行 python migrate_to_database.py 迁移数据")
        print("2. 启动服务器测试新功能")
        print("3. 使用 python test_database_api.py 测试API")
    else:
        print("⚠️ 发现问题，请检查上述错误信息")
        print("\n🔧 可能的解决方案:")
        print("1. 确保所有文件都已创建")
        print("2. 检查Python路径设置")
        print("3. 安装必要的依赖")

if __name__ == "__main__":
    main()
