import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / 'src' / 'frontend'


def read(relative_path):
    return (ROOT / relative_path).read_text(encoding='utf-8')


class PublicMailboxFrontendContractTest(unittest.TestCase):
    def test_login_builds_only_the_credential_route(self):
        script = read('src/frontend/static/scripts/mailbox_login.js')
        self.assertIn("window.location.assign(`/web/${credential}`)", script)
        self.assertIn('encodeURIComponent(address)', script)
        self.assertIn('encodeURIComponent(mailboxKey)', script)
        self.assertNotIn('localStorage', script)
        self.assertNotIn('/mailbox?', script)
        self.assertNotIn('?token=', script)

    def test_mailbox_uses_bearer_and_reauthenticates_on_load(self):
        script = read('src/frontend/static/scripts/mailbox_manager.js')
        self.assertIn("fetch('/api/get_mailbox_token'", script)
        self.assertIn("headers.set('Authorization', `Bearer ${state.accessToken}`)", script)
        self.assertIn('sessionStorage.removeItem(SESSION_TOKEN_KEY)', script)
        self.assertIn('await authenticateMailbox()', script)
        self.assertIn('POLL_INTERVAL_MS = 30_000', script)
        self.assertNotIn('localStorage', script)
        self.assertNotIn('?token=', script)
        self.assertNotIn('/mailbox?', script)

    def test_mail_html_is_isolated_without_remote_loading(self):
        script = read('src/frontend/static/scripts/mailbox_manager.js')
        self.assertIn("iframe.setAttribute('sandbox', '')", script)
        self.assertIn("default-src 'none'", script)
        self.assertIn("connect-src 'none'", script)
        self.assertIn("form-action 'none'", script)
        self.assertIn("frame-src 'none'", script)
        self.assertIn("document.createElement('template')", script)
        self.assertIn('pre.textContent = body', script)
        # DOMParser 可能在清洗前加载 img/iframe；惰性 template 才是此处的安全解析容器。
        self.assertNotIn('new DOMParser', script)

    def test_receive_only_ui_has_no_outbound_controls(self):
        sources = '\n'.join((
            read('src/frontend/templates/mailbox_manager.html'),
            read('src/frontend/static/scripts/mailbox_manager.js'),
            read('src/frontend/templates/api_test.html'),
            read('src/frontend/static/scripts/api_test.js'),
        ))
        for forbidden in ('写邮件', '已发送', '回复', '转发', '二维码', 'send_test_email'):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, sources)

    def test_neumorphic_tokens_and_responsive_rules_exist(self):
        # 核心令牌集中到共享基础，避免页面继续复制同一组主题变量。
        foundation = read('src/frontend/static/styles/ui_foundation.css').lower()
        for token in (
            '--bg-start: #eef3f1',
            '--bg-end: #e5edea',
            '--surface: #edf2f0',
            '--primary: #2f746d',
            '--shadow-raised:',
            '--shadow-inset:',
            '--ease: 180ms',
        ):
            self.assertIn(token, foundation)

        self.assertIn(':focus-visible', foundation)
        self.assertIn('prefers-reduced-motion: reduce', foundation)
        self.assertIn('max-width: 768px', foundation)
        self.assertIn('max-width: 480px', foundation)

        for stylesheet in (
            'src/frontend/static/styles/mailbox_login.css',
            'src/frontend/static/styles/mailbox_manager.css',
        ):
            css = read(stylesheet).lower()
            with self.subTest(stylesheet=stylesheet):
                self.assertIn('var(--surface)', css)
                self.assertIn('var(--ease)', css)

        manager_css = read('src/frontend/static/styles/mailbox_manager.css')
        for breakpoint in ('max-width: 900px', 'max-width: 720px', 'max-width: 520px'):
            self.assertIn(breakpoint, manager_css)

    def test_admin_and_registration_generate_mailbox_key_links(self):
        admin_script = read('src/frontend/static/scripts/admin_mailbox.js')
        register_script = read('src/frontend/static/scripts/register.js')
        self.assertIn('/web/${encodeURIComponent(address)}----${encodeURIComponent(mailboxKey)}', admin_script)
        self.assertIn("sessionStorage.setItem('admin_token', password)", admin_script)
        self.assertIn("'Authorization': `Bearer ${this.authToken}`", admin_script)
        self.assertIn('function escapeHtml(value)', admin_script)
        self.assertIn("modal.querySelector('[data-role=\"changes\"]').textContent", admin_script)
        self.assertNotIn('localStorage.setItem', admin_script)
        self.assertNotIn('localStorage.getItem', admin_script)
        self.assertIn('result.mailbox_key', register_script)
        self.assertIn('/web/${encodeURIComponent(result.mailbox_address)}----${encodeURIComponent(result.mailbox_key)}', register_script)
        self.assertNotIn('/mailbox?', admin_script + register_script)

    def test_api_console_is_memory_only_and_read_only(self):
        script = read('src/frontend/static/scripts/api_test.js')
        self.assertIn("const path = '/api/get_mailbox_token'", script)
        self.assertIn("runReadRequest(mailboxInfoButton, '/api/mailbox_info_v2')", script)
        self.assertIn('/api/get_inbox?address=', script)
        self.assertIn('output.textContent = JSON.stringify', script)
        self.assertNotIn('innerHTML', script)
        self.assertNotIn('localStorage', script)
        self.assertNotIn('sessionStorage', script)
        for forbidden in (
            '/api/get_email',
            '/api/register',
            '/api/send_test_email',
            '/api/delete_email',
            '/api/mark_email_read',
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, script)

    def test_legacy_admin_assets_are_deleted(self):
        for relative_path in (
            'src/frontend/templates/admin.html',
            'src/frontend/static/scripts/admin.js',
            'src/frontend/static/styles/admin.css',
            'src/frontend/templates/index.html',
            'src/frontend/static/scripts/main.js',
            'src/frontend/static/scripts/api.js',
            'src/frontend/static/scripts/language.js',
            'src/frontend/static/styles/style.css',
        ):
            with self.subTest(relative_path=relative_path):
                self.assertFalse((ROOT / relative_path).exists())


if __name__ == '__main__':
    unittest.main()
