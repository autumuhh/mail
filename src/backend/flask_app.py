import os
import secrets
from flask import Flask
from .routes import pages, api, admin_api

app = Flask(__name__, template_folder='../frontend/templates', static_folder='../frontend/static')

# 设置安全的secret_key用于session和CSRF保护
app.secret_key = os.environ.get('FLASK_SECRET_KEY') or secrets.token_hex(32)

# 配置session安全选项
app.config.update(
    SESSION_COOKIE_SECURE=os.environ.get('FLASK_ENV') == 'production',
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
)

app.register_blueprint(pages.bp) # load the blueprint for the all of the main web page routes
app.register_blueprint(api.bp, url_prefix='/api') # load the blueprint for the all of the api routes
app.register_blueprint(admin_api.bp, url_prefix='/api/admin') # load the blueprint for admin API routes

# Runs the main flask app
def run_flask_server(host, port):
    app.run(host=host, port=port, debug=False)