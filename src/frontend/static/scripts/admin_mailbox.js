// 邮箱管理系统 - 前端逻辑

class AdminMailboxManager {
    constructor() {
        this.authToken = localStorage.getItem('admin_token');
        this.currentView = 'login';
        this.currentPage = 1;
        this.pageSize = 20;
        this.currentStatus = 'all';
        this.currentSource = 'all';
        this.searchQuery = '';
        this.registerMode = 'single';
        this.init();
    }
    
    init() {
        // 检查是否已登录
        if (this.authToken) {
            this.showMainContent();
            this.loadStats();
            this.startClock();
        } else {
            this.showLoginView();
        }

        // 绑定事件
        this.bindEvents();
    }

    startClock() {
        const updateTime = () => {
            const now = new Date();
            const timeString = now.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            const timeElement = document.getElementById('current-time');
            if (timeElement) {
                timeElement.textContent = timeString;
            }
        };
        updateTime();
        setInterval(updateTime, 1000);
    }
    
    bindEvents() {
        // 登录表单
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }
        
        // 导航菜单
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // 跳过外部链接
                if (item.classList.contains('nav-link')) {
                    return;
                }
                const view = e.currentTarget.dataset.view;
                if (view) {
                    this.switchView(view);
                }
            });
        });
        
        // 筛选按钮
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentStatus = e.currentTarget.dataset.status;
                this.currentPage = 1;
                this.loadMailboxes();
            });
        });
        
        // 搜索输入
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchQuery = e.target.value;
                    this.currentPage = 1;
                    this.loadMailboxes();
                }, 500);
            });
        }

        // 注册表单
        const registerForm = document.getElementById('admin-register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }

        // 随机生成按钮
        const randomBtn = document.getElementById('reg-random-btn');
        if (randomBtn) {
            randomBtn.addEventListener('click', () => {
                this.generateRandomEmailPrefix();
            });
        }

        // 注册模式切换
        document.querySelectorAll('#register-mode-switch .mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.setRegisterMode(mode);
            });
        });
    }

    async generateRandomEmailPrefix() {
        // 生成可读用户名：英文名 + 数字
        const namePool = [
            'alex', 'emma', 'luna', 'oliver', 'mia',
            'liam', 'sophia', 'james', 'ava', 'henry',
            'grace', 'david', 'ella', 'lucas', 'nora'
        ];
        const selectedWord = namePool[Math.floor(Math.random() * namePool.length)];
        const numberPart = Math.floor(1000 + Math.random() * 9000); // 1000-9999
        const result = `${selectedWord}${numberPart}`;

        // 设置到输入框
        const prefixInput = document.getElementById('reg-email-prefix');
        if (prefixInput) {
            prefixInput.value = result;
        }

        // 加载域名列表并随机选择一个
        await this.loadAvailableDomains(true);
    }

    async loadAvailableDomains(randomSelect = false) {
        try {
            const domains = await this.fetchAvailableDomains();
            const domainSelect = document.getElementById('reg-email-domain');

            if (domainSelect && domains && domains.length > 0) {
                // 清空现有选项
                domainSelect.innerHTML = '<option value="">选择域名...</option>';

                // 添加域名选项
                domains.forEach(domain => {
                    const option = document.createElement('option');
                    option.value = domain;
                    option.textContent = domain;
                    domainSelect.appendChild(option);
                });

                // 如果需要随机选择域名
                if (randomSelect) {
                    const randomIndex = Math.floor(Math.random() * domains.length);
                    domainSelect.value = domains[randomIndex];
                }
            }
        } catch (error) {
            console.error('加载域名列表失败:', error);
        }
    }

    async fetchAvailableDomains() {
        try {
            const response = await fetch('/api/get_random_address');
            const data = await response.json();
            return data.available_domains || [];
        } catch (error) {
            console.error('获取域名失败:', error);
            return [];
        }
    }

    setRegisterMode(mode) {
        this.registerMode = mode === 'batch' ? 'batch' : 'single';

        document.querySelectorAll('#register-mode-switch .mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === this.registerMode);
        });

        const batchOptions = document.getElementById('reg-batch-options');
        if (batchOptions) {
            batchOptions.style.display = this.registerMode === 'batch' ? 'block' : 'none';
        }
    }

    isValidUsername(username) {
        return /^[a-zA-Z0-9]{3,20}$/.test(username);
    }

    buildBatchAddresses(prefix, domain, count) {
        const suffixLen = Math.max(2, String(count).length);
        const maxPrefixLen = 20 - suffixLen;

        if (!/^[a-zA-Z0-9]+$/.test(prefix)) {
            throw new Error('批量前缀只能包含英文和数字');
        }

        if (prefix.length < 1 || prefix.length > maxPrefixLen) {
            throw new Error(`当前数量下，前缀长度需为1-${maxPrefixLen}`);
        }

        const addresses = [];
        for (let index = 1; index <= count; index++) {
            const username = `${prefix}${index.toString().padStart(suffixLen, '0')}`;
            if (!this.isValidUsername(username)) {
                throw new Error(`生成的用户名不合法: ${username}`);
            }
            addresses.push(`${username}@${domain}`);
        }

        return addresses;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async login() {
        const password = document.getElementById('admin-password').value;
        const errorDiv = document.getElementById('login-error');
        
        if (!password) {
            this.showError(errorDiv, '请输入密码');
            return;
        }
        
        // 保存token
        this.authToken = password;
        localStorage.setItem('admin_token', password);
        
        // 验证token
        try {
            const response = await this.apiRequest('/api/admin/stats');
            if (response.success) {
                this.showMainContent();
                this.loadStats();
            } else {
                throw new Error('认证失败');
            }
        } catch (error) {
            this.authToken = null;
            localStorage.removeItem('admin_token');
            this.showError(errorDiv, '密码错误');
        }
    }
    
    logout() {
        this.authToken = null;
        localStorage.removeItem('admin_token');
        this.showLoginView();
    }
    
    showLoginView() {
        document.getElementById('login-view').style.display = 'flex';
        document.querySelectorAll('.view:not(#login-view)').forEach(view => {
            view.style.display = 'none';
        });
        document.querySelector('.sidebar').style.display = 'none';
    }
    
    showMainContent() {
        document.getElementById('login-view').style.display = 'none';
        document.querySelector('.sidebar').style.display = 'flex';
        this.switchView('dashboard');
    }
    
    switchView(viewName) {
        // 更新导航状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        // 更新视图显示
        document.querySelectorAll('.view').forEach(view => {
            view.style.display = 'none';
        });

        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.style.display = 'block';
        }

        this.currentView = viewName;

        // 加载对应数据
        if (viewName === 'dashboard') {
            this.loadStats();
        } else if (viewName === 'security') {
            refreshSecurityInfo();
        } else if (viewName === 'mailboxes') {
            this.loadMailboxes();
        } else if (viewName === 'audit') {
            this.loadAuditLogs();
        } else if (viewName === 'sub-admins') {
            loadSubAdmins();
        } else if (viewName === 'register') {
            // 重置注册表单
            const form = document.getElementById('admin-register-form');
            if (form) {
                form.reset();
                form.style.display = 'block';
                this.setRegisterMode('single');
                // 清空邮箱输入
                const prefixInput = document.getElementById('reg-email-prefix');
                const domainSelect = document.getElementById('reg-email-domain');
                const batchCountInput = document.getElementById('reg-batch-count');
                if (prefixInput) prefixInput.value = '';
                if (domainSelect) {
                    domainSelect.innerHTML = '<option value="">选择域名...</option>';
                }
                if (batchCountInput) {
                    batchCountInput.value = '10';
                }
            }
            const result = document.getElementById('register-result');
            if (result) {
                result.style.display = 'none';
            }
            // 加载可用域名列表
            this.loadAvailableDomains();
        }
    }

    async handleRegister() {
        const emailPrefix = document.getElementById('reg-email-prefix').value.trim();
        const emailDomain = document.getElementById('reg-email-domain').value;
        const retentionDays = parseInt(document.getElementById('reg-retention-days').value, 10);
        const batchCount = parseInt(document.getElementById('reg-batch-count').value, 10) || 1;
        const whitelistText = document.getElementById('reg-sender-whitelist').value;
        const allowedDomainsText = document.getElementById('reg-allowed-domains').value;
        const whitelistEnabled = document.getElementById('reg-whitelist-enabled').checked;

        if (!emailPrefix || !emailDomain) {
            this.showToast('error', '请输入用户名和域名');
            return;
        }

        // 解析白名单
        const senderWhitelist = whitelistText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        // 解析允许的域名
        const allowedDomains = allowedDomainsText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        let targetAddresses = [];
        try {
            if (this.registerMode === 'batch') {
                if (batchCount < 2 || batchCount > 100) {
                    this.showToast('error', '批量数量必须在2-100之间');
                    return;
                }

                targetAddresses = this.buildBatchAddresses(emailPrefix, emailDomain, batchCount);
            } else {
                if (!this.isValidUsername(emailPrefix)) {
                    this.showToast('error', '用户名必须是3-20位英文或数字');
                    return;
                }
                targetAddresses = [`${emailPrefix}@${emailDomain}`];
            }
        } catch (validationError) {
            this.showToast('error', validationError.message || '输入不合法');
            return;
        }

        const submitBtn = document.querySelector('#admin-register-form button[type="submit"]');
        const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 创建中...';
        }

        try {
            const successItems = [];
            const failedItems = [];

            for (const address of targetAddresses) {
                try {
                    const requestData = {
                        address,
                        retention_days: retentionDays,
                        sender_whitelist: senderWhitelist
                    };

                    if (allowedDomains.length > 0) {
                        requestData.allowed_domains = allowedDomains;
                    }

                    const response = await this.apiRequest('/api/admin/mailboxes', {
                        method: 'POST',
                        body: JSON.stringify(requestData)
                    });

                    if (whitelistEnabled && senderWhitelist.length > 0) {
                        await this.apiRequest(`/api/admin/mailboxes/${response.data.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ whitelist_enabled: true })
                        });
                    }

                    successItems.push(response.data);
                } catch (singleError) {
                    failedItems.push({
                        address,
                        error: singleError.message || '创建失败'
                    });
                }
            }

            if (successItems.length === 0) {
                throw new Error(failedItems[0]?.error || '创建失败');
            }

            const form = document.getElementById('admin-register-form');
            const result = document.getElementById('register-result');
            form.style.display = 'none';
            result.style.display = 'block';

            const summaryText = `共请求 ${targetAddresses.length} 个，成功 ${successItems.length} 个，失败 ${failedItems.length} 个`;
            const batchItemHtml = successItems.map((mailbox) => {
                const accessUrl = `${window.location.origin}/mailbox?address=${encodeURIComponent(mailbox.address)}&token=${encodeURIComponent(mailbox.access_token)}`;
                return `
                    <div class="batch-create-item">
                        <div class="item-text">${this.escapeHtml(mailbox.address)}</div>
                        <a class="item-link" href="${accessUrl}" target="_blank" rel="noopener noreferrer">打开邮箱</a>
                    </div>
                `;
            }).join('');

            const failedItemHtml = failedItems.map((item) => `
                <div class="batch-create-item failed">
                    <div class="item-text">${this.escapeHtml(item.address)}：${this.escapeHtml(item.error)}</div>
                    <span class="item-link">失败</span>
                </div>
            `).join('');

            result.innerHTML = `
                <div class="success-message">
                    <i class="fas fa-check-circle"></i>
                    <h3>${this.registerMode === 'batch' ? '批量创建完成！' : '邮箱创建成功！'}</h3>
                </div>
                <div class="batch-create-result">
                    <div class="batch-create-summary">${summaryText}</div>
                    <div class="batch-create-list">
                        ${batchItemHtml}
                        ${failedItemHtml}
                    </div>
                </div>
                <div class="result-actions">
                    <button class="btn btn-primary" onclick="adminManager.switchView('register')">
                        <i class="fas fa-plus"></i>
                        继续创建
                    </button>
                    <button class="btn btn-secondary" onclick="adminManager.switchView('mailboxes')">
                        <i class="fas fa-list"></i>
                        查看邮箱列表
                    </button>
                </div>
            `;

            this.showToast('success', this.registerMode === 'batch' ? '批量创建完成' : '邮箱创建成功');
            this.loadStats();
        } catch (error) {
            this.showToast('error', error.message || '创建失败');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        }
    }
    
    async apiRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`
            }
        };
        
        const response = await fetch(url, { ...defaultOptions, ...options });
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.error || '请求失败');
        }
        
        return data;
    }
    
    async loadStats() {
        try {
            const response = await this.apiRequest('/api/admin/stats');
            const stats = response.data;
            
            document.getElementById('stat-total-mailboxes').textContent = stats.total_mailboxes;
            document.getElementById('stat-active-mailboxes').textContent = stats.active_mailboxes;
            document.getElementById('stat-expired-mailboxes').textContent = stats.expired_mailboxes;
            document.getElementById('stat-disabled-mailboxes').textContent = stats.disabled_mailboxes;
            document.getElementById('stat-total-emails').textContent = stats.total_emails;
            document.getElementById('stat-unread-emails').textContent = stats.unread_emails;
        } catch (error) {
            console.error('加载统计信息失败:', error);
            this.showToast('error', '加载统计信息失败');
        }
    }
    
    async loadMailboxes() {
        const tbody = document.getElementById('mailbox-list');
        tbody.innerHTML = '<tr><td colspan="9" class="loading-row"><i class="fas fa-spinner fa-spin"></i> 加载中...</td></tr>';

        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                page_size: this.pageSize,
                status: this.currentStatus,
                source: this.currentSource,
                search: this.searchQuery
            });

            const response = await this.apiRequest(`/api/admin/mailboxes?${params}`);
            const data = response.data;

            this.renderMailboxList(data.mailboxes);
            this.renderPagination(data);
        } catch (error) {
            console.error('加载邮箱列表失败:', error);
            tbody.innerHTML = '<tr><td colspan="8" class="error-row">加载失败</td></tr>';
            this.showToast('error', '加载邮箱列表失败');
        }
    }
    
    renderMailboxList(mailboxes) {
        const tbody = document.getElementById('mailbox-list');

        if (mailboxes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-row">暂无数据</td></tr>';
            return;
        }

        // 创建来源标签配置
        const sourceLabels = {
            'admin': { text: '管理员', class: 'source-admin', icon: 'fa-user-shield' },
            'register': { text: '注册', class: 'source-register', icon: 'fa-user-plus' },
            'api_v2': { text: 'API', class: 'source-api', icon: 'fa-code' },
            'unknown': { text: '未知', class: 'source-unknown', icon: 'fa-question' }
        };

        tbody.innerHTML = mailboxes.map(mailbox => {
            const statusClass = mailbox.is_expired ? 'expired' : (mailbox.is_active ? 'active' : 'disabled');
            const statusText = mailbox.is_expired ? '已过期' : (mailbox.is_active ? '活跃' : '已禁用');

            const source = mailbox.created_source || 'unknown';
            const sourceConfig = sourceLabels[source] || sourceLabels['unknown'];

            return `
                <tr>
                    <td>
                        <input type="checkbox" class="mailbox-checkbox" value="${mailbox.id}" onchange="updateBatchDeleteButton()">
                    </td>
                    <td>
                        <div class="mailbox-address">
                            ${mailbox.address}
                            ${mailbox.whitelist_enabled ? '<i class="fas fa-shield-alt" title="已启用白名单"></i>' : ''}
                        </div>
                    </td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <span class="source-badge ${sourceConfig.class}">
                            <i class="fas ${sourceConfig.icon}"></i>
                            ${sourceConfig.text}
                        </span>
                    </td>
                    <td>${this.formatDate(mailbox.created_at)}</td>
                    <td>${this.formatDate(mailbox.expires_at)}</td>
                    <td>${mailbox.email_count}</td>
                    <td>${mailbox.unread_count}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon" onclick="adminManager.viewMailbox('${mailbox.id}')" title="查看详情">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-icon" onclick="adminManager.editMailbox('${mailbox.id}')" title="编辑">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon btn-danger" onclick="adminManager.deleteMailbox('${mailbox.id}')" title="删除">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    renderPagination(data) {
        const pagination = document.getElementById('pagination');
        const { page, total_pages } = data;
        
        if (total_pages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let html = '<div class="pagination-buttons">';
        
        // 上一页
        if (page > 1) {
            html += `<button class="btn btn-sm" onclick="adminManager.goToPage(${page - 1})"><i class="fas fa-chevron-left"></i></button>`;
        }
        
        // 页码
        for (let i = 1; i <= total_pages; i++) {
            if (i === 1 || i === total_pages || (i >= page - 2 && i <= page + 2)) {
                html += `<button class="btn btn-sm ${i === page ? 'active' : ''}" onclick="adminManager.goToPage(${i})">${i}</button>`;
            } else if (i === page - 3 || i === page + 3) {
                html += '<span>...</span>';
            }
        }
        
        // 下一页
        if (page < total_pages) {
            html += `<button class="btn btn-sm" onclick="adminManager.goToPage(${page + 1})"><i class="fas fa-chevron-right"></i></button>`;
        }
        
        html += '</div>';
        pagination.innerHTML = html;
    }
    
    goToPage(page) {
        this.currentPage = page;
        this.loadMailboxes();
    }
    
    formatDate(timestamp) {
        if (!timestamp) return '-';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 3000);
    }
    
    showToast(type, message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// 全局实例
let adminManager;

document.addEventListener('DOMContentLoaded', () => {
    adminManager = new AdminMailboxManager();
});

// 全局函数
function logout() {
    if (adminManager) {
        adminManager.logout();
    }
}

function refreshMailboxList() {
    if (adminManager) {
        adminManager.loadMailboxes();
    }
}

function changePageSize(size) {
    if (adminManager) {
        adminManager.pageSize = parseInt(size);
        adminManager.currentPage = 1; // 重置到第一页
        adminManager.loadMailboxes();
    }
}

function changeSourceFilter(source) {
    if (adminManager) {
        adminManager.currentSource = source;
        adminManager.currentPage = 1; // 重置到第一页
        adminManager.loadMailboxes();
    }
}

function refreshAuditLogs() {
    if (adminManager) {
        adminManager.loadAuditLogs();
    }
}

function showTokenModal(mailbox) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>邮箱创建成功</h3>
            </div>
            <div class="modal-body">
                <div class="token-display">
                    <p><strong>邮箱地址：</strong>${mailbox.address}</p>
                    <p><strong>访问令牌（请妥善保存，仅显示一次）：</strong></p>
                    <div class="token-box">
                        <code>${mailbox.access_token}</code>
                        <button class="btn-icon" onclick="copyToClipboard('${mailbox.access_token}')" title="复制">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <p class="warning-text">
                        <i class="fas fa-exclamation-triangle"></i>
                        此令牌仅显示一次，请立即复制保存！
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="this.closest('.modal').remove()">我已保存</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        adminManager.showToast('success', '已复制到剪贴板');
    }).catch(() => {
        adminManager.showToast('error', '复制失败');
    });
}

// 添加到AdminMailboxManager类
AdminMailboxManager.prototype.viewMailbox = async function(mailboxId) {
    try {
        const response = await this.apiRequest(`/api/admin/mailboxes/${mailboxId}`);
        const mailbox = response.data;

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>邮箱详情</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>邮箱地址</label>
                            <div>${mailbox.address}</div>
                        </div>
                        <div class="detail-item">
                            <label>状态</label>
                            <div>
                                <span class="status-badge ${mailbox.is_expired ? 'expired' : (mailbox.is_active ? 'active' : 'disabled')}">
                                    ${mailbox.is_expired ? '已过期' : (mailbox.is_active ? '活跃' : '已禁用')}
                                </span>
                            </div>
                        </div>
                        <div class="detail-item">
                            <label>创建时间</label>
                            <div>${this.formatDate(mailbox.created_at)}</div>
                        </div>
                        <div class="detail-item">
                            <label>过期时间</label>
                            <div>${this.formatDate(mailbox.expires_at)}</div>
                        </div>
                        <div class="detail-item">
                            <label>保留天数</label>
                            <div>${mailbox.retention_days} 天</div>
                        </div>
                        <div class="detail-item">
                            <label>邮件统计</label>
                            <div>总计 ${mailbox.email_count} 封，未读 ${mailbox.unread_count} 封</div>
                        </div>
                        <div class="detail-item">
                            <label>存储容量</label>
                            <div>
                                <div class="storage-info">
                                    <div class="storage-bar">
                                        <div class="storage-used" style="width: ${mailbox.storage_percent || 0}%"></div>
                                    </div>
                                    <div class="storage-text">
                                        ${(mailbox.storage_used_mb || 0).toFixed(2)} MB / ${(mailbox.storage_limit_mb || 50).toFixed(2)} MB
                                        (${(mailbox.storage_percent || 0).toFixed(1)}%)
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="detail-item">
                            <label>白名单状态</label>
                            <div>${mailbox.whitelist_enabled ? '已启用' : '未启用'}</div>
                        </div>
                        <div class="detail-item full-width">
                            <label>发件人白名单</label>
                            <div>${mailbox.sender_whitelist.length > 0 ? mailbox.sender_whitelist.join(', ') : '无'}</div>
                        </div>
                        <div class="detail-item full-width">
                            <label>允许的域名</label>
                            <div>${mailbox.allowed_domains && mailbox.allowed_domains.length > 0 ? mailbox.allowed_domains.join(', ') : '无限制'}</div>
                        </div>
                        <div class="detail-item full-width">
                            <label>访问令牌 (Access Token)</label>
                            <div class="token-display-inline">
                                <code>${mailbox.access_token}</code>
                                <button class="btn-icon" onclick="copyToClipboard('${mailbox.access_token}')" title="复制">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div class="detail-item full-width">
                            <label>邮箱密钥 (Mailbox Key)</label>
                            <div class="token-display-inline">
                                <code>${mailbox.mailbox_key}</code>
                                <button class="btn-icon" onclick="copyToClipboard('${mailbox.mailbox_key}')" title="复制">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div class="detail-item">
                            <label>创建IP</label>
                            <div>${mailbox.created_by_ip || '-'}</div>
                        </div>
                        <div class="detail-item">
                            <label>最后访问</label>
                            <div>${this.formatDate(mailbox.last_accessed)}</div>
                        </div>
                        <div class="detail-item">
                            <label>最后更新管理员</label>
                            <div>${mailbox.updated_by_admin || '-'}</div>
                        </div>
                        <div class="detail-item">
                            <label>最后更新时间</label>
                            <div>${this.formatDate(mailbox.updated_at)}</div>
                        </div>
                        <div class="detail-item full-width" style="margin-top: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px; border-left: 3px solid var(--primary-color);">
                            <label style="color: var(--primary-color); font-weight: 600;">
                                <i class="fas fa-link"></i>
                                🎯 快速访问链接
                            </label>
                            <div style="margin-top: 0.5rem;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                    <code style="flex: 1; min-width: 300px; padding: 0.5rem; background: var(--bg-primary); border-radius: 4px; font-size: 12px; word-break: break-all;">${window.location.origin}/mailbox?address=${encodeURIComponent(mailbox.address)}&token=${mailbox.access_token}</code>
                                    <button class="btn-icon" onclick="copyToClipboard('${window.location.origin}/mailbox?address=${encodeURIComponent(mailbox.address)}&token=${mailbox.access_token}')" title="复制链接">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                    <a href="/mailbox?address=${encodeURIComponent(mailbox.address)}&token=${mailbox.access_token}" target="_blank" class="btn btn-sm btn-primary" style="white-space: nowrap;">
                                        <i class="fas fa-external-link-alt"></i>
                                        打开邮箱
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">关闭</button>
                    <button class="btn btn-warning" onclick="resetMailboxToken('${mailboxId}'); this.closest('.modal').remove();">
                        <i class="fas fa-key"></i>
                        重置令牌
                    </button>
                    <button class="btn btn-primary" onclick="adminManager.editMailbox('${mailboxId}'); this.closest('.modal').remove();">
                        <i class="fas fa-edit"></i>
                        编辑
                    </button>
                    ${!mailbox.is_active ?
                        `<button class="btn btn-success" onclick="enableMailbox('${mailboxId}'); this.closest('.modal').remove();">
                            <i class="fas fa-undo"></i>
                            恢复邮箱
                        </button>` : ''
                    }
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        this.showToast('error', '加载邮箱详情失败');
    }
};

AdminMailboxManager.prototype.editMailbox = async function(mailboxId) {
    try {
        const response = await this.apiRequest(`/api/admin/mailboxes/${mailboxId}`);
        const mailbox = response.data;

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>编辑邮箱</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="edit-mailbox-form">
                        <div class="form-group">
                            <label>邮箱地址</label>
                            <input type="text" value="${mailbox.address}" disabled>
                        </div>
                        <div class="form-group">
                            <label for="edit-retention-days">保留天数</label>
                            <input type="number" id="edit-retention-days" value="${mailbox.retention_days}" min="1" max="36500">
                        </div>
                        <div class="form-group">
                            <label for="edit-sender-whitelist">发件人白名单</label>
                            <textarea id="edit-sender-whitelist" rows="3">${mailbox.sender_whitelist.join('\n')}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="edit-allowed-domains">允许的域名</label>
                            <textarea id="edit-allowed-domains" rows="3">${mailbox.allowed_domains ? mailbox.allowed_domains.join('\n') : ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="edit-whitelist-enabled" ${mailbox.whitelist_enabled ? 'checked' : ''}>
                                启用白名单过滤
                            </label>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="edit-is-active" ${mailbox.is_active ? 'checked' : ''}>
                                邮箱激活状态
                            </label>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
                    <button class="btn btn-primary" onclick="adminManager.saveMailboxEdit('${mailboxId}', this.closest('.modal'))">
                        <i class="fas fa-save"></i>
                        保存
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        this.showToast('error', '加载邮箱信息失败');
    }
};

AdminMailboxManager.prototype.saveMailboxEdit = async function(mailboxId, modal) {
    const retentionDays = parseInt(document.getElementById('edit-retention-days').value);
    const whitelistText = document.getElementById('edit-sender-whitelist').value;
    const allowedDomainsText = document.getElementById('edit-allowed-domains').value;
    const whitelistEnabled = document.getElementById('edit-whitelist-enabled').checked;
    const isActive = document.getElementById('edit-is-active').checked;

    const senderWhitelist = whitelistText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const allowedDomains = allowedDomainsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    try {
        const updates = {
            retention_days: retentionDays,
            sender_whitelist: senderWhitelist,
            whitelist_enabled: whitelistEnabled,
            is_active: isActive
        };

        // 如果有允许的域名，添加到更新中
        if (allowedDomains.length > 0) {
            updates.allowed_domains = allowedDomains;
        }

        await this.apiRequest(`/api/admin/mailboxes/${mailboxId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });

        this.showToast('success', '更新成功');
        modal.remove();

        if (this.currentView === 'mailboxes') {
            this.loadMailboxes();
        }
        this.loadStats();
    } catch (error) {
        this.showToast('error', error.message || '更新失败');
    }
};

