// 邮箱管理器 JavaScript

class MailboxManager {
    constructor() {
        this.accessToken = null;
        this.mailboxAddress = null;
        this.mailboxKey = null;
        this.currentView = 'inbox';
        this.emails = [];
        this.filteredEmails = [];
        this.emailSearchQuery = '';
        this.currentEmail = null;
        this.refreshInterval = null;
        this.currentMailboxStatus = true; // 默认状态为开启

        this.init();
    }
    
    init() {
        // 从URL参数或localStorage获取认证信息
        this.loadAuthFromStorage();
        
        // 绑定事件
        this.bindEvents();
        
        // 初始化界面
        this.initializeUI();
        
        // 开始自动刷新
        this.startAutoRefresh();
    }
    
    loadAuthFromStorage() {
        // 检查是否是演示模式
        this.isDemoMode = window.location.pathname === '/api/mailbox/demo';

        if (this.isDemoMode) {
            // 演示模式
            this.accessToken = 'demo-token-12345';
            this.mailboxAddress = 'demo@localhost';
            this.mailboxKey = 'demo-key';

            // 显示演示提示
            setTimeout(() => {
                this.showToast('info', '演示模式', '这是演示模式，所有数据都是模拟的，您可以体验所有功能');
            }, 1000);

            return;
        }

        // 正常模式：从URL参数获取
        const urlParams = new URLSearchParams(window.location.search);
        this.accessToken = urlParams.get('token') || localStorage.getItem('tempmail_access_token');
        this.mailboxAddress = urlParams.get('address') || localStorage.getItem('tempmail_address');
        this.mailboxKey = localStorage.getItem('tempmail_mailbox_key');

        if (!this.accessToken || !this.mailboxAddress) {
            this.redirectToLogin();
            return;
        }

        // 保存到localStorage
        localStorage.setItem('tempmail_access_token', this.accessToken);
        localStorage.setItem('tempmail_address', this.mailboxAddress);
    }
    
    redirectToLogin() {
        window.location.href = '/';
    }

