from flask import Blueprint, render_template

bp = Blueprint('pages', __name__)

# The main route that serves the website
@bp.route('/')
def index():
    return render_template('index.html')

# IP whitelist management page
@bp.route('/admin')
def admin():
    return render_template('admin.html')

@bp.route('/api-test')
def api_test():
    return render_template('api_test.html')