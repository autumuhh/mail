'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const addressInput = document.getElementById('mailbox-address');
    const keyInput = document.getElementById('mailbox-key');
    const passwordToggle = document.getElementById('password-toggle');
    addressInput.focus();

    form.addEventListener('submit', handleSubmit);
    addressInput.addEventListener('input', () => clearFieldError(addressInput, 'address-error'));
    keyInput.addEventListener('input', () => clearFieldError(keyInput, 'key-error'));
    passwordToggle.addEventListener('click', toggleKeyVisibility);
    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            form.requestSubmit();
        }
    });
});

function handleSubmit(event) {
    event.preventDefault();

    const addressInput = document.getElementById('mailbox-address');
    const keyInput = document.getElementById('mailbox-key');
    const address = addressInput.value.trim();
    const mailboxKey = keyInput.value.trim();
    let valid = true;

    if (!isValidEmail(address)) {
        setFieldError(addressInput, 'address-error', address ? '请输入有效的邮箱地址。' : '请输入邮箱地址。');
        valid = false;
    }

    if (!mailboxKey) {
        setFieldError(keyInput, 'key-error', '请输入邮箱密钥。');
        valid = false;
    } else if (!isValidMailboxKey(mailboxKey)) {
        setFieldError(keyInput, 'key-error', '仅支持字母、数字及 . _ ~ -，长度 6–128。');
        valid = false;
    }

    if (!valid) {
        showToast('请检查标记的输入项。', 'error');
        return;
    }

    // 密钥不做额外持久化；目标页从固定凭据地址重新认证。
    const credential = `${encodeURIComponent(address)}----${encodeURIComponent(mailboxKey)}`;
    window.location.assign(`/web/${credential}`);
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+(?:\.[^\s@]+)*$/.test(value);
}

function isValidMailboxKey(value) {
    return /^[A-Za-z0-9._~-]{6,128}$/.test(value);
}

function setFieldError(input, errorId, message) {
    input.setAttribute('aria-invalid', 'true');
    input.closest('.input-shell').classList.add('is-invalid');
    document.getElementById(errorId).textContent = message;
}

function clearFieldError(input, errorId) {
    input.removeAttribute('aria-invalid');
    input.closest('.input-shell').classList.remove('is-invalid');
    document.getElementById(errorId).textContent = '';
}

function toggleKeyVisibility() {
    const input = document.getElementById('mailbox-key');
    const button = document.getElementById('password-toggle');
    const icon = document.getElementById('password-icon');
    const show = input.type === 'password';

    input.type = show ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(show));
    button.setAttribute('aria-label', show ? '隐藏密钥' : '显示密钥');
    const sprite = document.documentElement.dataset.iconSprite;
    icon.setAttribute('href', `${sprite}#${show ? 'eye-off' : 'eye'}`);
    input.focus({ preventScroll: true });
}

function showToast(message, type = 'info') {
    MaildropUI.toast(message, type);
}