    handleAuthError(message) {
        // 清除本地存储的认证信息
        localStorage.removeItem('tempmail_access_token');
        localStorage.removeItem('tempmail_address');
        localStorage.removeItem('tempmail_mailbox_key');

        // 显示重新输入模态框
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '10000';
        modal.id = 'reauth-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 style="color: var(--danger-color);">
                        <i class="fas fa-exclamation-triangle"></i>
                        访问失败
                    </h3>
                </div>
                <div class="modal-body">
                    <p style="font-size: 16px; margin-bottom: 1.5rem; color: var(--danger-color);">${message}</p>
                    <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">请重新输入邮箱地址和密钥以继续访问。</p>

                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                            <i class="fas fa-at"></i>
                            邮箱地址
                        </label>
                        <input type="email" id="reauth-address" class="form-control" placeholder="输入邮箱地址" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-tertiary); color: var(--text-primary);">
                    </div>

                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                            <i class="fas fa-key"></i>
                            邮箱密钥
                        </label>
                        <input type="password" id="reauth-key" class="form-control" placeholder="输入邮箱密钥" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-tertiary); color: var(--text-primary);">
                    </div>

                    <div id="reauth-error" style="display: none; color: var(--danger-color); margin-top: 1rem; padding: 0.75rem; background: rgba(239, 68, 68, 0.1); border-radius: 6px; border-left: 3px solid var(--danger-color);">
                        <i class="fas fa-exclamation-circle"></i>
                        <span id="reauth-error-text"></span>
                    </div>
                </div>
                <div class="modal-footer" style="justify-content: center;">
                    <button class="btn btn-primary" id="reauth-submit-btn">
                        <i class="fas fa-sign-in-alt"></i>
                        <span>重新访问</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 绑定提交事件
        const submitBtn = document.getElementById('reauth-submit-btn');
        const addressInput = document.getElementById('reauth-address');
        const keyInput = document.getElementById('reauth-key');

        const handleReauth = async () => {
            const address = addressInput.value.trim();
            const key = keyInput.value.trim();

            if (!address || !key) {
                this.showReauthError('请填写完整的邮箱地址和密钥');
                return;
            }

            // 显示加载状态
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 验证中...';

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
                    // 保存新的认证信息
                    this.accessToken = data.access_token;
                    this.mailboxAddress = address;
                    this.mailboxKey = key;

                    localStorage.setItem('tempmail_access_token', data.access_token);
                    localStorage.setItem('tempmail_address', address);
                    localStorage.setItem('tempmail_mailbox_key', key);

                    // 关闭模态框
                    modal.remove();

                    // 重新初始化
                    this.showToast('success', '验证成功', '正在重新加载邮箱...');
                    await this.initializeUI();
                } else {
                    this.showReauthError(data.message || '验证失败，请检查邮箱地址和密钥');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>重新访问</span>';
                }
            } catch (error) {
                console.error('重新验证失败:', error);
                this.showReauthError('网络错误，请稍后重试');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>重新访问</span>';
            }
        };

        submitBtn.addEventListener('click', handleReauth);

        // 回车键提交
        addressInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleReauth();
        });
        keyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleReauth();
        });

        // 阻止点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                e.stopPropagation();
            }
        });

        // 自动聚焦到地址输入框
        setTimeout(() => addressInput.focus(), 100);
    }

    showReauthError(message) {
        const errorDiv = document.getElementById('reauth-error');
        const errorText = document.getElementById('reauth-error-text');
        if (errorDiv && errorText) {
            errorText.textContent = message;
            errorDiv.style.display = 'block';
        }
    }
    
    bindEvents() {
        // 导航事件
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });

        // 邮件搜索事件
        const emailSearchInput = document.getElementById('email-search-input');
        if (emailSearchInput) {
            let searchTimeout;
            emailSearchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();

                // 显示/隐藏清除按钮
                const clearBtn = document.getElementById('clear-search-btn');
                if (clearBtn) {
                    clearBtn.style.display = query ? 'flex' : 'none';
                }

                // 延迟搜索
                searchTimeout = setTimeout(() => {
                    this.emailSearchQuery = query;
                    this.filterEmails();
                }, 300);
            });
        }

        // 模态框事件
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }
    
    async initializeUI() {
        try {
            console.log('开始快速初始化UI...');

            // 等待核心DOM元素加载完成
            await this.waitForDOMElements();

            // 并行加载邮箱信息和邮件列表
            console.log('并行加载邮箱信息和邮件列表...');
            const [mailboxResult, emailsResult] = await Promise.allSettled([
                this.loadMailboxInfo(),
                this.loadEmails()
            ]);

            // 检查结果
            if (mailboxResult.status === 'rejected') {
                console.warn('邮箱信息加载失败:', mailboxResult.reason);
            }

            if (emailsResult.status === 'rejected') {
                console.warn('邮件列表加载失败:', emailsResult.reason);
            }

            // 立即显示收件箱视图
            console.log('立即切换到收件箱视图...');
            this.switchView('inbox');

            // 快速显示基本内容，即使API还在加载
            if (this.emails.length === 0) {
                console.log('立即显示空状态，等待邮件加载...');
                const emailList = document.getElementById('email-list');
                if (emailList) {
                    emailList.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-spinner fa-spin"></i>
                            <h3>正在加载邮件...</h3>
                            <p>请稍候，邮件正在加载中...</p>
                        </div>
                    `;
                }
            }

            // 确保UI正确显示
            const inboxView = document.getElementById('inbox-view');
            const emailList = document.getElementById('email-list');

            if (inboxView && emailList) {
                console.log('收件箱视图和邮件列表都已找到');

                // 确保移除任何残留的加载状态
                this.removeLoadingState();

                // 如果邮件列表为空，显示空状态
                if (this.emails.length === 0) {
                    console.log('邮件列表为空，显示空状态');
                    emailList.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <h3>收件箱为空</h3>
                            <p>您还没有收到任何邮件<br>等待新邮件到达或使用顶部刷新按钮</p>
                        </div>
                    `;
                }

                console.log(`邮件数量: ${this.emails.length}`);
            } else {
                console.error('收件箱视图或邮件列表未找到');
            }

            console.log('UI快速初始化完成');

            // 显示成功提示
            setTimeout(() => {
                this.showToast('success', '加载完成', '邮箱页面已就绪');
            }, 500);
        } catch (error) {
            console.error('初始化过程中发生错误:', error);

            // 显示错误提示但不重定向，让用户可以重试
            this.showToast('error', '初始化警告', `部分功能可能无法正常使用: ${error.message}`);

            // 尝试继续初始化基本功能
            try {
                this.switchView('inbox');
                console.log('尝试继续显示基本界面...');
            } catch (viewError) {
                console.error('无法切换视图:', viewError);
                this.redirectToLogin();
            }
        }
    }

    async waitForDOMElements() {
        const requiredElements = [
            'mailbox-address',
            'mailbox-status',
            'unread-count',
            'email-list'
        ];

        console.log('开始等待核心DOM元素加载...');

        for (const elementId of requiredElements) {
            let attempts = 0;
            const maxAttempts = 10; // 减少等待时间到1秒

            while (attempts < maxAttempts) {
                const element = document.getElementById(elementId);
                if (element) {
                    console.log(`✓ 核心DOM元素 ${elementId} 已找到`);
                    break;
                }

                if (attempts === 0) {
                    console.log(`等待核心DOM元素 ${elementId}...`);
                }

                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (attempts >= maxAttempts) {
                console.error(`✗ 核心DOM元素 ${elementId} 未找到，经过 ${maxAttempts} 次尝试`);
                // 不抛出错误，改为警告继续执行
                console.warn(`警告：某些核心DOM元素可能尚未加载完成，但将继续初始化`);
            }
        }

        console.log('核心DOM元素等待完成');
    }
    
    async loadMailboxInfo() {
        try {
            console.log('开始获取邮箱信息...');
            let response, data;

            if (this.isDemoMode) {
                // 演示模式：使用演示API
                console.log('使用演示模式API');
                response = await fetch('/api/demo/mailbox_info');
                data = await response.json();
            } else {
                // 正常模式
                console.log('使用正常模式API，token:', this.accessToken.substring(0, 10) + '...');
                const startTime = Date.now();
                response = await fetch(`/api/mailbox_info_v2?token=${this.accessToken}`);
                data = await response.json();
                const endTime = Date.now();
                console.log(`邮箱信息API调用耗时: ${endTime - startTime}ms`);
            }

            console.log('API响应状态:', response.status);
            console.log('API响应数据:', data);

            // 检查认证错误
            if (response.status === 401 || response.status === 403) {
                this.handleAuthError('访问令牌无效或已过期');
                return;
            }

            // 检查邮箱不存在
            if (response.status === 404 || (data.error && data.error.includes('not found'))) {
                this.handleAuthError('邮箱不存在或已被删除');
                return;
            }

            if (data.success) {
                const mailbox = data.mailbox;
                console.log('邮箱信息:', mailbox);

                // 安全地更新界面显示
                const elements = {
                    'mailbox-address': mailbox.address,
                    'mailbox-status': `创建于 ${this.formatFullDateTime(mailbox.created_at)} | 过期于 ${this.formatFullDateTime(mailbox.expires_at)}`,
                    'unread-count': mailbox.unread_count || 0
                };

                for (const [id, value] of Object.entries(elements)) {
                    const element = document.getElementById(id);
                    if (element) {
                        element.textContent = value;
                    } else {
                        console.warn(`DOM元素 ${id} 未找到`);
                    }
                }

                // 更新信息页面
                this.updateInfoView(mailbox);

                // 更新设置页面
                this.updateSettingsView(mailbox);

                // 更新标题
                const title = this.isDemoMode ? `邮箱管理演示 - ${mailbox.address}` : `邮箱管理 - ${mailbox.address}`;
                document.title = title;

                console.log('邮箱信息更新完成');
            } else {
                throw new Error(data.message || '获取邮箱信息失败');
            }
        } catch (error) {
            console.error('获取邮箱信息失败:', error);
            throw error;
        }
    }
    
    async loadEmails() {
        try {
            console.log('开始加载邮件列表...');
            let response, emails;

            if (this.isDemoMode) {
                // 演示模式：使用演示API
                console.log('使用演示模式API加载邮件');
                response = await fetch('/api/demo/emails');
                emails = await response.json();
            } else {
                // 正常模式
                console.log('使用正常模式API加载邮件，地址:', this.mailboxAddress);
                const startTime = Date.now();
                response = await fetch(`/api/get_inbox?address=${this.mailboxAddress}&token=${this.accessToken}`);
                emails = await response.json();
                const endTime = Date.now();
                console.log(`邮件列表API调用耗时: ${endTime - startTime}ms`);
            }

            console.log('邮件API响应状态:', response.status);
            console.log('邮件数据类型:', typeof emails);
            console.log('邮件数据是否为数组:', Array.isArray(emails));

            // 检查认证错误
            if (response.status === 401 || response.status === 403) {
                this.handleAuthError('访问令牌无效或已过期');
                return;
            }

            // 检查邮箱不存在
            if (response.status === 404) {
                this.handleAuthError('邮箱不存在或已被删除');
                return;
            }

            this.emails = Array.isArray(emails) ? emails : [];
            console.log('处理后的邮件数量:', this.emails.length);

            // 确保移除加载状态
            this.removeLoadingState();

            // 应用搜索过滤
            this.filterEmails();
            console.log('邮件列表渲染完成');

        } catch (error) {
            console.error('加载邮件失败:', error);
            console.error('错误详情:', error.stack);
            this.showToast('error', '加载邮件失败', error.message);
            // 邮件加载失败不应该导致页面崩溃
        }
    }

    filterEmails() {
        // 如果没有搜索查询，显示所有邮件
        if (!this.emailSearchQuery) {
            this.filteredEmails = this.emails;
        } else {
            const query = this.emailSearchQuery.toLowerCase();
            this.filteredEmails = this.emails.filter(email => {
                // 搜索主题
                const subject = (email.subject || '').toLowerCase();
                // 搜索发件人
                const from = (email.from || '').toLowerCase();
                // 搜索内容（纯文本）
                const text = (email.text || '').toLowerCase();
                // 搜索HTML内容（去除标签）
                const html = email.html ? email.html.replace(/<[^>]*>/g, '').toLowerCase() : '';

                return subject.includes(query) ||
                       from.includes(query) ||
                       text.includes(query) ||
                       html.includes(query);
            });
        }

        this.renderEmailList();
    }

    renderEmailList() {
        try {
            const emailList = document.getElementById('email-list');
            if (!emailList) {
                console.error('email-list 元素未找到');
                return;
            }

            // 更新邮件数量显示
            this.updateEmailCount();

            // 首先移除加载状态
            this.removeLoadingState();

            if (this.emails.length === 0) {
                emailList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>收件箱为空</h3>
                        <p>您还没有收到任何邮件<br>等待新邮件到达或使用顶部刷新按钮</p>
                    </div>
                `;
                return;
            }

            if (this.filteredEmails.length === 0) {
                emailList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <h3>没有找到匹配的邮件</h3>
                        <p>尝试使用不同的关键词搜索<br>当前搜索: "${this.emailSearchQuery}"</p>
                    </div>
                `;
                return;
            }

            // 统计未读邮件数量
            const unreadCount = this.filteredEmails.filter(email => !email.is_read).length;
            console.log(`渲染邮件列表: 总计 ${this.filteredEmails.length} 封邮件，其中 ${unreadCount} 封未读`);

            // 更新邮件数量显示
            this.updateEmailCount();

            // 批量生成HTML，减少DOM操作
            const emailHtmlArray = this.filteredEmails.map((email, index) => {
                try {
                    const emailId = email.id || `email-${index}`;
                    const isUnread = !email.is_read;
                    const preview = this.getEmailPreview(email.Body);

                    // 调试日志：检查邮件状态
                    console.log(`邮件 ${emailId}: is_read=${email.is_read}, isUnread=${isUnread}`);

                    return `
                        <div class="email-item ${isUnread ? 'unread' : ''}"
                             onclick="console.log('点击邮件:', '${emailId}'); mailboxManager.showEmailDetail('${emailId}')"
                             data-email-id="${emailId}"
                             style="cursor: pointer; position: relative; z-index: 1;"
                             title="点击查看邮件详情: ${email.Subject || '无主题'}">
                            <input type="checkbox" onclick="event.stopPropagation(); console.log('复选框点击');" onchange="mailboxManager.toggleEmailSelection('${emailId}', this.checked)">
                            <div class="email-content-wrapper" style="width: 100%; pointer-events: auto;">
                                <div class="email-header">
                                    <div class="email-from">${this.escapeHtml(email.From || '未知发件人')}</div>
                                    <div class="email-time">${email.Sent || this.formatDate(email.Timestamp)}</div>
                                </div>
                                <div class="email-subject">
                                    ${this.escapeHtml(email.Subject || '无主题')}
                                    ${this.isHtmlEmail(email.Body) ? '<span class="html-badge" title="HTML邮件">📧</span>' : ''}
                                </div>
                                <div class="email-preview">${this.escapeHtml(preview)}</div>
                            </div>
                            <div class="email-actions">
                                <button class="btn btn-sm" onclick="event.stopPropagation(); console.log('标记按钮点击'); mailboxManager.markAsRead('${emailId}', ${isUnread})" title="${isUnread ? '标记为已读' : '标记为未读'}">
                                    <i class="fas fa-${isUnread ? 'envelope' : 'envelope-open'}"></i>
                                </button>
                                <button class="btn btn-sm btn-info" onclick="event.stopPropagation(); console.log('阅读按钮点击'); mailboxManager.showEmailDetail('${emailId}')" title="查看详情">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); console.log('删除按钮点击'); mailboxManager.deleteEmail('${emailId}')" title="删除">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                } catch (emailError) {
                    console.error(`渲染邮件 ${index + 1} 失败:`, emailError);
                    return `<!-- 邮件渲染失败: ${email.id} -->`;
                }
            });

            emailList.innerHTML = emailHtmlArray.join('');

            console.log('邮件列表渲染完成');
        } catch (error) {
            console.error('渲染邮件列表失败:', error);
            // 渲染失败不应该导致页面崩溃
        }
    }
    
    toggleEmailSelection(emailId, checked) {
        const email = this.emails.find(e => e.id === emailId);
        if (email) {
            email.selected = checked;
        }
    }

    showEmailDetail(emailId) {
        console.log('=== 邮件详情调试开始 ===');
        console.log('点击的邮件ID:', emailId);
        console.log('当前邮件列表长度:', this.emails.length);

        // 检查邮件ID是否存在
        if (!emailId) {
            console.error('邮件ID为空');
            this.showToast('error', '错误', '邮件ID为空');
            return;
        }

        const email = this.emails.find(e => e.id === emailId);
        if (!email) {
            console.error('邮件未找到:', emailId);
            console.error('可用的邮件ID列表:', this.emails.map(e => ({
                id: e.id,
                subject: e.Subject,
                from: e.From
            })));
            this.showToast('error', '错误', `邮件未找到: ${emailId}`);
            return;
        }

        console.log('找到邮件:', email);
        console.log('邮件数据:', {
            id: email.id,
            subject: email.Subject,
            from: email.From,
            is_read: email.is_read,
            body_length: email.Body ? email.Body.length : 0
        });

        // 确保邮件能正常显示，无论是否已读
        console.log('准备显示邮件详情，邮件状态:', email.is_read ? '已读' : '未读');
        this.currentEmail = email;

        // 标记为已读（异步操作，不阻塞显示）
        if (!email.is_read) {
            console.log('标记邮件为已读');
            // 使用异步调用，不等待结果，允许显示继续
            this.markAsRead(emailId, true).then(success => {
                console.log('标记已读操作完成:', success ? '成功' : '失败');
            }).catch(error => {
                console.error('标记邮件已读失败:', error);
                // 即使标记失败，也要显示邮件详情
                console.log('尽管标记失败，仍将继续显示邮件详情');
            });
        } else {
            console.log('邮件已经是已读状态，无需标记');
        }

        // 渲染邮件详情
        const content = document.getElementById('email-detail-content');
        if (!content) {
            console.error('email-detail-content 元素未找到');
            this.showToast('error', '错误', '邮件详情容器未找到');
            return;
        }

        console.log('开始渲染邮件内容...');
        console.log('邮件内容类型检测:', this.isHtmlEmail(email.Body) ? 'HTML邮件' : '纯文本邮件');

        // 确保邮件内容不为空
        if (!email.Body) {
            console.warn('邮件内容为空，使用默认内容');
            email.Body = '邮件内容为空或无法显示';
        }

        // 首先移除占位符
        const placeholder = content.querySelector('.email-placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        content.innerHTML = `
            <div class="email-meta">
                <div class="email-meta-row">
                    <div class="email-meta-label">发件人:</div>
                    <div class="email-meta-value">${this.escapeHtml(email.From || '未知发件人')}</div>
                </div>
                <div class="email-meta-row">
                    <div class="email-meta-label">收件人:</div>
                    <div class="email-meta-value">${this.escapeHtml(email.To || this.mailboxAddress)}</div>
                </div>
                <div class="email-meta-row">
                    <div class="email-meta-label">主题:</div>
                    <div class="email-meta-value">
                        ${this.escapeHtml(email.Subject || '无主题')}
                        ${this.isHtmlEmail(email.Body) ? '<span class="html-badge" title="HTML邮件" style="margin-left: 0.5rem;">📧</span>' : ''}
                    </div>
                </div>
                <div class="email-meta-row">
                    <div class="email-meta-label">时间:</div>
                    <div class="email-meta-value">${email.Sent || this.formatEmailTime(email.Timestamp)}</div>
                </div>
            </div>
            <div class="email-body">
                <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: var(--border-radius); border: 1px solid var(--border-color);">
                    ${this.renderEmailContent(email.Body || '邮件内容为空')}
                </div>
            </div>
        `;

        console.log('邮件内容已渲染，切换到详情视图');
        this.switchView('email-detail');
        console.log('=== 邮件详情调试结束 ===');
    }
    
    switchView(viewName) {
        try {
            console.log('切换视图到:', viewName);

            // 更新导航状态
            document.querySelectorAll('.nav-item').forEach(item => {
                if (item.dataset) {
                    item.classList.toggle('active', item.dataset.view === viewName);
                }
            });

            // 更新视图显示
            document.querySelectorAll('.view').forEach(view => {
                if (view.id) {
                    const isActive = view.id === `${viewName}-view`;
                    if (isActive) {
                        view.classList.add('active');
                        view.style.display = 'flex'; // 确保视图可见
                        console.log(`视图 ${view.id}: 激活`);
                    } else {
                        view.classList.remove('active');
                        view.style.display = 'none'; // 隐藏非活动视图
                        console.log(`视图 ${view.id}: 隐藏`);
                    }
                }
            });

            this.currentView = viewName;

            // 视图特定的初始化
            if (viewName === 'info') {
                this.generateQRCode();
            } else if (viewName === 'email-detail') {
                // 确保邮件详情视图正确显示
                const emailDetailView = document.getElementById('email-detail-view');
                if (emailDetailView) {
                    emailDetailView.style.display = 'flex';

                    // 如果没有当前邮件，显示提示
                    if (!this.currentEmail) {
                        const content = document.getElementById('email-detail-content');
                        if (content) {
                            content.innerHTML = `
                                <div class="empty-state">
                                    <i class="fas fa-envelope-open"></i>
                                    <h3>选择邮件查看详情</h3>
                                    <p>在左侧收件箱中点击邮件来查看其内容</p>
                                </div>
                            `;
                        }
                    }

                    console.log('邮件详情视图已显示');
                }
            } else if (viewName === 'inbox') {
                // 切换到收件箱时清除当前邮件
                this.currentEmail = null;
                console.log('已清除当前邮件状态');
            }

            // 特别处理：确保收件箱视图正确显示
            if (viewName === 'inbox') {
                const inboxView = document.getElementById('inbox-view');
                if (inboxView) {
                    inboxView.classList.add('active');
                    console.log('收件箱视图已激活');

                    // 确保邮件列表容器可见
                    const emailList = document.getElementById('email-list');
                    if (emailList) {
                        console.log('邮件列表容器已找到');
                        // 移除可能存在的加载状态
                        this.removeLoadingState();
                    } else {
                        console.error('邮件列表容器未找到');
                    }
                } else {
                    console.error('收件箱视图未找到');
                }
            }

            console.log('视图切换完成');
        } catch (error) {
            console.error('切换视图失败:', error);
            // 视图切换失败不应该导致页面崩溃
        }
    }
    
    updateInfoView(mailbox) {
        try {
            // 安全地更新DOM元素
            const elements = {
                'info-address': mailbox.address,
                'info-created': this.formatFullDateTime(mailbox.created_at),
                'info-expires': this.formatFullDateTime(mailbox.expires_at),
                'info-total-emails': mailbox.email_count || 0,
                'info-unread-emails': mailbox.unread_count || 0,
                'info-read-emails': (mailbox.email_count || 0) - (mailbox.unread_count || 0)
            };

            for (const [id, value] of Object.entries(elements)) {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                } else {
                    console.warn(`DOM元素 ${id} 未找到，跳过更新`);
                }
            }

            // 计算并显示已使用时间和剩余时间
            this.updateTimeInfo(mailbox);

            // 更新二维码链接
            this.updateQRCode();
        } catch (error) {
            console.error('更新信息视图失败:', error);
            // 不抛出错误，让初始化继续
            console.warn('信息视图更新失败，但继续执行');
        }
    }

    updateTimeInfo(mailbox) {
        const now = Math.floor(Date.now() / 1000);
        const createdAt = mailbox.created_at;
        const expiresAt = mailbox.expires_at;

        if (createdAt) {
            // 计算已使用时间
            const usedSeconds = now - createdAt;
            const usedTime = this.formatTimeDuration(usedSeconds);
            const usageElement = document.getElementById('info-usage-time');
            if (usageElement) {
                usageElement.textContent = usedTime;
            } else {
                console.warn('DOM元素 info-usage-time 未找到');
            }
        }

        if (expiresAt) {
            // 计算剩余时间
            const remainingSeconds = expiresAt - now;
            const remainingTime = this.formatTimeDuration(Math.max(0, remainingSeconds));
            const remainingElement = document.getElementById('info-remaining-time');
            if (remainingElement) {
                remainingElement.textContent = remainingTime;

                // 根据剩余时间改变颜色
                if (remainingSeconds < 86400) { // 少于1天
                    remainingElement.style.color = 'var(--danger-color)';
                } else if (remainingSeconds < 259200) { // 少于3天
                    remainingElement.style.color = 'var(--warning-color)';
                } else {
                    remainingElement.style.color = 'var(--success-color)';
                }
            } else {
                console.warn('DOM元素 info-remaining-time 未找到');
            }
        }
    }

    formatTimeDuration(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (days > 0) {
            return `${days}天${hours}小时`;
        } else if (hours > 0) {
            return `${hours}小时${minutes}分钟`;
        } else {
            return `${minutes}分钟`;
        }
    }
    
    updateSettingsView(mailbox) {
        try {
            // 更新白名单
            const whitelistItems = document.getElementById('whitelist-items');
            if (whitelistItems) {
                const whitelist = mailbox.sender_whitelist || [];
                if (mailbox.whitelist_enabled) {
                    whitelistItems.innerHTML = whitelist.map(sender => `
                        <div class="whitelist-item">
                            <span>${this.escapeHtml(sender)}</span>
                            <button class="remove-btn" onclick="mailboxManager.removeSender('${sender}')" title="移除">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `).join('');
                } else {
                    whitelistItems.innerHTML = '<div class="whitelist-disabled">白名单功能已关闭，接收所有发件人的邮件</div>';
                }
            } else {
                console.warn('DOM元素 whitelist-items 未找到');
            }

            // 更新白名单启用状态
            this.updateWhitelistToggle(mailbox);

            // 更新保留天数
            const retentionSelect = document.getElementById('retention-days');
            if (retentionSelect) {
                retentionSelect.value = mailbox.retention_days || 7;
            } else {
                console.warn('DOM元素 retention-days 未找到');
            }

            // 更新邮箱状态显示
            this.updateMailboxStatusDisplay(mailbox);
        } catch (error) {
            console.error('更新设置视图失败:', error);
            // 设置视图更新失败不应该导致整个初始化失败
        }
    }

    updateMailboxStatusDisplay(mailbox) {
        try {
            const statusBadge = document.getElementById('mailbox-status-badge');
            const statusText = document.getElementById('mailbox-status-text');
            const toggleBtn = document.getElementById('toggle-mailbox-btn');
            const toggleText = document.getElementById('toggle-mailbox-text');

            if (!statusBadge || !statusText || !toggleBtn || !toggleText) {
                console.warn('邮箱状态显示元素未找到');
                return;
            }

            const isActive = mailbox.is_active !== false; // 默认认为是激活的

            // 更新当前状态
            this.currentMailboxStatus = isActive;

            // 更新状态徽章
            statusBadge.className = `status-badge ${isActive ? 'active' : 'inactive'}`;
            statusText.textContent = isActive ? '已开启' : '已关闭';

            // 更新切换按钮
            toggleBtn.className = `btn ${isActive ? 'btn-danger' : 'btn-success'}`;
            toggleText.textContent = isActive ? '关闭邮箱' : '开启邮箱';

            // 更新图标
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.className = `fas fa-toggle-${isActive ? 'off' : 'on'}`;
            }

            console.log('邮箱状态显示已更新:', isActive ? '已开启' : '已关闭');
        } catch (error) {
            console.error('更新邮箱状态显示失败:', error);
        }
    }

    updateWhitelistToggle(mailbox) {
        try {
            const whitelistEnabled = document.getElementById('whitelist-enabled');
            const whitelistStatus = document.getElementById('whitelist-status');
            const whitelistInputSection = document.getElementById('whitelist-input-section');

            if (!whitelistEnabled || !whitelistStatus || !whitelistInputSection) {
                console.warn('白名单切换元素未找到');
                return;
            }

            const isEnabled = mailbox.whitelist_enabled || false;

            // 更新复选框状态
            whitelistEnabled.checked = isEnabled;

            // 更新状态文本
            whitelistStatus.textContent = isEnabled ? '已开启' : '已关闭';

            // 更新输入区域显示
            whitelistInputSection.style.display = isEnabled ? 'flex' : 'none';

            console.log('白名单状态显示已更新:', isEnabled ? '已开启' : '已关闭');
        } catch (error) {
            console.error('更新白名单状态显示失败:', error);
        }
    }
    
    generateQRCode() {
        try {
            const qrContainer = document.getElementById('qr-code');
            const qrUrlElement = document.getElementById('qr-url');

            if (!qrContainer) {
                console.error('qr-code 元素未找到');
                return;
            }

            const url = `${window.location.origin}/mailbox?address=${this.mailboxAddress}&key=${this.mailboxKey}`;

            // 更新二维码链接显示
            if (qrUrlElement) {
                qrUrlElement.textContent = url;
            } else {
                console.warn('DOM元素 qr-url 未找到');
            }

            // 这里可以集成QR码生成库，暂时显示文本
            qrContainer.innerHTML = `
                <div style="padding: 2rem; background: #f0f0f0; border-radius: 8px; font-family: monospace; word-break: break-all; text-align: center;">
                    <i class="fas fa-qrcode" style="font-size: 4rem; color: #666; margin-bottom: 1rem; display: block;"></i>
                    <div style="font-size: 0.875rem; color: #666;">
                        二维码生成库未集成<br>
                        请使用链接访问
                    </div>
                </div>
            `;

            console.log('二维码生成完成');
        } catch (error) {
            console.error('生成二维码失败:', error);
            // 二维码生成失败不应该导致页面崩溃
        }
    }

    updateQRCode() {
        try {
            const qrUrlElement = document.getElementById('qr-url');
            if (qrUrlElement) {
                const url = `${window.location.origin}/mailbox?address=${this.mailboxAddress}&key=${this.mailboxKey}`;
                qrUrlElement.textContent = url;
            } else {
                console.warn('DOM元素 qr-url 未找到');
            }
        } catch (error) {
            console.error('更新二维码链接失败:', error);
        }
    }
    
    startAutoRefresh() {
        console.log('启动自动刷新功能...');

        // 页面可见性检测
        this.isPageVisible = true;
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
            console.log('页面可见性变化:', this.isPageVisible ? '可见' : '隐藏');
        });

        // 每30秒自动刷新邮件
        this.refreshInterval = setInterval(() => {
            if (this.currentView === 'inbox' && this.isPageVisible) {
                console.log('执行自动刷新...');
                this.loadEmails();
            } else {
                console.log('跳过自动刷新 - 视图:', this.currentView, '页面可见:', this.isPageVisible);
            }
        }, 30000);
    }
    
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    async retryInitialization() {
        console.log('用户请求重试初始化...');
        try {
            // 重新加载认证信息
            this.loadAuthFromStorage();

            // 重新初始化UI
            await this.initializeUI();

            this.showToast('success', '重试成功', '页面已重新初始化');
        } catch (error) {
            console.error('重试初始化失败:', error);
            this.showToast('error', '重试失败', error.message);
        }
    }

    // 更新邮件数量显示
    updateEmailCount() {
        const emailCountElement = document.getElementById('email-count');
        if (emailCountElement) {
            const totalEmails = this.emails.length;
            const unreadEmails = this.emails.filter(email => !email.is_read).length;

            let countText = `${totalEmails} 封邮件`;
            if (unreadEmails > 0) {
                countText += `，${unreadEmails} 封未读`;
            }

            emailCountElement.textContent = countText;
        }
    }

    // 移除加载状态并显示内容
    removeLoadingState() {
        const emailList = document.getElementById('email-list');
        if (emailList) {
            const loadingPlaceholder = emailList.querySelector('.loading-placeholder');
            if (loadingPlaceholder) {
                console.log('移除加载占位符');
                loadingPlaceholder.remove();
            }
        }
    }
    
    // 工具方法
     formatDate(timestamp) {
         if (!timestamp) return '未知时间';

         const now = Math.floor(Date.now() / 1000);
         const diffSeconds = now - timestamp;

         // 1分钟内的显示"刚刚"
         if (diffSeconds < 60) {
             return '刚刚';
         }

         // 1小时内的显示"X分钟前"
         if (diffSeconds < 3600) {
             const minutes = Math.floor(diffSeconds / 60);
             return `${minutes}分钟前`;
         }

         // 24小时内的显示"X小时前"
         if (diffSeconds < 86400) {
             const hours = Math.floor(diffSeconds / 3600);
             return `${hours}小时前`;
         }

         // 今天内的显示"今天 HH:MM"
         const nowDate = new Date(now * 1000);
         const emailDate = new Date(timestamp * 1000);
         const isToday = nowDate.toDateString() === emailDate.toDateString();

         if (isToday) {
             return `今天 ${emailDate.getHours().toString().padStart(2, '0')}:${emailDate.getMinutes().toString().padStart(2, '0')}`;
         }

         // 昨天的显示"昨天 HH:MM"
         const yesterday = new Date((now - 86400) * 1000);
         const isYesterday = yesterday.toDateString() === emailDate.toDateString();

         if (isYesterday) {
             return `昨天 ${emailDate.getHours().toString().padStart(2, '0')}:${emailDate.getMinutes().toString().padStart(2, '0')}`;
         }

         // 7天内的显示"X天前"
         if (diffSeconds < 604800) {
             const days = Math.floor(diffSeconds / 86400);
             return `${days}天前`;
         }

         // 超过7天的显示具体日期，但格式更友好
         const year = emailDate.getFullYear();
         const month = emailDate.getMonth() + 1;
         const day = emailDate.getDate();
         const hour = emailDate.getHours().toString().padStart(2, '0');
         const minute = emailDate.getMinutes().toString().padStart(2, '0');

         return `${year}/${month}/${day} ${hour}:${minute}`;
     }

     formatEmailTime(timestamp) {
         if (!timestamp) return '未知时间';

         const now = Math.floor(Date.now() / 1000);
         const diffSeconds = now - timestamp;

         // 1分钟内的显示"刚刚"
         if (diffSeconds < 60) {
             return '刚刚';
         }

         // 1小时内的显示"X分钟前"
         if (diffSeconds < 3600) {
             const minutes = Math.floor(diffSeconds / 60);
             return `${minutes}分钟前`;
         }

         // 24小时内的显示"今天 HH:MM"
         const nowDate = new Date(now * 1000);
         const emailDate = new Date(timestamp * 1000);
         const isToday = nowDate.toDateString() === emailDate.toDateString();

         if (isToday) {
             return `今天 ${emailDate.getHours().toString().padStart(2, '0')}:${emailDate.getMinutes().toString().padStart(2, '0')}`;
         }

         // 昨天的显示"昨天 HH:MM"
         const yesterday = new Date((now - 86400) * 1000);
         const isYesterday = yesterday.toDateString() === emailDate.toDateString();

         if (isYesterday) {
             return `昨天 ${emailDate.getHours().toString().padStart(2, '0')}:${emailDate.getMinutes().toString().padStart(2, '0')}`;
         }

         // 7天内的显示"X天前"
         if (diffSeconds < 604800) {
             const days = Math.floor(diffSeconds / 86400);
             return `${days}天前`;
         }

         // 超过7天的显示完整日期时间
         return emailDate.toLocaleString('zh-CN');
     }

     formatFullDateTime(timestamp) {
         if (!timestamp) return '未知时间';
         const date = new Date(timestamp * 1000);
         const year = date.getFullYear();
         const month = date.getMonth() + 1;
         const day = date.getDate();
         const hours = date.getHours().toString().padStart(2, '0');
         const minutes = date.getMinutes().toString().padStart(2, '0');
         return `${year}年${month}月${day}日 ${hours}:${minutes}`;
     }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    getEmailPreview(body) {
        if (!body) return '无内容';

        // 检测是否为HTML内容
        const isHtmlContent = body.includes('<html') ||
                             body.includes('<div') ||
                             body.includes('<p') ||
                             body.includes('<span') ||
                             body.includes('<strong') ||
                             body.includes('<em') ||
                             body.includes('<br') ||
                             body.includes('<ul') ||
                             body.includes('<ol') ||
                             body.includes('<li');

        if (isHtmlContent) {
            // HTML内容：提取纯文本用于预览
            const textContent = body.replace(/<[^>]*>/g, '').trim();
            return textContent.substring(0, 150) + (textContent.length > 150 ? '...' : '');
        } else {
            // 纯文本内容：直接截取
            return body.substring(0, 150) + (body.length > 150 ? '...' : '');
        }
    }
    
    formatEmailBody(body) {
        if (!body) return '邮件内容为空';

        // 如果是HTML邮件，直接显示
        if (body.includes('<html') || body.includes('<div') || body.includes('<p')) {
            return body;
        }

        // 纯文本邮件，转换换行符
        return body.replace(/\n/g, '<br>');
    }

    isHtmlEmail(body) {
        if (!body) return false;

        // 检测是否为HTML内容
        return body.includes('<html') ||
               body.includes('<div') ||
               body.includes('<p') ||
               body.includes('<span') ||
               body.includes('<strong') ||
               body.includes('<em') ||
               body.includes('<br') ||
               body.includes('<ul') ||
               body.includes('<ol') ||
               body.includes('<li');
    }

    renderEmailContent(body) {
        if (!body) return '<p style="color: var(--text-muted); font-style: italic;">邮件内容为空</p>';

        // 检查是否是被转义的HTML（包含&lt;、&gt;等）
        const hasEscapedHtml = body.includes('&lt;') || body.includes('&gt;') || body.includes('&amp;');

        if (hasEscapedHtml) {
            // 解码HTML实体
            const textarea = document.createElement('textarea');
            textarea.innerHTML = body;
            body = textarea.value;
            console.log('检测到转义的HTML，已解码');
        }

        if (this.isHtmlEmail(body)) {
            // HTML内容：直接渲染，但要确保安全性
            console.log('检测到HTML邮件内容，长度:', body.length);

            // 基本的安全检查：移除潜在的危险标签和属性
            let safeHtml = body
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // 移除script标签
                .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // 移除iframe标签
                .replace(/javascript:/gi, '') // 移除javascript协议
                .replace(/on\w+\s*=/gi, ''); // 移除事件处理属性

            return safeHtml;
        } else {
            // 纯文本内容：转换换行符并保留格式
            console.log('检测到纯文本邮件内容，长度:', body.length);
            return `<div style="white-space: pre-wrap; word-break: break-word; line-height: 1.6;">${this.escapeHtml(body)}</div>`;
        }
    }
    
    showToast(type, title, message) {
        try {
            const container = document.getElementById('toast-container');
            if (!container) {
                console.warn('Toast容器未找到，跳过显示提示');
                return;
            }

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
        } catch (error) {
            console.error('显示Toast失败:', error);
        }
    }
    
    closeModal(modal) {
        modal.classList.remove('active');
    }
    
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    async markAsRead(emailId, isRead) {
        try {
            if (this.isDemoMode) {
                // 演示模式：只更新本地状态
                const email = this.emails.find(e => e.id === emailId);
                if (email) {
                    email.is_read = isRead;
                    this.renderEmailList();
                }
                this.showToast('info', '演示模式', `邮件已标记为${isRead ? '已读' : '未读'}（演示）`);
                return true;
            }

            // 正常模式：调用API标记邮件已读状态
            const response = await fetch(`/api/mark_email_read?token=${this.accessToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email_id: emailId,
                    is_read: isRead
                })
            });

            if (response.ok) {
                const email = this.emails.find(e => e.id === emailId);
                if (email) {
                    email.is_read = isRead;
                    this.renderEmailList();
                    this.loadMailboxInfo(); // 更新未读计数
                }

                this.showToast('success', '成功', `邮件已标记为${isRead ? '已读' : '未读'}`);
                return true;
            } else {
                console.error('API调用失败，状态码:', response.status);
                const errorText = await response.text();
                console.error('错误响应:', errorText);
                throw new Error(`API调用失败: ${response.status}`);
            }
        } catch (error) {
            console.error('标记邮件已读失败:', error);
            this.showToast('error', '错误', '操作失败');
            return false;
        }
    }
}