AdminMailboxManager.prototype.deleteMailbox = async function(mailboxId) {
    // 显示确认模态框
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>确认删除</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <p>确定要删除此邮箱吗？</p>
                <div class="alert alert-warning">
                    <i class="fas fa-info-circle"></i>
                    <div>
                        <strong>软删除说明：</strong>
                        <ul style="margin: 8px 0 0 20px; padding: 0;">
                            <li>邮箱将被标记为"已禁用"</li>
                            <li>用户无法继续访问</li>
                            <li>数据保留在数据库中</li>
                            <li>可以通过"恢复"功能重新启用</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
                <button class="btn btn-danger" onclick="adminManager.confirmDeleteMailbox('${mailboxId}', this.closest('.modal'))">
                    <i class="fas fa-trash"></i>
                    确认删除
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

AdminMailboxManager.prototype.confirmDeleteMailbox = async function(mailboxId, modal) {
    try {
        await this.apiRequest(`/api/admin/mailboxes/${mailboxId}?soft=true`, {
            method: 'DELETE'
        });

        this.showToast('success', '邮箱已删除');
        modal.remove();

        if (this.currentView === 'mailboxes') {
            this.loadMailboxes();
        }
        this.loadStats();
    } catch (error) {
        this.showToast('error', error.message || '删除失败');
    }
};

AdminMailboxManager.prototype.loadAuditLogs = async function() {
    const tbody = document.getElementById('audit-log-list');
    tbody.innerHTML = '<tr><td colspan="6" class="loading-row"><i class="fas fa-spinner fa-spin"></i> 加载中...</td></tr>';

    try {
        const response = await this.apiRequest('/api/admin/audit-logs?limit=100');
        const logs = response.data;

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-row">暂无审计日志</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => `
            <tr>
                <td>${this.formatDate(log.timestamp)}</td>
                <td><span class="action-badge action-${log.action.toLowerCase()}">${log.action}</span></td>
                <td><code>${log.mailbox_id || '-'}</code></td>
                <td>${log.admin_user || '-'}</td>
                <td>${log.ip_address || '-'}</td>
                <td>
                    <button class="btn-icon" onclick="adminManager.showAuditDetail(${JSON.stringify(log).replace(/"/g, '&quot;')})" title="查看详情">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('加载审计日志失败:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="error-row">加载失败</td></tr>';
        this.showToast('error', '加载审计日志失败');
    }
};

