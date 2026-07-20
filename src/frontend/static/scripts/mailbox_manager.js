'use strict';

const SESSION_TOKEN_KEY = 'maildrop_access_token';
const POLL_INTERVAL_MS = 30_000;

const state = {
    address: '',
    mailboxKey: '',
    accessToken: '',
    mailbox: null,
    emails: [],
    selectedIds: new Set(),
    currentEmailId: null,
    activeView: 'inbox',
    searchQuery: '',
    pollTimer: null,
    loadingEmails: false
};

class ApiError extends Error {
    constructor(message, status, payload = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.payload = payload;
    }
}

document.addEventListener('DOMContentLoaded', initializeMailbox);

async function initializeMailbox() {
    bindInterfaceEvents();

    try {
        const credential = parseCredentialPath();
        state.address = credential.address;
        state.mailboxKey = credential.mailboxKey;
        await authenticateMailbox();
    } catch (error) {
        showAuthError(error);
    }
}

function parseCredentialPath() {
    const marker = '/web/';
    const markerIndex = window.location.pathname.indexOf(marker);

    if (markerIndex < 0) {
        throw new Error('访问地址格式不正确，请返回登录页重新输入。');
    }

    const encodedCredential = window.location.pathname.slice(markerIndex + marker.length);
    const separatorIndex = encodedCredential.lastIndexOf('----');

    if (separatorIndex <= 0 || separatorIndex >= encodedCredential.length - 4) {
        throw new Error('访问地址缺少邮箱或密钥，请返回登录页重新输入。');
    }

    try {
        const address = decodeURIComponent(encodedCredential.slice(0, separatorIndex)).trim();
        const mailboxKey = decodeURIComponent(encodedCredential.slice(separatorIndex + 4)).trim();

        if (!isValidEmail(address) || !isValidMailboxKey(mailboxKey)) {
            throw new Error('邮箱或密钥格式不正确，请返回登录页重新输入。');
        }
        return { address, mailboxKey };
    } catch (error) {
        if (error instanceof URIError) {
            throw new Error('访问地址编码无效，请返回登录页重新输入。');
        }
        throw error;
    }
}

async function authenticateMailbox() {
    showAuthLoading();
    // 每次刷新都用固定凭据地址重新换取令牌，避免把旧会话误当成当前邮箱。
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    state.accessToken = '';

    const response = await fetch('/api/get_mailbox_token', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            address: state.address,
            mailbox_key: state.mailboxKey
        })
    });
    const payload = await readJson(response);

    if (!response.ok || !payload.success || !payload.access_token) {
        throw new ApiError(getErrorMessage(payload, '邮箱验证失败。'), response.status, payload);
    }

    state.accessToken = payload.access_token;
    sessionStorage.setItem(SESSION_TOKEN_KEY, state.accessToken);
    revealApplication();
    history.replaceState({ view: 'inbox' }, '', window.location.href);

    const results = await Promise.allSettled([
        loadMailboxInfo(),
        loadEmails(true)
    ]);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) {
        handleRequestError(failed.reason, '部分邮箱数据加载失败。');
    }
    startPolling();
}

function bindInterfaceEvents() {
    document.getElementById('retry-auth').addEventListener('click', () => {
        authenticateMailbox().catch(showAuthError);
    });
    document.getElementById('refresh-button').addEventListener('click', refreshAll);
    document.getElementById('copy-address').addEventListener('click', copyAddress);
    document.getElementById('copy-address-secondary').addEventListener('click', copyAddress);
    document.getElementById('mark-all-read').addEventListener('click', markAllRead);
    document.getElementById('delete-selected').addEventListener('click', deleteSelectedEmails);
    document.getElementById('detail-back').addEventListener('click', returnFromDetail);
    document.getElementById('toggle-read').addEventListener('click', toggleCurrentReadState);
    document.getElementById('delete-current').addEventListener('click', deleteCurrentEmail);
    document.getElementById('switch-form').addEventListener('submit', switchMailbox);

    document.getElementById('email-search').addEventListener('input', handleSearch);
    document.getElementById('clear-search').addEventListener('click', clearSearch);
    document.getElementById('select-all').addEventListener('change', toggleSelectAll);

    document.querySelectorAll('.nav-button[data-view]').forEach((button) => {
        button.addEventListener('click', () => navigateToView(button.dataset.view));
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && state.activeView === 'inbox' && state.accessToken) {
            loadEmails(false).catch((error) => handleRequestError(error, '自动刷新失败。'));
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && state.activeView === 'detail') {
            event.preventDefault();
            returnFromDetail();
        }
    });

    window.addEventListener('popstate', handleHistoryChange);
}

