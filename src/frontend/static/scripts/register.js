// 用户注册页面JavaScript功能

class RegisterManager {
    constructor() {
        // 管理员登录相关元素
        this.adminLoginSection = document.getElementById('admin-login-section');
        this.registerCard = document.getElementById('register-card');
        this.adminPassword = document.getElementById('admin-password');
        this.adminLoginBtn = document.getElementById('admin-login-btn');
        this.adminLogoutBtn = document.getElementById('admin-logout-btn');
        this.adminLoginError = document.getElementById('admin-login-error');

        // 注册相关元素
        this.form = document.getElementById('register-form');
        this.progressContainer = document.getElementById('register-progress');
        this.progressFill = document.getElementById('progress-fill');
        this.progressText = document.getElementById('progress-text');
        this.toastContainer = document.getElementById('toast-container');
        this.batchResult = document.getElementById('batch-result');
        this.batchResultSummary = document.getElementById('batch-result-summary');
        this.batchResultList = document.getElementById('batch-result-list');

        this.isAdminAuthenticated = false;
        this.adminPasswordValue = '';

        // 注释掉URL自动验证逻辑，现在只在前端显示验证界面
        // 检查URL中是否包含管理员密码（从admin页面跳转过来）
        // const urlParams = new URLSearchParams(window.location.search);
        // const adminPasswordFromUrl = urlParams.get('admin_password');

        // if (adminPasswordFromUrl) {
        //     // 如果URL中包含管理员密码，自动进行验证
        //     this.autoVerifyAdmin(adminPasswordFromUrl);
        // }

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showProgress = this.showProgress.bind(this);
        this.hideProgress = this.hideProgress.bind(this);
    }

