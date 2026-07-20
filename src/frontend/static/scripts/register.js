'use strict';

// 注册页只保存当前标签页中的管理员密码；任何凭据都不会进入 URL 或 Web Storage。
class RegisterManager {
    constructor() {
        this.adminLoginSection = document.getElementById('admin-login-section');
        this.registerCard = document.getElementById('register-card');
        this.adminPassword = document.getElementById('admin-password');
        this.adminLoginBtn = document.getElementById('admin-login-btn');
        this.adminLogoutBtn = document.getElementById('admin-logout-btn');
        this.adminLoginError = document.getElementById('admin-login-error');

        this.form = document.getElementById('register-form');
        this.progressContainer = document.getElementById('register-progress');
        this.progressFill = document.getElementById('progress-fill');
        this.progressText = document.getElementById('progress-text');
        this.progressValue = document.getElementById('progress-value');
        this.toastContainer = document.getElementById('toast-container');

        this.successDialog = document.getElementById('success-dialog');
        this.policyDialog = document.getElementById('policy-dialog');
        this.createdAddress = document.getElementById('created-address');
        this.createdKey = document.getElementById('created-key');
        this.createdRetention = document.getElementById('created-retention');
        this.createdLink = document.getElementById('created-link');
        this.copyCreatedLink = document.getElementById('copy-created-link');
        this.openCreatedMailbox = document.getElementById('open-created-mailbox');

        this.isAdminAuthenticated = false;
        this.adminPasswordValue = '';
        this.currentAccessUrl = '';

        this.setupEventListeners();
        this.loadAvailableDomains();
    }

