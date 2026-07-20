// 邮箱管理系统 - 前端逻辑

// 统一转义所有写入 HTML 模板的外部数据，避免数据库/API 字段形成存储型 XSS。
// 动态模板统一复用本地图标，既移除第三方字体请求，也避免各视图重复 SVG 标记。
function uiIcon(name, className = '') {
    if (!window.MaildropUI || typeof window.MaildropUI.icon !== 'function') return '';
    return window.MaildropUI.icon(name, className);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 仅允许安全字符进入 CSS 类名，避免审计操作名等外部字段突破 class 属性。
function safeCssToken(value, fallback = 'unknown') {
    const token = String(value ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return token || fallback;
}

function safeNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function openAdminModal(modal, opener = document.activeElement) {
    if (!(modal instanceof HTMLElement)) return false;
    if (!modal.isConnected) document.body.appendChild(modal);
    // 动态后台弹窗统一交给共享组件管理焦点，避免键盘焦点留在遮罩层后方。
    return window.MaildropUI.openDialog(modal, opener);
}

function closeAndRemoveAdminModal(modal) {
    if (!(modal instanceof HTMLElement)) return;
    window.MaildropUI.closeDialog(modal);
    modal.remove();
}

function confirmAdminAction({
    title = '确认操作',
    message,
    confirmLabel = '确认',
    danger = false,
    opener = document.activeElement,
}) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-content--compact">
                <div class="modal-header">
                    <h3>${uiIcon(danger ? 'warning' : 'question')} ${escapeHtml(title)}</h3>
                    <button class="modal-close" type="button" data-action="close" title="关闭对话框" aria-label="关闭对话框">
                        ${uiIcon('close')}
                    </button>
                </div>
                <div class="modal-body">
                    <p class="modal-message" data-role="message" data-dialog-description></p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" type="button" data-action="close">取消</button>
                    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-action="confirm">
                        ${escapeHtml(confirmLabel)}
                    </button>
                </div>
            </div>
        `;
        // 提示文本只能写入 textContent，避免 IP、Token 等动态字段形成 HTML。
        modal.querySelector('[data-role="message"]').textContent = String(message || '');
        let settled = false;
        const finish = (accepted) => {
            if (settled) return;
            settled = true;
            closeAndRemoveAdminModal(modal);
            resolve(accepted);
        };
        modal.querySelectorAll('[data-action="close"]').forEach((button) => {
            button.addEventListener('click', () => finish(false));
        });
        modal.querySelector('[data-action="confirm"]').addEventListener('click', () => finish(true));
        openAdminModal(modal, opener);
    });
}

class AdminMailboxManager {
    constructor() {
        // 管理员凭据仅保留在当前标签会话，避免共享设备长期残留。
        this.authToken = sessionStorage.getItem('admin_token');
        localStorage.removeItem('admin_token');
        this.currentView = 'login';
        this.currentPage = 1;
        this.pageSize = 20;
        this.currentStatus = 'all';
        this.currentSource = 'all';
        this.searchQuery = '';

        // 邮箱创建视图沿用 register 内部标识，只调整用户可见语义。
        this.registerMode = 'single';
        this.batchStrategy = 'random';
        this.isRegistering = false;
        this.availableDomains = [];
        this.batchAddresses = [];
        this.batchPlanSignature = '';

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
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    item.click();
                }
            });
        });
        
        // 筛选按钮
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.remove('active');
                });
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

        // 邮箱创建表单
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

        // 创建模式切换
        const modeInputs = document.querySelectorAll('input[name="reg-create-mode"]');
        if (modeInputs && modeInputs.length > 0) {
            modeInputs.forEach(input => {
                input.addEventListener('change', (e) => {
                    this.applyRegisterModeToUi(e.target.value);
                });
            });

            const selectedInput = Array.from(modeInputs).find(i => i.checked);
            const selectedMode = (selectedInput && selectedInput.value) ? selectedInput.value : 'single';
            this.applyRegisterModeToUi(selectedMode);
        }

        const strategyInputs = document.querySelectorAll('input[name="reg-batch-strategy"]');
        strategyInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.batchStrategy = this.getSelectedBatchStrategy();
                this.applyRegisterModeToUi(this.getSelectedRegisterMode());
            });
        });

        // 输入变化后立即重建预览，确保提交内容与管理员看到的地址一致。
        ['reg-email-prefix', 'reg-email-domain', 'reg-batch-count'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => this.refreshBatchPreview());
                input.addEventListener('change', () => this.refreshBatchPreview());
            }
        });
    }

    async generateRandomEmailPrefix() {
        const username = this.generateRandomUsername();

        // 设置到输入框
        const prefixInput = document.getElementById('reg-email-prefix');
        if (prefixInput) {
            prefixInput.value = username;
        }

        // 加载域名列表并随机选择一个
        const domainSelect = document.getElementById('reg-email-domain');
        const hasDomainOptions = domainSelect && domainSelect.options && domainSelect.options.length > 1;
        if (hasDomainOptions) {
            this.selectRandomDomain();
        } else {
            await this.loadAvailableDomains(true);
        }

        this.refreshBatchPreview();
    }

    selectRandomDomain() {
        const domainSelect = document.getElementById('reg-email-domain');
        if (!domainSelect || !domainSelect.options || domainSelect.options.length <= 1) {
            return;
        }

        const selectable = Array.from(domainSelect.options)
            .map(opt => opt.value)
            .filter(v => v);

        if (selectable.length === 0) {
            return;
        }

        const randomIndex = Math.floor(Math.random() * selectable.length);
        domainSelect.value = selectable[randomIndex];
    }

    async loadAvailableDomains(randomSelect = false) {
        try {
            const domains = this.normalizeDomains(await this.fetchAvailableDomains());
            const domainSelect = document.getElementById('reg-email-domain');

            this.availableDomains = domains;

            if (domainSelect) {
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
                if (randomSelect && domains.length > 0) {
                    const randomIndex = Math.floor(Math.random() * domains.length);
                    domainSelect.value = domains[randomIndex];
                }
            }

            this.refreshBatchPreview();
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
        
        // 保存token，仅在当前会话内有效。
        this.authToken = password;
        sessionStorage.setItem('admin_token', password);
        
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
            sessionStorage.removeItem('admin_token');
            this.showError(errorDiv, '密码错误');
        }
    }
    
    logout() {
        this.authToken = null;
        sessionStorage.removeItem('admin_token');
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
            this.resetRegisterView();
        }
    }

    resetRegisterView() {
        const form = document.getElementById('admin-register-form');
        if (form) {
            form.reset();
            form.style.display = 'block';
        }

        // 默认回到单个创建；进入批量时使用随机姓名与随机域名方案。
        const singleRadio = document.querySelector('input[name="reg-create-mode"][value="single"]');
        if (singleRadio) {
            singleRadio.checked = true;
        }
        const randomStrategyRadio = document.querySelector('input[name="reg-batch-strategy"][value="random"]');
        if (randomStrategyRadio) {
            randomStrategyRadio.checked = true;
        }
        this.batchStrategy = 'random';
        this.batchAddresses = [];
        this.batchPlanSignature = '';

        const batchCountInput = document.getElementById('reg-batch-count');
        if (batchCountInput) {
            batchCountInput.value = '2';
        }

        // 清空邮箱输入
        const prefixInput = document.getElementById('reg-email-prefix');
        const domainSelect = document.getElementById('reg-email-domain');
        if (prefixInput) {
            prefixInput.value = '';
        }
        if (domainSelect) {
            domainSelect.innerHTML = '<option value="">选择域名...</option>';
        }

        // 清空结果
        const result = document.getElementById('register-result');
        if (result) {
            result.style.display = 'none';
            result.innerHTML = '';
        }
        this.updateBatchProgress(0, 0, false);

        this.applyRegisterModeToUi('single');
        this.loadAvailableDomains(true);
    }

    getSelectedRegisterMode() {
        const checked = document.querySelector('input[name="reg-create-mode"]:checked');
        return checked && checked.value === 'batch' ? 'batch' : 'single';
    }

    getSelectedBatchStrategy() {
        const checked = document.querySelector('input[name="reg-batch-strategy"]:checked');
        return checked && checked.value === 'sequence' ? 'sequence' : 'random';
    }

    applyRegisterModeToUi(mode) {
        this.registerMode = mode === 'batch' ? 'batch' : 'single';
        this.batchStrategy = this.getSelectedBatchStrategy();

        const batchCountGroup = document.getElementById('reg-batch-count-group');
        const batchCountInput = document.getElementById('reg-batch-count');
        const batchStrategyGroup = document.getElementById('reg-batch-strategy-group');
        const batchPreviewGroup = document.getElementById('reg-batch-preview-group');
        const addressGroup = document.getElementById('reg-email-address-group');
        const addressLabel = document.getElementById('reg-email-address-label');
        const prefixInput = document.getElementById('reg-email-prefix');
        const domainSelect = document.getElementById('reg-email-domain');
        const registerForm = document.getElementById('admin-register-form');
        const submitBtn = registerForm ? registerForm.querySelector('button[type="submit"]') : null;
        const isBatch = this.registerMode === 'batch';
        const needsManualAddress = !isBatch || this.batchStrategy === 'sequence';

        if (batchCountGroup) {
            batchCountGroup.style.display = isBatch ? 'block' : 'none';
        }
        if (batchCountInput) {
            batchCountInput.disabled = !isBatch;
        }
        if (batchStrategyGroup) {
            batchStrategyGroup.hidden = !isBatch;
        }
        if (batchPreviewGroup) {
            batchPreviewGroup.hidden = !isBatch;
        }
        if (addressGroup) {
            addressGroup.hidden = !needsManualAddress;
        }
        if (addressLabel) {
            addressLabel.textContent = isBatch ? '用户名前缀与域名 *' : '邮箱地址 *';
        }

        if (prefixInput) {
            prefixInput.disabled = !needsManualAddress;
            prefixInput.required = needsManualAddress;
            prefixInput.placeholder = isBatch ? '用户名前缀（如 team）' : '用户名（如 oliviawilson4821）';
        }
        if (domainSelect) {
            domainSelect.disabled = !needsManualAddress;
            domainSelect.required = needsManualAddress;
        }

        if (submitBtn) {
            submitBtn.innerHTML = isBatch
                ? `${uiIcon('layer-group')}<span>批量创建</span>`
                : `${uiIcon('plus')}<span>创建邮箱</span>`;
        }

        this.refreshBatchPreview();
    }

    generateRandomUsername() {
        const firstNames = this.getRandomFirstNames();
        const lastNames = this.getRandomLastNames();
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const digits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `${firstName}${lastName}${digits}`;
    }

    getRandomFirstNames() {
        return [
            'alex', 'emma', 'oliver', 'mia', 'liam', 'sophia', 'noah', 'ava',
            'jack', 'lily', 'lucas', 'grace', 'leo', 'ella', 'henry', 'chloe',
            'james', 'zoey', 'ethan', 'alice'
        ];
    }

    getRandomLastNames() {
        return [
            'smith', 'brown', 'davis', 'wilson', 'taylor', 'moore', 'clark',
            'hall', 'young', 'king', 'wright', 'green', 'baker', 'adams',
            'scott', 'lewis', 'walker', 'turner', 'hill', 'reed'
        ];
    }

    shuffleValues(values) {
        const shuffled = [...values];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    normalizeDomains(domains) {
        // API 域名先去空和去重，避免同一域名在轮转中获得额外权重。
        return [...new Set((Array.isArray(domains) ? domains : [])
            .map(domain => String(domain ?? '').trim())
            .filter(Boolean))];
    }

    generateRandomUsernames(count) {
        const combinations = [];
        this.getRandomFirstNames().forEach(firstName => {
            this.getRandomLastNames().forEach(lastName => {
                combinations.push(`${firstName}${lastName}`);
            });
        });

        // 姓名组合本身不重复，因此即使四位数字碰撞也能保证同批用户名唯一。
        return this.shuffleValues(combinations).slice(0, count).map(name => {
            const digits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            return `${name}${digits}`;
        });
    }

    generateRotatingDomains(domains, count) {
        const normalized = this.normalizeDomains(domains);
        const scheduled = [];
        while (scheduled.length < count && normalized.length > 0) {
            // 每轮重新洗牌后再依次分配，域名不足时也能均衡复用。
            for (const domain of this.shuffleValues(normalized)) {
                scheduled.push(domain);
                if (scheduled.length === count) break;
            }
        }
        return scheduled;
    }

    generateRandomBatchAddresses(count, domains) {
        const usernames = this.generateRandomUsernames(count);
        const scheduledDomains = this.generateRotatingDomains(domains, count);
        if (scheduledDomains.length !== count) return [];
        return usernames.map((username, index) => `${username}@${scheduledDomains[index]}`);
    }

    isValidLocalPart(localPart) {
        return /^[a-zA-Z0-9]{3,20}$/.test(localPart);
    }

    escapeHtml(text) {
        return escapeHtml(text);
    }

    buildMailboxAccessPath(address, mailboxKey) {
        // 分段编码凭据，避免邮箱特殊字符破坏 /web/<邮箱>----<密钥> 路由。
        return `/web/${encodeURIComponent(address)}----${encodeURIComponent(mailboxKey)}`;
    }

    setRegisterSubmitting(isSubmitting) {
        this.isRegistering = isSubmitting;
        const form = document.getElementById('admin-register-form');
        const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
        const randomBtn = document.getElementById('reg-random-btn');
        const inputs = form ? form.querySelectorAll('input, textarea, select, button') : [];

        if (inputs && inputs.length > 0) {
            inputs.forEach(el => {
                if (el === submitBtn) return;
                if (el === randomBtn) return;
                el.disabled = isSubmitting;
            });
        }

        if (submitBtn) {
            window.MaildropUI.setBusy(submitBtn, isSubmitting, isSubmitting ? '创建中...' : '');
            if (!isSubmitting) {
                this.applyRegisterModeToUi(this.registerMode);
            }
        }

        if (randomBtn) {
            randomBtn.disabled = isSubmitting;
        }
    }

    generateBatchAddresses(prefix, domain, count) {
        const digits = Math.max(2, String(count).length);
        const addresses = [];
        for (let i = 1; i <= count; i++) {
            const number = String(i).padStart(digits, '0');
            addresses.push(`${prefix}${number}@${domain}`);
        }
        return { digits, addresses };
    }

    getBatchPlanSignature() {
        const count = parseInt(document.getElementById('reg-batch-count')?.value || '0');
        const prefix = document.getElementById('reg-email-prefix')?.value.trim() || '';
        const domain = document.getElementById('reg-email-domain')?.value.trim() || '';
        return JSON.stringify({
            strategy: this.getSelectedBatchStrategy(),
            count,
            prefix,
            domain,
            domains: this.normalizeDomains(this.availableDomains)
        });
    }

    refreshBatchPreview() {
        const previewList = document.getElementById('reg-batch-preview-list');
        if (!previewList || this.getSelectedRegisterMode() !== 'batch') {
            this.batchAddresses = [];
            this.batchPlanSignature = '';
            return;
        }

        const count = parseInt(document.getElementById('reg-batch-count')?.value || '0');
        const strategy = this.getSelectedBatchStrategy();
        const prefix = document.getElementById('reg-email-prefix')?.value.trim() || '';
        const domain = document.getElementById('reg-email-domain')?.value.trim() || '';
        let addresses = [];
        let emptyMessage = '';

        if (!Number.isInteger(count) || count < 2 || count > 100) {
            emptyMessage = '请输入 2–100 的创建数量';
        } else if (strategy === 'random') {
            const domains = this.normalizeDomains(this.availableDomains);
            if (domains.length === 0) {
                emptyMessage = '暂无可用域名，无法生成预览';
            } else {
                addresses = this.generateRandomBatchAddresses(count, domains);
            }
        } else if (!prefix || !domain) {
            emptyMessage = '填写前缀并选择域名后显示预览';
        } else if (!/^[a-zA-Z0-9]+$/.test(prefix)) {
            emptyMessage = '批量前缀仅允许英文和数字';
        } else {
            const generated = this.generateBatchAddresses(prefix, domain, count);
            const localPartLength = prefix.length + generated.digits;
            if (localPartLength < 3 || localPartLength > 20) {
                emptyMessage = '前缀加序号后的长度需为 3–20';
            } else {
                addresses = generated.addresses;
            }
        }

        this.batchAddresses = addresses;
        this.batchPlanSignature = this.getBatchPlanSignature();
        previewList.replaceChildren();

        if (addresses.length === 0) {
            const item = document.createElement('li');
            item.className = 'batch-preview-empty';
            item.textContent = emptyMessage || '暂无预览';
            previewList.appendChild(item);
            return;
        }

        addresses.slice(0, 3).forEach(address => {
            const item = document.createElement('li');
            item.textContent = address;
            previewList.appendChild(item);
        });
    }

    updateBatchProgress(completed, total, visible = true) {
        const progress = document.getElementById('reg-batch-progress');
        const text = document.getElementById('reg-batch-progress-text');
        const bar = document.getElementById('reg-batch-progress-bar');
        if (!progress || !text || !bar) return;

        const safeTotal = Math.max(0, Number(total) || 0);
        const safeCompleted = Math.min(safeTotal, Math.max(0, Number(completed) || 0));
        progress.hidden = !visible;
        text.textContent = `已完成 ${safeCompleted}/${safeTotal}`;
        bar.max = Math.max(1, safeTotal);
        bar.value = safeCompleted;
        bar.textContent = `${safeTotal > 0 ? Math.round((safeCompleted / safeTotal) * 100) : 0}%`;
    }

    async createMailboxByAddress({ address, retentionDays, senderWhitelist, allowedDomains, whitelistEnabled }) {
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

        if (!response.data || !response.data.mailbox_key) {
            throw new Error('创建结果缺少邮箱密钥');
        }

        if (whitelistEnabled && senderWhitelist.length > 0) {
            await this.apiRequest(`/api/admin/mailboxes/${encodeURIComponent(response.data.id)}`, {
                method: 'PUT',
                body: JSON.stringify({ whitelist_enabled: true })
            });
        }

        return response.data;
    }

    async handleRegister() {
        if (this.isRegistering) {
            return;
        }

        const mode = this.getSelectedRegisterMode();
        const emailPrefix = document.getElementById('reg-email-prefix').value.trim();
        const emailDomain = document.getElementById('reg-email-domain').value.trim();
        const retentionDays = parseInt(document.getElementById('reg-retention-days').value);
        const whitelistText = document.getElementById('reg-sender-whitelist').value;
        const allowedDomainsText = document.getElementById('reg-allowed-domains').value;
        const whitelistEnabled = document.getElementById('reg-whitelist-enabled').checked;

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

        const commonOptions = {
            retentionDays,
            senderWhitelist,
            allowedDomains,
            whitelistEnabled
        };

        if (mode === 'batch') {
            const count = parseInt(document.getElementById('reg-batch-count').value);
            const strategy = this.getSelectedBatchStrategy();
            if (!Number.isInteger(count) || count < 2 || count > 100) {
                this.showToast('error', '创建数量必须为 2–100');
                return;
            }

            let addresses = [];
            if (strategy === 'random') {
                if (this.availableDomains.length === 0) {
                    await this.loadAvailableDomains(false);
                }
                if (this.availableDomains.length === 0) {
                    this.showToast('error', '暂无可用域名，无法批量创建');
                    return;
                }

                // 优先提交预览中的方案，避免点击创建后地址突然变化。
                const signature = this.getBatchPlanSignature();
                if (this.batchPlanSignature !== signature || this.batchAddresses.length !== count) {
                    this.refreshBatchPreview();
                }
                addresses = [...this.batchAddresses];
            } else {
                if (!emailPrefix || !emailDomain) {
                    this.showToast('error', '请输入完整的用户名前缀和域名');
                    return;
                }
                if (!/^[a-zA-Z0-9]+$/.test(emailPrefix)) {
                    this.showToast('error', '批量前缀仅允许英文/数字');
                    return;
                }

                const generated = this.generateBatchAddresses(emailPrefix, emailDomain, count);
                const maxLocalPartLen = emailPrefix.length + generated.digits;
                if (maxLocalPartLen > 20 || maxLocalPartLen < 3) {
                    this.showToast('error', '前缀+序号后长度必须为 3–20');
                    return;
                }
                addresses = generated.addresses;
            }

            // 兜底验证数量、唯一性与 local-part，避免异常域名数据生成无效请求。
            const usernames = addresses.map(address => address.split('@')[0]);
            const anyInvalid = addresses.length !== count
                || new Set(usernames).size !== count
                || usernames.some(username => !this.isValidLocalPart(username));
            if (anyInvalid) {
                this.showToast('error', '批量生成的用户名不符合规则，请调整前缀/数量');
                return;
            }

            await this.handleBatchRegister({
                addresses,
                ...commonOptions
            });
            return;
        }

        if (!emailPrefix || !emailDomain) {
            this.showToast('error', '请输入完整的邮箱地址');
            return;
        }

        // 单个创建：校验local-part
        if (!this.isValidLocalPart(emailPrefix)) {
            this.showToast('error', '用户名仅允许英文/数字，长度 3–20');
            return;
        }

        const address = `${emailPrefix}@${emailDomain}`;

        try {
            this.setRegisterSubmitting(true);
            const mailbox = await this.createMailboxByAddress({ address, ...commonOptions });

            this.showToast('success', '邮箱创建成功');

            // 显示结果
            const form = document.getElementById('admin-register-form');
            const result = document.getElementById('register-result');
            const accessPath = this.buildMailboxAccessPath(mailbox.address, mailbox.mailbox_key);
            const accessUrl = `${window.location.origin}${accessPath}`;

            form.style.display = 'none';
            result.style.display = 'block';
            result.innerHTML = `
                <div class="success-message">
                    ${uiIcon('check-circle')}
                    <h3>邮箱创建成功！</h3>
                </div>
                <div class="mailbox-info">
                    <div class="info-item">
                        <label>邮箱地址</label>
                        <div class="info-value address-value">${escapeHtml(mailbox.address)}</div>
                    </div>
                    
                    <div class="info-item">
                        <label>邮箱密钥</label>
                        <div class="token-box">
                            <code>${escapeHtml(mailbox.mailbox_key)}</code>
                            <button class="btn btn-sm btn-secondary" type="button" data-action="copy-key">
                                ${uiIcon('copy')} 复制
                            </button>
                        </div>
                        <div class="warning-alert">
                            ${uiIcon('warning')}
                            <span>密钥会包含在访问地址中，请按登录凭据妥善保管。</span>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <label>过期时间</label>
                        <div class="info-value">${escapeHtml(this.formatDate(mailbox.expires_at))}</div>
                    </div>
                    
                    <div class="info-item">
                        <label>邮箱访问地址</label>
                        <div class="info-value">
                            <a data-role="access-link" target="_blank" rel="noopener noreferrer" class="access-link">
                                ${escapeHtml(accessUrl)}
                            </a>
                            <button class="btn btn-sm btn-secondary" type="button" data-action="copy-link">
                                ${uiIcon('copy')} 复制链接
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="result-actions">
                    <button class="btn btn-success" type="button" data-action="open-mailbox">
                        ${uiIcon('external-link')}
                        打开邮箱
                    </button>
                    <button class="btn btn-primary" type="button" data-action="continue-register">
                        ${uiIcon('plus')}
                        继续创建
                    </button>
                    <button class="btn btn-secondary" type="button" data-action="view-mailboxes">
                        ${uiIcon('list')}
                        查看邮箱列表
                    </button>
                </div>
            `;

            // 外部凭据只通过 DOM 属性和闭包传递，避免拼入内联 JavaScript。
            const accessLink = result.querySelector('[data-role="access-link"]');
            accessLink.href = accessPath;
            result.querySelector('[data-action="copy-key"]').addEventListener('click', () => {
                copyToClipboard(mailbox.mailbox_key);
            });
            result.querySelector('[data-action="copy-link"]').addEventListener('click', () => {
                copyToClipboard(accessUrl);
            });
            result.querySelector('[data-action="open-mailbox"]').addEventListener('click', () => {
                window.open(accessPath, '_blank', 'noopener,noreferrer');
            });
            result.querySelector('[data-action="continue-register"]').addEventListener('click', () => {
                this.switchView('register');
            });
            result.querySelector('[data-action="view-mailboxes"]').addEventListener('click', () => {
                this.switchView('mailboxes');
            });

            // 刷新统计
            this.loadStats();
        } catch (error) {
            this.showToast('error', error.message || '创建失败');
        } finally {
            this.setRegisterSubmitting(false);
        }
    }

    async handleBatchRegister({ addresses, retentionDays, senderWhitelist, allowedDomains, whitelistEnabled }) {
        const form = document.getElementById('admin-register-form');
        const result = document.getElementById('register-result');

        const results = [];

        try {
            this.setRegisterSubmitting(true);
            this.updateBatchProgress(0, addresses.length, true);

            for (let i = 0; i < addresses.length; i++) {
                const address = addresses[i];
                try {
                    const mailbox = await this.createMailboxByAddress({
                        address,
                        retentionDays,
                        senderWhitelist,
                        allowedDomains,
                        whitelistEnabled
                    });

                    results.push({
                        success: true,
                        address: mailbox.address,
                        mailbox_key: mailbox.mailbox_key
                    });
                } catch (error) {
                    results.push({
                        success: false,
                        address,
                        error: error.message || '创建失败'
                    });
                }
                this.updateBatchProgress(i + 1, addresses.length, true);
            }

            const total = results.length;
            const successCount = results.filter(r => r.success).length;
            const failedCount = total - successCount;

            const completionType = successCount === total
                ? 'success'
                : (successCount === 0 ? 'error' : 'warning');
            const completionTitle = completionType === 'success'
                ? '批量创建完成'
                : (completionType === 'error' ? '批量创建失败' : '批量创建部分完成');
            const completionIcon = completionType === 'success'
                ? 'check-circle'
                : (completionType === 'error' ? 'error' : 'warning');
            // 按真实结果反馈状态，避免部分失败或全部失败仍显示绿色成功提示。
            this.showToast(completionType, `${completionTitle}：成功 ${successCount}，失败 ${failedCount}`);

            // 显示结果
            if (form) form.style.display = 'none';
            if (result) {
                result.style.display = 'block';
                result.innerHTML = `
                    <div class="success-message batch-completion-message ${completionType}">
                        ${uiIcon(completionIcon)}
                        <h3>${completionTitle}</h3>
                        <p class="batch-completion-text">已完成 ${total}/${total}</p>
                    </div>

                    <div class="batch-result-summary">
                        <div class="batch-summary-item">
                            <div class="label">总请求数</div>
                            <div class="value">${total}</div>
                        </div>
                        <div class="batch-summary-item">
                            <div class="label">成功数</div>
                            <div class="value">${successCount}</div>
                        </div>
                        <div class="batch-summary-item">
                            <div class="label">失败数</div>
                            <div class="value">${failedCount}</div>
                        </div>
                    </div>

                    <div class="batch-result-list">
                        ${results.map(item => {
                            if (item.success) {
                                const addressEscaped = this.escapeHtml(item.address);
                                const openUrl = this.buildMailboxAccessPath(item.address, item.mailbox_key);
                                return `
                                    <div class="batch-result-item success">
                                        <div class="address">${addressEscaped}</div>
                                        <div class="detail"><a href="${escapeHtml(openUrl)}" target="_blank" rel="noopener noreferrer">打开邮箱</a></div>
                                    </div>
                                `;
                            }
                            return `
                                <div class="batch-result-item error">
                                    <div class="address">${this.escapeHtml(item.address)}</div>
                                    <div class="detail">${this.escapeHtml(item.error)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div class="result-actions">
                        <button class="btn btn-primary" type="button" data-action="continue-register">
                            ${uiIcon('plus')}
                            继续创建
                        </button>
                        <button class="btn btn-secondary" type="button" data-action="view-mailboxes">
                            ${uiIcon('list')}
                            查看邮箱列表
                        </button>
                    </div>
                `;
                result.querySelector('[data-action="continue-register"]').addEventListener('click', () => {
                    this.switchView('register');
                });
                result.querySelector('[data-action="view-mailboxes"]').addEventListener('click', () => {
                    this.switchView('mailboxes');
                });
            }

            this.loadStats();
        } finally {
            this.setRegisterSubmitting(false);
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
        tbody.innerHTML = `<tr><td colspan="9" class="loading-row">${uiIcon('spinner', 'is-spinning')} 加载中...</td></tr>`;

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
        const rows = Array.isArray(mailboxes) ? mailboxes : [];

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-row">暂无数据</td></tr>';
            tbody.onclick = null;
            tbody.onchange = null;
            return;
        }

        // 创建来源标签配置
        const sourceLabels = {
            'admin': { text: '管理员', class: 'source-admin', icon: 'user-shield' },
            'register': { text: '自助创建', class: 'source-register', icon: 'user-plus' },
            'api_v2': { text: 'API', class: 'source-api', icon: 'code' },
            'unknown': { text: '未知', class: 'source-unknown', icon: 'question' }
        };

        tbody.innerHTML = rows.map((mailbox, index) => {
            const statusClass = mailbox.is_expired ? 'expired' : (mailbox.is_active ? 'active' : 'disabled');
            const statusText = mailbox.is_expired ? '已过期' : (mailbox.is_active ? '活跃' : '已禁用');

            const source = mailbox.created_source || 'unknown';
            const sourceConfig = sourceLabels[source] || sourceLabels['unknown'];

            return `
                <tr>
                    <td>
                        <input type="checkbox" class="mailbox-checkbox" value="${escapeHtml(mailbox.id)}">
                    </td>
                    <td data-label="邮箱地址">
                        <div class="mailbox-address">
                            <span class="mailbox-address-text" title="${escapeHtml(mailbox.address)}">${escapeHtml(mailbox.address)}</span>
                            ${mailbox.whitelist_enabled ? `<span class="mailbox-shield-indicator" title="已启用白名单" aria-label="已启用白名单">${uiIcon('shield', 'mailbox-shield-icon')}</span>` : ''}
                        </div>
                    </td>
                    <td data-label="状态"><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td data-label="创建来源">
                        <span class="source-badge ${sourceConfig.class}">
                            ${uiIcon(sourceConfig.icon)}
                            ${sourceConfig.text}
                        </span>
                    </td>
                    <td data-label="创建时间">${escapeHtml(this.formatDate(mailbox.created_at))}</td>
                    <td data-label="过期时间">${escapeHtml(this.formatDate(mailbox.expires_at))}</td>
                    <td data-label="邮件数">${escapeHtml(safeNumber(mailbox.email_count))}</td>
                    <td data-label="未读">${escapeHtml(safeNumber(mailbox.unread_count))}</td>
                    <td class="actions-cell">
                        <div class="action-buttons">
                            <button class="btn-icon" type="button" data-action="view" data-mailbox-index="${index}" title="查看详情" aria-label="查看详情">
                                ${uiIcon('eye')}
                            </button>
                            <button class="btn-icon" type="button" data-action="edit" data-mailbox-index="${index}" title="编辑" aria-label="编辑">
                                ${uiIcon('edit')}
                            </button>
                            <button class="btn-icon btn-danger" type="button" data-action="delete" data-mailbox-index="${index}" title="删除" aria-label="删除">
                                ${uiIcon('trash')}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // 使用索引从当前响应取原值，避免把未信任 ID 拼入 onclick JavaScript。
        tbody.onclick = (event) => {
            const button = event.target.closest('button[data-mailbox-index]');
            if (!button || !tbody.contains(button)) return;

            const mailbox = rows[Number(button.dataset.mailboxIndex)];
            if (!mailbox) return;

            if (button.dataset.action === 'view') {
                this.viewMailbox(mailbox.id);
            } else if (button.dataset.action === 'edit') {
                this.editMailbox(mailbox.id);
            } else if (button.dataset.action === 'delete') {
                this.deleteMailbox(mailbox.id);
            }
        };
        tbody.onchange = (event) => {
            if (event.target.matches('.mailbox-checkbox')) {
                updateBatchDeleteButton();
            }
        };
    }
    
    renderPagination(data) {
        const pagination = document.getElementById('pagination');
        const page = Math.max(1, Math.trunc(safeNumber(data.page, 1)));
        const totalPages = Math.max(1, Math.trunc(safeNumber(data.total_pages, 1)));
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            pagination.onclick = null;
            return;
        }
        
        let html = '<div class="pagination-buttons">';
        
        // 上一页
        if (page > 1) {
            html += `<button class="btn btn-sm" type="button" data-page="${page - 1}" title="上一页" aria-label="上一页">${uiIcon('chevron-left')}</button>`;
        }
        
        // 页码
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
                html += `<button class="btn btn-sm ${i === page ? 'active' : ''}" type="button" data-page="${i}">${i}</button>`;
            } else if (i === page - 3 || i === page + 3) {
                html += '<span>...</span>';
            }
        }
        
        // 下一页
        if (page < totalPages) {
            html += `<button class="btn btn-sm" type="button" data-page="${page + 1}" title="下一页" aria-label="下一页">${uiIcon('chevron-right')}</button>`;
        }
        
        html += '</div>';
        pagination.innerHTML = html;
        pagination.onclick = (event) => {
            const button = event.target.closest('button[data-page]');
            if (!button || !pagination.contains(button)) return;
            this.goToPage(Number(button.dataset.page));
        };
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
        const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
        // API 错误信息由共享 Toast 以 textContent 写入，避免外部输入进入 HTML。
        return window.MaildropUI.toast(String(message ?? ''), safeType);
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
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content modal-content--compact">
            <div class="modal-header">
                <h3>邮箱创建成功</h3>
            </div>
            <div class="modal-body">
                <div class="token-display">
                    <p><strong>邮箱地址：</strong><span data-role="mailbox-address"></span></p>
                    <p><strong>访问令牌（请妥善保存，仅显示一次）：</strong></p>
                    <div class="token-box">
                        <code data-role="access-token"></code>
                        <button class="btn-icon" type="button" data-action="copy-token" title="复制" aria-label="复制">
                            ${uiIcon('copy')}
                        </button>
                    </div>
                    <p class="warning-text">
                        ${uiIcon('warning')}
                        此令牌仅显示一次，请立即复制保存！
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" type="button" data-action="close">我已保存</button>
            </div>
        </div>
    `;
    modal.querySelector('[data-role="mailbox-address"]').textContent = String(mailbox.address ?? '');
    modal.querySelector('[data-role="access-token"]').textContent = String(mailbox.access_token ?? '');
    modal.querySelector('[data-action="copy-token"]').addEventListener('click', () => {
        copyToClipboard(mailbox.access_token);
    });
    modal.querySelector('[data-action="close"]').addEventListener('click', () => {
        closeAndRemoveAdminModal(modal);
    });
    openAdminModal(modal);
}

function copyToClipboard(text) {
    const value = String(text ?? '');
    navigator.clipboard.writeText(value).then(() => {
        adminManager.showToast('success', '已复制到剪贴板');
    }).catch(() => {
        // 降级方案
        const input = document.createElement('input');
        input.value = value;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        adminManager.showToast('success', '已复制到剪贴板');
    });
}

// 添加到AdminMailboxManager类
AdminMailboxManager.prototype.viewMailbox = async function(mailboxId) {
    // 在异步详情请求前保存列表触发按钮，后续串联确认框时才能把焦点还给原位置。
    const viewOpener = document.activeElement;
    try {
        const response = await this.apiRequest(`/api/admin/mailboxes/${encodeURIComponent(mailboxId)}`);
        const mailbox = response.data;
        const accessPath = this.buildMailboxAccessPath(mailbox.address, mailbox.mailbox_key);
        const accessUrl = `${window.location.origin}${accessPath}`;
        const senderWhitelist = Array.isArray(mailbox.sender_whitelist) ? mailbox.sender_whitelist : [];
        const allowedDomains = Array.isArray(mailbox.allowed_domains) ? mailbox.allowed_domains : [];
        const storagePercent = Math.min(100, Math.max(0, safeNumber(mailbox.storage_percent)));
        const storageUsed = safeNumber(mailbox.storage_used_mb);
        const storageLimit = safeNumber(mailbox.storage_limit_mb, 50);

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-content--wide">
                <div class="modal-header">
                    <h3>${uiIcon('inbox')} 邮箱详情</h3>
                    <button class="modal-close" type="button" data-action="close" title="关闭对话框" aria-label="关闭对话框">
                        ${uiIcon('close')}
                    </button>
                </div>
                <div class="modal-body">
                    <div class="detail-grid">
                        <div class="detail-item full-width">
                            <label>${uiIcon('at')} 邮箱地址</label>
                            <div class="address-value">${escapeHtml(mailbox.address)}</div>
                        </div>
                        <div class="detail-item">
                            <label>${uiIcon('info')} 状态</label>
                            <div>
                                <span class="status-badge ${mailbox.is_expired ? 'expired' : (mailbox.is_active ? 'active' : 'disabled')}">
                                    ${mailbox.is_expired ? '已过期' : (mailbox.is_active ? '活跃' : '已禁用')}
                                </span>
                            </div>
                        </div>
                        <div class="detail-item">
                            <label>${uiIcon('calendar-plus')} 创建时间</label>
                            <div>${escapeHtml(this.formatDate(mailbox.created_at))}</div>
                        </div>
                        <div class="detail-item">
                            <label>${uiIcon('hourglass-end')} 过期时间</label>
                            <div>${escapeHtml(this.formatDate(mailbox.expires_at))}</div>
                        </div>
                        <div class="detail-item">
                            <label>${uiIcon('stopwatch')} 保留天数</label>
                            <div>${escapeHtml(safeNumber(mailbox.retention_days))} 天</div>
                        </div>
                        <div class="detail-item">
                            <label>${uiIcon('mail')} 邮件统计</label>
                            <div>总计 ${escapeHtml(safeNumber(mailbox.email_count))} 封，未读 ${escapeHtml(safeNumber(mailbox.unread_count))} 封</div>
                        </div>
                        <div class="detail-item">
                            <label>${uiIcon('storage')} 存储容量</label>
                            <div>
                                <div class="storage-info">
                                    <div class="storage-bar">
                                        <div class="storage-used" style="width: ${storagePercent}%"></div>
                                    </div>
                                    <div class="storage-text">
                                        ${storageUsed.toFixed(2)} MB / ${storageLimit.toFixed(2)} MB
                                        (${storagePercent.toFixed(1)}%)
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="detail-item">
                            <label>${uiIcon('shield')} 白名单状态</label>
                            <div>${mailbox.whitelist_enabled ? '已启用' : '未启用'}</div>
                        </div>
                        <div class="detail-item full-width">
                            <label>${uiIcon('list-alt')} 发件人白名单</label>
                            <div>${escapeHtml(senderWhitelist.length > 0 ? senderWhitelist.join(', ') : '无')}</div>
                        </div>
                        <div class="detail-item full-width">
                            <label>${uiIcon('globe')} 允许的域名</label>
                            <div>${escapeHtml(allowedDomains.length > 0 ? allowedDomains.join(', ') : '无限制')}</div>
                        </div>
                        <div class="detail-item full-width">
                            <label>${uiIcon('key')} 访问令牌 (Access Token)</label>
                            <div class="token-display-inline">
                                <code>${escapeHtml(mailbox.access_token)}</code>
                                <button class="btn-icon" type="button" data-action="copy-token" title="复制" aria-label="复制">
                                    ${uiIcon('copy')}
                                </button>
                            </div>
                        </div>
                        <div class="detail-item full-width">
                            <label>${uiIcon('lock')} 邮箱密钥 (Mailbox Key)</label>
                            <div class="token-display-inline">
                                <code>${escapeHtml(mailbox.mailbox_key)}</code>
                                <button class="btn-icon" type="button" data-action="copy-key" title="复制" aria-label="复制">
                                    ${uiIcon('copy')}
                                </button>
                            </div>
                        </div>
                        <div class="detail-item">
                            <label>${uiIcon('network')} 创建IP</label>
                            <div>${escapeHtml(mailbox.created_by_ip || '-')}</div>
                        </div>
                        <div class="detail-item">
                            <label>${uiIcon('history')} 最后访问</label>
                            <div>${escapeHtml(this.formatDate(mailbox.last_accessed))}</div>
                        </div>
                        <div class="detail-item">
                            <label>${uiIcon('user-shield')} 最后更新管理员</label>
                            <div>${escapeHtml(mailbox.updated_by_admin || '-')}</div>
                        </div>
                        <div class="detail-item">
                            <label>${uiIcon('pen')} 最后更新时间</label>
                            <div>${escapeHtml(this.formatDate(mailbox.updated_at))}</div>
                        </div>
                        <div class="detail-item full-width quick-access-box">
                            <div class="quick-access-label">
                                ${uiIcon('link')}
                                🎯 快速访问链接
                            </div>
                            <div class="quick-access-content">
                                <div class="quick-access-url">${escapeHtml(accessUrl)}</div>
                                <div class="quick-access-actions">
                                    <button class="btn btn-sm btn-secondary" type="button" data-action="copy-link" title="复制链接">
                                        ${uiIcon('copy')} 复制
                                    </button>
                                    <a data-role="access-link" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">
                                        ${uiIcon('external-link')} 打开
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" type="button" data-action="close">关闭</button>
                    <button class="btn btn-warning" type="button" data-action="reset-token">
                        ${uiIcon('key')}
                        重置令牌
                    </button>
                    <button class="btn btn-primary" type="button" data-action="edit">
                        ${uiIcon('edit')}
                        编辑
                    </button>
                    ${!mailbox.is_active ?
                        `<button class="btn btn-success" type="button" data-action="enable">
                            ${uiIcon('undo')}
                            恢复邮箱
                        </button>` : ''
                    }
                </div>
            </div>
        `;
        modal.querySelector('[data-role="access-link"]').href = accessPath;
        modal.querySelectorAll('[data-action="close"]').forEach(button => {
            button.addEventListener('click', () => closeAndRemoveAdminModal(modal));
        });
        modal.querySelector('[data-action="copy-token"]').addEventListener('click', () => {
            copyToClipboard(mailbox.access_token);
        });
        modal.querySelector('[data-action="copy-key"]').addEventListener('click', () => {
            copyToClipboard(mailbox.mailbox_key);
        });
        modal.querySelector('[data-action="copy-link"]').addEventListener('click', () => {
            copyToClipboard(accessUrl);
        });
        modal.querySelector('[data-action="reset-token"]').addEventListener('click', () => {
            closeAndRemoveAdminModal(modal);
            resetMailboxToken(mailboxId, viewOpener);
        });
        modal.querySelector('[data-action="edit"]').addEventListener('click', () => {
            closeAndRemoveAdminModal(modal);
            this.editMailbox(mailboxId);
        });
        const enableButton = modal.querySelector('[data-action="enable"]');
        if (enableButton) {
            enableButton.addEventListener('click', () => {
                closeAndRemoveAdminModal(modal);
                enableMailbox(mailboxId, viewOpener);
            });
        }
        openAdminModal(modal, viewOpener);
    } catch (error) {
        this.showToast('error', '加载邮箱详情失败');
    }
};

AdminMailboxManager.prototype.editMailbox = async function(mailboxId) {
    try {
        const response = await this.apiRequest(`/api/admin/mailboxes/${encodeURIComponent(mailboxId)}`);
        const mailbox = response.data;
        const senderWhitelist = Array.isArray(mailbox.sender_whitelist) ? mailbox.sender_whitelist : [];
        const allowedDomains = Array.isArray(mailbox.allowed_domains) ? mailbox.allowed_domains : [];

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-content--medium">
                <div class="modal-header">
                    <h3>编辑邮箱</h3>
                    <button class="modal-close" type="button" data-action="close" title="关闭对话框" aria-label="关闭对话框">
                        ${uiIcon('close')}
                    </button>
                </div>
                <div class="modal-body">
                    <form id="edit-mailbox-form">
                        <div class="form-group">
                            <label>邮箱地址</label>
                            <input type="text" data-role="mailbox-address" disabled>
                        </div>
                        <div class="form-group">
                            <label for="edit-retention-days">保留天数</label>
                            <input type="number" id="edit-retention-days" min="1" max="36500">
                        </div>
                        <div class="form-group">
                            <label for="edit-sender-whitelist">发件人白名单</label>
                            <textarea id="edit-sender-whitelist" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label for="edit-allowed-domains">允许的域名</label>
                            <textarea id="edit-allowed-domains" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="edit-whitelist-enabled">
                                启用白名单过滤
                            </label>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="edit-is-active">
                                邮箱激活状态
                            </label>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" type="button" data-action="close">取消</button>
                    <button class="btn btn-primary" type="button" data-action="save">
                        ${uiIcon('save')}
                        保存
                    </button>
                </div>
            </div>
        `;
        // 表单值通过 value/textContent 属性写入，避免 textarea 与属性上下文注入。
        modal.querySelector('[data-role="mailbox-address"]').value = String(mailbox.address ?? '');
        modal.querySelector('#edit-retention-days').value = String(safeNumber(mailbox.retention_days, 30));
        modal.querySelector('#edit-sender-whitelist').value = senderWhitelist.join('\n');
        modal.querySelector('#edit-allowed-domains').value = allowedDomains.join('\n');
        modal.querySelector('#edit-whitelist-enabled').checked = Boolean(mailbox.whitelist_enabled);
        modal.querySelector('#edit-is-active').checked = Boolean(mailbox.is_active);
        modal.querySelectorAll('[data-action="close"]').forEach(button => {
            button.addEventListener('click', () => closeAndRemoveAdminModal(modal));
        });
        modal.querySelector('[data-action="save"]').addEventListener('click', () => {
            this.saveMailboxEdit(mailboxId, modal);
        });
        openAdminModal(modal);
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

        await this.apiRequest(`/api/admin/mailboxes/${encodeURIComponent(mailboxId)}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });

        this.showToast('success', '更新成功');
        closeAndRemoveAdminModal(modal);

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
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content modal-content--compact">
            <div class="modal-header">
                <h3>确认删除</h3>
                <button class="modal-close" type="button" data-action="close" title="关闭对话框" aria-label="关闭对话框">
                    ${uiIcon('close')}
                </button>
            </div>
            <div class="modal-body">
                <p>确定要删除此邮箱吗？</p>
                <div class="alert alert-warning">
                    ${uiIcon('info')}
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
                <button class="btn btn-secondary" type="button" data-action="close">取消</button>
                <button class="btn btn-danger" type="button" data-action="confirm">
                    ${uiIcon('trash')}
                    确认删除
                </button>
            </div>
        </div>
    `;
    modal.querySelectorAll('[data-action="close"]').forEach(button => {
        button.addEventListener('click', () => closeAndRemoveAdminModal(modal));
    });
    modal.querySelector('[data-action="confirm"]').addEventListener('click', () => {
        this.confirmDeleteMailbox(mailboxId, modal);
    });
    openAdminModal(modal);
};

AdminMailboxManager.prototype.confirmDeleteMailbox = async function(mailboxId, modal) {
    try {
        await this.apiRequest(`/api/admin/mailboxes/${encodeURIComponent(mailboxId)}?soft=true`, {
            method: 'DELETE'
        });

        this.showToast('success', '邮箱已删除');
        closeAndRemoveAdminModal(modal);

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
    tbody.innerHTML = `<tr><td colspan="6" class="loading-row">${uiIcon('spinner', 'is-spinning')} 加载中...</td></tr>`;

    try {
        const response = await this.apiRequest('/api/admin/audit-logs?limit=100');
        const logs = Array.isArray(response.data) ? response.data : [];

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-row">暂无审计日志</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map((log, index) => `
            <tr>
                <td data-label="时间">${escapeHtml(this.formatDate(log.timestamp))}</td>
                <td data-label="操作"><span class="action-badge action-${safeCssToken(log.action)}">${escapeHtml(log.action || '-')}</span></td>
                <td data-label="邮箱ID"><code>${escapeHtml(log.mailbox_id || '-')}</code></td>
                <td data-label="管理员">${escapeHtml(log.admin_user || '-')}</td>
                <td data-label="IP地址">${escapeHtml(log.ip_address || '-')}</td>
                <td class="actions-cell">
                    <div class="action-buttons">
                        <button class="btn-icon" type="button" data-log-index="${index}" title="查看详情" aria-label="查看审计详情">
                            ${uiIcon('info')}
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        // 日志对象仅保留在闭包中，不能序列化进 onclick 属性。
        tbody.onclick = (event) => {
            const button = event.target.closest('button[data-log-index]');
            if (!button || !tbody.contains(button)) return;
            const log = logs[Number(button.dataset.logIndex)];
            if (log) this.showAuditDetail(log);
        };
    } catch (error) {
        console.error('加载审计日志失败:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="error-row">加载失败</td></tr>';
        this.showToast('error', '加载审计日志失败');
    }
};

AdminMailboxManager.prototype.showAuditDetail = function(log) {
    const modal = document.createElement('div');
    modal.className = 'modal';

    modal.innerHTML = `
        <div class="modal-content modal-content--medium">
                <div class="modal-header">
                    <h3>${uiIcon('info')} 审计日志详情</h3>
                    <button class="modal-close" type="button" data-action="close" title="关闭对话框" aria-label="关闭对话框">
                    ${uiIcon('close')}
                </button>
            </div>
            <div class="modal-body">
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>${uiIcon('clock')} 时间</label>
                        <div>${escapeHtml(this.formatDate(log.timestamp))}</div>
                    </div>
                    <div class="detail-item">
                        <label>${uiIcon('tag')} 操作</label>
                        <div><span class="action-badge action-${safeCssToken(log.action)}">${escapeHtml(log.action || '-')}</span></div>
                    </div>
                    <div class="detail-item">
                        <label>${uiIcon('inbox')} 邮箱ID</label>
                        <div><code>${escapeHtml(log.mailbox_id || '-')}</code></div>
                    </div>
                    <div class="detail-item">
                        <label>${uiIcon('user-shield')} 管理员</label>
                        <div>${escapeHtml(log.admin_user || '-')}</div>
                    </div>
                    <div class="detail-item">
                        <label>${uiIcon('network')} IP地址</label>
                        <div>${escapeHtml(log.ip_address || '-')}</div>
                    </div>
                    <div class="detail-item full-width">
                        <label>${uiIcon('file-code')} 变更内容</label>
                        <pre class="audit-log-content json-viewer" data-role="changes"></pre>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" type="button" data-action="close">关闭</button>
            </div>
        </div>
    `;
    // 审计 changes 可能含任意数据库内容，纯文本展示比手写 HTML 高亮更可靠。
    let changesText = '无数据';
    if (log.changes !== null && log.changes !== undefined) {
        try {
            changesText = JSON.stringify(log.changes, null, 2) ?? String(log.changes);
        } catch (error) {
            changesText = String(log.changes);
        }
    }
    modal.querySelector('[data-role="changes"]').textContent = changesText;
    modal.querySelectorAll('[data-action="close"]').forEach(button => {
        button.addEventListener('click', () => closeAndRemoveAdminModal(modal));
    });
    openAdminModal(modal);
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
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content modal-content--compact">
            <div class="modal-header">
                <h3>确认批量删除</h3>
                <button class="modal-close" type="button" data-action="close" title="关闭对话框" aria-label="关闭对话框">
                    ${uiIcon('close')}
                </button>
            </div>
            <div class="modal-body">
                <p>确定要删除选中的 <strong>${mailboxIds.length}</strong> 个邮箱吗？</p>
                <div class="alert alert-warning">
                    ${uiIcon('info')}
                    <div>
                        <strong>软删除说明：</strong>
                        <ul style="margin: 8px 0 0 20px; padding: 0;">
                            <li>邮箱将被批量标记为"已禁用"</li>
                            <li>用户无法继续访问</li>
                            <li>数据保留在数据库中</li>
                            <li>可以通过"恢复"功能重新启用</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" type="button" data-action="close">取消</button>
                <button class="btn btn-danger" id="confirm-batch-delete-btn">
                    ${uiIcon('trash')}
                    确认删除
                </button>
            </div>
        </div>
    `;
    modal.querySelectorAll('[data-action="close"]').forEach(button => {
        button.addEventListener('click', () => closeAndRemoveAdminModal(modal));
    });

    // 绑定确认按钮事件
    modal.querySelector('#confirm-batch-delete-btn').onclick = async () => {
        try {
            closeAndRemoveAdminModal(modal);

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
    openAdminModal(modal);
}

// 重置邮箱token
async function resetMailboxToken(mailboxId, opener = document.activeElement) {
    if (!await confirmAdminAction({
        title: '重置访问令牌',
        message: '确定要重置此邮箱的访问令牌吗？重置后旧令牌将失效。',
        confirmLabel: '确认重置',
        danger: true,
        opener,
    })) {
        return;
    }

    try {
        const response = await adminManager.apiRequest(`/api/admin/mailboxes/${encodeURIComponent(mailboxId)}/reset-token`, {
            method: 'POST'
        });

        // 显示新token
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-content--compact">
                <div class="modal-header">
                    <h3>${uiIcon('key')} 新的访问令牌</h3>
                    <button class="modal-close" type="button" data-action="close" title="关闭对话框" aria-label="关闭对话框">
                        ${uiIcon('close')}
                    </button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning">
                        ${uiIcon('warning')}
                        请妥善保存新令牌，关闭后将无法再次查看！
                    </div>
                    <div class="form-group">
                        <label>新访问令牌：</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" data-role="new-token" readonly style="flex: 1;">
                            <button class="btn btn-primary" type="button" data-action="copy-token">
                                ${uiIcon('copy')} 复制
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" type="button" data-action="close">关闭</button>
                </div>
            </div>
        `;
        const newToken = String(response.data.new_token ?? '');
        modal.querySelector('[data-role="new-token"]').value = newToken;
        modal.querySelector('[data-action="copy-token"]').addEventListener('click', () => {
            copyToClipboard(newToken);
        });
        modal.querySelectorAll('[data-action="close"]').forEach(button => {
            button.addEventListener('click', () => closeAndRemoveAdminModal(modal));
        });
        openAdminModal(modal, opener);

        adminManager.showToast('success', '令牌重置成功');
    } catch (error) {
        adminManager.showToast('error', '重置令牌失败: ' + error.message);
    }
}

// 恢复（启用）邮箱
async function enableMailbox(mailboxId, opener = document.activeElement) {
    if (!await confirmAdminAction({
        title: '恢复邮箱',
        message: '确定要恢复此邮箱吗？恢复后用户可以正常访问。',
        confirmLabel: '确认恢复',
        opener,
    })) {
        return;
    }

    try {
        await adminManager.apiRequest(`/api/admin/mailboxes/${encodeURIComponent(mailboxId)}/enable`, {
            method: 'POST'
        });

        adminManager.showToast('success', '邮箱已恢复');
        adminManager.loadMailboxes();
    } catch (error) {
        adminManager.showToast('error', '恢复失败: ' + error.message);
    }
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
    tbody.innerHTML = `<tr><td colspan="3" class="loading-row">${uiIcon('spinner', 'is-spinning')} 加载中...</td></tr>`;

    try {
        const response = await adminManager.apiRequest('/api/admin/blocked-ips');
        const blockedIPs = Array.isArray(response.data.blocked_ips) ? response.data.blocked_ips : [];

        if (blockedIPs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-row">当前没有被封禁的IP</td></tr>';
            return;
        }

        tbody.innerHTML = blockedIPs.map((item, index) => `
            <tr>
                <td><code>${escapeHtml(item.ip)}</code></td>
                <td>${escapeHtml(formatSeconds(safeNumber(item.remaining_seconds)))}</td>
                <td>
                    <button class="btn btn-sm btn-warning" type="button" data-ip-index="${index}">
                        ${uiIcon('unlock')}
                        解除封禁
                    </button>
                </td>
            </tr>
        `).join('');
        tbody.onclick = (event) => {
            const button = event.target.closest('button[data-ip-index]');
            if (!button || !tbody.contains(button)) return;
            const item = blockedIPs[Number(button.dataset.ipIndex)];
            if (item) unblockIP(item.ip);
        };
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="3" class="error-row">加载失败</td></tr>';
        adminManager.showToast('error', '加载被封禁IP失败');
    }
}

// 解除IP封禁
async function unblockIP(ip) {
    if (!await confirmAdminAction({
        title: '解除 IP 封禁',
        message: `确定要解除 ${ip} 的封禁吗？`,
        confirmLabel: '解除封禁',
    })) {
        return;
    }

    try {
        await adminManager.apiRequest(`/api/admin/blocked-ips/${encodeURIComponent(ip)}`, {
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
    grid.innerHTML = `<div class="stat-card"><div class="stat-icon">${uiIcon('spinner', 'is-spinning')}</div><div class="stat-info"><div class="stat-label">加载中...</div><div class="stat-value">-</div></div></div>`;

    try {
        const response = await adminManager.apiRequest('/api/admin/source-stats');
        const sourceStats = response.data;

        // 创建来源配置
        const sourceConfig = {
            'admin': {
                label: '管理员创建',
                icon: 'user-shield',
                gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            },
            'register': {
                label: '自助创建',
                icon: 'user-plus',
                gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
            },
            'api_v2': {
                label: 'API创建',
                icon: 'code',
                gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
            },
            'unknown': {
                label: '未知来源',
                icon: 'question',
                gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
            }
        };

        // 生成统计卡片
        let html = '';
        let total = 0;

        for (const [source, count] of Object.entries(sourceStats)) {
            const config = sourceConfig[source] || sourceConfig['unknown'];
            const safeCount = Math.max(0, Math.trunc(safeNumber(count)));
            total += safeCount;
            html += `
                <div class="stat-card">
                    <div class="stat-icon" style="background: ${config.gradient};">
                        ${uiIcon(config.icon)}
                    </div>
                    <div class="stat-info">
                        <div class="stat-label">${config.label}</div>
                        <div class="stat-value">${safeCount}</div>
                    </div>
                </div>
            `;
        }

        // 添加总计卡片
        html += `
            <div class="stat-card">
                <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
                    ${uiIcon('inbox')}
                </div>
                <div class="stat-info">
                    <div class="stat-label">总邮箱数</div>
                    <div class="stat-value">${total}</div>
                </div>
            </div>
        `;

        grid.innerHTML = html;
    } catch (error) {
        grid.innerHTML = `<div class="stat-card"><div class="stat-icon">${uiIcon('warning')}</div><div class="stat-info"><div class="stat-label">加载失败</div><div class="stat-value">-</div></div></div>`;
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
    const rows = Array.isArray(subAdmins) ? subAdmins : [];

    if (rows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-cell">
                    ${uiIcon('inbox')}
                    <p>暂无子管理员</p>
                </td>
            </tr>
        `;
        tbody.onclick = null;
        return;
    }

    tbody.innerHTML = rows.map((admin, index) => {
        const domains = Array.isArray(admin.domains) ? admin.domains : [];
        const senderWhitelist = Array.isArray(admin.sender_whitelist) ? admin.sender_whitelist : [];
        return `
            <tr>
                <td data-label="Token"><code>${escapeHtml(admin.token)}</code></td>
                <td data-label="可创建域名">
                    <div class="domains-tags">
                        ${domains.map(domain => `<span class="domain-tag">${escapeHtml(domain)}</span>`).join('')}
                    </div>
                </td>
                <td data-label="发件人白名单">
                    <div class="domains-tags">
                        ${senderWhitelist.length > 0
                            ? senderWhitelist.map(domain => `<span class="domain-tag">${escapeHtml(domain)}</span>`).join('')
                            : '<span class="text-muted">不限制</span>'}
                    </div>
                </td>
                <td data-label="最长保留天数">${escapeHtml(safeNumber(admin.max_retention_days, 30))} 天</td>
                <td data-label="状态">
                    <span class="status-badge ${admin.is_active ? 'status-active' : 'status-inactive'}">
                        ${admin.is_active ? '启用' : '禁用'}
                    </span>
                </td>
                <td data-label="创建时间">${escapeHtml(adminManager.formatDate(admin.created_at))}</td>
                <td data-label="备注">${escapeHtml(admin.notes || '-')}</td>
                <td class="actions-cell">
                    <div class="action-buttons">
                        <button class="btn-icon" type="button" data-action="edit" data-admin-index="${index}" title="编辑" aria-label="编辑">
                            ${uiIcon('edit')}
                        </button>
                        <button class="btn-icon btn-danger" type="button" data-action="delete" data-admin-index="${index}" title="删除" aria-label="删除">
                            ${uiIcon('trash')}
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // 子管理员 token/ID 不进入内联脚本，点击时从闭包按索引读取。
    tbody.onclick = (event) => {
        const button = event.target.closest('button[data-admin-index]');
        if (!button || !tbody.contains(button)) return;
        const admin = rows[Number(button.dataset.adminIndex)];
        if (!admin) return;
        if (button.dataset.action === 'edit') {
            editSubAdmin(admin.id);
        } else if (button.dataset.action === 'delete') {
            deleteSubAdmin(admin.id, admin.token);
        }
    };
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

    window.MaildropUI.openDialog(document.getElementById('sub-admin-modal'));
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

            window.MaildropUI.openDialog(document.getElementById('sub-admin-modal'));
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

        if (response.ok && Array.isArray(result.available_domains)) {
            // 域名来自 API，使用 DOM 属性和文本节点写入，彻底隔离 HTML 上下文。
            domainsContainer.replaceChildren();
            const selected = new Set(Array.isArray(selectedDomains) ? selectedDomains : []);
            result.available_domains.forEach(domain => {
                const label = document.createElement('label');
                label.className = 'checkbox-label';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.name = 'sub-admin-domain';
                input.value = String(domain ?? '');
                input.checked = selected.has(domain);

                label.append(input, document.createTextNode(` ${String(domain ?? '')}`));
                domainsContainer.appendChild(label);
            });
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
    window.MaildropUI.closeDialog(document.getElementById('sub-admin-modal'));
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

            response = await adminManager.apiRequest(`/api/admin/sub-admins/${encodeURIComponent(subAdminId)}`, {
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
    if (!await confirmAdminAction({
        title: '删除子管理员',
        message: `确定要删除子管理员 "${token}" 吗？`,
        confirmLabel: '确认删除',
        danger: true,
    })) {
        return;
    }

    try {
        const response = await adminManager.apiRequest(`/api/admin/sub-admins/${encodeURIComponent(subAdminId)}`, {
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