function revealApplication() {
    document.getElementById('auth-state').hidden = true;
    document.getElementById('mailbox-app').hidden = false;
    document.getElementById('mailbox-address').textContent = state.address;
    document.getElementById('info-address').textContent = state.address;
    document.title = `${state.address} · Maildrop`;
}

function showAuthLoading() {
    const authState = document.getElementById('auth-state');
    authState.hidden = false;
    document.getElementById('mailbox-app').hidden = true;
    document.getElementById('auth-spinner').hidden = false;
    document.getElementById('auth-title').textContent = '正在验证邮箱';
    document.getElementById('auth-message').textContent = '正在使用当前访问地址重新认证，请稍候。';
    document.getElementById('auth-actions').hidden = true;
}

function showAuthError(error) {
    const status = error instanceof ApiError ? error.status : 0;
    const messages = {
        401: '邮箱密钥不正确，请检查后重试。',
        403: '当前请求没有访问该邮箱的权限。',
        404: '没有找到这个邮箱。',
        410: '这个邮箱已经过期。',
        423: '这个邮箱已被停用。'
    };

    state.accessToken = '';
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    document.getElementById('auth-state').hidden = false;
    document.getElementById('mailbox-app').hidden = true;
    document.getElementById('auth-spinner').hidden = true;
    document.getElementById('auth-title').textContent = '无法访问邮箱';
    document.getElementById('auth-message').textContent = messages[status] || error.message || '验证失败，请稍后重试。';
    document.getElementById('auth-actions').hidden = false;
    document.getElementById('status-dot').classList.add('is-offline');
}