// 全局函数
function refreshEmails() {
    // 确保移除加载状态
    if (mailboxManager) {
        mailboxManager.removeLoadingState();
    }
    mailboxManager.loadEmails();
    mailboxManager.showToast('info', '刷新', '正在刷新邮件列表...');
}

function clearEmailSearch() {
    const searchInput = document.getElementById('email-search-input');
    const clearBtn = document.getElementById('clear-search-btn');

    if (searchInput) {
        searchInput.value = '';
    }
    if (clearBtn) {
        clearBtn.style.display = 'none';
    }

    if (mailboxManager) {
        mailboxManager.emailSearchQuery = '';
        mailboxManager.filterEmails();
    }
}

// 重试初始化（全局函数）
function retryInit() {
    if (mailboxManager) {
        mailboxManager.retryInitialization();
    }
}

function showCompose() {
    document.getElementById('compose-modal').classList.add('active');
}

function closeCompose() {
    document.getElementById('compose-modal').classList.remove('active');
    document.getElementById('compose-form').reset();
}

function sendEmail() {
    const to = document.getElementById('compose-to').value;
    const subject = document.getElementById('compose-subject').value;
    const body = document.getElementById('compose-body').value;
    
    if (!to || !subject || !body) {
        mailboxManager.showToast('warning', '提示', '请填写完整的邮件信息');
        return;
    }
    
    // 这里可以实现发送邮件功能
    mailboxManager.showToast('info', '提示', '发送邮件功能暂未实现');
    closeCompose();
}

