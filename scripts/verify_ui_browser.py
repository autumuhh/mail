"""在隔离数据上验证实际页面；绝不启动 app.py、SMTP 或清理任务。"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import json
import gc
import hashlib
from importlib.metadata import version
import platform
import subprocess
import logging
import os
from pathlib import Path
import shutil
import statistics
import sys
import tempfile
import threading
import traceback
import time
from urllib.parse import quote, urlparse
import uuid

ROOT = Path(__file__).resolve().parents[1]
AXE = ROOT / ".ui-qa" / "node_modules" / "axe-core" / "axe.min.js"
WIDTHS = (320, 360, 390, 768, 1024, 1440, 1920)
THEMES = (
    ("light", "light"),
    ("dark", "dark"),
    ("auto", "light"),
    ("auto", "dark"),
)
ADMIN_VIEWS = (
    "dashboard",
    "mailboxes",
    "audit",
    "security",
    "register",
    "sub-admins",
    "settings",
)
ADMIN_PASSWORD = "ui-fixture-admin-only"


@contextmanager
def isolated_site(port=0):
    # 先确定临时目录边界，再导入应用；dotenv 不得覆盖隔离数据库路径。
    temp_root = Path(tempfile.mkdtemp(prefix="maildrop-ui-")).resolve()
    assert temp_root.parent == Path(tempfile.gettempdir()).resolve()
    assert (
        temp_root.name.startswith("maildrop-ui-")
        and not temp_root.is_symlink()
    )
    os.environ.update(
        {
            "DATABASE_PATH": str(temp_root / "mailbox.db"),
            "USE_DATABASE": "true",
            "INBOX_FILE_NAME": str(temp_root / "inbox.json"),
            "PASSWORD": ADMIN_PASSWORD,
            "ENABLE_IP_WHITELIST": "false",
            "TRUST_PROXY_HOPS": "0",
            "DOMAINS": "example.test,studio.test",
            "IP_MAX_FAILED_ATTEMPTS": "1000",
        }
    )
    sys.path[:0] = [str(ROOT), str(ROOT / "src" / "backend")]
    from database import db_manager
    from src.backend.flask_app import app
    from werkzeug.serving import make_server

    assert Path(db_manager.db_path).resolve().parent == temp_root
    boxes = {}
    for name in ("studio", "empty", "expired", "disabled"):
        boxes[name] = db_manager.create_mailbox(
            f"{name}@example.test",
            created_source="admin",
            # 覆盖白名单图标状态，不把测试修改扩散到任何真实邮箱。
            sender_whitelist=(
                ["allowed@studio.test"] if name == "empty" else None
            ),
        )
    with db_manager.get_connection() as conn:
        conn.execute(
            "UPDATE mailboxes SET expires_at = ? WHERE id = ?",
            (int(time.time()) - 10, boxes["expired"]["id"]),
        )
        conn.execute(
            "UPDATE mailboxes SET is_active = 0 WHERE id = ?",
            (boxes["disabled"]["id"],),
        )
    conn.close()
    db_manager.create_sub_admin(
        "fixture-studio-team",
        ["example.test"],
        notes="隔离测试账号，不可用于生产",
    )

    def add_message(
        subject, body="这是一封用于界面验证的测试邮件。", html=False
    ):
        return db_manager.add_email(
            boxes["studio"]["id"],
            {
                "id": str(uuid.uuid4()),
                "From": "Maildrop Studio <hello@studio.test>",
                "To": boxes["studio"]["address"],
                "Subject": subject,
                "Body": body,
                "ContentType": "text/html" if html else "text/plain",
                "Timestamp": int(time.time()),
                "Sent": "刚刚",
            },
        )

    boxes["long"] = db_manager.create_mailbox(
        "research-notes-" + "a" * 42 + "@" + "studio-" * 8 + "example.test",
        created_source="admin",
    )
    ids = []
    for number in range(24):
        ids.append(
            add_message(
                f"{number + 1:02d} · 关于周末的计划与一封简短来信",
                "把重要的消息留在眼前。\n邮件正文与地址均为隔离测试数据。",
            )
        )
    ids.append(
        add_message(
            "很长的邮件主题用于检查不同屏幕的中文换行、视觉层级和可读性。" * 3,
            "a" * 160,
        )
    )
    html_id = add_message(
        "HTML · 安静的阅读空间",
        "<h1>你好，Maildrop。</h1><p>这是一封安全 HTML 测试"
        "邮件。</p><p>愿每一封重要的信，都有一个安静的位置。</p>",
        True,
    )
    unsafe_id = add_message(
        "隔离测试 · 不可信 HTML",
        "<script>parent.__mailAttack=true</scri"
        'pt><img src="https://maildrop-qa.inval'
        'id/pixel"><iframe src="https://maildro'
        'p-qa.invalid/frame"></iframe><form act'
        'ion="https://maildrop-qa.invalid/post"'
        "><input></form><p>只有安全文本应该显示。</p>",
        True,
    )
    fixtures = {
        "boxes": boxes,
        "html_id": html_id,
        "unsafe_id": unsafe_id,
        "ids": ids,
    }
    logging.getLogger("werkzeug").setLevel(logging.ERROR)
    app.config.update(TESTING=True)
    server = make_server("127.0.0.1", port, app, threaded=True)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", fixtures, add_message
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=10)
        # SQLite 上下文提交事务但不一定关闭连接；回收已结束请求的连接后再清理。
        gc.collect()
        # 递归清理只允许此次已经检查的临时根目录，不接受调用方传入路径。
        assert temp_root.parent == Path(tempfile.gettempdir()).resolve()
        assert (
            temp_root.name.startswith("maildrop-ui-")
            and not temp_root.is_symlink()
        )
        shutil.rmtree(temp_root)


def mailbox_path(box, key=None):
    return (
        "/web/"
        + quote(box["address"], safe="")
        + "----"
        + quote(key or box["mailbox_key"], safe="")
    )


QA_INIT = """(() => {
    if (window !== window.top) return;
    window.__qaPending = 0;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (...args) => {
        window.__qaPending++;
        return originalFetch(...args).finally(() => window.__qaPending--);
    };
})();"""


def settle(page):
    if page.evaluate('() => typeof window.__qaPending === "number"'):
        page.wait_for_function(
            '() => document.readyState === "complet'
            'e" && window.__qaPending === 0'
        )
        page.evaluate(
            "() => new Promise(resolve => requestAn"
            "imationFrame(() => requestAnimationFra"
            "me(resolve)))"
        )
    else:
        page.wait_for_load_state("networkidle")
    page.evaluate("() => document.fonts.ready")


def show_surface(page, base, fixtures, name):
    if name == "login":
        page.goto(base + "/")
    elif name in ("inbox", "empty"):
        box = fixtures["boxes"]["studio" if name == "inbox" else "empty"]
        page.goto(base + mailbox_path(box))
        page.locator("#mailbox-app").wait_for(state="visible")
        page.wait_for_function(
            "() => document.getElementById('email-l"
            "ist').getAttribute('aria-busy') === 'f"
            "alse'"
        )
    elif name in ("register-gate", "register"):
        page.goto(base + "/register")
        if name == "register":
            page.locator("#admin-password").fill(ADMIN_PASSWORD)
            page.locator("#admin-login-btn").click()
            page.locator("#register-card").wait_for(state="visible")
    elif name == "api":
        page.goto(base + "/api-test")
    elif name == "admin-gate":
        page.evaluate(
            "sessionStorage.removeItem('admin_token')"
        ) if page.url.startswith(base) else None
        page.goto(base + "/admin")
        page.locator("#login-view").wait_for(state="visible")
    elif name.startswith("admin-"):
        page.goto(base + "/admin")
        if page.locator("#login-view").is_visible():
            page.locator("#admin-password").fill(ADMIN_PASSWORD)
            page.locator("#login-form button[type=submit]").click()
        page.wait_for_function(
            "() => document.getElementById('stats-s"
            "tatus').textContent === '统计已更新'"
        )
        view = name.removeprefix("admin-")
        page.locator(f'.nav-item[data-view="{view}"]').click()
        page.locator(f"#{view}-view").wait_for(state="visible")
    settle(page)


LAYOUT_JS = r"""() => {
    const shown = el => el.getClientRects().length
        && getComputedStyle(el).visibility !== 'hidden';
    const selectors = [
        '.icon-button', '.button', '.soft-button', '.btn', '.nav-item',
        '.request-card', '.password-toggle', '.login-button', '.btn-preset',
        '.filter-btn', '.domain-tag', '.email-select', '.select-all',
        '.primary-button', '.email-action', '.nav-button', '.clear-search',
        '.table-select'
    ].join(',');
    const targets = [...document.querySelectorAll(selectors)]
        .filter(shown).filter(el => !el.matches('input,.status-badge,span'));
    const fields = 'input:not([type=hidden]):not([type=checkbox])'
        + ':not([type=radio]),select,textarea';
    // 检查真实伪元素，而不是假设浏览器原生占位颜色适配主题。
    const muted = getComputedStyle(document.documentElement)
        .getPropertyValue('--text-muted').trim();
    const expectedRgb = [1,3,5].map(i => parseInt(muted.slice(i,i+2),16));
    const placeholders = [...document.querySelectorAll(fields)]
        .filter(shown).filter(el => !el.disabled && !el.value
            && el.getAttribute('placeholder'));
    const placeholderIssues = placeholders.map(el => {
        const s = getComputedStyle(el,'::placeholder');
        const rgb = (s.color.match(/[\d.]+/g) || []).map(Number);
        const opaque = Number(s.opacity) === 1
            && (rgb.length < 4 || rgb[3] === 1);
        return {target:el.id, color:s.color, opacity:s.opacity,
            inputColor:getComputedStyle(el).color,
            valid:opaque && expectedRgb.every((v,i) => v === rgb[i])};
    }).filter(r => !r.valid);
    const topbar = document.querySelector('.topbar-inner');
    const sidebar = document.querySelector('.workspace > .sidebar');
    let geometry = null;
    if (topbar && shown(topbar) && innerWidth > 900) {
        const r = topbar.getBoundingClientRect();
        const a = document.querySelector('.address-block')
            .getBoundingClientRect();
        geometry = {workWidth:r.width,
            sidebarWidth:sidebar.getBoundingClientRect().width,
            addressCenterError:Math.abs(a.x + a.width / 2 - innerWidth / 2)};
    }
    return {
        mailboxGeometry: geometry,
        placeholderIssues,
        viewport: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        background: getComputedStyle(document.body).backgroundColor,
        smallTargets: targets.map(el => {
            const r = el.getBoundingClientRect();
            return {target: el.id || el.className,
                width: r.width, height: r.height};
        }).filter(r => r.width < 43.5 || r.height < 43.5),
        smallInputs: [...document.querySelectorAll(fields)]
            .filter(shown)
            .filter(el => parseFloat(getComputedStyle(el).fontSize) < 16)
            .map(el => el.id),
        activeAnimations: [...document.querySelectorAll('*')].filter(shown)
            .filter(el => getComputedStyle(el).animationName !== 'none')
            .map(el => el.id || el.className)
    };
}"""


def axe_audit(page):
    # 检测通过调试通道注入，不放宽产品 CSP，也不添加外部脚本。
    page.evaluate(AXE.read_text(encoding="utf-8"))
    return page.evaluate("""async () => {
        const r = await axe.run(document, {runOnly: {type: 'tag',
            values: ['wcag2a','wcag2aa','wcag21a','wcag21aa',
                'wcag22aa','best-practice']},
            rules: {'label-content-name-mismatch': {enabled:true}}});
        return {
            violations: r.violations.map(v => ({id:v.id, impact:v.impact,
                description:v.description,
                nodes:v.nodes.map(n => ({target:n.target,
                    summary:n.failureSummary}))})),
            incomplete:r.incomplete.map(v => ({id:v.id,
                count:v.nodes.length,
                nodes:v.nodes.map(n => ({target:n.target,
                    summary:n.failureSummary}))})),
            passes:r.passes.length
        };
    }""")


def record_checks(result, layout, a11y=None):
    failures = result.setdefault("failures", [])
    if layout["scrollWidth"] > layout["viewport"] + 1:
        failures.append(
            f"全页横向溢出 {layout['scrollWidth']}/{layout['viewport']}"
        )
    if layout["smallTargets"]:
        failures.append({"smallTargets": layout["smallTargets"]})
    if layout["smallInputs"]:
        failures.append({"smallInputs": layout["smallInputs"]})
    if layout.get("placeholderIssues"):
        issues = layout["placeholderIssues"]
        # 实测 WebKit 伪元素查询返回输入正文色，而非截图中的占位色。
        # 不把不可读取的数据伪称自动通过；保留人工项并保存原生截图复核。
        if result["key"].startswith("webkit-") and all(
            r["color"] == r["inputColor"] for r in issues
        ):
            result["manualReview"] = {
                "placeholderPseudoUnavailable": issues,
                "reason": "WebKit 返回父控件色；以原生截图与声明复核",
            }
        else:
            failures.append({"placeholderIssues": issues})
    geometry = layout.get("mailboxGeometry")
    if geometry:
        if abs(geometry["sidebarWidth"] - 220) > 1:
            failures.append("桌面收件箱侧栏不再为 220px")
        if geometry["addressCenterError"] > 1:
            failures.append("桌面地址区域不再几何居中")
        if abs(geometry["workWidth"] - min(1240, layout["viewport"] - 48)) > 1:
            failures.append("桌面收件工作区宽度契约改变")
    if a11y and a11y["violations"]:
        failures.append({"accessibility": a11y["violations"]})


def dialog_keyboard_check(page, selector, opener):
    page.locator(opener).click()
    page.locator(selector).wait_for(state="visible")
    for _ in range(12):
        page.keyboard.press("Tab")
        assert page.evaluate(
            "(s) => document.querySelector(s).conta"
            "ins(document.activeElement)",
            selector,
        ), "对话框焦点逃逸：" + selector
    page.keyboard.press("Escape")
    page.locator(selector).wait_for(state="hidden")
    page.wait_for_function(
        "(s) => document.activeElement === document.querySelector(s)",
        arg=opener,
    )


def exercise_core(page, base, fixtures, add_message, screenshots):
    # 这些操作只作用于隔离数据库，真实 API 验证比静态 DOM 断言更能发现退化。
    checks = []
    box = fixtures["boxes"]["studio"]
    show_surface(page, base, fixtures, "login")
    page.locator("#mailbox-address").fill(box["address"])
    page.locator("#mailbox-key").fill(box["mailbox_key"])
    page.locator("#login-button").click()
    page.locator("#mailbox-app").wait_for(state="visible")
    settle(page)
    checks.append("公开登录、重新鉴权与真实收件列表")
    assert not page.locator(".email-row.is-new").count(), (
        "初始列表不应整屏入场"
    )
    page.locator("#email-search").fill("关于周末")
    first = page.locator(".email-row").first
    selected_id = first.get_attribute("data-email-id")
    first.locator("input[type=checkbox]").check()
    first.locator("[data-focus-role=open]").focus()
    old_y = page.evaluate("scrollY")
    page.evaluate("async () => await loadEmails(false)")
    assert page.locator("#email-search").input_value() == "关于周末"
    assert page.locator(
        f'.email-row[data-email-id="{selected_id}"] input'
    ).is_checked()
    assert (
        page.evaluate(
            'document.activeElement.closest(".email-row").dataset.emailId'
        )
        == selected_id
    )
    assert abs(page.evaluate("scrollY") - old_y) <= 1
    checks.append("自动刷新保留搜索、选择、滚动和焦点")
    page.locator("#clear-search").click()
    new_id = add_message("新信 · 仅新增行入场")
    page.evaluate("async () => await loadEmails(false)")
    assert page.locator(".email-row.is-new").count() == 1
    assert (
        page.locator(".email-row.is-new").get_attribute("data-email-id")
        == new_id
    )
    checks.append("仅真实新增 ID 入场，旧邮件不重播")
    # 安全 HTML 不得执行脚本或向外发起资源请求。
    page.locator(
        f'.email-row[data-email-id="{fixtures["unsafe_id"]}"] .email-open'
    ).click()
    page.locator("#detail-view").wait_for(state="visible")
    settle(page)
    frame = page.locator("#detail-body iframe")
    assert frame.get_attribute("sandbox") == ""
    assert not page.evaluate("Boolean(window.__mailAttack)")
    checks.append("HTML 沙箱与恶意资源隔离")
    page.keyboard.press("Escape")
    page.locator("#inbox-view").wait_for(state="visible")
    assert (
        page.evaluate(
            'document.activeElement.closest(".email-row").dataset.emailId'
        )
        == fixtures["unsafe_id"]
    )
    checks.append("详情返回焦点回到原邮件")
    page.locator(
        f'.email-row[data-email-id="{new_id}"] [data-focus-role=delete]'
    ).click()
    page.locator("#confirm-dialog").wait_for(state="visible")
    page.locator("#confirm-accept").click()
    page.locator(f'.email-row[data-email-id="{new_id}"]').wait_for(
        state="detached"
    )
    assert page.evaluate(
        'Boolean(document.activeElement.closest(".email-row"))'
    )
    checks.append("删除后焦点移到相邻邮件")
    row = page.locator(".email-row").first
    row_id = row.get_attribute("data-email-id")
    read_button = row.locator("[data-focus-role=read]")
    was_unread = "is-unread" in row.get_attribute("class")
    read_button.click()
    page.wait_for_function(
        "([id, old]) => document.querySelector("
        '`.email-row[data-email-id="${id}"]`).classList'
        ".contains('is-unread') !== old",
        arg=[row_id, was_unread],
    )
    page.locator("#mark-all-read").click()
    page.wait_for_function(
        "() => document.getElementById('unread-badge').textContent === '0'"
    )
    checks.append("行内已读切换与全部已读真实状态同步")
    # 删除用例使用独立邮件，避免删掉后续阅读与跨内核检查的固定样本。
    ids_to_delete = [add_message(f"批量删除隔离样本 {i}") for i in (1, 2)]
    page.evaluate("async () => await loadEmails(false)")
    for checkbox in page.locator(".email-row input:checked").all():
        checkbox.uncheck()
    for value in ids_to_delete:
        page.locator(f'.email-row[data-email-id="{value}"] input').check()
    page.locator("#delete-selected").click()
    page.locator("#confirm-dialog").wait_for(state="visible")
    page.locator("#confirm-accept").click()
    for value in ids_to_delete:
        page.locator(f'.email-row[data-email-id="{value}"]').wait_for(
            state="detached"
        )
    assert page.locator("#delete-selected").is_disabled()
    assert page.evaluate(
        '() => Boolean(document.activeElement.closest(".email-row"))'
    )
    checks.append("真实批量删除与焦点、选择状态恢复")
    show_surface(page, base, fixtures, "api")
    dialog_keyboard_check(page, "#security-dialog", "#security-dialog-open")
    page.locator("#mailbox-address").fill(box["address"])
    page.locator("#mailbox-key").fill(box["mailbox_key"])
    page.locator("#auth-button").click()
    page.wait_for_function(
        "() => document.getElementById('auth-st"
        "atus').dataset.kind === 'success'"
    )
    page.locator("#inbox-button").click()
    page.wait_for_function(
        "() => document.getElementById('api-out"
        "put').textContent.includes('/api/get_i"
        "nbox')"
    )
    assert box["access_token"] not in page.locator("#api-output").inner_text()
    assert box["mailbox_key"] not in page.evaluate(
        "JSON.stringify({...sessionStorage,...localStorage})"
    )
    page.locator("#clear-session-button").click()
    assert page.locator("#inbox-button").is_disabled()
    checks.append("API 真实只读请求、令牌不回显与会话清空")
    show_surface(page, base, fixtures, "register")
    dialog_keyboard_check(
        page, "#policy-dialog", "[data-dialog-open=policy-dialog]"
    )
    page.locator("#email-input").fill("qa" + uuid.uuid4().hex[:10])
    page.locator("#agree-terms").check()
    page.locator("#register-btn").click()
    page.locator("#success-dialog").wait_for(state="visible")
    assert "/web/" in page.locator("#created-link").get_attribute("href")
    checks.append("公开创建、成功凭据与说明弹窗键盘循环")
    page.keyboard.press("Escape")
    show_surface(page, base, fixtures, "admin-register")
    page.locator("input[name=reg-create-mode][value=batch]").check()
    page.wait_for_function(
        "() => document.querySelectorAll('#reg-"
        "batch-preview-list li').length > 0"
    )
    assert page.locator("#reg-batch-preview-list li").count() == 2
    page.locator("input[name=reg-batch-strategy][value=sequence]").check()
    page.locator("#reg-email-prefix").fill("qasequence" + uuid.uuid4().hex[:4])
    page.locator("#reg-email-domain").select_option("example.test")
    page.locator("#reg-batch-count").fill("3")
    page.locator("#admin-register-form button[type=submit]").click()
    page.locator("#register-result").wait_for(state="visible")
    assert page.locator(".batch-result-item.success").count() == 3
    checks.append("后台随机预览、顺序批量实际创建与真实计数进度")
    show_surface(page, base, fixtures, "admin-sub-admins")
    dialog_keyboard_check(
        page, "#sub-admin-modal", "#sub-admins-view .view-header button"
    )
    checks.append("后台原生导航、真实表格与子管理员弹窗键盘循环")
    return checks


def exercise_states(browser, base, fixtures, output):
    results = []
    for width in (320, 390, 1440):
        for theme in ("light", "dark"):
            context = browser.new_context(
                viewport={
                    "width": width,
                    "height": 844 if width < 768 else 1000,
                },
                color_scheme=theme,
                has_touch=width < 768,
                reduced_motion="reduce",
            )
            context.add_init_script(QA_INIT)
            context.add_init_script(
                "if (window === window.top) sessionStorage.setItem("
                f"'maildrop_theme', {json.dumps(theme)})"
            )
            external = []

            def guard(route):
                if urlparse(route.request.url).hostname not in (
                    "127.0.0.1",
                    None,
                ):
                    external.append(route.request.url)
                    route.abort()
                else:
                    route.continue_()

            context.route("**/*", guard)
            page = context.new_page()
            page.set_default_timeout(12000)
            js_errors = []
            page.on("pageerror", lambda e: js_errors.append(str(e)))

            def capture(name, audit=True):
                case = {
                    "key": f"state-{width}-{theme}-{name}",
                    "surface": name,
                    "failures": [],
                }
                try:
                    layout = page.evaluate(LAYOUT_JS)
                    case["layout"] = layout
                    case["a11y"] = axe_audit(page) if audit else None
                    record_checks(case, layout, case["a11y"])
                    filename = case["key"] + ".png"
                    page.screenshot(
                        path=str(output / filename),
                        full_page=True,
                        animations="disabled",
                    )
                    case["screenshot"] = filename
                    if external or js_errors:
                        case["failures"].append(
                            {
                                "unexpectedExternal": external[:],
                                "jsErrors": js_errors[:],
                            }
                        )
                except Exception as e:
                    case["failures"].append(str(e))
                results.append(case)

            try:
                if width == 320:
                    # 最窄屏专门复测阅读工具栏，覆盖人工发现的孤字换行。
                    show_surface(page, base, fixtures, "inbox")
                    page.locator(
                        f'.email-row[data-email-id="{fixtures["ids"][0]}"]'
                        ' .email-open'
                    ).click()
                    page.locator("#detail-view").wait_for(state="visible")
                    assert page.locator("#toggle-read span").evaluate(
                        "el => {const r=document.createRange();"
                        "r.selectNodeContents(el);"
                        "return r.getClientRects().length === 1;}"
                    ), "阅读操作名称不应出现孤字换行"
                    capture("reading-toolbar")
                    context.close()
                    continue
                show_surface(page, base, fixtures, "login")
                page.locator("#login-button").click()
                assert (
                    page.locator("#mailbox-address").get_attribute(
                        "aria-invalid"
                    )
                    == "true"
                )
                capture("login-validation")
                for name, key in [
                    ("wrong-key", "WrongKey123"),
                    ("expired", None),
                    ("disabled", None),
                    ("not-found", "AbsentKey123"),
                ]:
                    box = fixtures["boxes"][
                        "studio"
                        if name in ("wrong-key", "not-found")
                        else name
                    ].copy()
                    if name == "not-found":
                        box["address"] = "missing@example.test"
                    page.goto(base + mailbox_path(box, key))
                    page.locator("#auth-actions").wait_for(state="visible")
                    assert (
                        page.locator("#auth-title").inner_text()
                        == "无法访问邮箱"
                    )
                    capture("auth-" + name)
                show_surface(page, base, fixtures, "empty")
                capture("inbox-empty")
                page.goto(base + mailbox_path(fixtures["boxes"]["long"]))
                page.locator("#mailbox-app").wait_for(state="visible")
                settle(page)
                capture("long-address")
                show_surface(page, base, fixtures, "inbox")
                page.locator("#email-search").fill("no-matching-fixture-word")
                capture("search-empty")
                page.locator("#clear-search").click()
                page.locator(".email-row").first.locator("input").check()
                capture("selected")
                page.locator("#delete-selected").click()
                page.locator("#confirm-dialog").wait_for(state="visible")
                capture("delete-dialog")
                page.keyboard.press("Escape")
                for label, email_id in [
                    ("html-reading", fixtures["html_id"]),
                    ("plain-reading", fixtures["ids"][0]),
                ]:
                    page.locator(
                        f'.email-row[data-email-id="{email_id}"] .email-open'
                    ).click()
                    page.locator("#detail-view").wait_for(state="visible")
                    settle(page)
                    assert page.locator("#toggle-read span").evaluate(
                        "el => {const r=document.createRange();"
                        "r.selectNodeContents(el);"
                        "return r.getClientRects().length === 1;}"
                    ), "阅读操作名称不应出现孤字换行"
                    capture(label)
                    page.keyboard.press("Escape")
                    page.locator("#inbox-view").wait_for(state="visible")
                page.locator(".nav-button[data-view=info]").click()
                capture("mailbox-info")
                show_surface(page, base, fixtures, "api")
                page.locator("#mailbox-address").fill(
                    fixtures["boxes"]["studio"]["address"]
                )
                page.locator("#mailbox-key").fill("WrongKey123")
                page.locator("#auth-button").click()
                page.wait_for_function(
                    "() => document.getElementById('auth-status')"
                    ".dataset.kind === 'error'"
                )
                capture("api-auth-error")
                page.locator("#mailbox-address").fill(
                    fixtures["boxes"]["studio"]["address"]
                )
                page.locator("#mailbox-key").fill(
                    fixtures["boxes"]["studio"]["mailbox_key"]
                )
                page.locator("#auth-button").click()
                page.wait_for_function(
                    "() => document.getElementById('auth-st"
                    "atus').dataset.kind === 'success'"
                )
                page.locator("#inbox-button").click()
                page.wait_for_function(
                    "() => document.getElementById('auth-st"
                    "atus').dataset.kind === 'success'"
                )
                capture("api-success")

                # 只在此隔离页面中断鉴权请求，验证真实的客户端错误处理。
                def abort_auth(route):
                    route.abort()

                context.route("**/api/get_mailbox_token", abort_auth)
                page.locator("#mailbox-key").fill(
                    fixtures["boxes"]["studio"]["mailbox_key"]
                )
                page.locator("#auth-button").click()
                page.wait_for_function(
                    "() => document.getElementById('auth-status')"
                    ".dataset.kind === 'error'"
                )
                assert page.locator("#inbox-button").is_disabled()
                capture("api-network-error")
                context.unroute("**/api/get_mailbox_token", abort_auth)
                show_surface(page, base, fixtures, "register")
                page.locator("#email-input").fill(
                    "qastate" + uuid.uuid4().hex[:8]
                )
                page.locator("#agree-terms").check()
                page.locator("#register-btn").click()
                page.locator("#success-dialog").wait_for(state="visible")
                capture("register-success")
                page.keyboard.press("Escape")
                show_surface(page, base, fixtures, "admin-mailboxes")
                for action in ("view", "edit", "delete"):
                    page.locator(
                        f"#mailbox-list button[data-action={action}]"
                    ).first.click()
                    page.locator(".modal.is-open").wait_for(state="visible")
                    capture("admin-" + action + "-dialog")
                    page.keyboard.press("Escape")
                    page.locator(".modal.is-open").wait_for(state="hidden")
                show_surface(page, base, fixtures, "admin-sub-admins")
                page.locator("#sub-admins-view .view-header button").click()
                page.locator("#sub-admin-modal").wait_for(state="visible")
                settle(page)
                capture("sub-admin-dialog")
                page.keyboard.press("Escape")
                for surface in (
                    "login",
                    "inbox",
                    "inbox-detail",
                    "register",
                    "api",
                    "admin-dashboard",
                    "admin-register",
                ):
                    show_surface(
                        page, base, fixtures,
                        "inbox" if surface == "inbox-detail" else surface,
                    )
                    if surface == "inbox-detail":
                        page.locator(
                            f'.email-row[data-email-id="{fixtures["ids"][0]}"]'
                            ' .email-open'
                        ).click()
                        page.locator("#detail-view").wait_for(state="visible")
                    # 文字单独放大两倍；先读取所有字号，避免继承关系导致累乘。
                    page.evaluate("""() => {
                        const values = [...document.querySelectorAll('body *')]
                            .map(el => [el, getComputedStyle(el).fontSize,
                                getComputedStyle(el).lineHeight]);
                        for (const [el, font, line] of values) {
                            if (el.tagName === 'svg' || el.closest('svg')) {
                                continue;
                            }
                            el.style.fontSize = `${parseFloat(font) * 2}px`;
                            if (line !== 'normal') {
                                el.style.lineHeight =
                                    `${parseFloat(line) * 2}px`;
                            }
                        }
                    }""")
                    capture("text-200-" + surface, audit=False)
            except Exception as e:
                results.append(
                    {
                        "key": f"state-{width}-{theme}-execution",
                        "failures": [describe_error(e)],
                    }
                )
            context.close()
    # 人为延迟只作用于此测试页面，响应仍来自真实隔离 API。
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        reduced_motion="no-preference",
        has_touch=True,
    )
    context.add_init_script("""(() => {
        if (window !== window.top) return;
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
            await new Promise(resolve => setTimeout(resolve, 1800));
            return originalFetch(...args);
        };
    })();""")
    page = context.new_page()
    page.goto(
        base + mailbox_path(fixtures["boxes"]["studio"]),
        wait_until="domcontentloaded",
    )
    page.locator("#auth-spinner").wait_for(state="visible")
    filename = "state-390-light-auth-pending.png"
    page.screenshot(path=str(output / filename), animations="allow")
    results.append(
        {
            "key": "state-390-light-auth-pending",
            "failures": [],
            "screenshot": filename,
        }
    )
    page.locator("#mailbox-app").wait_for(state="visible")
    settle(page)
    button = page.locator("#refresh-button")
    before = button.bounding_box()
    button.click()
    assert button.get_attribute("aria-busy") == "true"
    assert button.is_disabled()
    during = button.bounding_box()
    assert (
        abs(before["width"] - during["width"]) <= 1
        and abs(before["height"] - during["height"]) <= 1
    )
    filename = "state-390-light-refresh-pending.png"
    page.screenshot(path=str(output / filename), animations="allow")
    results.append(
        {
            "key": "state-390-light-refresh-pending",
            "failures": [],
            "screenshot": filename,
            "stableButtonBounds": True,
        }
    )
    context.close()
    return results


PERF_INIT = """(() => {
    if (window !== window.top) return;
    window.__lab = {lcp: 0, cls: 0, interactions: []};
    new PerformanceObserver(list => {
        for (const e of list.getEntries()) window.__lab.lcp = e.startTime;
    }).observe({type:'largest-contentful-paint',buffered:true});
    new PerformanceObserver(list => {
        for (const e of list.getEntries()) {
            if (!e.hadRecentInput) window.__lab.cls += e.value;
        }
    }).observe({type:'layout-shift',buffered:true});
    new PerformanceObserver(list => {
        for (const e of list.getEntries()) {
            if (e.interactionId) {
                window.__lab.interactions.push({name:e.name,
                    duration:e.duration});
            }
        }
    }).observe({type:'event',buffered:true,durationThreshold:16});
})();"""


def performance_runs(browser, base, fixtures):
    results = []
    for surface in ("login", "inbox", "register-gate", "api", "admin-gate"):
        samples = []
        for _ in range(3):
            context = browser.new_context(
                viewport={"width": 390, "height": 844},
                color_scheme="light",
                is_mobile=True,
            )
            context.add_init_script(PERF_INIT)
            page = context.new_page()
            cdp = context.new_cdp_session(page)
            cdp.send("Network.enable")
            cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
            cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
            cdp.send(
                "Network.emulateNetworkConditions",
                {
                    "offline": False,
                    "latency": 150,
                    "downloadThroughput": 1600000 / 8,
                    "uploadThroughput": 750000 / 8,
                    "connectionType": "cellular4g",
                },
            )
            show_surface(page, base, fixtures, surface)
            page.wait_for_timeout(700)
            page.locator(
                "#theme-toggle, .btn-theme-toggle"
            ).first.click() if page.locator(
                "#theme-toggle, .btn-theme-toggle"
            ).first.is_visible() else page.locator("#admin-password").click()
            page.wait_for_timeout(100)
            samples.append(page.evaluate("window.__lab"))
            context.close()
        lcp = statistics.median(x["lcp"] for x in samples)
        cls = statistics.median(x["cls"] for x in samples)
        results.append(
            {
                "surface": surface,
                "samples": samples,
                "median_lcp_ms": lcp,
                "median_cls": cls,
                "passed": lcp <= 2500 and cls <= 0.1,
            }
        )
    return results


def describe_error(error):
    location = traceback.extract_tb(error.__traceback__)[-1].lineno
    return f"{type(error).__name__}: {error} (line {location})"


def frontend_digest():
    # 固定前端快照，正式轮次中途若改动源文件，不能混用不同版本的结果。
    digest = hashlib.sha256()
    for path in sorted((ROOT / "src" / "frontend").rglob("*")):
        if path.is_file() and path.suffix in {".css", ".js", ".html", ".svg"}:
            digest.update(str(path.relative_to(ROOT)).encode("utf-8"))
            digest.update(path.read_bytes())
    return digest.hexdigest()


def run(args, base, fixtures, add_message):
    from playwright.sync_api import sync_playwright

    output = (ROOT / args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    assert AXE.exists(), (
        "先安装测试专用 axe-core：npm install --prefix "
        ".ui-qa --no-save axe-core@4.11.0"
    )
    report = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "isolation": "loopback / temporary database / Web on"
        "ly / synthetic accounts",
        "cases": [],
        "states": [],
        "core": {},
        "performance": [],
        "errors": [],
        "source_sha256": frontend_digest(),
        "browser_versions": {},
        "environment": {
            "python": platform.python_version(),
            "os": platform.platform(),
            "playwright": version("playwright"),
            "flask": version("flask"),
            "axe_core": "4.11.0",
        },
        "commit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
        "lab_profile": {
            "viewport": "390x844",
            "cpu_throttle": 4,
            "latency_ms": 150,
            "download_bits_s": 1600000,
            "upload_bits_s": 750000,
            "fresh_context": True,
            "cache_disabled": True,
            "samples_per_surface": 3,
            "field_inp_available": False,
        },
    }

    def save():
        (output / "report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    surfaces = [
        "login",
        "inbox",
        "register-gate",
        "register",
        "api",
        "admin-gate",
    ] + ["admin-" + v for v in ADMIN_VIEWS]
    widths = (390, 1440) if args.quick else WIDTHS
    themes = THEMES[:2] if args.quick else THEMES
    with sync_playwright() as pw:
        for engine in (
            ("chromium",)
            if args.quick or args.states_only
            else ("chromium", "firefox", "webkit")
        ):
            browser = getattr(pw, engine).launch()
            report["browser_versions"][engine] = browser.version
            engine_widths = (
                ()
                if args.states_only
                else (widths if engine == "chromium" else (390, 1440))
            )
            engine_themes = themes if engine == "chromium" else THEMES[:2]
            for width in engine_widths:
                for preference, system in engine_themes:
                    context = browser.new_context(
                        viewport={
                            "width": width,
                            "height": 844 if width < 768 else 1000,
                        },
                        color_scheme=system,
                        reduced_motion="reduce",
                        has_touch=width < 768,
                    )
                    context.add_init_script(QA_INIT)
                    context.add_init_script(
                        "if (window === window.top) sessionStorage.setItem("
                        f"'maildrop_theme', {json.dumps(preference)})"
                    )
                    page = context.new_page()
                    page.set_default_timeout(12000)
                    current_errors = []
                    page.on(
                        "pageerror", lambda e: current_errors.append(str(e))
                    )
                    page.on(
                        "console",
                        lambda m: (
                            current_errors.append("console: " + m.text)
                            if m.type == "error"
                            else None
                        ),
                    )

                    def guard(route):
                        if urlparse(route.request.url).hostname not in (
                            "127.0.0.1",
                            None,
                        ):
                            current_errors.append(
                                "外部资源请求：" + route.request.url
                            )
                            route.abort()
                        else:
                            route.continue_()

                    context.route("**/*", guard)
                    for surface in surfaces:
                        key = (
                            f"{engine}-{width}-{preference}-{system}-{surface}"
                        )
                        case = {"key": key, "surface": surface, "failures": []}
                        current_errors.clear()
                        try:
                            show_surface(page, base, fixtures, surface)
                            layout = page.evaluate(LAYOUT_JS)
                            case["layout"] = layout
                            case["a11y"] = (
                                axe_audit(page)
                                if (
                                    width in (320, 390, 1440)
                                    and engine == "chromium"
                                )
                                else None
                            )
                            record_checks(case, layout, case["a11y"])
                            if layout["activeAnimations"]:
                                case["failures"].append(
                                    "减少动效偏好下仍有动画："
                                    + str(layout["activeAnimations"])
                                )
                            if surface == "login" and width == 390:
                                r = page.locator(
                                    "#login-button"
                                ).bounding_box()
                                case["cta_bottom"] = r["y"] + r["height"]
                                if case["cta_bottom"] > 844:
                                    case["failures"].append(
                                        "主操作不在移动首屏内"
                                    )
                            expected_bg = (
                                "rgb(17, 25, 22)"
                                if (
                                    preference == "dark"
                                    or preference == "auto"
                                    and system == "dark"
                                )
                                else "rgb(247, 247, 242)"
                            )
                            if layout["background"] != expected_bg:
                                case["failures"].append(
                                    "主题解析错误：" + layout["background"]
                                )
                            if width in (390, 1440) and engine in (
                                "chromium", "webkit"
                            ):
                                filename = key + ".png"
                                before_capture = list(current_errors)
                                page.screenshot(
                                    path=str(output / filename),
                                    full_page=True,
                                    animations="disabled",
                                )
                                # 截图同步注入临时样式时，严格 CSP 会拒绝。
                                # 该副作用已隔离复现，不能放宽产品策略。
                                added = current_errors[len(before_capture):]
                                known = (
                                    "console: Refused to apply a stylesheet "
                                    "because its hash, its nonce, or "
                                    "'unsafe-inline' does not appear in the "
                                    "style-src directive of the Content "
                                    "Security Policy."
                                )
                                if engine == "webkit" and known in added:
                                    case["captureDiagnostics"] = [
                                        e for e in added if e == known
                                    ]
                                    current_errors[:] = before_capture + [
                                        e for e in added if e != known
                                    ]
                                case["screenshot"] = filename
                        except Exception as e:
                            case["failures"].append(str(e))
                        if current_errors:
                            case["failures"].append(
                                {"browserErrors": list(current_errors)}
                            )
                        report["cases"].append(case)
                        save()
                        print(
                            key
                            + ": "
                            + ("PASS" if not case["failures"] else "FAIL"),
                            flush=True,
                        )
                    context.close()
            # 每个内核验证真实交互，不以浏览器能打开页面代替功能回归。
            context = browser.new_context(
                viewport={"width": 1440, "height": 1000},
                reduced_motion="reduce",
            )
            context.add_init_script(QA_INIT)
            external_requests = []

            def core_guard(route):
                if urlparse(route.request.url).hostname not in (
                    "127.0.0.1",
                    None,
                ):
                    external_requests.append(route.request.url)
                    route.abort()
                else:
                    route.continue_()

            context.route("**/*", core_guard)
            page = context.new_page()
            page.set_default_timeout(12000)
            try:
                checks = exercise_core(
                    page, base, fixtures, add_message, output
                )
                assert not external_requests, "出现外部资源加载"
                report["core"][engine] = {"checks": checks, "passed": True}
            except Exception as e:
                report["core"][engine] = {
                    "passed": False,
                    "error": describe_error(e),
                }
                page.screenshot(
                    path=str(output / f"{engine}-core-failure.png"),
                    full_page=True,
                )
            context.close()
            save()
            print(
                "交互回归 "
                + engine
                + ": "
                + json.dumps(report["core"][engine], ensure_ascii=False),
                flush=True,
            )
            if engine == "chromium":
                try:
                    report["states"] = exercise_states(
                        browser, base, fixtures, output
                    )
                except Exception as e:
                    report["states"] = [
                        {
                            "key": "state-execution",
                            "failures": [describe_error(e)],
                        }
                    ]
                save()
                print(
                    "状态检查："
                    + str(sum(bool(x["failures"]) for x in report["states"]))
                    + " 项失败",
                    flush=True,
                )
            if engine == "chromium" and not args.skip_perf:
                try:
                    report["performance"] = performance_runs(
                        browser, base, fixtures
                    )
                except Exception as e:
                    report["performance"] = [
                        {
                            "passed": False,
                            "error": describe_error(e),
                        }
                    ]
            browser.close()
            save()
    if report["source_sha256"] != frontend_digest():
        report["errors"].append(
            "本轮进行中前端快照发生变化，结果不能作为正式验收依据。"
        )
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    report["failed_cases"] = sum(
        bool(c["failures"]) for c in report["cases"] + report["states"]
    )
    report["passed"] = (
        not report["errors"]
        and not report["failed_cases"]
        and all(x["passed"] for x in report["core"].values())
        and all(x["passed"] for x in report["performance"])
    )
    save()
    print(
        json.dumps(
            {
                "cases": len(report["cases"]),
                "failed_cases": report["failed_cases"],
                "core": report["core"],
                "performance": report["performance"],
                "report": str(output / "report.json"),
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
    return 0 if report["passed"] else 1


def main():
    if not __debug__:
        raise RuntimeError(
            "验证脚本不能在 -O 模式运行，以免跳过断言与边界检查。"
        )
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="reports/ui-redesign/round-1")
    parser.add_argument(
        "--quick", action="store_true", help="先验证两种尺寸与显式深浅主题"
    )
    parser.add_argument("--skip-perf", action="store_true")
    parser.add_argument(
        "--states-only", action="store_true", help="集中复测复杂状态与文字放大"
    )
    parser.add_argument(
        "--serve",
        type=int,
        metavar="SECONDS",
        help="提供有时限的隔离预览，仅供本机检查",
    )
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args()
    with isolated_site(args.port) as (base, fixtures, add_message):
        if args.serve:
            print(
                json.dumps(
                    {
                        "preview": base,
                        "fixture_address": fixtures["boxes"]["studio"][
                            "address"
                        ],
                        "fixture_path": mailbox_path(
                            fixtures["boxes"]["studio"]
                        ),
                        "admin_password": ADMIN_PASSWORD,
                        "expires_seconds": args.serve,
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )
            time.sleep(args.serve)
            return 0
        result = run(args, base, fixtures, add_message)
    # 只有隔离服务器关闭与临时目录清理真实完成后，才写入清理证明。
    report_path = (ROOT / args.output).resolve() / "report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    report["cleanup"] = {
        "web_server_stopped": True,
        "temporary_data_removed": True,
        "smtp_started": False,
        "cleanup_task_started": False,
    }
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return result


if __name__ == "__main__":
    raise SystemExit(main())
