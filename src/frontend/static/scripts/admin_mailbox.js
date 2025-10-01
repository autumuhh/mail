// 邮箱管理系统 - 前端逻辑

class AdminMailboxManager {
    constructor() {
        this.authToken = localStorage.getItem('admin_token');
        this.currentView = 'login';
        this.currentPage = 1;
        this.pageSize = 20;
        this.currentStatus = 'all';
        this.searchQuery = '';
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
    }

    generateRandomEmailPrefix() {
        // 生成随机字符串（8-12位）
        const length = Math.floor(Math.random() * 5) + 8; // 8-12
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // 设置到输入框
        const prefixInput = document.getElementById('reg-email-prefix');
        if (prefixInput) {
            prefixInput.value = result;
        }

        // 加载域名列表
        this.loadAvailableDomains();
    }

    async loadAvailableDomains() {
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

                // 如果当前没有选择域名，自动选择第一个
                if (!domainSelect.value) {
                    domainSelect.value = domains[0];
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
        } else if (viewName === 'mailboxes') {
            this.loadMailboxes();
        } else if (viewName === 'audit') {
            this.loadAuditLogs();
        } else if (viewName === 'register') {
            // 重置注册表单
            const form = document.getElementById('admin-register-form');
            if (form) {
                form.reset();
                form.style.display = 'block';
                // 清空邮箱输入
                const prefixInput = document.getElementById('reg-email-prefix');
                const domainSelect = document.getElementById('reg-email-domain');
                if (prefixInput) prefixInput.value = '';
                if (domainSelect) {
                    domainSelect.innerHTML = '<option value="">选择域名...</option>';
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
        const emailPrefix = document.getElementById('reg-email-prefix').value;
        const emailDomain = document.getElementById('reg-email-domain').value;
        const retentionDays = parseInt(document.getElementById('reg-retention-days').value);
        const whitelistText = document.getElementById('reg-sender-whitelist').value;
        const allowedDomainsText = document.getElementById('reg-allowed-domains').value;
        const whitelistEnabled = document.getElementById('reg-whitelist-enabled').checked;

        if (!emailPrefix || !emailDomain) {
            this.showToast('error', '请输入完整的邮箱地址');
            return;
        }

        // 组合邮箱地址
        const address = `${emailPrefix}@${emailDomain}`;

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

        try {
            const requestData = {
                address,
                retention_days: retentionDays,
                sender_whitelist: senderWhitelist
            };

            // 如果有允许的域名，添加到请求中
            if (allowedDomains.length > 0) {
                requestData.allowed_domains = allowedDomains;
            }

            const response = await this.apiRequest('/api/admin/mailboxes', {
                method: 'POST',
                body: JSON.stringify(requestData)
            });

            // 如果启用白名单，更新状态
            if (whitelistEnabled && senderWhitelist.length > 0) {
                await this.apiRequest(`/api/admin/mailboxes/${response.data.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        whitelist_enabled: true
                    })
                });
            }

            this.showToast('success', '邮箱创建成功');

            // 显示结果
            const form = document.getElementById('admin-register-form');
            const result = document.getElementById('register-result');

            form.style.display = 'none';
            result.style.display = 'block';
            result.innerHTML = `
                <div class="success-message">
                    <i class="fas fa-check-circle"></i>
                    <h3>邮箱创建成功！</h3>
                </div>
                <div class="mailbox-info">
                    <div class="info-item">
                        <label>邮箱地址：</label>
                        <div class="info-value">${response.data.address}</div>
                    </div>
                    <div class="info-item">
                        <label>访问令牌：</label>
                        <div class="token-display-inline">
                            <code>${response.data.access_token}</code>
                            <button class="btn-icon" onclick="copyToClipboard('${response.data.access_token}')" title="复制">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <small class="warning-text">
                            <i class="fas fa-exclamation-triangle"></i>
                            此令牌仅显示一次，请立即复制保存！
                        </small>
                    </div>
                    <div class="info-item">
                        <label>过期时间：</label>
                        <div class="info-value">${this.formatDate(response.data.expires_at)}</div>
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

            // 刷新统计
            this.loadStats();
        } catch (error) {
            this.showToast('error', error.message || '创建失败');
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
        tbody.innerHTML = '<tr><td colspan="7" class="loading-row"><i class="fas fa-spinner fa-spin"></i> 加载中...</td></tr>';
        
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                page_size: this.pageSize,
                status: this.currentStatus,
                search: this.searchQuery
            });
            
            const response = await this.apiRequest(`/api/admin/mailboxes?${params}`);
            const data = response.data;
            
            this.renderMailboxList(data.mailboxes);
            this.renderPagination(data);
        } catch (error) {
            console.error('加载邮箱列表失败:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="error-row">加载失败</td></tr>';
            this.showToast('error', '加载邮箱列表失败');
        }
    }
    
    renderMailboxList(mailboxes) {
        const tbody = document.getElementById('mailbox-list');
        
        if (mailboxes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-row">暂无数据</td></tr>';
            return;
        }
        
        tbody.innerHTML = mailboxes.map(mailbox => {
            const statusClass = mailbox.is_expired ? 'expired' : (mailbox.is_active ? 'active' : 'disabled');
            const statusText = mailbox.is_expired ? '已过期' : (mailbox.is_active ? '活跃' : '已禁用');
            
            return `
                <tr>
                    <td>
                        <div class="mailbox-address">
                            ${mailbox.address}
                            ${mailbox.whitelist_enabled ? '<i class="fas fa-shield-alt" title="已启用白名单"></i>' : ''}
                        </div>
                    </td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
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
                                    <code style="flex: 1; min-width: 300px; padding: 0.5rem; background: var(--bg-primary); border-radius: 4px; font-size: 12px; word-break: break-all;">http://localhost:5000/mailbox?address=${encodeURIComponent(mailbox.address)}&token=${mailbox.access_token}</code>
                                    <button class="btn-icon" onclick="copyToClipboard('http://localhost:5000/mailbox?address=${encodeURIComponent(mailbox.address)}&token=${mailbox.access_token}')" title="复制链接">
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
                    <button class="btn btn-primary" onclick="adminManager.editMailbox('${mailboxId}'); this.closest('.modal').remove();">
                        <i class="fas fa-edit"></i>
                        编辑
                    </button>
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
                            <input type="number" id="edit-retention-days" value="${mailbox.retention_days}" min="1" max="90">
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
                <p class="warning-text">
                    <i class="fas fa-exclamation-triangle"></i>
                    此操作将禁用邮箱（软删除），邮箱将无法继续使用。
                </p>
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