function showInbox() {
    console.log('返回收件箱视图');

    // 确保邮件详情视图被隐藏
    const emailDetailView = document.getElementById('email-detail-view');
    if (emailDetailView) {
        emailDetailView.style.display = 'none';
        emailDetailView.classList.remove('active');
    }

    // 确保收件箱视图显示
    const inboxView = document.getElementById('inbox-view');
    if (inboxView) {
        inboxView.style.display = 'flex';
        inboxView.classList.add('active');
    }

    mailboxManager.switchView('inbox');
}

async function markAllRead() {
    if (!confirm('确定要标记所有邮件为已读吗？')) return;

    try {
        // 调用API标记全部已读
        const response = await fetch(`/api/mark_all_read?token=${mailboxManager.accessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: mailboxManager.mailboxAddress
            })
        });

        if (response.ok) {
            // 更新本地邮件状态
            mailboxManager.emails.forEach(email => {
                email.is_read = true;
            });
            mailboxManager.renderEmailList();
            mailboxManager.loadMailboxInfo(); // 更新未读计数

            mailboxManager.showToast('success', '成功', '所有邮件已标记为已读');
        } else {
            throw new Error('API调用失败');
        }
    } catch (error) {
        mailboxManager.showToast('error', '错误', '操作失败');
    }
}

async function deleteSelected() {
    const selectedEmails = mailboxManager.emails.filter(e => e.selected);

    if (selectedEmails.length === 0) {
        mailboxManager.showToast('warning', '提示', '请先选择要删除的邮件');
        return;
    }

    if (!confirm(`确定要删除选中的 ${selectedEmails.length} 封邮件吗？`)) return;

    try {
        // 批量删除邮件
        const response = await fetch(`/api/delete_emails_batch?token=${mailboxManager.accessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email_ids: selectedEmails.map(e => e.id)
            })
        });

        if (response.ok) {
            // 从本地列表中移除已删除的邮件
            mailboxManager.emails = mailboxManager.emails.filter(e => !e.selected);
            mailboxManager.renderEmailList();
            mailboxManager.loadMailboxInfo(); // 更新统计

            mailboxManager.showToast('success', '成功', `已删除 ${selectedEmails.length} 封邮件`);
        } else {
            throw new Error('API调用失败');
        }
    } catch (error) {
        mailboxManager.showToast('error', '错误', '删除失败');
    }
}

