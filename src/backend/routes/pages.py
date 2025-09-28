from flask import Blueprint, render_template, request, jsonify
import config

bp = Blueprint('pages', __name__)

# The main route that serves the website
@bp.route('/')
def index():
    return render_template('index.html')

# IP whitelist management page
@bp.route('/admin')
def admin():
    return render_template('admin.html')

@bp.route('/register')
def register():
    # 注册页面现在会在前端显示管理员验证界面
    # 任何人都可以访问，但需要验证管理员密码才能使用注册功能
    return render_template('register.html')

@bp.route('/login')
def login():
    return render_template('mailbox_login.html')

@bp.route('/mailbox')
def mailbox():
    return render_template('mailbox_manager.html')


@bp.route('/api-test')
def api_test():
    """API测试页面"""
    return render_template('api_test.html')


