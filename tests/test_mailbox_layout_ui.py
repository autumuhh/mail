import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(relative_path):
    return (ROOT / relative_path).read_text(encoding='utf-8')


class MailboxLayoutUiContractTest(unittest.TestCase):
    def test_topbar_and_workspace_keep_the_centered_desktop_layout(self):
        html = read('src/frontend/templates/mailbox_manager.html')
        css = read('src/frontend/static/styles/mailbox_manager.css')

        # 等宽两翼是邮箱地址几何居中的契约，避免以后又退回非对称三栏。
        self.assertIn('<div class="topbar-inner">', html)
        self.assertIn(
            'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);',
            css,
        )
        self.assertIn('width: min(1240px, calc(100% - 48px));', css)
        self.assertIn('grid-template-columns: 220px minmax(0, 1fr);', css)
        for breakpoint in ('max-width: 900px', 'max-width: 720px'):
            self.assertIn(breakpoint, css)

    def test_delete_confirmation_uses_the_compact_dialog(self):
        html = read('src/frontend/templates/mailbox_manager.html')
        css = read('src/frontend/static/styles/mailbox_manager.css')

        # 用户页的删除确认只有短文本，应始终使用 420px 紧凑弹窗。
        self.assertIn('ui-dialog--compact confirm-dialog', html)
        self.assertIn('width: min(420px, calc(100vw - 32px));', css)

    def test_operation_toasts_are_compact_and_bottom_anchored(self):
        css = read('src/frontend/static/styles/mailbox_manager.css')

        # 必须清除共享 top 定位，否则与 bottom 同时生效会把网格拉成整屏高度。
        self.assertRegex(
            css,
            r'\.toast-region\s*\{[^}]*top:\s*auto;[^}]*left:\s*auto;'
            r'[^}]*align-content:\s*end;'
            r'[^}]*width:\s*min\(320px',
        )


if __name__ == '__main__':
    unittest.main()