    setupEventListeners() {
        this.adminLoginBtn.addEventListener('click', () => this.handleAdminLogin());
        this.adminLogoutBtn.addEventListener('click', () => this.handleAdminLogout());
        this.adminPassword.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.handleAdminLogin();
            }
        });

        this.form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.handleRegister();
        });

        const emailInput = document.getElementById('email-input');
        emailInput.addEventListener('input', () => {
            emailInput.removeAttribute('aria-invalid');
            emailInput.setCustomValidity('');
        });

        document.querySelectorAll('[data-dialog-open]').forEach((button) => {
            button.addEventListener('click', () => {
                const dialog = document.getElementById(button.dataset.dialogOpen);
                window.MaildropUI.openDialog(dialog, button);
            });
        });

        this.copyCreatedLink.addEventListener('click', () => this.copyAccessLink());
        this.openCreatedMailbox.addEventListener('click', () => this.openAccessLink());

        [this.successDialog, this.policyDialog].forEach((dialog) => {
            dialog.addEventListener('click', (event) => {
                if (event.target === dialog) {
                    window.MaildropUI.closeDialog(dialog);
                }
            });
        });
    }

    showProgress(message, percentage = 0) {
        const safePercentage = Math.max(0, Math.min(100, Number(percentage) || 0));
        this.progressContainer.hidden = false;
        this.progressFill.style.width = `${safePercentage}%`;
        this.progressText.textContent = message;
        this.progressValue.textContent = `${safePercentage}%`;
    }

    hideProgress() {
        this.progressContainer.hidden = true;
        this.progressFill.style.width = '0%';
        this.progressValue.textContent = '0%';
    }

    showToast(message, type = 'info', duration = 5000) {
        return window.MaildropUI.toast(String(message), type, { duration });
    }

    validateEmail(showFeedback = true) {
        const input = document.getElementById('email-input');
        const value = input.value.trim();
        let message = '';

        if (!value) {
            message = '请输入邮箱地址或前缀';
        } else if (value.includes('@')) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                message = '请输入有效的邮箱地址格式';
            }
        } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) {
            message = '邮箱前缀必须为 3–20 位字母、数字或下划线';
        }

        input.setCustomValidity(message);
        input.toggleAttribute('aria-invalid', Boolean(message));
        if (message && showFeedback) {
            this.showToast(message, 'warning', 3200);
            input.focus();
        }
        return !message;
    }

    async loadAvailableDomains() {
        const container = document.getElementById('domains-display');
        container.setAttribute('aria-busy', 'true');

        try {
            const response = await fetch('/api/get_random_address');
            const result = await this.parseResponse(response);
            const domains = response.ok && Array.isArray(result?.available_domains)
                ? result.available_domains
                : ['localhost', 'test.local'];
            this.displayDomains(domains);
        } catch (error) {
            console.error('加载域名失败：', error);
            this.displayDomains(['localhost', 'test.local']);
            this.showToast('未能读取服务端域名，已显示本地备用项。', 'warning');
        } finally {
            container.setAttribute('aria-busy', 'false');
        }
    }

    displayDomains(domains) {
        const container = document.getElementById('domains-display');
        const list = document.createElement('div');
        list.className = 'domains-list';

        domains
            .map((domain) => String(domain || '').trim())
            .filter(Boolean)
            .forEach((domain) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'domain-tag';
                button.dataset.domain = domain;
                button.textContent = domain;
                button.addEventListener('click', () => selectDomain(domain));
                list.appendChild(button);
            });

        container.replaceChildren(list);
    }

    async handleAdminLogin() {
        const password = this.adminPassword.value.trim();
        if (!password) {
            this.showAdminError('请输入管理员密码');
            this.adminPassword.focus();
            return;
        }

        this.hideAdminError();
        window.MaildropUI.setBusy(this.adminLoginBtn, true, '验证中…');

        try {
            const response = await fetch('/api/admin_login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const result = await this.parseResponse(response);

            if (!response.ok || !result?.success) {
                throw new Error(result?.message || '管理员密码错误');
            }

            this.isAdminAuthenticated = true;
            this.adminPasswordValue = password;
            this.adminPassword.value = '';
            this.adminLoginSection.hidden = true;
            this.registerCard.hidden = false;
            document.getElementById('email-input').focus();
            this.showToast('管理员验证成功。', 'success');
        } catch (error) {
            console.error('管理员登录失败：', error);
            this.showAdminError(error.message || '管理员登录失败，请稍后重试');
        } finally {
            window.MaildropUI.setBusy(this.adminLoginBtn, false);
        }
    }

    handleAdminLogout() {
        this.isAdminAuthenticated = false;
        this.adminPasswordValue = '';
        this.currentAccessUrl = '';
        this.form.reset();
        this.hideProgress();
        this.registerCard.hidden = true;
        this.adminLoginSection.hidden = false;
        this.adminPassword.focus();
        this.showToast('已退出管理员验证。', 'info');
    }

    showAdminError(message) {
        this.adminLoginError.textContent = message;
        this.adminLoginError.hidden = false;
    }

    hideAdminError() {
        this.adminLoginError.textContent = '';
        this.adminLoginError.hidden = true;
    }

    async handleRegister() {
        if (!this.isAdminAuthenticated || !this.adminPasswordValue) {
            this.showToast('管理员会话已失效，请重新验证。', 'error');
            this.handleAdminLogout();
            return;
        }

        const formData = new FormData(this.form);
        const emailValue = formData.get('email');
        const data = {
            email: typeof emailValue === 'string' ? emailValue.trim() : '',
            retention_days: Number.parseInt(formData.get('retention_days'), 10) || 7,
            agree_terms: formData.get('agree-terms') === 'on'
        };

        if (!this.validateEmail()) {
            return;
        }
        if (!data.agree_terms) {
            this.showToast('请先同意服务条款和隐私说明。', 'warning');
            document.getElementById('agree-terms').focus();
            return;
        }
        if (data.retention_days < 1 || data.retention_days > 30) {
            this.showToast('保留天数必须在 1–30 天之间。', 'warning');
            return;
        }

        const submitButton = document.getElementById('register-btn');
        window.MaildropUI.setBusy(submitButton, true, '创建中…');
        this.showProgress('正在创建邮箱…', 25);

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.adminPasswordValue
                },
                body: JSON.stringify(data)
            });
            const result = await this.parseResponse(response);

            if (!response.ok || !result?.success) {
                throw new Error(result?.error || result?.message || '注册失败');
            }

            this.showProgress('正在生成固定访问链接…', 75);
            if (!result.mailbox_created || !result.mailbox_key || !result.mailbox_address) {
                throw new Error('邮箱已创建，但响应中缺少邮箱密钥');
            }

            // 分段编码邮箱与密钥，确保特殊字符不会改变凭据路由含义。
            const accessPath = `/web/${encodeURIComponent(result.mailbox_address)}----${encodeURIComponent(result.mailbox_key)}`;
            const accessUrl = `${window.location.origin}${accessPath}`;
            this.showProgress('邮箱创建完成', 100);
            this.presentSuccess(result, accessUrl);
            this.showToast('临时邮箱创建成功。', 'success');
        } catch (error) {
            console.error('创建邮箱失败：', error);
            this.showToast(error.message || '注册失败，请稍后重试', 'error');
            this.hideProgress();
        } finally {
            window.MaildropUI.setBusy(submitButton, false);
        }
    }

    presentSuccess(result, accessUrl) {
        this.currentAccessUrl = accessUrl;
        this.createdAddress.textContent = String(result.mailbox_address);
        this.createdKey.textContent = String(result.mailbox_key);
        this.createdRetention.textContent = `${Number(result.retention_days) || 7} 天`;
        this.createdLink.textContent = accessUrl;
        this.createdLink.href = accessUrl;
        window.MaildropUI.openDialog(this.successDialog, document.getElementById('register-btn'));
    }

    async copyAccessLink() {
        if (!this.currentAccessUrl) {
            return;
        }

        try {
            await navigator.clipboard.writeText(this.currentAccessUrl);
            this.showToast('访问链接已复制。', 'success');
        } catch (error) {
            console.error('复制访问链接失败：', error);
            this.showToast('无法自动复制，请手动选择链接。', 'warning');
            this.createdLink.focus();
        }
    }

    openAccessLink() {
        if (this.currentAccessUrl) {
            window.open(this.currentAccessUrl, '_blank', 'noopener,noreferrer');
        }
    }

    async parseResponse(response) {
        const raw = await response.text();
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch (_error) {
            return { error: raw };
        }
    }
}

function selectDomain(domain) {
    const emailInput = document.getElementById('email-input');
    if (!emailInput) {
        return;
    }

    const safeDomain = String(domain || '').trim();
    if (!safeDomain) {
        return;
    }

    const currentValue = emailInput.value.trim();
    if (currentValue && !currentValue.includes('@')) {
        emailInput.value = `${currentValue}@${safeDomain}`;
    } else if (!currentValue) {
        emailInput.value = `yourname@${safeDomain}`;
        emailInput.focus();
        emailInput.setSelectionRange(0, 8);
    } else {
        const parts = currentValue.split('@');
        if (parts.length === 2) {
            emailInput.value = `${parts[0]}@${safeDomain}`;
        }
    }

    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    showDomainSelectedFeedback(safeDomain);
}

function showDomainSelectedFeedback(domain) {
    window.MaildropUI.toast(`已选择域名：${domain}`, 'success', { duration: 2200 });
}

document.addEventListener('DOMContentLoaded', () => {
    window.registerManager = new RegisterManager();
});

// 保留旧页面的全局调用入口，便于外部脚本继续选择域名。
window.selectDomain = selectDomain;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RegisterManager;
}
