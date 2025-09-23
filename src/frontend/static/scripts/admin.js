document.addEventListener("DOMContentLoaded", () => {
    // Elements
    const loginSection = document.getElementById('login-section');
    const adminPanel = document.getElementById('admin-panel');
    const quickAdd = document.getElementById('quick-add');
    const quickActions = document.getElementById('quick-actions');
    const loginBtn = document.getElementById('login-btn');
    const adminPassword = document.getElementById('admin-password');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    
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
    adminPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
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
            showError(loginError, 'Please enter password');
            return;
        }

        // Disable login button during operation
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';
        loginError.style.display = 'none';

        try {
            const response = await fetch('/admin/whitelist', {
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
                showError(loginError, data.error || 'Login failed');
            }
        } catch (error) {
            showError(loginError, 'Connection error');
        } finally {
            // Re-enable login button
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
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
            reloadBtn.textContent = 'Loading...';
        }

        try {
            const response = await fetch('/admin/whitelist', {
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
                    showStatus('Settings reloaded successfully', 'success');
                }
            } else {
                showStatus('Failed to load settings', 'error');
            }
        } catch (error) {
            showStatus('Connection error', 'error');
        } finally {
            // Re-enable reload button
            if (reloadBtn) {
                reloadBtn.disabled = false;
                reloadBtn.textContent = 'Reload';
            }
        }
    }
    
    async function saveSettings() {
        // Disable save button during operation
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const settings = {
            enabled: whitelistEnabled.checked,
            whitelist: whitelistIps.value.trim()
        };

        console.log('[DEBUG] Saving settings:', settings);

        try {
            const response = await fetch('/admin/whitelist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': currentPassword
                },
                body: JSON.stringify(settings)
            });

            const data = await response.json();

            if (response.ok) {
                showStatus(data.message, 'success');
            } else {
                showStatus(data.error || 'Save failed', 'error');
            }
        } catch (error) {
            showStatus('Connection error', 'error');
        } finally {
            // Re-enable save button
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Settings';
        }
    }
    
    async function testIp() {
        const testIp = testIpInput.value.trim();
        if (!testIp) {
            showTestResult('Please enter an IP address', 'error');
            return;
        }

        // Disable test button during operation
        testIpBtn.disabled = true;
        testIpBtn.textContent = 'Testing...';

        const settings = {
            ip: testIp,
            enabled: whitelistEnabled.checked,
            whitelist: whitelistIps.value.trim()
        };

        try {
            const response = await fetch('/admin/test_ip', {
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
                showTestResult(data.error || 'Test failed', 'error');
            }
        } catch (error) {
            showTestResult('Connection error', 'error');
        } finally {
            // Re-enable test button
            testIpBtn.disabled = false;
            testIpBtn.textContent = 'Test';
        }
    }
    
    function addToWhitelist(ip) {
        if (!ip || !ip.trim()) {
            showStatus('Invalid IP address', 'error');
            return;
        }

        const currentList = whitelistIps.value.trim();
        const ips = currentList ? currentList.split('\n').map(s => s.trim()).filter(s => s) : [];

        if (!ips.includes(ip)) {
            ips.push(ip);
            whitelistIps.value = ips.join('\n');
            showStatus(`Added ${ip} to whitelist`, 'success');
        } else {
            showStatus(`${ip} is already in whitelist`, 'warning');
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
});