function logout() {
    if (mailboxManager.isDemoMode) {
        // 演示模式：直接跳转到登录页
        window.location.href = '/login';
        return;
    }

    localStorage.removeItem('tempmail_access_token');
    localStorage.removeItem('tempmail_address');
    localStorage.removeItem('tempmail_mailbox_key');
    window.location.href = '/';
}

function copyAddress() {
    navigator.clipboard.writeText(mailboxManager.mailboxAddress).then(() => {
        mailboxManager.showToast('success', '成功', '邮箱地址已复制到剪贴板');
    });
}

function shareMailbox() {
    const url = `${window.location.origin}/mailbox?address=${mailboxManager.mailboxAddress}&key=${mailboxManager.mailboxKey}`;

    if (navigator.share) {
        navigator.share({
            title: '临时邮箱分享',
            text: `我的临时邮箱地址：${mailboxManager.mailboxAddress}`,
            url: url
        }).then(() => {
            mailboxManager.showToast('success', '成功', '邮箱链接已分享');
        }).catch(() => {
            // 如果分享失败，回退到复制链接
            copyQRUrl();
        });
    } else {
        // 如果不支持原生分享，复制链接
        copyQRUrl();
    }
}

function copyQRUrl() {
    const url = `${window.location.origin}/mailbox?address=${mailboxManager.mailboxAddress}&key=${mailboxManager.mailboxKey}`;

    navigator.clipboard.writeText(url).then(() => {
        mailboxManager.showToast('success', '成功', '邮箱链接已复制到剪贴板');
    }).catch(() => {
        mailboxManager.showToast('error', '错误', '复制失败，请手动复制');
    });
}