    setupEventListeners() {
        // 管理员登录相关
        this.adminLoginBtn.addEventListener('click', () => this.handleAdminLogin());
        this.adminLogoutBtn.addEventListener('click', () => this.handleAdminLogout());
        this.adminPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAdminLogin();
        });

        // 表单提交
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // 实时验证
         const emailInput = document.getElementById('email-input');
         const batchCountInput = document.getElementById('batch-count');

          if (emailInput) {
              emailInput.addEventListener('input', () => this.validateRegisterInput(true));
          }

          if (batchCountInput) {
              batchCountInput.addEventListener('input', () => this.validateRegisterInput(true));
          }

         // 加载可用域名
         this.loadAvailableDomains();
    }

    // 显示进度条
    showProgress(message, percentage = 0) {
        this.progressContainer.style.display = 'block';
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = message;
    }

    // 隐藏进度条
    hideProgress() {
        this.progressContainer.style.display = 'none';
        this.progressFill.style.width = '0%';
    }

    // 显示Toast通知
    showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        this.toastContainer.appendChild(toast);

        // 触发动画
        setTimeout(() => toast.classList.add('show'), 100);

        // 自动移除
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

        return toast;
    }


    // 验证用户名规则（仅英文+数字，3-20位）
    isValidUsername(username) {
        return /^[a-zA-Z0-9]{3,20}$/.test(username);
    }

    // 验证注册输入（支持单个/批量）
    validateRegisterInput(silent = false) {
        const emailInputEl = document.getElementById('email-input');
        const batchCountEl = document.getElementById('batch-count');
        const emailInput = emailInputEl ? emailInputEl.value.trim() : '';
        const count = batchCountEl ? parseInt(batchCountEl.value, 10) || 1 : 1;

        const showWarning = (message) => {
            if (!silent) {
                this.showToast(message, 'warning', 3000);
            }
        };

        if (!emailInput) {
            showWarning('请输入邮箱地址或前缀');
            return false;
        }

        if (count < 1 || count > 100) {
            showWarning('创建数量必须在1-100之间');
            return false;
        }

        // 批量创建只允许前缀
        if (count > 1) {
            if (emailInput.includes('@')) {
                showWarning('批量创建时请输入用户名英文数字前缀，不要输入完整邮箱');
                return false;
            }

            if (!/^[a-zA-Z0-9]+$/.test(emailInput)) {
                showWarning('批量前缀仅支持英文和数字');
                return false;
            }

            const suffixLen = Math.max(2, String(count).length);
            const maxPrefixLen = 20 - suffixLen;
            if (emailInput.length < 1 || emailInput.length > maxPrefixLen) {
                showWarning(`当前数量下，前缀长度需为1-${maxPrefixLen}`);
                return false;
            }

            return true;
        }

        // 单个创建：支持完整邮箱或前缀
        if (emailInput.includes('@')) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailInput)) {
                showWarning('请输入有效的邮箱地址格式');
                return false;
            }

            const username = emailInput.split('@')[0];
            if (!this.isValidUsername(username)) {
                showWarning('用户名必须为3-20位英文或数字');
                return false;
            }

            return true;
        }

        if (!this.isValidUsername(emailInput)) {
            showWarning('邮箱前缀必须为3-20位英文或数字');
            return false;
        }

        return true;
    }

     // 加载可用域名
     async loadAvailableDomains() {
         try {
             const response = await fetch('/api/get_random_address');
             const result = await response.json();

             if (response.ok && result.available_domains) {
                 this.displayDomains(result.available_domains);
             } else {
                 this.displayDomains(['localhost', 'test.local']);
             }
         } catch (error) {
             console.error('加载域名失败:', error);
             this.displayDomains(['localhost', 'test.local']);
         }
     }

     // 显示可用域名
     displayDomains(domains) {
         const container = document.getElementById('domains-display');
         if (!container) return;

         const domainsHtml = domains.map(domain =>
             `<span class="domain-tag" data-domain="${domain}" onclick="selectDomain('${domain}')">${domain}</span>`
         ).join('');

         container.innerHTML = `
             <div class="domains-list">
                 ${domainsHtml}
             </div>
         `;
     }



    // 处理管理员登录
    async handleAdminLogin() {
        const password = this.adminPassword.value.trim();

        if (!password) {
            this.showAdminError('请输入管理员密码');
            return;
        }

        // 禁用登录按钮
        this.adminLoginBtn.disabled = true;
        this.adminLoginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 验证中...';
        this.hideAdminError();

        try {
            const response = await fetch('/api/admin_login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.isAdminAuthenticated = true;
                this.adminPasswordValue = password;

                // 隐藏管理员登录，显示注册表单
                this.adminLoginSection.style.display = 'none';
                this.registerCard.style.display = 'block';

                this.showToast('管理员验证成功！', 'success');
            } else {
                throw new Error(result.message || '管理员密码错误');
            }
        } catch (error) {
            console.error('管理员登录错误:', error);
            this.showAdminError(error.message || '管理员登录失败，请稍后重试');
        } finally {
            // 恢复按钮状态
            this.adminLoginBtn.disabled = false;
            this.adminLoginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 验证管理员身份';
        }
    }

    // 处理管理员退出
    handleAdminLogout() {
        this.isAdminAuthenticated = false;
        this.adminPasswordValue = '';
        this.adminPassword.value = '';

        // 显示管理员登录，隐藏注册表单
        this.adminLoginSection.style.display = 'block';
        this.registerCard.style.display = 'none';

        this.showToast('已退出管理员验证', 'info');
    }

    // 显示管理员错误信息
    showAdminError(message) {
        if (this.adminLoginError) {
            this.adminLoginError.textContent = message;
            this.adminLoginError.style.display = 'block';
        }
    }

    // 隐藏管理员错误信息
    hideAdminError() {
        if (this.adminLoginError) {
            this.adminLoginError.style.display = 'none';
        }
    }

    // 渲染批量创建结果
    renderBatchResult(createdList = [], failedList = [], total = 0) {
        if (!this.batchResult || !this.batchResultSummary || !this.batchResultList) {
            return;
        }

        this.batchResult.style.display = 'block';
        this.batchResultList.innerHTML = '';
        this.batchResultSummary.textContent = `总计 ${total} 个，成功 ${createdList.length} 个，失败 ${failedList.length} 个`;

        createdList.forEach((item) => {
            const address = item.mailbox_address || '';
            const token = item.access_token || '';
            const accessUrl = `${window.location.origin}/mailbox?address=${encodeURIComponent(address)}&token=${encodeURIComponent(token)}`;

            const row = document.createElement('div');
            row.className = 'batch-result-item';

            const addressEl = document.createElement('div');
            addressEl.className = 'address';
            addressEl.textContent = `邮箱：${address}`;

            const link = document.createElement('a');
            link.className = 'access-link';
            link.href = accessUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = '打开邮箱';

            row.appendChild(addressEl);
            row.appendChild(link);
            this.batchResultList.appendChild(row);
        });

        failedList.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'batch-result-item';

            const failText = document.createElement('div');
            failText.className = 'address';
            failText.textContent = `失败：${item.address || 'unknown'}（${item.error || '未知错误'}）`;
            row.appendChild(failText);

            this.batchResultList.appendChild(row);
        });
    }

    // 处理注册
    async handleRegister() {
        const formData = new FormData(this.form);
        const emailInput = String(formData.get('email') || '').trim();
        const count = parseInt(String(formData.get('count') || '1'), 10) || 1;
        const data = {
            email: emailInput,
            count,
            retention_days: parseInt(formData.get('retention_days')) || 7,
            agree_terms: formData.get('agree-terms') === 'on'
        };

        // 基础验证
        if (!data.email) {
            this.showToast('请输入邮箱地址或前缀', 'error');
            return;
        }

        if (!data.agree_terms) {
            this.showToast('请同意服务条款和隐私政策', 'warning');
            return;
        }

        // 字段验证
        if (!this.validateRegisterInput()) {
            return;
        }

        // 验证保留天数
        if (data.retention_days < 1 || data.retention_days > 30) {
            this.showToast('保留天数必须在1-30天之间', 'warning');
            return;
        }

        // 禁用按钮
        const submitBtn = document.getElementById('register-btn');
        const btnText = submitBtn.querySelector('span');
        const loadingSpinner = submitBtn.querySelector('.loading-spinner');

        submitBtn.disabled = true;
        btnText.textContent = '创建中...';
        loadingSpinner.style.display = 'block';

        try {
            if (this.batchResult) {
                this.batchResult.style.display = 'none';
            }

            this.showProgress('正在创建邮箱...', 20);

            // 发送注册请求
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.adminPasswordValue  // 添加管理员密码到请求头
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showProgress('邮箱创建完成！', 100);

                const createdList = Array.isArray(result.created) ? result.created : [];
                const failedList = Array.isArray(result.failed) ? result.failed : [];
                const total = Number.isInteger(result.total) ? result.total : count;

                if (createdList.length === 1 && failedList.length === 0) {
                    const mailbox = createdList[0];
                    const accessUrl = `${window.location.origin}/mailbox?address=${encodeURIComponent(mailbox.mailbox_address)}&token=${encodeURIComponent(mailbox.access_token)}`;
                    this.showToast(`创建成功：${mailbox.mailbox_address}`, 'success', 3500);
                    this.showToast(`<a href="${accessUrl}" target="_blank" style="color: #007bff; word-break: break-all;">${accessUrl}</a>`, 'info', 8000);
                } else {
                    this.showToast(`批量创建完成：成功 ${createdList.length} / ${total}`, 'success', 3500);
                }

                this.renderBatchResult(createdList, failedList, total);
            } else {
                throw new Error(result.error || '注册失败');
            }

        } catch (error) {
            console.error('注册错误:', error);
            this.showToast(error.message || '注册失败，请稍后重试', 'error');
        } finally {
            this.hideProgress();

            // 恢复按钮状态
            submitBtn.disabled = false;
            btnText.textContent = '创建邮箱';
            loadingSpinner.style.display = 'none';
        }
    }
}


