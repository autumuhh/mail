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
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirm-password');

        if (usernameInput) {
            usernameInput.addEventListener('input', () => this.validateUsername());
        }
        if (emailInput) {
            emailInput.addEventListener('input', () => this.validateEmail());
        }
        if (passwordInput) {
            passwordInput.addEventListener('input', () => this.validatePassword());
        }
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', () => this.validateConfirmPassword());
        }

        // 密码强度检查
        if (passwordInput) {
            passwordInput.addEventListener('input', () => this.checkPasswordStrength());
        }
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

    // 切换密码显示/隐藏
    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        const toggleIcon = document.getElementById(`${inputId}-toggle-icon`);

        if (input.type === 'password') {
            input.type = 'text';
            toggleIcon.classList.remove('fa-eye');
            toggleIcon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            toggleIcon.classList.remove('fa-eye-slash');
            toggleIcon.classList.add('fa-eye');
        }
    }

    // 验证用户名
    validateUsername() {
        const username = document.getElementById('username').value;
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;

        if (username && !usernameRegex.test(username)) {
            this.showToast('用户名只能包含字母、数字和下划线，长度3-20位', 'warning', 3000);
            return false;
        }
        return true;
    }

    // 验证邮箱
    validateEmail() {
        const email = document.getElementById('email').value;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (email && !emailRegex.test(email)) {
            this.showToast('请输入有效的邮箱地址', 'warning', 3000);
            return false;
        }
        return true;
    }

    // 验证密码
    validatePassword() {
        const password = document.getElementById('password').value;

        if (password.length < 8) {
            return false;
        }
        return true;
    }

    // 验证确认密码
    validateConfirmPassword() {
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (password !== confirmPassword) {
            this.showToast('两次输入的密码不一致', 'warning', 3000);
            return false;
        }
        return true;
    }

    // 检查密码强度
    checkPasswordStrength() {
        const password = document.getElementById('password').value;
        let strength = 0;
        let feedback = [];

        if (password.length >= 8) strength += 25;
        else feedback.push('至少8个字符');

        if (/[a-z]/.test(password)) strength += 25;
        else feedback.push('包含小写字母');

        if (/[A-Z]/.test(password)) strength += 25;
        else feedback.push('包含大写字母');

        if (/[0-9]/.test(password)) strength += 25;
        else feedback.push('包含数字');

        // 显示密码强度指示器（如果需要的话）
        return { strength, feedback };
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
        // 检查管理员是否已验证
        if (!this.isAdminAuthenticated) {
            this.showToast('请先验证管理员身份', 'warning');
            return;
        }

        const formData = new FormData(this.form);
        const data = {
            username: formData.get('username').trim(),
            email: formData.get('email').trim(),
            password: formData.get('password'),
            create_mailbox: formData.get('create-mailbox') === 'on',
            agree_terms: formData.get('agree-terms') === 'on'
        };

        // 基础验证
        if (!data.username || !data.password) {
            this.showToast('请填写所有必需字段', 'error');
            return;
        }

        if (!data.agree_terms) {
            this.showToast('请同意服务条款和隐私政策', 'warning');
            return;
        }

        // 字段验证
        if (!this.validateUsername() || !this.validateEmail() || !this.validateConfirmPassword()) {
            return;
        }

        if (data.password.length < 8) {
            this.showToast('密码长度至少8位', 'warning');
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
            this.showProgress('正在创建账户...', 25);

            // 发送注册请求
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showProgress('账户创建成功！', 75);

                // 如果同时创建邮箱
                if (data.create_mailbox && result.mailbox_created) {
                    this.showProgress('正在创建临时邮箱...', 90);

                    // 等待一下让用户看到进度
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    this.showToast('账户和邮箱创建成功！正在跳转...', 'success', 2000);

                    // 显示邮箱信息
                    this.showToast(`您的邮箱地址：${result.mailbox_address}<br>请保存好您的邮箱密钥：<br><strong>${result.mailbox_key}</strong>`, 'info', 8000);

                    // 跳转到邮箱管理页面
                    setTimeout(() => {
                        window.location.href = `/mailbox?address=${encodeURIComponent(result.mailbox_address)}&token=${encodeURIComponent(result.access_token)}`;
                    }, 3000);
                } else {
                    this.showToast('账户创建成功！正在跳转到登录页面...', 'success', 2000);

                    // 跳转到登录页面
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
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
            btnText.textContent = '创建账户';
            loadingSpinner.style.display = 'none';
        }
    }
}

// 全局函数供HTML调用
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const toggleIcon = document.getElementById(`${inputId}-toggle-icon`);

    if (input.type === 'password') {
        input.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new RegisterManager();
});

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RegisterManager;
}