AdminMailboxManager.prototype.showAuditDetail = function(log) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>审计日志详情</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>时间</label>
                        <div>${this.formatDate(log.timestamp)}</div>
                    </div>
                    <div class="detail-item">
                        <label>操作</label>
                        <div><span class="action-badge action-${log.action.toLowerCase()}">${log.action}</span></div>
                    </div>
                    <div class="detail-item">
                        <label>邮箱ID</label>
                        <div><code>${log.mailbox_id || '-'}</code></div>
                    </div>
                    <div class="detail-item">
                        <label>管理员</label>
                        <div>${log.admin_user || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <label>IP地址</label>
                        <div>${log.ip_address || '-'}</div>
                    </div>
                    <div class="detail-item full-width">
                        <label>变更内容</label>
                        <pre>${JSON.stringify(log.changes, null, 2)}</pre>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">关闭</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

// 全选/取消全选
function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('.mailbox-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
    updateBatchDeleteButton();
}

// 更新批量删除按钮状态
function updateBatchDeleteButton() {
    const checkboxes = document.querySelectorAll('.mailbox-checkbox:checked');
    const count = checkboxes.length;
    const btn = document.getElementById('batch-delete-btn');
    const countSpan = document.getElementById('selected-count');

    if (count > 0) {
        btn.style.display = 'inline-block';
        countSpan.textContent = count;
    } else {
        btn.style.display = 'none';
    }
}

// 批量删除邮箱
async function batchDeleteMailboxes() {
    const checkboxes = document.querySelectorAll('.mailbox-checkbox:checked');
    const mailboxIds = Array.from(checkboxes).map(cb => cb.value);

    if (mailboxIds.length === 0) {
        adminManager.showToast('warning', '请先选择要删除的邮箱');
        return;
    }

    // 创建确认模态框
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-exclamation-triangle"></i> 确认批量删除</h3>
            </div>
            <div class="modal-body">
                <p>确定要删除选中的 <strong>${mailboxIds.length}</strong> 个邮箱吗？</p>
                <p class="text-secondary">删除后可以在详情界面恢复。</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                    取消
                </button>
                <button class="btn btn-danger" id="confirm-batch-delete-btn">
                    <i class="fas fa-trash"></i>
                    确认删除
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // 绑定确认按钮事件
    document.getElementById('confirm-batch-delete-btn').onclick = async () => {
        try {
            modal.remove();

            const response = await adminManager.apiRequest('/api/admin/mailboxes/batch-delete', {
                method: 'POST',
                body: JSON.stringify({
                    mailbox_ids: mailboxIds,
                    soft_delete: true
                })
            });

            adminManager.showToast('success', response.message);

            // 取消全选
            document.getElementById('select-all-checkbox').checked = false;
            updateBatchDeleteButton();

            // 重新加载列表
            adminManager.loadMailboxes();
        } catch (error) {
            adminManager.showToast('error', '批量删除失败: ' + error.message);
        }
    };
}

// 重置邮箱token
async function resetMailboxToken(mailboxId) {
    if (!confirm('确定要重置此邮箱的访问令牌吗？重置后旧令牌将失效。')) {
        return;
    }

    try {
        const response = await adminManager.apiRequest(`/api/admin/mailboxes/${mailboxId}/reset-token`, {
            method: 'POST'
        });

        // 显示新token
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-key"></i> 新的访问令牌</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        请妥善保存新令牌，关闭后将无法再次查看！
                    </div>
                    <div class="form-group">
                        <label>新访问令牌：</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" value="${response.data.new_token}" readonly style="flex: 1;">
                            <button class="btn btn-primary" onclick="copyToClipboard('${response.data.new_token}')">
                                <i class="fas fa-copy"></i> 复制
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        adminManager.showToast('success', '令牌重置成功');
    } catch (error) {
        adminManager.showToast('error', '重置令牌失败: ' + error.message);
    }
}

// 恢复（启用）邮箱
async function enableMailbox(mailboxId) {
    if (!confirm('确定要恢复此邮箱吗？恢复后用户可以正常访问。')) {
        return;
    }

    try {
        await adminManager.apiRequest(`/api/admin/mailboxes/${mailboxId}/enable`, {
            method: 'POST'
        });

        adminManager.showToast('success', '邮箱已恢复');
        adminManager.loadMailboxes();
    } catch (error) {
        adminManager.showToast('error', '恢复失败: ' + error.message);
    }
}

// 复制到剪贴板
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        adminManager.showToast('success', '已复制到剪贴板');
    }).catch(() => {
        // 降级方案
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        adminManager.showToast('success', '已复制到剪贴板');
    });
}

