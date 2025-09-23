#!/usr/bin/env python3
"""
发送测试邮件到本地SMTP服务器
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import time

def send_test_email(to_email, subject="测试邮件", body="这是一封测试邮件", sender_email="test-sender@example.com"):
    """发送测试邮件"""
    try:
        # 连接到本地SMTP服务器
        print(f"连接到 localhost:25...")
        smtp_server = smtplib.SMTP('localhost', 25)

        # 创建邮件
        msg = MIMEText(body, 'plain', 'utf-8')
        msg['Subject'] = subject
        msg['From'] = sender_email
        msg['To'] = to_email
        
        print(f"发送邮件到: {to_email}")
        print(f"发送方: {sender_email}")
        print(f"主题: {subject}")
        
        # 发送邮件
        smtp_server.send_message(msg)
        smtp_server.quit()
        
        print("✅ 邮件发送成功!")
        return True
        
    except Exception as e:
        print(f"❌ 邮件发送失败: {e}")
        return False

def send_html_email(to_email):
    """发送HTML格式的测试邮件"""
    try:
        smtp_server = smtplib.SMTP('localhost', 2525)
        
        # 创建HTML邮件
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'HTML测试邮件'
        msg['From'] = 'html-sender@example.com'
        msg['To'] = to_email
        
        html_body = """
        <html>
        <body>
            <h2>这是一封HTML测试邮件</h2>
            <p>这是一个<strong>粗体</strong>文本。</p>
            <p>这是一个<em>斜体</em>文本。</p>
            <ul>
                <li>列表项 1</li>
                <li>列表项 2</li>
                <li>列表项 3</li>
            </ul>
            <p>发送时间: {}</p>
        </body>
        </html>
        """.format(time.strftime("%Y-%m-%d %H:%M:%S"))
        
        html_part = MIMEText(html_body, 'html', 'utf-8')
        msg.attach(html_part)
        
        print(f"发送HTML邮件到: {to_email}")
        smtp_server.send_message(msg)
        smtp_server.quit()
        
        print("✅ HTML邮件发送成功!")
        return True
        
    except Exception as e:
        print(f"❌ HTML邮件发送失败: {e}")
        return False

def send_multiple_emails(to_email, count=3):
    """发送多封测试邮件"""
    print(f"准备发送 {count} 封邮件到 {to_email}")
    
    success_count = 0
    for i in range(1, count + 1):
        subject = f"测试邮件 #{i}"
        body = f"这是第 {i} 封测试邮件\n发送时间: {time.strftime('%Y-%m-%d %H:%M:%S')}"
        
        if send_test_email(to_email, subject, body):
            success_count += 1
        
        # 间隔1秒
        if i < count:
            time.sleep(1)
    
    print(f"\n📊 发送完成: {success_count}/{count} 封邮件成功")

def test_whitelist_functionality(to_email):
    """测试白名单功能"""
    print(f"\n=== 白名单功能测试 ===")
    print(f"目标邮箱: {to_email}")
    print("将从不同发送方发送邮件，测试白名单是否生效")

    # 测试不同的发送方
    test_senders = [
        ("allowed@gmail.com", "Gmail发送方 - 应该被接收"),
        ("boss@company.com", "公司老板 - 应该被接收"),
        ("spam@badsite.com", "垃圾邮件 - 应该被拒绝"),
        ("noreply@github.com", "GitHub通知 - 根据白名单决定"),
        ("test@company.com", "公司测试 - 根据白名单决定")
    ]

    success_count = 0
    for i, (sender, description) in enumerate(test_senders, 1):
        print(f"\n--- 测试 {i}/5: {description} ---")
        subject = f"白名单测试 #{i}"
        body = f"发送方: {sender}\n描述: {description}\n时间: {time.strftime('%Y-%m-%d %H:%M:%S')}"

        if send_test_email(to_email, subject, body, sender):
            success_count += 1

        time.sleep(1)

    print(f"\n📊 白名单测试完成: {success_count}/{len(test_senders)} 封邮件发送成功")
    print("注意: 发送成功不等于被接收，请检查邮箱中实际收到的邮件数量")

def main():
    print("=== 邮件发送测试工具 ===")
    print("请确保 TempMail 应用正在运行 (python app.py)")
    print("请确保已在网页 http://localhost:5000 生成了邮箱地址")
    print()
    
    # 获取目标邮箱地址
    to_email = input("请输入目标邮箱地址 (例如: abc123@localhost): ").strip()
    
    if not to_email:
        print("❌ 邮箱地址不能为空")
        return
    
    if '@' not in to_email:
        print("❌ 邮箱地址格式不正确")
        return
    
    print(f"\n目标邮箱: {to_email}")
    print("\n选择测试类型:")
    print("1. 发送单封文本邮件")
    print("2. 发送单封HTML邮件")
    print("3. 发送多封邮件 (3封)")
    print("4. 发送多封邮件 (自定义数量)")
    print("5. 全部测试")
    print("6. 白名单功能测试")
    
    choice = input("\n请选择 (1-6): ").strip()
    
    if choice == '1':
        send_test_email(to_email)
        
    elif choice == '2':
        send_html_email(to_email)
        
    elif choice == '3':
        send_multiple_emails(to_email, 3)
        
    elif choice == '4':
        try:
            count = int(input("请输入邮件数量: "))
            if count > 0:
                send_multiple_emails(to_email, count)
            else:
                print("❌ 邮件数量必须大于0")
        except ValueError:
            print("❌ 请输入有效的数字")
            
    elif choice == '5':
        print("\n🚀 开始全部测试...")
        
        # 测试1: 文本邮件
        print("\n--- 测试1: 文本邮件 ---")
        send_test_email(to_email, "全部测试 - 文本邮件", "这是文本格式的测试邮件")
        
        time.sleep(1)
        
        # 测试2: HTML邮件
        print("\n--- 测试2: HTML邮件 ---")
        send_html_email(to_email)
        
        time.sleep(1)
        
        # 测试3: 多封邮件
        print("\n--- 测试3: 多封邮件 ---")
        send_multiple_emails(to_email, 2)
        
        print("\n🎉 全部测试完成!")

    elif choice == '6':
        test_whitelist_functionality(to_email)

    else:
        print("❌ 无效选择")
        return
    
    print(f"\n💡 提示:")
    print(f"1. 在浏览器中打开 http://localhost:5000")
    print(f"2. 输入邮箱地址: {to_email}")
    print(f"3. 点击刷新按钮查看收到的邮件")
    print(f"4. 或者查看项目目录下的 inbox.json 文件")

if __name__ == "__main__":
    main()