// 邮件操作函数 - 已移动到MailboxManager类中

async function deleteEmail(emailId) {
    if (!confirm('确定要删除这封邮件吗？')) return;

    try {
        if (mailboxManager.isDemoMode) {
            // 演示模式：只更新本地状态
            mailboxManager.emails = mailboxManager.emails.filter(e => e.id !== emailId);
            mailboxManager.renderEmailList();
            mailboxManager.showToast('info', '演示模式', '邮件已删除（演示）');
            return;
        }

        // 正常模式：调用API删除邮件
        const response = await fetch(`/api/delete_email?token=${mailboxManager.accessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email_id: emailId
            })
        });

        if (response.ok) {
            mailboxManager.emails = mailboxManager.emails.filter(e => e.id !== emailId);
            mailboxManager.renderEmailList();
            mailboxManager.loadMailboxInfo(); // 更新统计

            mailboxManager.showToast('success', '成功', '邮件已删除');
        } else {
            throw new Error('API调用失败');
        }
    } catch (error) {
        mailboxManager.showToast('error', '错误', '删除失败');
    }
}

function toggleEmailSelection(emailId, selected) {
    const email = mailboxManager.emails.find(e => e.id === emailId);
    if (email) {
        email.selected = selected;
    }
}

function replyEmail() {
    if (!mailboxManager.currentEmail) return;

    const email = mailboxManager.currentEmail;
    document.getElementById('compose-to').value = email.From;
    document.getElementById('compose-subject').value = `Re: ${email.Subject}`;
    document.getElementById('compose-body').value = `\n\n--- 原始邮件 ---\n发件人: ${email.From}\n时间: ${email.Sent}\n主题: ${email.Subject}\n\n${email.Body}`;

    showCompose();
}

function forwardEmail() {
    if (!mailboxManager.currentEmail) return;

    const email = mailboxManager.currentEmail;
    document.getElementById('compose-subject').value = `Fwd: ${email.Subject}`;
    document.getElementById('compose-body').value = `\n\n--- 转发邮件 ---\n发件人: ${email.From}\n收件人: ${email.To}\n时间: ${email.Sent}\n主题: ${email.Subject}\n\n${email.Body}`;

    showCompose();
}

function deleteCurrentEmail() {
    if (!mailboxManager.currentEmail) {
        console.log('没有当前邮件可删除');
        return;
    }

    console.log('删除当前邮件:', mailboxManager.currentEmail.id);
    deleteEmail(mailboxManager.currentEmail.id);

    // 确保返回收件箱
    showInbox();
}

// 邮箱状态管理函数
async function toggleMailboxStatus() {
    if (!mailboxManager.mailboxAddress) {
        mailboxManager.showToast('error', '错误', '邮箱地址未找到');
        return;
    }

    const toggleBtn = document.getElementById('toggle-mailbox-btn');
    const originalText = toggleBtn.textContent;

    // 显示加载状态
    toggleBtn.disabled = true;
    toggleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';

    try {
        if (mailboxManager.isDemoMode) {
            // 演示模式：模拟切换状态
            const newStatus = !mailboxManager.currentMailboxStatus;
            mailboxManager.currentMailboxStatus = newStatus;

            mailboxManager.showToast('info', '演示模式', `邮箱已${newStatus ? '开启' : '关闭'}（演示）`);

            // 立即更新显示
            mailboxManager.updateMailboxStatusDisplay({
                is_active: newStatus
            });

            // 恢复按钮状态
            toggleBtn.disabled = false;
            toggleBtn.innerHTML = `<i class="fas fa-toggle-${newStatus ? 'off' : 'on'}"></i> ${newStatus ? '关闭邮箱' : '开启邮箱'}`;

            return;
        }

        // 正常模式：调用API切换状态
        const response = await fetch(`/api/toggle_mailbox_status?token=${mailboxManager.accessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: mailboxManager.mailboxAddress
            })
        });

        if (response.ok) {
            const data = await response.json();

            if (data.success) {
                mailboxManager.showToast('success', '成功', data.message);

                // 更新显示
                mailboxManager.updateMailboxStatusDisplay({
                    is_active: data.is_active
                });

                // 刷新邮箱信息
                mailboxManager.loadMailboxInfo();
            } else {
                throw new Error(data.error || '切换失败');
            }
        } else {
            throw new Error(`API调用失败: ${response.status}`);
        }
    } catch (error) {
        console.error('切换邮箱状态失败:', error);
        mailboxManager.showToast('error', '错误', '切换邮箱状态失败');

        // 恢复按钮状态
        toggleBtn.disabled = false;
        toggleBtn.innerHTML = `<i class="fas fa-toggle-on"></i> ${originalText}`;
    }
}

