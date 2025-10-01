// 邮箱登录页面功能

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const modeButtons = document.querySelectorAll('.mode-btn');

    // 当前登录模式
    let currentMode = 'mailbox';

    // 登录模式切换
    modeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const mode = this.dataset.mode;

            // 更新按钮状态
            modeButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // 切换表单显示
            switchMode(mode);

            // 更新当前模式
            currentMode = mode;
        });
    });

    // 表单提交处理
    loginForm.addEventListener('submit', handleLogin);

    // 检查是否有自动登录参数
    checkAutoLogin();

    // 自动填充保存的信息
    loadSavedCredentials();

    // 设置验证监听器
    setupValidationListeners();
});

async function handleLogin(event) {
    event.preventDefault();

    if (currentMode === 'mailbox') {
        // 邮箱密钥登录
        const address = document.getElementById('mailbox-address').value.trim();
        const key = document.getElementById('mailbox-key').value.trim();

        if (!address || !key) {
            showToast('error', '输入错误', '请填写完整的邮箱地址和密钥');
            return;
        }

        // 验证邮箱格式
        if (!isValidEmail(address)) {
            showToast('error', '格式错误', '请输入有效的邮箱地址');
            return;
        }

        await handleMailboxLogin(address, key);
    } else {
        // 用户密码登录
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('user-password').value.trim();

        if (!username || !password) {
            showToast('error', '输入错误', '请填写完整的用户名和密码');
            return;
        }

        await handleUserLogin(username, password);
    }
}

async function handleMailboxLogin(address, key) {
    // 显示加载状态
    setLoadingState(true);

    try {
        // 获取访问令牌
        const response = await fetch('/api/get_mailbox_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: address,
                mailbox_key: key
            })
        });

        const data = await response.json();

        if (data.success) {
            // 保存认证信息到localStorage
            localStorage.setItem('tempmail_access_token', data.access_token);
            localStorage.setItem('tempmail_address', address);
            localStorage.setItem('tempmail_mailbox_key', key);

            showToast('success', '登录成功', '正在跳转到邮箱管理页面...');

            // 延迟跳转，让用户看到成功提示
            setTimeout(() => {
                window.location.href = `/mailbox?address=${encodeURIComponent(address)}&token=${encodeURIComponent(data.access_token)}`;
            }, 1000);

        } else {
            showToast('error', '登录失败', data.message || '请检查邮箱地址和密钥是否正确');
        }
    } catch (error) {
        console.error('登录失败:', error);
        showToast('error', '网络错误', '请检查网络连接后重试');
    } finally {
        setLoadingState(false);
    }
}