async function apiFetch(path, options = {}) {
    if (!state.accessToken) {
        throw new ApiError('当前会话尚未完成认证。', 401);
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${state.accessToken}`);
    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(path, {
        ...options,
        headers,
        credentials: 'same-origin'
    });
    const payload = await readJson(response);

    if (!response.ok) {
        throw new ApiError(getErrorMessage(payload, '请求失败。'), response.status, payload);
    }
    return payload;
}

async function readJson(response) {
    try {
        return await response.json();
    } catch (_error) {
        return {};
    }
}

function getErrorMessage(payload, fallback) {
    return payload.message || payload.error || fallback;
}

async function loadMailboxInfo() {
    const data = await apiFetch('/api/mailbox_info_v2');
    state.mailbox = data.mailbox || data;
    renderMailboxInfo();
}

async function loadEmails(showLoading = false) {
    if (state.loadingEmails) {
        return;
    }

    state.loadingEmails = true;
    const list = document.getElementById('email-list');
    if (showLoading) {
        renderListState('loading', '正在读取邮件', '请稍候，收件箱很快就好。');
    }
    list.setAttribute('aria-busy', 'true');

    try {
        const data = await apiFetch(`/api/get_inbox?address=${encodeURIComponent(state.address)}`);
        const emails = Array.isArray(data) ? data : (Array.isArray(data.emails) ? data.emails : []);
        state.emails = emails;

        const existingIds = new Set(emails.map((email) => String(email.id)));
        state.selectedIds.forEach((id) => {
            if (!existingIds.has(id)) {
                state.selectedIds.delete(id);
            }
        });

        if (state.currentEmailId && !existingIds.has(state.currentEmailId)) {
            state.currentEmailId = null;
            showView('inbox');
        }

        renderEmailList();
        updateCounters();
    } finally {
        state.loadingEmails = false;
        list.setAttribute('aria-busy', 'false');
    }
}

async function refreshAll() {
    const button = document.getElementById('refresh-button');
    button.classList.add('is-loading');
    button.disabled = true;

    try {
        await Promise.all([loadMailboxInfo(), loadEmails(false)]);
        showToast('收件箱已刷新。', 'success');
    } catch (error) {
        handleRequestError(error, '刷新失败，请稍后重试。');
    } finally {
        button.classList.remove('is-loading');
        button.disabled = false;
    }
}

function startPolling() {
    window.clearInterval(state.pollTimer);
    state.pollTimer = window.setInterval(() => {
        if (!document.hidden && state.activeView === 'inbox') {
            loadEmails(false).catch((error) => handleRequestError(error, '自动刷新失败。'));
        }
    }, POLL_INTERVAL_MS);
}

function getFilteredEmails() {
    const query = state.searchQuery.trim().toLocaleLowerCase();
    if (!query) {
        return state.emails;
    }

    return state.emails.filter((email) => {
        const searchable = [email.Subject, email.From, email.To, stripHtml(email.Body || '')]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase();
        return searchable.includes(query);
    });
}

function renderEmailList() {
    const list = document.getElementById('email-list');
    const emails = getFilteredEmails();
    list.replaceChildren();

    if (!emails.length) {
        const searching = Boolean(state.searchQuery.trim());
        renderListState(
            searching ? 'search' : 'empty',
            searching ? '没有匹配的邮件' : '收件箱还是空的',
            searching ? '换一个关键词试试。' : '新邮件到达后会自动显示在这里。'
        );
        updateSelectionControls(emails);
        return;
    }

    const fragment = document.createDocumentFragment();
    emails.forEach((email) => fragment.appendChild(createEmailRow(email)));
    list.appendChild(fragment);
    updateSelectionControls(emails);
}

function createEmailRow(email) {
    const id = String(email.id);
    const row = document.createElement('article');
    const checkbox = document.createElement('input');
    const openButton = document.createElement('button');
    const sender = document.createElement('span');
    const subjectWrap = document.createElement('span');
    const subject = document.createElement('span');
    const preview = document.createElement('span');
    const time = document.createElement('time');
    const actions = document.createElement('div');
    const readButton = createIconButton(email.is_read ? '标记为未读' : '标记为已读', email.is_read ? 'dot' : 'check');
    const deleteButton = createIconButton('删除邮件', 'trash', 'danger');

    row.className = `email-row${email.is_read ? '' : ' is-unread'}${state.selectedIds.has(id) ? ' is-selected' : ''}`;
    row.dataset.emailId = id;

    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedIds.has(id);
    checkbox.setAttribute('aria-label', `选择邮件：${email.Subject || '无主题'}`);
    checkbox.addEventListener('change', () => toggleEmailSelection(id, checkbox.checked));

    openButton.type = 'button';
    openButton.className = 'email-open';
    openButton.setAttribute('aria-label', `查看邮件：${email.Subject || '无主题'}`);
    openButton.addEventListener('click', () => openEmailDetail(id));

    sender.className = 'email-sender';
    sender.textContent = email.From || '未知发件人';
    subjectWrap.className = 'email-subject-wrap';
    subject.className = 'email-subject';
    subject.textContent = email.Subject || '（无主题）';
    preview.className = 'email-preview';
    preview.textContent = buildPreview(email.Body || '');
    subjectWrap.append(subject, preview);

    time.className = 'email-time';
    time.dateTime = toIsoDate(email.Timestamp);
    time.textContent = formatRelativeDate(email.Timestamp, email.Sent);
    openButton.append(sender, subjectWrap, time);

    actions.className = 'email-actions';
    readButton.addEventListener('click', () => setEmailRead(id, !Boolean(email.is_read)));
    deleteButton.addEventListener('click', () => deleteOneEmail(id));
    actions.append(readButton, deleteButton);
    row.append(checkbox, openButton, actions);
    return row;
}

function createIconButton(label, iconName, extraClass = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `email-action ${extraClass}`.trim();
    button.setAttribute('aria-label', label);
    button.title = label;
    button.appendChild(createIcon(iconName));
    return button;
}

function createIcon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    use.setAttribute('href', `${document.documentElement.dataset.iconSprite}#${name}`);
    svg.appendChild(use);
    return svg;
}

function renderListState(type, title, message) {
    const list = document.getElementById('email-list');
    const stateBox = document.createElement('div');
    const inner = document.createElement('div');
    const icon = document.createElement('span');
    const heading = document.createElement('h3');
    const copy = document.createElement('p');

    stateBox.className = 'list-state';
    inner.className = 'list-state-inner';
    icon.className = 'state-icon';
    icon.appendChild(createIcon(type === 'search' ? 'search' : type === 'loading' ? 'refresh' : 'inbox'));
    heading.textContent = title;
    copy.textContent = message;
    inner.append(icon, heading, copy);
    stateBox.appendChild(inner);
    list.replaceChildren(stateBox);
}

function handleSearch(event) {
    state.searchQuery = event.target.value;
    document.getElementById('clear-search').hidden = !state.searchQuery;
    renderEmailList();
    updateCounters();
}

function clearSearch() {
    const input = document.getElementById('email-search');
    input.value = '';
    state.searchQuery = '';
    document.getElementById('clear-search').hidden = true;
    renderEmailList();
    updateCounters();
    input.focus();
}

function toggleEmailSelection(id, selected) {
    if (selected) {
        state.selectedIds.add(id);
    } else {
        state.selectedIds.delete(id);
    }
    const row = document.querySelector(`.email-row[data-email-id="${cssEscape(id)}"]`);
    if (row) {
        row.classList.toggle('is-selected', selected);
    }
    updateSelectionControls(getFilteredEmails());
}

function toggleSelectAll(event) {
    getFilteredEmails().forEach((email) => {
        const id = String(email.id);
        if (event.target.checked) {
            state.selectedIds.add(id);
        } else {
            state.selectedIds.delete(id);
        }
    });
    renderEmailList();
}

function updateSelectionControls(filteredEmails = getFilteredEmails()) {
    const selectableIds = filteredEmails.map((email) => String(email.id));
    const selectedVisible = selectableIds.filter((id) => state.selectedIds.has(id)).length;
    const selectAll = document.getElementById('select-all');
    const deleteButton = document.getElementById('delete-selected');

    selectAll.checked = selectableIds.length > 0 && selectedVisible === selectableIds.length;
    selectAll.indeterminate = selectedVisible > 0 && selectedVisible < selectableIds.length;
    selectAll.disabled = selectableIds.length === 0;
    deleteButton.disabled = state.selectedIds.size === 0;
    deleteButton.querySelector('span').textContent = state.selectedIds.size
        ? `删除选中（${state.selectedIds.size}）`
        : '删除选中';
}

function updateCounters() {
    const unread = state.emails.filter((email) => !email.is_read).length;
    const visible = getFilteredEmails().length;
    const summary = state.searchQuery.trim()
        ? `找到 ${visible} 封，共 ${state.emails.length} 封邮件`
        : `${state.emails.length} 封邮件 · ${unread} 封未读`;

    document.getElementById('unread-badge').textContent = String(unread);
    document.getElementById('inbox-summary').textContent = summary;
    document.getElementById('info-total').textContent = String(state.emails.length);
    document.getElementById('info-unread').textContent = String(unread);
}

async function setEmailRead(id, isRead, options = {}) {
    const email = state.emails.find((item) => String(item.id) === String(id));
    if (!email || Boolean(email.is_read) === isRead) {
        return;
    }

    try {
        await apiFetch('/api/mark_email_read', {
            method: 'POST',
            body: JSON.stringify({
                address: state.address,
                email_id: id,
                is_read: isRead
            })
        });
        email.is_read = isRead;
        renderEmailList();
        updateCounters();
        if (state.currentEmailId === String(id)) {
            updateDetailReadButton(email);
        }
        if (!options.silent) {
            showToast(isRead ? '已标记为已读。' : '已标记为未读。', 'success');
        }
    } catch (error) {
        handleRequestError(error, '更新邮件状态失败。');
    }
}

async function markAllRead() {
    if (!state.emails.some((email) => !email.is_read)) {
        showToast('当前没有未读邮件。');
        return;
    }

    try {
        await apiFetch('/api/mark_all_read', {
            method: 'POST',
            body: JSON.stringify({ address: state.address })
        });
        state.emails.forEach((email) => { email.is_read = true; });
        renderEmailList();
        updateCounters();
        showToast('全部邮件已标记为已读。', 'success');
    } catch (error) {
        handleRequestError(error, '标记全部已读失败。');
    }
}

async function deleteOneEmail(id) {
    const email = state.emails.find((item) => String(item.id) === String(id));
    if (!email || !await requestConfirmation(`确定删除“${email.Subject || '无主题'}”吗？此操作无法撤销。`)) {
        return;
    }

    try {
        await apiFetch('/api/delete_email', {
            method: 'POST',
            body: JSON.stringify({ address: state.address, email_id: id })
        });
        removeEmailsLocally([String(id)]);
        showToast('邮件已删除。', 'success');
    } catch (error) {
        handleRequestError(error, '删除邮件失败。');
    }
}

async function deleteSelectedEmails() {
    const ids = Array.from(state.selectedIds);
    if (!ids.length || !await requestConfirmation(`确定删除选中的 ${ids.length} 封邮件吗？此操作无法撤销。`)) {
        return;
    }

    try {
        await apiFetch('/api/delete_emails_batch', {
            method: 'POST',
            body: JSON.stringify({ address: state.address, email_ids: ids })
        });
        removeEmailsLocally(ids);
        showToast(`已删除 ${ids.length} 封邮件。`, 'success');
    } catch (error) {
        handleRequestError(error, '批量删除失败。');
    }
}

function requestConfirmation(message) {
    const dialog = document.getElementById('confirm-dialog');
    const messageNode = document.getElementById('confirm-message');
    const acceptButton = document.getElementById('confirm-accept');
    const cancelButton = document.getElementById('confirm-cancel');

    messageNode.textContent = message;
    return new Promise((resolve) => {
        let settled = false;
        const finish = (accepted) => {
            if (settled) {
                return;
            }
            settled = true;
            acceptButton.removeEventListener('click', accept);
            cancelButton.removeEventListener('click', cancel);
            dialog.removeEventListener('cancel', cancelNative);
            MaildropUI.closeDialog(dialog);
            resolve(accepted);
        };
        const accept = () => finish(true);
        const cancel = () => finish(false);
        const cancelNative = (event) => {
            event.preventDefault();
            finish(false);
        };

        acceptButton.addEventListener('click', accept);
        cancelButton.addEventListener('click', cancel);
        dialog.addEventListener('cancel', cancelNative);
        MaildropUI.openDialog(dialog);
    });
}

function removeEmailsLocally(ids) {
    const idSet = new Set(ids.map(String));
    state.emails = state.emails.filter((email) => !idSet.has(String(email.id)));
    ids.forEach((id) => state.selectedIds.delete(String(id)));

    if (state.currentEmailId && idSet.has(state.currentEmailId)) {
        state.currentEmailId = null;
        if (history.state?.view === 'detail') {
            history.back();
        } else {
            showView('inbox');
        }
    }
    renderEmailList();
    updateCounters();
}

function openEmailDetail(id, pushHistory = true) {
    const email = state.emails.find((item) => String(item.id) === String(id));
    if (!email) {
        showToast('这封邮件已不存在。', 'error');
        return;
    }

    state.currentEmailId = String(id);
    renderEmailDetail(email);
    showView('detail');
    if (pushHistory) {
        history.pushState({ view: 'detail', emailId: state.currentEmailId }, '', window.location.href);
    }
    if (!email.is_read) {
        setEmailRead(id, true, { silent: true });
    }
}

function renderEmailDetail(email) {
    document.getElementById('detail-subject').textContent = email.Subject || '（无主题）';
    document.getElementById('detail-from').textContent = email.From || '未知发件人';
    document.getElementById('detail-to').textContent = email.To || state.address;
    document.getElementById('detail-date').textContent = formatFullDate(email.Timestamp, email.Sent);
    document.getElementById('detail-status').textContent = email.is_read ? '已读邮件' : '未读邮件';
    updateDetailReadButton(email);
    renderMessageBody(email);
}

function updateDetailReadButton(email) {
    const button = document.getElementById('toggle-read');
    button.querySelector('span').textContent = email.is_read ? '标记未读' : '标记已读';
    button.setAttribute('aria-label', email.is_read ? '将当前邮件标记为未读' : '将当前邮件标记为已读');
    document.getElementById('detail-status').textContent = email.is_read ? '已读邮件' : '未读邮件';
}

function renderMessageBody(email) {
    const container = document.getElementById('detail-body');
    const body = String(email.Body || '');
    const contentType = String(email.ContentType || '').toLocaleLowerCase();
    const looksLikeHtml = contentType.includes('html') || /<([a-z][\w-]*)(?:\s[^>]*)?>/i.test(body);
    container.replaceChildren();

    if (!looksLikeHtml) {
        // 纯文本必须通过 textContent 渲染，避免把邮件内容解释为页面标记。
        const pre = document.createElement('pre');
        pre.className = 'message-text';
        pre.textContent = body || '邮件正文为空。';
        container.appendChild(pre);
        return;
    }

    // HTML 邮件放入无任何权限的 sandbox iframe；srcdoc 内 CSP 再阻断脚本、表单、导航与外网资源。
    const iframe = document.createElement('iframe');
    iframe.className = 'message-frame';
    iframe.title = `邮件正文：${email.Subject || '无主题'}`;
    iframe.setAttribute('sandbox', '');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('loading', 'lazy');
    iframe.srcdoc = buildIsolatedHtml(body);
    container.appendChild(iframe);
}

function buildIsolatedHtml(rawHtml) {
    const safeBody = sanitizeEmailMarkup(rawHtml);
    const csp = [
        "default-src 'none'",
        "script-src 'none'",
        "connect-src 'none'",
        "img-src data: cid:",
        "style-src 'unsafe-inline'",
        "font-src 'none'",
        "media-src 'none'",
        "frame-src 'none'",
        "object-src 'none'",
        "form-action 'none'",
        "base-uri 'none'"
    ].join('; ');

    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><style>html{color-scheme:light}body{margin:0;padding:22px;color:#243430;background:#fff;font:14px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}a{color:#2f746d;text-decoration:underline}pre{white-space:pre-wrap}table{max-width:100%;border-collapse:collapse}</style></head><body>${safeBody}</body></html>`;
}

function sanitizeEmailMarkup(rawHtml) {
    // template.content 在离屏惰性文档片段中解析，清洗前不会请求邮件里的外部子资源。
    const template = document.createElement('template');
    template.innerHTML = String(rawHtml);
    const blocked = 'script,form,input,button,textarea,select,option,iframe,frame,frameset,object,embed,applet,base,meta,link,video,audio,source,track';
    template.content.querySelectorAll(blocked).forEach((node) => node.remove());

    template.content.querySelectorAll('*').forEach((element) => {
        Array.from(element.attributes).forEach((attribute) => {
            const name = attribute.name.toLocaleLowerCase();
            const value = attribute.value.trim();
            const isEvent = name.startsWith('on');
            const isNavigation = ['href', 'xlink:href', 'action', 'formaction', 'target', 'download', 'poster', 'srcset'].includes(name);
            const isRemoteImage = name === 'src' && element.tagName === 'IMG' && !/^(?:data:|cid:)/i.test(value);
            const isOtherSource = name === 'src' && element.tagName !== 'IMG';

            if (isEvent || isNavigation || isRemoteImage || isOtherSource) {
                element.removeAttribute(attribute.name);
            }
        });

        if (element.hasAttribute('style')) {
            const style = element.getAttribute('style')
                .replace(/url\s*\([^)]*\)/gi, 'none')
                .replace(/@import[^;]+;?/gi, '');
            element.setAttribute('style', style);
        }
    });

    return template.innerHTML;
}

function returnFromDetail() {
    if (history.state?.view === 'detail') {
        history.back();
    } else {
        showView('inbox');
    }
}

function toggleCurrentReadState() {
    const email = state.emails.find((item) => String(item.id) === state.currentEmailId);
    if (email) {
        setEmailRead(state.currentEmailId, !Boolean(email.is_read));
    }
}

function deleteCurrentEmail() {
    if (state.currentEmailId) {
        deleteOneEmail(state.currentEmailId);
    }
}

function navigateToView(view) {
    if (!['inbox', 'info'].includes(view)) {
        return;
    }
    showView(view);
    history.pushState({ view }, '', window.location.href);
}

function showView(view) {
    state.activeView = view;
    document.querySelectorAll('.view').forEach((element) => {
        const active = element.id === `${view}-view`;
        element.classList.toggle('is-active', active);
        element.hidden = !active;
    });

    document.querySelectorAll('.nav-button[data-view]').forEach((button) => {
        const active = button.dataset.view === view || (view === 'detail' && button.dataset.view === 'inbox');
        button.classList.toggle('is-active', active);
        if (active) {
            button.setAttribute('aria-current', 'page');
        } else {
            button.removeAttribute('aria-current');
        }
    });

    if (view !== 'detail') {
        state.currentEmailId = null;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
}

function handleHistoryChange(event) {
    const historyState = event.state || { view: 'inbox' };
    if (historyState.view === 'detail' && historyState.emailId) {
        openEmailDetail(String(historyState.emailId), false);
    } else {
        showView(historyState.view === 'info' ? 'info' : 'inbox');
    }
}

function renderMailboxInfo() {
    const mailbox = state.mailbox || {};
    document.getElementById('info-created').textContent = formatFullDate(mailbox.created_at);
    document.getElementById('info-expires').textContent = formatFullDate(mailbox.expires_at);
    document.getElementById('status-dot').classList.toggle('is-offline', mailbox.is_active === false || mailbox.is_expired === true);

    if (Number.isFinite(Number(mailbox.email_count)) && state.emails.length === 0) {
        document.getElementById('info-total').textContent = String(mailbox.email_count);
    }
    if (Number.isFinite(Number(mailbox.unread_count)) && state.emails.length === 0) {
        document.getElementById('info-unread').textContent = String(mailbox.unread_count);
    }
}

async function copyAddress() {
    try {
        await navigator.clipboard.writeText(state.address);
        showToast('邮箱地址已复制。', 'success');
    } catch (_error) {
        const input = document.createElement('textarea');
        input.value = state.address;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
        showToast('邮箱地址已复制。', 'success');
    }
}

function switchMailbox(event) {
    event.preventDefault();
    const address = document.getElementById('switch-address').value.trim();
    const mailboxKey = document.getElementById('switch-key').value.trim();

    if (!isValidEmail(address)) {
        showToast('请输入有效的邮箱地址。', 'error');
        return;
    }
    if (!isValidMailboxKey(mailboxKey)) {
        showToast('密钥仅支持字母、数字及 . _ ~ -，长度 6–128。', 'error');
        return;
    }

    const credential = `${encodeURIComponent(address)}----${encodeURIComponent(mailboxKey)}`;
    window.location.assign(`/web/${credential}`);
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+(?:\.[^\s@]+)*$/.test(value);
}

function isValidMailboxKey(value) {
    return /^[A-Za-z0-9._~-]{6,128}$/.test(value);
}

function handleRequestError(error, fallback) {
    if (error instanceof ApiError && [401, 403, 410, 423].includes(error.status)) {
        window.clearInterval(state.pollTimer);
        showAuthError(error);
        return;
    }
    showToast(error.message || fallback, 'error');
}

function showToast(message, type = 'info') {
    MaildropUI.toast(message, type);
}

function normalizeDate(value, fallback) {
    if (value === null || value === undefined || value === '') {
        if (fallback) {
            const parsedFallback = new Date(fallback);
            return Number.isNaN(parsedFallback.getTime()) ? null : parsedFallback;
        }
        return null;
    }

    const numeric = Number(value);
    const date = Number.isFinite(numeric)
        ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
        : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelativeDate(value, fallback) {
    const date = normalizeDate(value, fallback);
    if (!date) {
        return '时间未知';
    }
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(date);
    }
    return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date);
}

function formatFullDate(value, fallback) {
    const date = normalizeDate(value, fallback);
    if (!date) {
        return '—';
    }
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function toIsoDate(value) {
    const date = normalizeDate(value);
    return date ? date.toISOString() : '';
}

function buildPreview(value) {
    const text = stripHtml(value).replace(/\s+/g, ' ').trim();
    return text || '邮件正文为空';
}

function stripHtml(value) {
    // 搜索摘要同样使用惰性 template，避免预览阶段触发外部资源加载。
    const template = document.createElement('template');
    template.innerHTML = String(value);
    template.content.querySelectorAll('script,style,template,noscript').forEach((node) => node.remove());
    return template.content.textContent || '';
}

function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
        return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, '\\$&');
}