// 白名单管理函数
async function toggleWhitelist() {
    if (!mailboxManager.mailboxAddress) {
        mailboxManager.showToast('error', '错误', '邮箱地址未找到');
        return;
    }

    const whitelistEnabled = document.getElementById('whitelist-enabled');
    const whitelistStatus = document.getElementById('whitelist-status');
    const whitelistInputSection = document.getElementById('whitelist-input-section');

    if (!whitelistEnabled || !whitelistStatus || !whitelistInputSection) {
        mailboxManager.showToast('error', '错误', '白名单控制元素未找到');
        return;
    }

    const isEnabled = whitelistEnabled.checked;

    try {
        if (mailboxManager.isDemoMode) {
            // 演示模式：模拟切换白名单状态
            mailboxManager.showToast('info', '演示模式', `白名单已${isEnabled ? '开启' : '关闭'}（演示）`);

            // 立即更新显示
            whitelistStatus.textContent = isEnabled ? '已开启' : '已关闭';
            whitelistInputSection.style.display = isEnabled ? 'flex' : 'none';

            // 更新白名单显示
            const whitelistItems = document.getElementById('whitelist-items');
            if (whitelistItems) {
                if (isEnabled) {
                    // 显示现有白名单或空状态
                    const currentWhitelist = [];
                    if (currentWhitelist.length > 0) {
                        whitelistItems.innerHTML = currentWhitelist.map(sender => `
                            <div class="whitelist-item">
                                <span>${mailboxManager.escapeHtml(sender)}</span>
                                <button class="remove-btn" onclick="mailboxManager.removeSender('${sender}')" title="移除">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `).join('');
                    } else {
                        whitelistItems.innerHTML = '<div class="whitelist-empty">白名单为空，请添加发件人</div>';
                    }
                } else {
                    whitelistItems.innerHTML = '<div class="whitelist-disabled">白名单功能已关闭，接收所有发件人的邮件</div>';
                }
            }

            return;
        }

        // 正常模式：调用API切换白名单状态
        const response = await fetch(`/api/toggle_whitelist?token=${mailboxManager.accessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: mailboxManager.mailboxAddress,
                enabled: isEnabled
            })
        });

        if (response.ok) {
            const data = await response.json();

            if (data.success) {
                mailboxManager.showToast('success', '成功', data.message);

                // 更新显示
                whitelistStatus.textContent = isEnabled ? '已开启' : '已关闭';
                whitelistInputSection.style.display = isEnabled ? 'flex' : 'none';

                // 更新白名单显示
                const whitelistItems = document.getElementById('whitelist-items');
                if (whitelistItems) {
                    if (isEnabled) {
                        // 显示现有白名单或空状态
                        const currentWhitelist = data.whitelist || [];
                        if (currentWhitelist.length > 0) {
                            whitelistItems.innerHTML = currentWhitelist.map(sender => `
                                <div class="whitelist-item">
                                    <span>${mailboxManager.escapeHtml(sender)}</span>
                                    <button class="remove-btn" onclick="mailboxManager.removeSender('${sender}')" title="移除">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            `).join('');
                        } else {
                            whitelistItems.innerHTML = '<div class="whitelist-empty">白名单为空，请添加发件人</div>';
                        }
                    } else {
                        whitelistItems.innerHTML = '<div class="whitelist-disabled">白名单功能已关闭，接收所有发件人的邮件</div>';
                    }
                }

                // 刷新邮箱信息
                mailboxManager.loadMailboxInfo();
            } else {
                throw new Error(data.error || '切换失败');
            }
        } else {
            throw new Error(`API调用失败: ${response.status}`);
        }
    } catch (error) {
        console.error('切换白名单状态失败:', error);
        mailboxManager.showToast('error', '错误', '切换白名单状态失败');

        // 恢复复选框状态 - 需要恢复到操作前的状态
        // 如果原本想开启(isEnabled=true)，失败后应该恢复为关闭(false)
        // 如果原本想关闭(isEnabled=false)，失败后应该恢复为开启(true)
        whitelistEnabled.checked = !isEnabled;

        // 同时恢复相关的UI状态
        whitelistStatus.textContent = !isEnabled ? '已开启' : '已关闭';
        whitelistInputSection.style.display = !isEnabled ? 'flex' : 'none';
    }
}

// 设置页面函数
async function addSender() {
    const input = document.getElementById('new-sender');
    const sender = input.value.trim();

    if (!sender) {
        mailboxManager.showToast('warning', '提示', '请输入发件人地址');
        return;
    }

    try {
        // 调用API添加发件人白名单
        const response = await fetch(`/api/add_sender_whitelist?token=${mailboxManager.accessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: mailboxManager.mailboxAddress,
                sender: sender
            })
        });

        if (response.ok) {
            mailboxManager.showToast('success', '成功', '发件人已添加到白名单');
            input.value = '';
            mailboxManager.loadMailboxInfo(); // 刷新设置
        } else {
            throw new Error('API调用失败');
        }
    } catch (error) {
        mailboxManager.showToast('error', '错误', '添加失败');
    }
}

