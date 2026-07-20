'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const addressInput = document.getElementById('mailbox-address');
    const keyInput = document.getElementById('mailbox-key');
    const authButton = document.getElementById('auth-button');
    const clearSessionButton = document.getElementById('clear-session-button');
    const mailboxInfoButton = document.getElementById('mailbox-info-button');
    const inboxButton = document.getElementById('inbox-button');
    const clearOutputButton = document.getElementById('clear-output-button');
    const authStatus = document.getElementById('auth-status');
    const statusMessage = authStatus.querySelector('[data-role="message"]');
    const output = document.getElementById('api-output');
    const securityDialog = document.getElementById('security-dialog');

    // 敏感凭据只存在于当前页面闭包，禁止写入任何 Web Storage 或 URL。
    const state = {
        address: '',
        accessToken: ''
    };

    function setAuthenticated(authenticated) {
        mailboxInfoButton.disabled = !authenticated;
        inboxButton.disabled = !authenticated;
    }

    function setStatus(kind, message) {
        authStatus.dataset.kind = kind;
        statusMessage.textContent = message;
    }

    function renderOutput(payload) {
        // API 响应只能作为文本输出，防止邮件 HTML 或错误字段进入调试台 DOM。
        output.textContent = JSON.stringify(payload, null, 2);
    }

    function clearCredentials() {
        state.address = '';
        state.accessToken = '';
        keyInput.value = '';
        setAuthenticated(false);
    }

    function markInvalid(input, invalid) {
        input.toggleAttribute('aria-invalid', Boolean(invalid));
    }

    async function parseResponse(response) {
        const raw = await response.text();
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch (_error) {
            return raw;
        }
    }

    function responsePayload(method, path, response, body) {
        return {
            requested_at: new Date().toISOString(),
            request: { method, path },
            response: {
                status: response.status,
                ok: response.ok,
                body
            }
        };
    }

    async function authenticate(event) {
        event.preventDefault();

        const address = addressInput.value.trim();
        const mailboxKey = keyInput.value.trim();
        markInvalid(addressInput, !address);
        markInvalid(keyInput, !mailboxKey);

        if (!address || !mailboxKey) {
            setStatus('error', '请输入邮箱地址和邮箱密钥。');
            window.MaildropUI.toast('请先补全鉴权凭据。', 'warning');
            (!address ? addressInput : keyInput).focus();
            return;
        }

        clearCredentials();
        window.MaildropUI.setBusy(authButton, true, '鉴权中…');
        setStatus('pending', '正在换取访问令牌…');

        const path = '/api/get_mailbox_token';
        try {
            const response = await fetch(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address,
                    mailbox_key: mailboxKey
                })
            });
            const body = await parseResponse(response);

            if (!response.ok || !body || !body.access_token) {
                renderOutput(responsePayload('POST', path, response, body));
                const message = body?.message || body?.error || `鉴权失败（HTTP ${response.status}）`;
                setStatus('error', message);
                window.MaildropUI.toast(message, 'error');
                return;
            }

            state.address = body.address || address;
            state.accessToken = body.access_token;
            keyInput.value = '';
            setAuthenticated(true);
            setStatus('success', `已鉴权：${state.address}`);
            window.MaildropUI.toast('鉴权成功，可以执行只读查询。', 'success');

            // access_token 永不回显，避免截图或复制响应时泄露凭据。
            renderOutput({
                requested_at: new Date().toISOString(),
                request: { method: 'POST', path },
                response: {
                    status: response.status,
                    ok: true,
                    body: {
                        success: true,
                        address: state.address,
                        mailbox_id: body.mailbox_id,
                        expires_at: body.expires_at,
                        message: body.message
                    }
                }
            });
        } catch (error) {
            renderOutput({
                requested_at: new Date().toISOString(),
                request: { method: 'POST', path },
                error: error.message
            });
            setStatus('error', '网络请求失败，请检查服务状态。');
            window.MaildropUI.toast('网络请求失败，请检查服务状态。', 'error');
        } finally {
            window.MaildropUI.setBusy(authButton, false);
        }
    }

    async function runReadRequest(button, path) {
        if (!state.accessToken || !state.address) {
            setStatus('error', '请先完成邮箱鉴权。');
            window.MaildropUI.toast('请先完成邮箱鉴权。', 'warning');
            addressInput.focus();
            return;
        }

        window.MaildropUI.setBusy(button, true, '请求中…');
        setStatus('pending', '正在执行只读请求…');

        try {
            const response = await fetch(path, {
                headers: {
                    'Authorization': `Bearer ${state.accessToken}`
                }
            });
            const body = await parseResponse(response);
            renderOutput(responsePayload('GET', path, response, body));

            if (response.ok) {
                setStatus('success', `请求成功：HTTP ${response.status}`);
                window.MaildropUI.toast(`只读请求成功（HTTP ${response.status}）。`, 'success');
            } else {
                const message = body?.message || body?.error || `请求失败（HTTP ${response.status}）`;
                setStatus('error', message);
                window.MaildropUI.toast(message, 'error');
            }
        } catch (error) {
            renderOutput({
                requested_at: new Date().toISOString(),
                request: { method: 'GET', path },
                error: error.message
            });
            setStatus('error', '网络请求失败，请检查服务状态。');
            window.MaildropUI.toast('网络请求失败，请检查服务状态。', 'error');
        } finally {
            window.MaildropUI.setBusy(button, false);
            button.disabled = !state.accessToken;
        }
    }

    authForm.addEventListener('submit', authenticate);
    addressInput.addEventListener('input', () => markInvalid(addressInput, false));
    keyInput.addEventListener('input', () => markInvalid(keyInput, false));

    mailboxInfoButton.addEventListener('click', () => {
        runReadRequest(mailboxInfoButton, '/api/mailbox_info_v2');
    });
    inboxButton.addEventListener('click', () => {
        runReadRequest(inboxButton, `/api/get_inbox?address=${encodeURIComponent(state.address)}`);
    });

    clearSessionButton.addEventListener('click', () => {
        clearCredentials();
        authForm.reset();
        markInvalid(addressInput, false);
        markInvalid(keyInput, false);
        output.textContent = '等待请求...';
        setStatus('idle', '会话已清空。');
        window.MaildropUI.toast('内存中的调试会话已清空。', 'info');
        addressInput.focus();
    });

    clearOutputButton.addEventListener('click', () => {
        output.textContent = '等待请求...';
        output.focus();
    });

    document.getElementById('security-dialog-open').addEventListener('click', (event) => {
        window.MaildropUI.openDialog(securityDialog, event.currentTarget);
    });
    securityDialog.addEventListener('click', (event) => {
        if (event.target === securityDialog) {
            window.MaildropUI.closeDialog(securityDialog);
        }
    });

    setAuthenticated(false);
});
