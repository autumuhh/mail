// 邮箱登录页面功能

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const addressInput = document.getElementById('mailbox-address');
    const keyInput = document.getElementById('mailbox-key');
    
    // 表单提交处理
    loginForm.addEventListener('submit', handleLogin);
    
    // 输入框回车处理
    addressInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            keyInput.focus();
        }
    });
    
    keyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin(e);
        }
    });
    
    // 自动填充保存的信息
    loadSavedCredentials();
});

async function handleLogin(event) {
    event.preventDefault();
    
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
    
    // 显示加载状态
    setLoadingState(true);
    
    try {
        // 获取访问令牌
        const response = await fetch('/get_mailbox_token', {
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

function togglePasswordVisibility() {
    const keyInput = document.getElementById('mailbox-key');
    const toggleIcon = document.getElementById('password-toggle-icon');
    
    if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleIcon.className = 'fas fa-eye-slash';
    } else {
        keyInput.type = 'password';
        toggleIcon.className = 'fas fa-eye';
    }
}

function isValidEmail(email) {
    // 允许localhost等不带点号的域名
    const emailRegex = /^[^\s@]+@[^\s@]+(\.[^\s@]+)*$/;
    return emailRegex.test(email);
}

function loadSavedCredentials() {
    const savedAddress = localStorage.getItem('tempmail_address');
    const savedKey = localStorage.getItem('tempmail_mailbox_key');
    
    if (savedAddress) {
        document.getElementById('mailbox-address').value = savedAddress;
    }
    
    if (savedKey) {
        document.getElementById('mailbox-key').value = savedKey;
    }
    
    // 如果都有保存的信息，聚焦到登录按钮
    if (savedAddress && savedKey) {
        document.getElementById('login-btn').focus();
    } else if (savedAddress) {
        document.getElementById('mailbox-key').focus();
    } else {
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
        document.getElementById('mailbox-address').value = '';
        document.getElementById('mailbox-key').value = '';
        document.getElementById('mailbox-address').focus();
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
    const address = document.getElementById('mailbox-address').value.trim();
    const key = document.getElementById('mailbox-key').value.trim();
    const loginBtn = document.getElementById('login-btn');
    
    const isValid = address && key && isValidEmail(address);
    
    if (isValid) {
        loginBtn.style.opacity = '1';
        loginBtn.style.cursor = 'pointer';
    } else {
        loginBtn.style.opacity = '0.7';
        loginBtn.style.cursor = 'not-allowed';
    }
    
    return isValid;
}

// 实时验证
document.getElementById('mailbox-address').addEventListener('input', validateForm);
document.getElementById('mailbox-key').addEventListener('input', validateForm);

// 初始验证
validateForm();