// 选择域名并拼接到输入框
function selectDomain(domain) {
    const emailInput = document.getElementById('email-input');
    if (!emailInput) return;

    const currentValue = emailInput.value.trim();

    // 如果当前输入框有内容且不包含@，则添加@域名
    if (currentValue && !currentValue.includes('@')) {
        emailInput.value = `${currentValue}@${domain}`;
    } else if (!currentValue) {
        // 如果输入框为空，显示提示
        emailInput.value = `yourname@${domain}`;
        emailInput.focus();
        // 选中文本，让用户可以直接替换
        emailInput.setSelectionRange(0, 8);
    } else {
        // 如果已经是完整邮箱，替换域名部分
        const parts = currentValue.split('@');
        if (parts.length === 2) {
            emailInput.value = `${parts[0]}@${domain}`;
        }
    }

    // 添加视觉反馈
    showDomainSelectedFeedback(domain);
}

// 显示域名选择反馈
function showDomainSelectedFeedback(domain) {
    const feedback = document.createElement('div');
    feedback.className = 'domain-feedback';
    feedback.innerHTML = `
        <i class="fas fa-check-circle"></i>
        已选择域名: ${domain}
    `;
    feedback.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #48bb78, #38a169);
        color: white;
        padding: 1rem 2rem;
        border-radius: 25px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        z-index: 2000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        animation: domainFeedback 0.3s ease-out;
    `;

    document.body.appendChild(feedback);

    // 动画效果
    const style = document.createElement('style');
    style.textContent = `
        @keyframes domainFeedback {
            0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
            50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    // 2秒后移除反馈
    setTimeout(() => {
        feedback.style.opacity = '0';
        feedback.style.transform = 'translate(-50%, -50%) scale(0.8)';
        setTimeout(() => feedback.remove(), 300);
    }, 2000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new RegisterManager();
});

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RegisterManager;
}
