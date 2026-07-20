import re
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_ROOT = ROOT / 'src' / 'frontend' / 'templates'
STATIC_ROOT = ROOT / 'src' / 'frontend' / 'static'

PAGE_ASSETS = {
    'mailbox_login.html': ('mailbox_login.css', 'mailbox_login.js'),
    'mailbox_manager.html': ('mailbox_manager.css', 'mailbox_manager.js'),
    'register.html': ('register.css', 'register.js'),
    'api_test.html': ('api_test.css', 'api_test.js'),
    'admin_mailbox.html': ('admin_mailbox.css', 'admin_mailbox.js'),
}


def read(relative_path):
    return (ROOT / relative_path).read_text(encoding='utf-8')


class UiRefactorContractTest(unittest.TestCase):
    def test_every_page_loads_shared_assets_before_page_assets(self):
        for template_name, (stylesheet_name, script_name) in PAGE_ASSETS.items():
            html = (TEMPLATE_ROOT / template_name).read_text(encoding='utf-8')
            with self.subTest(template=template_name):
                foundation_index = html.find('styles/ui_foundation.css')
                page_style_index = html.find(f'styles/{stylesheet_name}')
                theme_index = html.find('scripts/theme.js')
                components_index = html.find('scripts/ui_components.js')
                page_script_index = html.find(f'scripts/{script_name}')

                self.assertGreaterEqual(foundation_index, 0)
                self.assertGreater(page_style_index, foundation_index)
                self.assertGreaterEqual(theme_index, 0)
                self.assertGreater(components_index, theme_index)
                self.assertGreater(page_script_index, components_index)
                page_script = (STATIC_ROOT / 'scripts' / script_name).read_text(encoding='utf-8')
                self.assertIn('MaildropUI', page_script)

                # 图标定义只保留在本地 sprite，避免模板再次复制整套 SVG。
                self.assertNotIn('<symbol', html.lower())
                self.assertIsNone(re.search(
                    r'(?:src|href)\s*=\s*["\']\s*(?:https?:)?//',
                    html,
                    flags=re.IGNORECASE,
                ))

    def test_soft_ui_foundation_has_stable_tokens_and_accessibility_rules(self):
        css = read('src/frontend/static/styles/ui_foundation.css').lower()
        token_patterns = {
            '--bg-start': r'--bg-start\s*:\s*#eef3f1',
            '--bg-end': r'--bg-end\s*:\s*#e5edea',
            '--surface': r'--surface\s*:\s*#edf2f0',
            '--primary': r'--primary\s*:\s*#2f746d',
            '--shadow-raised': r'--shadow-raised\s*:',
            '--shadow-inset': r'--shadow-inset\s*:',
            '--ease': r'--ease\s*:\s*180ms\b',
        }
        for token, pattern in token_patterns.items():
            with self.subTest(token=token):
                self.assertRegex(css, pattern)

        self.assertIn(':focus-visible', css)
        self.assertRegex(css, r'prefers-reduced-motion\s*:\s*reduce')
        self.assertRegex(css, r'@media\s*\(max-width:\s*768px\)')
        self.assertRegex(css, r'@media\s*\(max-width:\s*480px\)')
        self.assertIn('box-shadow: var(--shadow-raised)', css)
        self.assertIn('box-shadow: var(--shadow-inset)', css)

        # 页面样式必须保留自己的窄屏排版，不能只依赖共享颜色变量。
        for _, (stylesheet_name, _) in PAGE_ASSETS.items():
            page_css = (STATIC_ROOT / 'styles' / stylesheet_name).read_text(encoding='utf-8').lower()
            with self.subTest(stylesheet=stylesheet_name):
                self.assertRegex(page_css, r'@media\s*\(max-width:')
                self.assertIn('var(--', page_css)

    def test_no_font_awesome_or_external_font_assets_remain(self):
        active_assets = list(TEMPLATE_ROOT.glob('*.html'))
        active_assets.extend((STATIC_ROOT / 'styles').glob('*.css'))
        active_assets.extend((STATIC_ROOT / 'scripts').glob('*.js'))
        forbidden_markers = (
            'font-awesome',
            'fontawesome',
            'cdnjs.cloudflare.com',
            'fonts.googleapis.com',
            'fonts.gstatic.com',
        )

        for path in active_assets:
            content = path.read_text(encoding='utf-8').lower()
            with self.subTest(path=str(path.relative_to(ROOT))):
                for marker in forbidden_markers:
                    self.assertNotIn(marker, content)
                self.assertIsNone(re.search(r'\bfa(?:s|r|b|l|d)?\b|\bfa-[a-z0-9-]+', content))

                if path.suffix in {'.html', '.css'}:
                    self.assertIsNone(re.search(
                        r'(?:@import\s+[^;]*|url\s*\()\s*["\']?https?://',
                        content,
                    ))

    def test_local_sprite_and_maildrop_ui_api_are_complete(self):
        sprite_path = STATIC_ROOT / 'icons' / 'maildrop-icons.svg'
        self.assertTrue(sprite_path.is_file())
        root = ET.parse(sprite_path).getroot()
        namespace = {'svg': 'http://www.w3.org/2000/svg'}
        symbols = root.findall('.//svg:symbol', namespace)
        symbol_ids = {symbol.attrib.get('id') for symbol in symbols}
        required_icons = {
            'mail', 'inbox', 'key', 'eye', 'eye-off', 'theme', 'refresh',
            'search', 'check', 'trash', 'copy', 'close', 'dashboard',
            'audit', 'settings', 'user-shield', 'spinner', 'question',
        }
        self.assertGreaterEqual(len(symbol_ids), 40)
        self.assertTrue(required_icons.issubset(symbol_ids))
        self.assertFalse(any(element.tag.endswith('script') for element in root.iter()))
        for symbol in symbols:
            self.assertTrue(symbol.attrib.get('viewBox'))

        components = read('src/frontend/static/scripts/ui_components.js')
        self.assertIn('maildrop-icons.svg', components)
        self.assertIn('window.MaildropUI = Object.freeze', components)
        for function_name in ('icon', 'toast', 'openDialog', 'closeDialog', 'setBusy'):
            with self.subTest(function=function_name):
                self.assertRegex(components, rf'function\s+{function_name}\s*\(')
                self.assertRegex(
                    components,
                    rf'window\.MaildropUI\s*=\s*Object\.freeze\([\s\S]*\b{function_name}\b',
                )

        # 图标名、CSS class 与 Toast 文本都经过白名单或文本节点处理。
        self.assertIn('normalizeIconName', components)
        self.assertIn('normalizeClassName', components)
        self.assertIn("messageNode.textContent = String(message || '')", components)

        theme = read('src/frontend/static/scripts/theme.js')
        self.assertIn("const STORAGE_KEY = 'maildrop_theme'", theme)
        self.assertIn("Object.freeze(['auto', 'light', 'dark'])", theme)
        self.assertIn('sessionStorage.getItem(STORAGE_KEY)', theme)
        self.assertIn('sessionStorage.setItem(STORAGE_KEY, theme)', theme)
        self.assertNotIn('localStorage', theme)

    def test_literal_dom_ids_and_admin_api_contract_remain_aligned(self):
        for template_name, (_, script_name) in PAGE_ASSETS.items():
            html = (TEMPLATE_ROOT / template_name).read_text(encoding='utf-8')
            script = (STATIC_ROOT / 'scripts' / script_name).read_text(encoding='utf-8')
            literal_refs = set(re.findall(
                r'getElementById\(\s*["\']([A-Za-z0-9_-]+)["\']\s*\)',
                script,
            ))
            declared_ids = set(re.findall(
                r'\bid\s*=\s*["\']([A-Za-z0-9_-]+)["\']',
                f'{html}\n{script}',
            ))
            with self.subTest(script=script_name):
                self.assertEqual(sorted(literal_refs - declared_ids), [])

        admin_script = read('src/frontend/static/scripts/admin_mailbox.js')
        for endpoint in (
            '/api/admin/mailboxes',
            '/api/admin/stats',
            '/api/admin/audit-logs',
            '/api/admin/security-config',
            '/api/admin/sub-admins',
            '/api/admin/blocked-ips',
        ):
            with self.subTest(endpoint=endpoint):
                self.assertIn(endpoint, admin_script)

        self.assertIn("'Authorization': `Bearer ${this.authToken}`", admin_script)
        self.assertIn("sessionStorage.setItem('admin_token', password)", admin_script)
        self.assertNotIn('localStorage.setItem', admin_script)
        self.assertNotIn('localStorage.getItem', admin_script)

    def test_credentials_stay_memory_only_and_ui_is_receive_only(self):
        api_test = read('src/frontend/static/scripts/api_test.js')
        self.assertIn("const path = '/api/get_mailbox_token'", api_test)
        self.assertIn("runReadRequest(mailboxInfoButton, '/api/mailbox_info_v2')", api_test)
        self.assertIn('/api/get_inbox?address=', api_test)
        self.assertIn('output.textContent = JSON.stringify', api_test)
        self.assertNotIn('localStorage', api_test)
        self.assertNotIn('sessionStorage', api_test)
        self.assertNotIn('innerHTML', api_test)

        ui_sources = '\n'.join(
            path.read_text(encoding='utf-8')
            for path in [
                *TEMPLATE_ROOT.glob('*.html'),
                *(STATIC_ROOT / 'scripts').glob('*.js'),
            ]
        )
        for forbidden in (
            '写邮件', '回复', '转发', '发件箱', '已发送',
            'send_test_email', '/api/send', '/mailbox?', '?token=', '&token=',
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, ui_sources)

        for forbidden_word in ('compose', 'reply', 'forward'):
            with self.subTest(forbidden_word=forbidden_word):
                self.assertIsNone(re.search(rf'\b{forbidden_word}\b', ui_sources, flags=re.IGNORECASE))

    def test_dialog_sizes_and_focus_behavior_are_consistent(self):
        foundation = read('src/frontend/static/styles/ui_foundation.css')
        for modifier, width in (
            ('ui-dialog--compact', '420px'),
            ('ui-dialog--medium', '560px'),
            ('ui-dialog--wide', '760px'),
        ):
            with self.subTest(modifier=modifier):
                self.assertRegex(
                    foundation,
                    rf'dialog\.ui-dialog\.{modifier}\s*\{{[\s\S]*?width:\s*min\({width}',
                )

        register_html = read('src/frontend/templates/register.html')
        api_html = read('src/frontend/templates/api_test.html')
        mailbox_html = read('src/frontend/templates/mailbox_manager.html')
        admin_html = read('src/frontend/templates/admin_mailbox.html')
        self.assertGreaterEqual(register_html.count('ui-dialog--medium'), 2)
        self.assertIn('ui-dialog--medium', api_html)
        self.assertIn('ui-dialog--compact', mailbox_html)
        self.assertIn('modal-content--medium', admin_html)

        admin_script = read('src/frontend/static/scripts/admin_mailbox.js')
        admin_css = read('src/frontend/static/styles/admin_mailbox.css')
        components = read('src/frontend/static/scripts/ui_components.js')
        self.assertIsNone(re.search(r'\bconfirm\s*\(', admin_script))
        self.assertIn('function confirmAdminAction(', admin_script)
        self.assertIn('openAdminModal(modal', admin_script)
        self.assertIn('closeAndRemoveAdminModal(modal)', admin_script)
        for modifier in (
            'modal-content--compact',
            'modal-content--medium',
            'modal-content--wide',
        ):
            with self.subTest(admin_modifier=modifier):
                self.assertIn(modifier, admin_css)
                self.assertIn(modifier, admin_script)

        # 非原生管理弹窗必须支持 Escape，并仍通过关闭按钮完成清理。
        self.assertIn("event.key === 'Escape'", components)
        self.assertIn("closeControl.click()", components)
        self.assertIn("aria-labelledby", components)
        self.assertIn("[data-dialog-description]", components)
        self.assertIn("aria-describedby", components)
        self.assertIn("data-dialog-description", admin_script)

    def test_shared_toasts_are_content_sized_and_compact(self):
        foundation = read('src/frontend/static/styles/ui_foundation.css')

        # 操作反馈应按内容收缩，避免短文本提示占据大块页面空间。
        self.assertRegex(
            foundation,
            r'\.toast,\s*\.ui-toast\s*\{[^}]*justify-self:\s*end;'
            r'[^}]*width:\s*fit-content;[^}]*max-width:\s*min\(320px, 100%\);'
            r'[^}]*min-height:\s*40px;[^}]*padding:\s*6px 10px;',
        )
        self.assertRegex(
            foundation,
            r'\.ui-toast-close\s*\{[^}]*width:\s*32px;'
            r'[^}]*min-height:\s*32px;',
        )
        self.assertRegex(
            foundation,
            r'\.ui-toast-message\s*\{[^}]*min-width:\s*0;'
            r'[^}]*overflow-wrap:\s*anywhere;',
        )

    def test_only_strict_credential_route_is_generated(self):
        pages = read('src/backend/routes/pages.py')
        routes = re.findall(r'@bp\.route\(["\']([^"\']+)["\']', pages)
        self.assertEqual(routes.count('/web/<path:credential>'), 1)
        self.assertNotIn('/mailbox', routes)
        self.assertIn("credential.rsplit('----', 1)", pages)

        expected_builders = {
            'src/frontend/static/scripts/mailbox_login.js':
                '`${encodeURIComponent(address)}----${encodeURIComponent(mailboxKey)}`',
            'src/frontend/static/scripts/mailbox_manager.js':
                '`${encodeURIComponent(address)}----${encodeURIComponent(mailboxKey)}`',
            'src/frontend/static/scripts/admin_mailbox.js':
                '`/web/${encodeURIComponent(address)}----${encodeURIComponent(mailboxKey)}`',
            'src/frontend/static/scripts/register.js':
                '`/web/${encodeURIComponent(result.mailbox_address)}----${encodeURIComponent(result.mailbox_key)}`',
        }
        for relative_path, expected in expected_builders.items():
            script = read(relative_path)
            with self.subTest(script=relative_path):
                self.assertIn(expected, script)


if __name__ == '__main__':
    unittest.main()