async function handleUserLogin(username, password) {
    // 显示加载状态
    setLoadingState(true);

    try {
        // 用户密码登录
        const response = await fetch('/api/user_login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        const data = await response.json();

        if (data.success) {
            // 保存用户信息到localStorage
            localStorage.setItem('tempmail_user_id', data.user.id);
            localStorage.setItem('tempmail_username', data.user.username);

            showToast('success', '登录成功', data.message || '正在跳转到邮箱管理页面...');

            // 如果用户只有一个邮箱，直接跳转到该邮箱
            if (data.mailboxes.length === 1) {
                const mailbox = data.mailboxes[0];
                setTimeout(() => {
                    window.location.href = `/mailbox?address=${encodeURIComponent(mailbox.address)}&token=${encodeURIComponent(mailbox.access_token)}`;
                }, 1000);
            } else if (data.mailboxes.length > 1) {
                // 如果用户有多个邮箱，跳转到邮箱选择页面或第一个邮箱
                const mailbox = data.mailboxes[0];
                setTimeout(() => {
                    window.location.href = `/mailbox?address=${encodeURIComponent(mailbox.address)}&token=${encodeURIComponent(mailbox.access_token)}`;
                }, 1000);
            } else {
                showToast('warning', '无邮箱', '您还没有创建任何邮箱，请先创建一个邮箱');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            }

        } else {
            showToast('error', '登录失败', data.message || '请检查用户名和密码是否正确');
        }
    } catch (error) {
        console.error('登录失败:', error);
        showToast('error', '网络错误', '请检查网络连接后重试');
    } finally {
        setLoadingState(false);
    }
}

function setLoadingState(loading) {
    const loginBtn = document.getElementById('login-btn');
    const btnText = loginBtn.querySelector('span');
    const btnIcon = loginBtn.querySelector('i:not(.loading-spinner i)');
    const spinner = loginBtn.querySelector('.loading-spinner');
    
    if (loading) {
        loginBtn.disabled = true;
        btnText.style.opacity = '0';
        btnIcon.style.opacity = '0';
        spinner.style.display = 'block';
    } else {
        loginBtn.disabled = false;
        btnText.style.opacity = '1';
        btnIcon.style.opacity = '1';
        spinner.style.display = 'none';
    }
}

function switchMode(mode) {
    // 隐藏所有模式
    document.querySelectorAll('.login-mode').forEach(modeDiv => {
        modeDiv.classList.remove('active');
    });

    // 显示选中的模式
    document.querySelector(`.${mode}-mode`).classList.add('active');

    // 更新当前模式
    currentMode = mode;

    // 重新设置验证监听器
    setupValidationListeners();
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const toggleIcon = document.getElementById(`${inputId}-toggle-icon`);

    if (input.type === 'password') {
        input.type = 'text';
        toggleIcon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        toggleIcon.className = 'fas fa-eye';
    }
}

function isValidEmail(email) {
    // 允许localhost等不带点号的域名
    const emailRegex = /^[^\s@]+@[^\s@]+(\.[^\s@]+)*$/;
    return emailRegex.test(email);
}

function checkAutoLogin() {
    // 检查URL参数是否有自动登录信息
    const urlParams = new URLSearchParams(window.location.search);
    const autoLogin = urlParams.get('auto_login');
    const username = urlParams.get('username');

    if (autoLogin === 'true' && username) {
        // 有自动登录参数，切换到用户密码登录模式
        switchMode('user');

        // 尝试从localStorage获取密码
        const savedPassword = localStorage.getItem('auto_login_password');

        if (savedPassword) {
            // 自动填写用户名和密码
            document.getElementById('username').value = username;
            document.getElementById('user-password').value = savedPassword;

            // 显示自动登录提示
            showToast('info', '自动登录', '正在自动登录您的账户...', 2000);

            // 自动触发登录
            setTimeout(() => {
                handleLogin(new Event('submit'));
            }, 1000);
        } else {
            // 没有保存的密码，显示错误
            showToast('error', '自动登录失败', '未找到登录凭证，请手动登录');
        }
    }
}

function loadSavedCredentials() {
    // 检查是否有保存的邮箱登录信息
    const savedAddress = localStorage.getItem('tempmail_address');
    const savedKey = localStorage.getItem('tempmail_mailbox_key');

    // 检查是否有保存的用户登录信息
    const savedUsername = localStorage.getItem('tempmail_username');

    if (savedAddress && savedKey) {
        // 有邮箱登录信息，默认显示邮箱密钥登录模式
        switchMode('mailbox');
        document.getElementById('mailbox-address').value = savedAddress;
        document.getElementById('mailbox-key').value = savedKey;
        document.getElementById('login-btn').focus();
    } else if (savedUsername) {
        // 有用户登录信息，显示用户密码登录模式
        switchMode('user');
        document.getElementById('username').value = savedUsername;
        document.getElementById('user-password').focus();
    } else {
        // 没有保存的登录信息，默认显示邮箱密钥登录模式
        switchMode('mailbox');
        document.getElementById('mailbox-address').focus();
    }
}

function showToast(type, title, message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${iconMap[type]}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    // 显示动画
    setTimeout(() => toast.classList.add('show'), 100);
    
    // 自动移除
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// 键盘快捷键
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + Enter 快速登录
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const form = document.getElementById('login-form');
        form.dispatchEvent(new Event('submit'));
    }
    
    // ESC 清空表单
    if (e.key === 'Escape') {
        if (currentMode === 'mailbox') {
            document.getElementById('mailbox-address').value = '';
            document.getElementById('mailbox-key').value = '';
            document.getElementById('mailbox-address').focus();
        } else {
            document.getElementById('username').value = '';
            document.getElementById('user-password').value = '';
            document.getElementById('username').focus();
        }
    }
});

// 页面可见性变化时的处理
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // 页面重新可见时，检查是否有保存的登录状态
        const token = localStorage.getItem('tempmail_access_token');
        const address = localStorage.getItem('tempmail_address');
        
        if (token && address) {
            // 如果有有效的登录状态，询问是否直接跳转
            if (confirm('检测到您已登录，是否直接跳转到邮箱管理页面？')) {
                window.location.href = `/mailbox?address=${encodeURIComponent(address)}&token=${encodeURIComponent(token)}`;
            }
        }
    }
});

// 表单验证增强
function validateForm() {
    const loginBtn = document.getElementById('login-btn');
    let isValid = false;

    if (currentMode === 'mailbox') {
        const address = document.getElementById('mailbox-address').value.trim();
        const key = document.getElementById('mailbox-key').value.trim();
        isValid = address && key && isValidEmail(address);
    } else {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('user-password').value.trim();
        isValid = username && password;
    }

    if (isValid) {
        loginBtn.style.opacity = '1';
        loginBtn.style.cursor = 'pointer';
    } else {
        loginBtn.style.opacity = '0.7';
        loginBtn.style.cursor = 'not-allowed';
    }

    return isValid;
}

// 实时验证 - 根据当前模式添加事件监听
function setupValidationListeners() {
    // 清除所有输入框的验证监听器
    const inputs = ['mailbox-address', 'mailbox-key', 'username', 'user-password'];
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.removeEventListener('input', validateForm);
        }
    });

    // 根据当前模式添加新的监听器
    if (currentMode === 'mailbox') {
        const addressInput = document.getElementById('mailbox-address');
        const keyInput = document.getElementById('mailbox-key');
        if (addressInput) addressInput.addEventListener('input', validateForm);
        if (keyInput) keyInput.addEventListener('input', validateForm);
    } else {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('user-password');
        if (usernameInput) usernameInput.addEventListener('input', validateForm);
        if (passwordInput) passwordInput.addEventListener('input', validateForm);
    }
}

// 初始验证
validateForm();

// 初始验证
validateForm();