// 刷新安全信息
async function refreshSecurityInfo() {
    await loadBlockedIPs();
    await loadSourceStats();
    await loadSecurityConfig();
}

// 加载被封禁的IP列表
async function loadBlockedIPs() {
    const tbody = document.getElementById('blocked-ips-list');
    tbody.innerHTML = '<tr><td colspan="3" class="loading-row"><i class="fas fa-spinner fa-spin"></i> 加载中...</td></tr>';

    try {
        const response = await adminManager.apiRequest('/api/admin/blocked-ips');
        const blockedIPs = response.data.blocked_ips;

        if (blockedIPs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-row">当前没有被封禁的IP</td></tr>';
            return;
        }

        tbody.innerHTML = blockedIPs.map(item => `
            <tr>
                <td><code>${item.ip}</code></td>
                <td>${formatSeconds(item.remaining_seconds)}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="unblockIP('${item.ip}')">
                        <i class="fas fa-unlock"></i>
                        解除封禁
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="3" class="error-row">加载失败</td></tr>';
        adminManager.showToast('error', '加载被封禁IP失败');
    }
}

// 解除IP封禁
async function unblockIP(ip) {
    if (!confirm(`确定要解除 ${ip} 的封禁吗？`)) {
        return;
    }

    try {
        await adminManager.apiRequest(`/api/admin/blocked-ips/${ip}`, {
            method: 'DELETE'
        });

        adminManager.showToast('success', `IP ${ip} 已解除封禁`);
        loadBlockedIPs();
    } catch (error) {
        adminManager.showToast('error', '解除封禁失败: ' + error.message);
    }
}

// 加载创建来源统计
async function loadSourceStats() {
    const grid = document.getElementById('source-stats-grid');
    grid.innerHTML = '<div class="stat-card"><div class="stat-icon"><i class="fas fa-spinner fa-spin"></i></div><div class="stat-info"><div class="stat-label">加载中...</div><div class="stat-value">-</div></div></div>';

    try {
        const response = await adminManager.apiRequest('/api/admin/source-stats');
        const sourceStats = response.data;

        // 创建来源配置
        const sourceConfig = {
            'admin': {
                label: '管理员创建',
                icon: 'fa-user-shield',
                gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            },
            'register': {
                label: '用户注册',
                icon: 'fa-user-plus',
                gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
            },
            'api_v2': {
                label: 'API创建',
                icon: 'fa-code',
                gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
            },
            'unknown': {
                label: '未知来源',
                icon: 'fa-question',
                gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
            }
        };

        // 生成统计卡片
        let html = '';
        let total = 0;

        for (const [source, count] of Object.entries(sourceStats)) {
            const config = sourceConfig[source] || sourceConfig['unknown'];
            total += count;
            html += `
                <div class="stat-card">
                    <div class="stat-icon" style="background: ${config.gradient};">
                        <i class="fas ${config.icon}"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-label">${config.label}</div>
                        <div class="stat-value">${count}</div>
                    </div>
                </div>
            `;
        }

        // 添加总计卡片
        html += `
            <div class="stat-card">
                <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
                    <i class="fas fa-inbox"></i>
                </div>
                <div class="stat-info">
                    <div class="stat-label">总邮箱数</div>
                    <div class="stat-value">${total}</div>
                </div>
            </div>
        `;

        grid.innerHTML = html;
    } catch (error) {
        grid.innerHTML = '<div class="stat-card"><div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div><div class="stat-info"><div class="stat-label">加载失败</div><div class="stat-value">-</div></div></div>';
        adminManager.showToast('error', '加载统计信息失败');
    }
}

// 加载安全配置
async function loadSecurityConfig() {
    try {
        const response = await adminManager.apiRequest('/api/admin/security-config');
        const config = response.data;

        document.getElementById('config-block-duration').value = config.block_duration;
        document.getElementById('config-max-attempts').value = config.max_attempts;
        document.getElementById('config-attempt-window').value = config.attempt_window;
    } catch (error) {
        adminManager.showToast('error', '加载配置失败');
    }
}

// 保存安全配置
async function saveSecurityConfig() {
    const blockDuration = parseInt(document.getElementById('config-block-duration').value);
    const maxAttempts = parseInt(document.getElementById('config-max-attempts').value);
    const attemptWindow = parseInt(document.getElementById('config-attempt-window').value);

    // 验证
    if (blockDuration < 60 || blockDuration > 86400) {
        adminManager.showToast('error', '封禁时长必须在60-86400秒之间');
        return;
    }

    if (maxAttempts < 1 || maxAttempts > 10) {
        adminManager.showToast('error', '最大失败次数必须在1-10次之间');
        return;
    }

    if (attemptWindow < 30 || attemptWindow > 600) {
        adminManager.showToast('error', '尝试窗口时间必须在30-600秒之间');
        return;
    }

    try {
        await adminManager.apiRequest('/api/admin/security-config', {
            method: 'PUT',
            body: JSON.stringify({
                block_duration: blockDuration,
                max_attempts: maxAttempts,
                attempt_window: attemptWindow
            })
        });

        adminManager.showToast('success', '配置已保存');
    } catch (error) {
        adminManager.showToast('error', '保存配置失败: ' + error.message);
    }
}

// 格式化秒数为可读格式
function formatSeconds(seconds) {
    if (seconds < 60) {
        return `${seconds} 秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} 分 ${remainingSeconds} 秒`;
}

// 设置保留天数（用于注册界面的快捷按钮）
function setRetentionDays(days) {
    document.getElementById('reg-retention-days').value = days;
}

// ==================== 子管理员管理 ====================

// 加载子管理员列表
async function loadSubAdmins() {
    try {
        const response = await adminManager.apiRequest('/api/admin/sub-admins');

        if (response.success) {
            displaySubAdmins(response.data);
        } else {
            adminManager.showToast('error', response.error || '加载子管理员列表失败');
        }
    } catch (error) {
        console.error('加载子管理员列表失败:', error);
        adminManager.showToast('error', '加载子管理员列表失败');
    }
}

// 显示子管理员列表
function displaySubAdmins(subAdmins) {
    const tbody = document.getElementById('sub-admins-tbody');

    if (!subAdmins || subAdmins.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-cell">
                    <i class="fas fa-inbox"></i>
                    <p>暂无子管理员</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = subAdmins.map(admin => `
        <tr>
            <td><code>${admin.token}</code></td>
            <td>
                <div class="domains-tags">
                    ${admin.domains.map(d => `<span class="domain-tag">${d}</span>`).join('')}
                </div>
            </td>
            <td>
                <div class="domains-tags">
                    ${admin.sender_whitelist && admin.sender_whitelist.length > 0
                        ? admin.sender_whitelist.map(d => `<span class="domain-tag">${d}</span>`).join('')
                        : '<span class="text-muted">不限制</span>'}
                </div>
            </td>
            <td>${admin.max_retention_days || 30} 天</td>
            <td>
                <span class="status-badge ${admin.is_active ? 'status-active' : 'status-inactive'}">
                    ${admin.is_active ? '启用' : '禁用'}
                </span>
            </td>
            <td>${adminManager.formatDate(admin.created_at)}</td>
            <td>${admin.notes || '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editSubAdmin('${admin.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteSubAdmin('${admin.id}', '${admin.token}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// 显示创建子管理员模态框
async function showCreateSubAdminModal() {
    document.getElementById('sub-admin-modal-title').textContent = '添加子管理员';
    document.getElementById('sub-admin-id').value = '';
    document.getElementById('sub-admin-token').value = '';
    document.getElementById('sub-admin-token').disabled = false;
    document.getElementById('sub-admin-notes').value = '';
    document.getElementById('sub-admin-sender-whitelist').value = '';
    document.getElementById('sub-admin-max-retention-days').value = '30';
    document.getElementById('sub-admin-active').checked = true;

    // 加载可用域名
    await loadDomainsForSubAdmin();

    document.getElementById('sub-admin-modal').style.display = 'flex';
}

// 编辑子管理员
async function editSubAdmin(subAdminId) {
    try {
        const response = await adminManager.apiRequest('/api/admin/sub-admins');

        if (response.success) {
            const admin = response.data.find(a => a.id === subAdminId);
            if (!admin) {
                adminManager.showToast('error', '未找到该子管理员');
                return;
            }

            document.getElementById('sub-admin-modal-title').textContent = '编辑子管理员';
            document.getElementById('sub-admin-id').value = admin.id;
            document.getElementById('sub-admin-token').value = admin.token;
            document.getElementById('sub-admin-token').disabled = true;
            document.getElementById('sub-admin-notes').value = admin.notes || '';
            document.getElementById('sub-admin-active').checked = admin.is_active;
            document.getElementById('sub-admin-max-retention-days').value = admin.max_retention_days || 30;

            // 设置发件人白名单（每行一个域名）
            document.getElementById('sub-admin-sender-whitelist').value =
                (admin.sender_whitelist && admin.sender_whitelist.length > 0)
                    ? admin.sender_whitelist.join('\n')
                    : '';

            // 加载可用域名并选中已分配的域名
            await loadDomainsForSubAdmin(admin.domains);

            document.getElementById('sub-admin-modal').style.display = 'flex';
        }
    } catch (error) {
        console.error('加载子管理员信息失败:', error);
        adminManager.showToast('error', '加载子管理员信息失败');
    }
}

// 加载域名复选框
async function loadDomainsForSubAdmin(selectedDomains = []) {
    try {
        const response = await fetch('/api/get_random_address');
        const result = await response.json();

        const domainsContainer = document.getElementById('sub-admin-domains-container');

        if (response.ok && result.available_domains) {
            // 可创建的域名
            domainsContainer.innerHTML = result.available_domains.map(domain => `
                <label class="checkbox-label">
                    <input type="checkbox" name="sub-admin-domain" value="${domain}"
                        ${selectedDomains.includes(domain) ? 'checked' : ''}>
                    ${domain}
                </label>
            `).join('');
        } else {
            domainsContainer.innerHTML = '<p class="text-muted">无可用域名</p>';
        }
    } catch (error) {
        console.error('加载域名失败:', error);
        document.getElementById('sub-admin-domains-container').innerHTML =
            '<p class="text-danger">加载域名失败</p>';
    }
}

// 关闭子管理员模态框
function closeSubAdminModal() {
    document.getElementById('sub-admin-modal').style.display = 'none';
}

// 保存子管理员
async function saveSubAdmin(event) {
    event.preventDefault();

    const subAdminId = document.getElementById('sub-admin-id').value;
    const token = document.getElementById('sub-admin-token').value.trim();
    const notes = document.getElementById('sub-admin-notes').value.trim();
    const isActive = document.getElementById('sub-admin-active').checked;
    const maxRetentionDays = parseInt(document.getElementById('sub-admin-max-retention-days').value);

    // 获取选中的域名
    const domainCheckboxes = document.querySelectorAll('input[name="sub-admin-domain"]:checked');
    const domains = Array.from(domainCheckboxes).map(cb => cb.value);

    // 获取发件人白名单（从文本域，每行一个域名）
    const senderWhitelistText = document.getElementById('sub-admin-sender-whitelist').value.trim();
    const senderWhitelist = senderWhitelistText
        ? senderWhitelistText.split('\n').map(line => line.trim()).filter(line => line.length > 0)
        : [];

    // 验证
    if (!token) {
        adminManager.showToast('error', 'Token不能为空');
        return;
    }

    if (domains.length === 0) {
        adminManager.showToast('error', '至少需要选择一个可创建的域名');
        return;
    }

    if (isNaN(maxRetentionDays) || maxRetentionDays < 1 || maxRetentionDays > 36500) {
        adminManager.showToast('error', '最长保留天数必须在1-36500之间');
        return;
    }

    try {
        let response;

        if (subAdminId) {
            // 更新
            const updateData = {
                domains: domains,
                sender_whitelist: senderWhitelist,
                max_retention_days: maxRetentionDays,
                is_active: isActive ? 1 : 0,
                notes: notes
            };

            response = await adminManager.apiRequest(`/api/admin/sub-admins/${subAdminId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
        } else {
            // 创建
            response = await adminManager.apiRequest('/api/admin/sub-admins', {
                method: 'POST',
                body: JSON.stringify({
                    token: token,
                    domains: domains,
                    sender_whitelist: senderWhitelist,
                    max_retention_days: maxRetentionDays,
                    notes: notes
                })
            });
        }

        if (response.success) {
            adminManager.showToast('success', response.message || '保存成功');
            closeSubAdminModal();
            loadSubAdmins();
        } else {
            adminManager.showToast('error', response.error || '保存失败');
        }
    } catch (error) {
        console.error('保存子管理员失败:', error);
        adminManager.showToast('error', '保存失败');
    }
}

// 删除子管理员
async function deleteSubAdmin(subAdminId, token) {
    if (!confirm(`确定要删除子管理员 "${token}" 吗？`)) {
        return;
    }

    try {
        const response = await adminManager.apiRequest(`/api/admin/sub-admins/${subAdminId}`, {
            method: 'DELETE'
        });

        if (response.success) {
            adminManager.showToast('success', '删除成功');
            loadSubAdmins();
        } else {
            adminManager.showToast('error', response.error || '删除失败');
        }
    } catch (error) {
        console.error('删除子管理员失败:', error);
        adminManager.showToast('error', '删除失败');
    }
}

// 绑定子管理员表单提交事件
document.addEventListener('DOMContentLoaded', () => {
    const subAdminForm = document.getElementById('sub-admin-form');
    if (subAdminForm) {
        subAdminForm.addEventListener('submit', saveSubAdmin);
    }
});

