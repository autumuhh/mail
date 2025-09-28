document.addEventListener("DOMContentLoaded", () => {
    // Elements
    const loginSection = document.getElementById('login-section');
    const registerSection = document.getElementById('register-section');
    const adminPanel = document.getElementById('admin-panel');
    const quickAdd = document.getElementById('quick-add');
    const quickActions = document.getElementById('quick-actions');
    const loginBtn = document.getElementById('login-btn');
    const showRegisterBtn = document.getElementById('show-register-btn');
    const backToLoginBtn = document.getElementById('back-to-login-btn');
    const registerBtn = document.getElementById('register-btn');
    const adminPassword = document.getElementById('admin-password');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    const registerSuccess = document.getElementById('register-success');
    const logoutBtn = document.getElementById('logout-btn');

    // Register form elements
    const registerUsername = document.getElementById('register-username');
    const registerEmail = document.getElementById('register-email');
    const registerPassword = document.getElementById('register-password');
    const registerConfirmPassword = document.getElementById('register-confirm-password');
    const registerInviteCode = document.getElementById('register-invite-code');
    
    const whitelistEnabled = document.getElementById('whitelist-enabled');
    const whitelistIps = document.getElementById('whitelist-ips');
    const currentIpSpan = document.getElementById('current-ip');
    const testIpInput = document.getElementById('test-ip');
    const testIpBtn = document.getElementById('test-ip-btn');
    const testResult = document.getElementById('test-result');
    const saveBtn = document.getElementById('save-btn');
    const reloadBtn = document.getElementById('reload-btn');
    const statusMessage = document.getElementById('status-message');
    
    let currentPassword = '';

    // 检查是否已登录
    if (sessionStorage.getItem('admin_authenticated') === 'true') {
        const savedPassword = sessionStorage.getItem('admin_password');
        if (savedPassword) {
            currentPassword = savedPassword;
            loginSection.style.display = 'none';
            adminPanel.style.display = 'block';
            quickAdd.style.display = 'block';
            quickActions.style.display = 'block';
            loadSettings();
        }
    }

    // Event Listeners
    loginBtn.addEventListener('click', login);
    logoutBtn.addEventListener('click', logout);
    showRegisterBtn.addEventListener('click', showRegisterForm);
    backToLoginBtn.addEventListener('click', showLoginForm);
    registerBtn.addEventListener('click', register);

    adminPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });

    registerUsername.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') register();
    });
    registerEmail.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') register();
    });
    registerPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') register();
    });
    registerConfirmPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') register();
    });
    registerInviteCode.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') register();
    });

    testIpInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') testIp();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 's':
                    e.preventDefault();
                    if (adminPanel.style.display !== 'none') {
                        saveSettings();
                    }
                    break;
                case 'r':
                    e.preventDefault();
                    if (adminPanel.style.display !== 'none') {
                        loadSettings();
                    }
                    break;
            }
        }
    });
    
    saveBtn.addEventListener('click', saveSettings);
    reloadBtn.addEventListener('click', loadSettings);
    testIpBtn.addEventListener('click', testIp);

    // 开关状态变化监听
    whitelistEnabled.addEventListener('change', function() {
        console.log('[DEBUG] Toggle changed to:', this.checked);
    });
    
    // Quick add buttons - use event delegation to handle dynamically loaded content
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('quick-add-btn')) {
            const ip = e.target.dataset.ip;
            if (ip) {
                addToWhitelist(ip);
            }
        }
    });
    
    // Functions
    async function login() {
        const password = adminPassword.value.trim();
        if (!password) {
            showError(loginError, '请输入密码');
            return;
        }

        // Disable login button during operation
        loginBtn.disabled = true;
        loginBtn.textContent = '登录中...';
        loginError.style.display = 'none';

        try {
            const response = await fetch('/api/admin/whitelist', {
                headers: {
                    'Authorization': password
                }
            });

            if (response.ok) {
                currentPassword = password;
                // 保存登录状态到sessionStorage
                sessionStorage.setItem('admin_authenticated', 'true');
                sessionStorage.setItem('admin_password', password);
                sessionStorage.setItem('api_test_authenticated', 'true'); // 同时设置api-test认证

                loginSection.style.display = 'none';
                adminPanel.style.display = 'block';
                quickAdd.style.display = 'block';
                quickActions.style.display = 'block';
                await loadSettings();
            } else {
                const data = await response.json();
                showError(loginError, data.error || '登录失败');
            }
        } catch (error) {
            showError(loginError, '连接错误');
        } finally {
            // Re-enable login button
            loginBtn.disabled = false;
            loginBtn.textContent = '登录';
        }
    }

    function logout() {
        // 清除所有登录状态
        sessionStorage.removeItem('admin_authenticated');
        sessionStorage.removeItem('admin_password');
        sessionStorage.removeItem('api_test_authenticated');

        // 重置界面
        currentPassword = '';
        adminPassword.value = '';
        loginSection.style.display = 'block';
        adminPanel.style.display = 'none';
        quickAdd.style.display = 'none';
        quickActions.style.display = 'none';

        // 清空表单
        whitelistIps.value = '';
        whitelistEnabled.checked = false;
        testIpInput.value = '';

        showStatus('已退出登录', 'info');
    }

    async function loadSettings() {
        // Disable reload button during operation
        if (reloadBtn) {
            reloadBtn.disabled = true;
            reloadBtn.textContent = '加载中...';
        }

        try {
            const response = await fetch('/api/admin/whitelist', {
                headers: {
                    'Authorization': currentPassword
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('[DEBUG] Loaded settings:', data);
                whitelistEnabled.checked = data.enabled;
                console.log('[DEBUG] Checkbox checked:', whitelistEnabled.checked);
                whitelistIps.value = data.whitelist;
                currentIpSpan.textContent = data.current_ip;
                testIpInput.value = data.current_ip;

                if (reloadBtn) {
                    showStatus('设置重新加载成功', 'success');
                }
            } else {
                showStatus('加载设置失败', 'error');
            }
        } catch (error) {
            showStatus('连接错误', 'error');
        } finally {
            // Re-enable reload button
            if (reloadBtn) {
                reloadBtn.disabled = false;
                reloadBtn.textContent = '重新加载';
            }
        }
    }
    
    async function saveSettings() {
        // Disable save button during operation
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';

        const settings = {
            enabled: whitelistEnabled.checked,
            whitelist: whitelistIps.value.trim()
        };


        try {
            const response = await fetch('/api/admin/whitelist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': currentPassword
                },
                body: JSON.stringify(settings)
            });

            const data = await response.json();

            if (response.ok) {
                showStatus('设置保存成功', 'success');
            } else {
                showStatus(data.error || '保存失败', 'error');
            }
        } catch (error) {
            showStatus('连接错误', 'error');
        } finally {
            // Re-enable save button
            saveBtn.disabled = false;
            saveBtn.textContent = '保存设置';
        }
    }
    
    async function testIp() {
        const testIp = testIpInput.value.trim();
        if (!testIp) {
            showTestResult('请输入IP地址', 'error');
            return;
        }

        // Disable test button during operation
        testIpBtn.disabled = true;
        testIpBtn.textContent = '测试中...';

        const settings = {
            ip: testIp,
            enabled: whitelistEnabled.checked,
            whitelist: whitelistIps.value.trim()
        };

        try {
            const response = await fetch('/api/admin/test_ip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': currentPassword
                },
                body: JSON.stringify(settings)
            });

            const data = await response.json();

            if (response.ok) {
                const resultClass = data.allowed ? 'success' : 'error';
                showTestResult(`${data.ip}: ${data.message}`, resultClass);
            } else {
                showTestResult(data.error || '测试失败', 'error');
            }
        } catch (error) {
            showTestResult('连接错误', 'error');
        } finally {
            // Re-enable test button
            testIpBtn.disabled = false;
            testIpBtn.textContent = '测试';
        }
    }
    
    function addToWhitelist(ip) {
        if (!ip || !ip.trim()) {
            showStatus('无效的IP地址', 'error');
            return;
        }

        const currentList = whitelistIps.value.trim();
        const ips = currentList ? currentList.split('\n').map(s => s.trim()).filter(s => s) : [];

        if (!ips.includes(ip)) {
            ips.push(ip);
            whitelistIps.value = ips.join('\n');
            showStatus(`已将 ${ip} 添加到白名单`, 'success');
        } else {
            showStatus(`${ip} 已在白名单中`, 'warning');
        }
    }
    
    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
    
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';
        
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 5000);
    }
    
    function showTestResult(message, type) {
        testResult.textContent = message;
        testResult.className = `test-result ${type}`;
        testResult.style.display = 'block';

        setTimeout(() => {
            testResult.style.display = 'none';
        }, 5000);
    }

    // Register functions
    function showRegisterForm() {
        // 跳转到注册页面
        window.location.href = '/register';
    }

    function showLoginForm() {
        registerSection.style.display = 'none';
        loginSection.style.display = 'block';
        adminPanel.style.display = 'none';
        quickAdd.style.display = 'none';
        quickActions.style.display = 'none';
        hideMessages();
    }

    function hideMessages() {
        if (registerError) registerError.style.display = 'none';
        if (registerSuccess) registerSuccess.style.display = 'none';
        if (loginError) loginError.style.display = 'none';
    }

    async function register() {
        const username = registerUsername.value.trim();
        const email = registerEmail.value.trim();
        const password = registerPassword.value;
        const confirmPassword = registerConfirmPassword.value;
        const inviteCode = registerInviteCode.value.trim();

        // Validation
        if (!username) {
            showRegisterError('请输入用户名');
            return;
        }
        if (!email) {
            showRegisterError('请输入邮箱地址');
            return;
        }
        if (!password) {
            showRegisterError('请输入密码');
            return;
        }
        if (password !== confirmPassword) {
            showRegisterError('两次输入的密码不一致');
            return;
        }
        if (!inviteCode) {
            showRegisterError('请输入邀请码');
            return;
        }

        // Disable register button during operation
        registerBtn.disabled = true;
        registerBtn.textContent = '注册中...';
        hideMessages();

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                    invite_code: inviteCode
                })
            });

            const data = await response.json();

            if (response.ok) {
                showRegisterSuccess('注册成功！请返回登录页面使用新账号登录。');
            } else {
                showRegisterError(data.error || '注册失败');
            }
        } catch (error) {
            showRegisterError('连接错误，请稍后重试');
        } finally {
            // Re-enable register button
            registerBtn.disabled = false;
            registerBtn.textContent = '注册';
        }
    }

    function showRegisterError(message) {
        if (registerError) {
            registerError.textContent = message;
            registerError.style.display = 'block';
        }
    }

    function showRegisterSuccess(message) {
        if (registerSuccess) {
            registerSuccess.textContent = message;
            registerSuccess.style.display = 'block';
        }
    }
});
