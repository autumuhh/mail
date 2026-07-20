import re

from flask import Blueprint, abort, redirect, render_template, request, url_for


bp = Blueprint('pages', __name__)

# 只做必要的语法检查；邮箱是否存在、密钥是否正确由 API 在加载页面后验证。
EMAIL_PATTERN = re.compile(r'^[^\s/@]+@[^\s/@]+$')
MAILBOX_KEY_PATTERN = re.compile(r'^[A-Za-z0-9._~-]{6,128}$')


def _set_private_page_headers(response):
    """阻止含邮箱密钥的页面被缓存、引用或索引。"""
    response.headers['Cache-Control'] = 'no-store, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-src 'self'; "
        "object-src 'none'; "
        "base-uri 'none'; "
        "form-action 'self'; "
        "frame-ancestors 'none'"
    )
    return response


@bp.after_app_request
def protect_credential_url_responses(response):
    """即使凭据语法错误返回 404，也不能让含密钥的 URL 被缓存或引用。"""
    if request.path.startswith('/web/'):
        return _set_private_page_headers(response)
    return response


@bp.route('/')
def index():
    """公开邮箱登录入口。"""
    return render_template('mailbox_login.html')


@bp.route('/login')
def login():
    """旧登录地址只归一到首页，不保留旧邮箱令牌链接。"""
    return redirect(url_for('pages.index'))


@bp.route('/web')
def web_login():
    """为手动输入 /web 保留清晰的登录入口。"""
    return render_template('mailbox_login.html')


@bp.route('/web/<path:credential>')
def mailbox(credential):
    """渲染 /web/<邮箱>----<密钥> 邮箱页。"""
    if '----' not in credential:
        abort(404)

    # 从最后一个分隔符拆分，避免邮箱 local-part 中的连字符干扰解析。
    address, mailbox_key = credential.rsplit('----', 1)
    if not EMAIL_PATTERN.fullmatch(address) or not MAILBOX_KEY_PATTERN.fullmatch(mailbox_key):
        abort(404)

    return render_template(
        'mailbox_manager.html',
        mailbox_address=address,
        mailbox_key=mailbox_key,
    )


@bp.route('/admin')
def admin():
    """唯一管理后台入口。"""
    return render_template('admin_mailbox.html')


@bp.route('/register')
def register():
    """保留管理员授权的邮箱注册页。"""
    return render_template('register.html')


@bp.route('/api-test')
def api_test():
    """保留 API 测试页。"""
    return render_template('api_test.html')
