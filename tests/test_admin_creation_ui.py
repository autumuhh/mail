import shutil
import subprocess
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(relative_path):
    return (ROOT / relative_path).read_text(encoding='utf-8')


class AdminCreationUiTest(unittest.TestCase):
    def test_mailbox_creation_labels_keep_register_internal_contract(self):
        html = read('src/frontend/templates/admin_mailbox.html')
        script = read('src/frontend/static/scripts/admin_mailbox.js')

        self.assertNotIn('用户注册', html + script)
        self.assertIn('data-view="register"', html)
        self.assertIn('id="register-view"', html)
        self.assertIn('<span>邮箱创建</span>', html)
        self.assertIn('<option value="register">自助创建</option>', html)
        self.assertIn("'register': { text: '自助创建'", script)
        self.assertIn("label: '自助创建'", script)

    def test_batch_creation_controls_and_feedback_are_present(self):
        html = read('src/frontend/templates/admin_mailbox.html')
        script = read('src/frontend/static/scripts/admin_mailbox.js')
        css = read('src/frontend/static/styles/admin_mailbox.css')

        self.assertRegex(
            html,
            r'name="reg-batch-strategy"\s+value="random"\s+checked',
        )
        self.assertIn('name="reg-batch-strategy" value="sequence"', html)
        self.assertRegex(
            html,
            r'id="reg-batch-count"\s+min="2"\s+max="100"',
        )
        for element_id in (
            'reg-batch-preview-list',
            'reg-batch-progress-text',
            'reg-batch-progress-bar',
        ):
            self.assertIn(f'id="{element_id}"', html)

        self.assertIn('addresses.slice(0, 3)', script)
        self.assertIn('`已完成 ${safeCompleted}/${safeTotal}`', script)
        self.assertIn("successCount === total", script)
        self.assertIn("successCount === 0 ? 'error' : 'warning'", script)
        self.assertRegex(css, r'\.batch-result-list\s*\{[^}]*max-height:\s*340px')
        self.assertRegex(css, r'\.batch-result-list\s*\{[^}]*overflow-y:\s*auto')
        self.assertIn('.batch-completion-message.warning', css)
        self.assertIn('.batch-completion-message.error', css)

    @unittest.skipUnless(shutil.which('node'), '需要 Node.js 验证前端生成逻辑')
    def test_random_names_are_unique_and_domains_are_normalized_and_rotated(self):
        # 直接执行类方法而不启动页面，验证随机数碰撞时仍满足同批唯一性。
        node_test = textwrap.dedent(
            r'''
            const fs = require('fs');
            const source = fs.readFileSync(
                'src/frontend/static/scripts/admin_mailbox.js',
                'utf8'
            );
            const start = source.indexOf('class AdminMailboxManager');
            const end = source.indexOf('let adminManager', start);
            if (start < 0 || end < 0) throw new Error('无法定位管理类');
            const classSource = source
                .slice(start, end)
                .replace(/\/\/ 全局实例\s*$/, '')
                .trim();
            const AdminMailboxManager = eval(`(${classSource})`);
            const manager = Object.create(AdminMailboxManager.prototype);

            const originalRandom = Math.random;
            Math.random = () => 0;
            const single = manager.generateRandomUsername();
            const usernames = manager.generateRandomUsernames(100);
            Math.random = originalRandom;

            if (single !== 'alexsmith0000') throw new Error('单个用户名未包含英文名和英文姓');
            if (new Set(usernames).size !== 100) throw new Error('同批用户名不唯一');
            if (!usernames.every(name => /^[a-z]+[0-9]{4}$/.test(name) && name.length <= 20)) {
                throw new Error('用户名格式或长度不正确');
            }

            const domains = manager.normalizeDomains([
                ' alpha.test ', '', 'beta.test', 'alpha.test', null
            ]);
            if (JSON.stringify(domains) !== JSON.stringify(['alpha.test', 'beta.test'])) {
                throw new Error('域名未正确清理或去重');
            }

            const addresses = manager.generateRandomBatchAddresses(100, domains);
            const domainCounts = addresses.reduce((counts, address) => {
                const domain = address.split('@')[1];
                counts[domain] = (counts[domain] || 0) + 1;
                return counts;
            }, {});
            if (addresses.length !== 100) throw new Error('批量地址数量不正确');
            if (new Set(addresses.map(address => address.split('@')[0])).size !== 100) {
                throw new Error('批量地址用户名不唯一');
            }
            if (Object.keys(domainCounts).length !== 2) throw new Error('未轮转全部域名');
            if (Math.abs(domainCounts['alpha.test'] - domainCounts['beta.test']) > 1) {
                throw new Error('域名分配不均衡');
            }
            '''
        )

        result = subprocess.run(
            ['node', '-e', node_test],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