async function removeSender(sender) {
    if (!confirm(`确定要移除 ${sender} 吗？`)) return;

    try {
        // 调用API移除发件人白名单
        const response = await fetch(`/api/remove_sender_whitelist?token=${mailboxManager.accessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: mailboxManager.mailboxAddress,
                sender: sender
            })
        });

        if (response.ok) {
            mailboxManager.showToast('success', '成功', '发件人已从白名单移除');
            mailboxManager.loadMailboxInfo(); // 刷新设置
        } else {
            throw new Error('API调用失败');
        }
    } catch (error) {
        mailboxManager.showToast('error', '错误', '移除失败');
    }
}

async function updateRetention() {
    const days = document.getElementById('retention-days').value;

    if (!days || days < 1 || days > 30) {
        mailboxManager.showToast('warning', '提示', '保留天数必须在1-30天之间');
        return;
    }

    try {
        // 调用API更新保留天数
        const response = await fetch(`/api/update_retention?token=${mailboxManager.accessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: mailboxManager.mailboxAddress,
                retention_days: parseInt(days)
            })
        });

        if (response.ok) {
            mailboxManager.showToast('success', '成功', `保留时间已更新为${days}天`);
            mailboxManager.loadMailboxInfo(); // 刷新信息
        } else {
            throw new Error('API调用失败');
        }
    } catch (error) {
        mailboxManager.showToast('error', '错误', '更新失败');
    }
}

async function regenerateKey() {
    if (!confirm('重新生成邮箱密钥将使当前密钥失效，确定继续吗？')) return;

    try {
        // 调用API重新生成密钥
        const response = await fetch(`/api/regenerate_mailbox_key?token=${mailboxManager.accessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: mailboxManager.mailboxAddress,
                current_key: mailboxManager.mailboxKey
            })
        });

        if (response.ok) {
            const data = await response.json();

            // 更新本地存储的密钥
            localStorage.setItem('tempmail_mailbox_key', data.new_key);
            mailboxManager.mailboxKey = data.new_key;

            // 显示新密钥
            alert(`新的邮箱密钥：${data.new_key}\n\n请妥善保存，旧密钥已失效！`);

            mailboxManager.showToast('success', '成功', '邮箱密钥已重新生成');
        } else {
            throw new Error('API调用失败');
        }
    } catch (error) {
        mailboxManager.showToast('error', '错误', '重新生成密钥失败');
    }
}

function showAccessToken() {
    const token = mailboxManager.accessToken;
    const maskedToken = token.substring(0, 8) + '...' + token.substring(token.length - 8);

    // 显示访问令牌模态框
    const modal = document.getElementById('token-modal');
    const tokenDisplay = document.getElementById('token-display');
    const tokenInput = document.getElementById('token-input');

    tokenInput.value = token;
    tokenDisplay.textContent = maskedToken;

    modal.classList.add('active');
}

function closeTokenModal() {
    const modal = document.getElementById('token-modal');
    modal.classList.remove('active');
}

function copyToken() {
    const tokenInput = document.getElementById('token-input');
    const token = tokenInput.value;

    navigator.clipboard.writeText(token).then(() => {
        mailboxManager.showToast('success', '成功', '访问令牌已复制到剪贴板');
        closeTokenModal();
    }).catch(() => {
        mailboxManager.showToast('error', '错误', '复制失败，请手动复制');
    });
}

function toggleTokenVisibility() {
    const tokenDisplay = document.getElementById('token-display');
    const tokenInput = document.getElementById('token-input');
    const toggleBtn = document.getElementById('token-toggle-visibility');

    if (tokenInput.type === 'password') {
        tokenInput.type = 'text';
        tokenDisplay.textContent = tokenInput.value;
        toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        toggleBtn.title = '隐藏令牌';
    } else {
        tokenInput.type = 'password';
        tokenDisplay.textContent = tokenInput.value.substring(0, 8) + '...' + tokenInput.value.substring(tokenInput.value.length - 8);
        toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
        toggleBtn.title = '显示令牌';
    }
}

// 初始化
let mailboxManager;
document.addEventListener('DOMContentLoaded', () => {
    mailboxManager = new MailboxManager();
});
