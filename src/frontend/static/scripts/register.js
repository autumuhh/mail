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

         if (emailInput) {
             emailInput.addEventListener('input', () => this.validateEmail());
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


    // 验证邮箱
     validateEmail() {
         const emailInput = document.getElementById('email-input').value;

         if (!emailInput) {
             this.showToast('请输入邮箱地址或前缀', 'warning', 3000);
             return false;
         }

         // Check if it's a full email or just prefix
         if (emailInput.includes('@')) {
             // Full email validation
             const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
             if (!emailRegex.test(emailInput)) {
                 this.showToast('请输入有效的邮箱地址格式', 'warning', 3000);
                 return false;
             }
         } else {
             // Prefix validation
             const prefixRegex = /^[a-zA-Z0-9_]{3,20}$/;
             if (!prefixRegex.test(emailInput)) {
                 this.showToast('邮箱前缀必须3-20字符，只能包含字母数字下划线', 'warning', 3000);
                 return false;
             }
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

    // 处理注册
    async handleRegister() {

        const formData = new FormData(this.form);
        const emailInput = formData.get('email').trim();
        const data = {
            email: emailInput,
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
        if (!this.validateEmail()) {
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
            this.showProgress('正在创建邮箱...', 25);

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
                this.showProgress('邮箱创建成功！', 75);

                // 注册成功，直接跳转到邮箱管理页面
                this.showProgress('邮箱创建完成！', 100);

                // 等待一下让用户看到成功状态
                await new Promise(resolve => setTimeout(resolve, 1500));

                if (result.mailbox_created && result.access_token) {
                    // 有邮箱创建成功，显示访问URL
                    const accessUrl = `${window.location.origin}/mailbox?address=${encodeURIComponent(result.mailbox_address)}&token=${encodeURIComponent(result.access_token)}`;

                    this.showToast('临时邮箱创建成功！', 'success', 3000);

                    // 显示邮箱信息和访问链接
                    const emailParts = result.mailbox_address.split('@');
                    const domainInfo = emailParts.length === 2 ? '使用域名：' + emailParts[1] + '<br>' : '';

                    this.showToast(`
                        <div style="text-align: left;">
                            <strong>您的临时邮箱：</strong><br>
                            地址：${result.mailbox_address}<br>
                            ${domainInfo}
                            保留时间：${result.retention_days}天<br><br>
                            <strong>访问链接：</strong><br>
                            <a href="${accessUrl}" target="_blank" style="color: #007bff; word-break: break-all;">${accessUrl}</a><br><br>
                            <small>点击链接即可开始使用您的临时邮箱</small>
                        </div>
                    `, 'info', 10000);

                    // 同时显示一个"立即访问"按钮
                    setTimeout(() => {
                        const accessButton = document.createElement('button');
                        accessButton.className = 'btn btn-primary';
                        accessButton.innerHTML = '<i class="fas fa-external-link-alt"></i> 立即访问邮箱';
                        accessButton.style.cssText = `
                            position: fixed;
                            top: 20px;
                            right: 20px;
                            z-index: 1000;
                            padding: 10px 20px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            border: none;
                            border-radius: 25px;
                            color: white;
                            cursor: pointer;
                            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                            transition: all 0.3s ease;
                        `;
                        accessButton.onmouseover = () => accessButton.style.transform = 'translateY(-2px)';
                        accessButton.onmouseout = () => accessButton.style.transform = 'translateY(0)';
                        accessButton.onclick = () => window.open(accessUrl, '_blank');

                        document.body.appendChild(accessButton);

                        // 10秒后自动隐藏按钮
                        setTimeout(() => {
                            if (accessButton.parentNode) {
                                accessButton.style.opacity = '0';
                                accessButton.style.transform = 'translateY(-20px)';
                                setTimeout(() => accessButton.remove(), 300);
                            }
                        }, 10000);
                    }, 2000);

                } else {
                    // 没有邮箱创建成功，显示错误信息
                    this.showToast('邮箱创建失败，请稍后重试', 'warning', 3000);
                }
            } else {
                throw new Error(result.error || '注册失败');
            }

        } catch (error) {
            console.error('注册错误:', error);
            this.showToast(error.message || '注册失败，请稍后重试', 'error');
            this.hideProgress();
        } finally {
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