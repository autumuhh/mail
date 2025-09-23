// 语言切换功能
(function() {
    'use strict';
    
    // 语言管理类
    class LanguageManager {
        constructor() {
            this.currentLanguage = this.getStoredLanguage() || 'zh';
            this.translations = {};
            this.languageSelector = null;
            this.languageToggle = null;
            this.languageDropdown = null;
            this.init();
        }
        
        init() {
            // 加载翻译数据
            this.loadTranslations();
            
            // 等待DOM加载完成后绑定事件
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.bindEvents());
            } else {
                this.bindEvents();
            }
        }
        
        bindEvents() {
            this.languageSelector = document.getElementById('language-selector');
            this.languageToggle = document.getElementById('language-toggle');
            this.languageDropdown = document.getElementById('language-dropdown');

            // 检查当前页面是否有足够的翻译内容（在翻译数据加载后）
            setTimeout(() => {
                const hasTranslatableContent = this.checkTranslatableContent();

                if (!hasTranslatableContent) {
                    // 如果没有可翻译内容，隐藏语言选择器
                    if (this.languageSelector) {
                        this.languageSelector.style.display = 'none';
                    }
                }
            }, 100);

            if (this.languageToggle && this.languageDropdown) {
                // 点击切换按钮显示/隐藏下拉菜单
                this.languageToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleDropdown();
                });
                
                // 点击语言选项
                const languageOptions = this.languageDropdown.querySelectorAll('.language-option');
                languageOptions.forEach(option => {
                    option.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const lang = option.getAttribute('data-lang');
                        const name = option.getAttribute('data-name');
                        this.setLanguage(lang, name);
                        this.hideDropdown();
                    });
                });
                
                // 点击其他地方关闭下拉菜单
                document.addEventListener('click', () => {
                    this.hideDropdown();
                });
                
                // 键盘快捷键支持 (Ctrl/Cmd + Shift + L)
                document.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
                        e.preventDefault();
                        this.toggleLanguage();
                    }
                });
            }
            
            // 设置初始语言
            this.applyLanguage(this.currentLanguage);

            // 设置初始语言显示
            const currentLanguageElement = document.getElementById('current-language');
            if (currentLanguageElement) {
                currentLanguageElement.textContent = this.currentLanguage === 'zh' ? '中文' : 'English';
            }

            // 更新选中状态
            this.updateActiveOption(this.currentLanguage);
        }

        checkTranslatableContent() {
            // 检查页面是否有带 data-i18n 属性的元素
            const translatableElements = document.querySelectorAll('[data-i18n]');

            // 如果可翻译元素少于3个，认为不值得显示语言切换器
            if (translatableElements.length < 3) {
                return false;
            }

            // 检查是否有实际的翻译内容
            let hasValidTranslations = false;
            translatableElements.forEach(element => {
                const key = element.getAttribute('data-i18n');
                if (this.translations.zh && this.translations.en &&
                    this.translations.zh[key] && this.translations.en[key] &&
                    this.translations.zh[key] !== this.translations.en[key]) {
                    hasValidTranslations = true;
                }
            });

            return hasValidTranslations;
        }

        loadTranslations() {
            // 翻译数据
            this.translations = {
                zh: {
                    // 主页
                    'site_title': 'TempMail',
                    'site_description': '临时邮箱服务 - 保护您的隐私',
                    'generate_email': '生成随机邮箱',
                    'refresh': '刷新',
                    'copy': '复制邮箱',
                    'admin': '管理',
                    'api_test': 'API测试',
                    'current_email': '当前邮箱地址',
                    'inbox': '您的收件箱',
                    'no_emails': '您的邮件将显示在这里。点击刷新检查新邮件。',
                    'email_active': '已激活',
                    'email_inactive': '未生成',
                    'new_emails': '收到新邮件',
                    'mailbox_expired': '邮箱已过期，正在生成新邮箱...',
                    'refresh_error': '刷新失败，请稍后重试',
                    'network_error': '网络连接失败',
                    'from': '来自',
                    'subject': '主题',
                    'time': '时间',
                    'view_details': '查看详情',
                    'close': '关闭',
                    
                    // Admin页面
                    'admin_panel': 'TempMail - Admin Panel',
                    'admin_title': 'TempMail admin',
                    'admin_description': 'IP白名单管理',
                    'admin_login': '管理员登录',
                    'admin_password': '管理员密码:',
                    'password_placeholder': '请输入管理员密码',
                    'login': '登录',
                    'ip_whitelist': 'IP白名单管理',
                    'add_ip': '添加IP',
                    'remove_ip': '移除IP',
                    'save_settings': '保存设置',
                    'settings_saved': '设置保存成功',
                    
                    // API测试页面
                    'api_test_title': 'API功能测试',
                    'back_home': '返回主页',
                    'admin_panel': '管理面板',
                    'logout': '退出登录',
                    'create_mailbox': '创建邮箱',
                    'mailbox_address': '邮箱地址',
                    'view_mailbox': '查看邮箱',
                    'view_emails': '查看邮件',
                    'send_email': '发送邮件',
                    'sender': '发件人',
                    'recipient': '收件人',
                    'email_subject': '邮件主题',
                    'email_content': '邮件内容',
                    'send': '发送',
                    'mailbox_info': '邮箱信息',
                    'email_list': '邮件列表',
                    'email_details': '邮件详情',
                    'created_time': '创建时间',
                    'expires_time': '过期时间',
                    'email_count': '邮件数量',
                    'sender_whitelist': '发送方白名单',
                    'no_limit': '无限制 - 接收所有发送方的邮件',
                    'active': '活跃',
                    'expired': '已过期',
                    'loading': '正在加载邮件详情...',
                    'network_error': '网络连接失败',
                    'unknown': '未知',
                    'no_subject': '无主题',
                    'no_content': '无内容'
                },
                en: {
                    // Main page
                    'site_title': 'TempMail',
                    'site_description': 'Your free and open source disposable email inbox.',
                    'generate_email': 'Generate Random',
                    'refresh': 'Refresh',
                    'copy': 'Copy Email',
                    'admin': 'Admin',
                    'api_test': 'API Test',
                    'current_email': 'Current Email Address',
                    'inbox': 'Your Inbox',
                    'no_emails': 'Your emails will appear here. Refresh to check for new mail.',
                    'email_active': 'Active',
                    'email_inactive': 'Not Generated',
                    'new_emails': 'New emails received',
                    'mailbox_expired': 'Mailbox expired, generating new one...',
                    'refresh_error': 'Refresh failed, please try again',
                    'network_error': 'Network connection failed',
                    'from': 'From',
                    'subject': 'Subject',
                    'time': 'Time',
                    'view_details': 'View Details',
                    'close': 'Close',
                    
                    // Admin page
                    'admin_panel': 'TempMail - Admin Panel',
                    'admin_title': 'TempMail admin',
                    'admin_description': 'IP Whitelist Management',
                    'admin_login': 'Admin Login',
                    'admin_password': 'Admin Password:',
                    'password_placeholder': 'Enter admin password',
                    'login': 'Login',
                    'ip_whitelist': 'IP Whitelist Management',
                    'add_ip': 'Add IP',
                    'remove_ip': 'Remove IP',
                    'save_settings': 'Save Settings',
                    'settings_saved': 'Settings saved successfully',
                    
                    // API test page
                    'api_test_title': 'API Function Test',
                    'back_home': 'Back to Home',
                    'admin_panel': 'Admin Panel',
                    'logout': 'Logout',
                    'create_mailbox': 'Create Mailbox',
                    'mailbox_address': 'Mailbox Address',
                    'view_mailbox': 'View Mailbox',
                    'view_emails': 'View Emails',
                    'send_email': 'Send Email',
                    'sender': 'Sender',
                    'recipient': 'Recipient',
                    'email_subject': 'Subject',
                    'email_content': 'Content',
                    'send': 'Send',
                    'mailbox_info': 'Mailbox Info',
                    'email_list': 'Email List',
                    'email_details': 'Email Details',
                    'created_time': 'Created Time',
                    'expires_time': 'Expires Time',
                    'email_count': 'Email Count',
                    'sender_whitelist': 'Sender Whitelist',
                    'no_limit': 'No limit - Accept emails from all senders',
                    'active': 'Active',
                    'expired': 'Expired',
                    'loading': 'Loading email details...',
                    'network_error': 'Network connection failed',
                    'unknown': 'Unknown',
                    'no_subject': 'No Subject',
                    'no_content': 'No Content'
                }
            };
        }
        
        getStoredLanguage() {
            try {
                return localStorage.getItem('language');
            } catch (e) {
                console.warn('无法访问localStorage，使用默认语言');
                return null;
            }
        }
        
        storeLanguage(language) {
            try {
                localStorage.setItem('language', language);
            } catch (e) {
                console.warn('无法保存语言设置到localStorage');
            }
        }
        
        toggleDropdown() {
            if (this.languageSelector) {
                this.languageSelector.classList.toggle('active');
            }
        }
        
        hideDropdown() {
            if (this.languageSelector) {
                this.languageSelector.classList.remove('active');
            }
        }
        
        setLanguage(lang, name) {
            this.currentLanguage = lang;
            this.storeLanguage(lang);
            this.applyLanguage(lang);
            
            // 更新显示的语言名称
            const currentLanguageElement = document.getElementById('current-language');
            if (currentLanguageElement) {
                currentLanguageElement.textContent = name;
            }
            
            // 更新选中状态
            this.updateActiveOption(lang);
            
            // 触发语言变更事件
            this.dispatchLanguageChangeEvent(lang);
        }
        
        applyLanguage(lang) {
            const translations = this.translations[lang] || this.translations['zh'];
            
            // 更新页面标题
            if (translations['site_title']) {
                document.title = translations['site_title'];
            }
            
            // 更新所有带有 data-i18n 属性的元素
            document.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                if (translations[key]) {
                    if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'password')) {
                        element.placeholder = translations[key];
                    } else if (element.hasAttribute('title')) {
                        element.title = translations[key];
                        // 如果元素没有文本内容，也设置title
                        if (!element.textContent.trim()) {
                            element.title = translations[key];
                        } else {
                            element.textContent = translations[key];
                        }
                    } else {
                        element.textContent = translations[key];
                    }
                }
            });
            
            // 更新HTML lang属性
            document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
        }
        
        updateActiveOption(lang) {
            const options = this.languageDropdown?.querySelectorAll('.language-option');
            options?.forEach(option => {
                if (option.getAttribute('data-lang') === lang) {
                    option.classList.add('active');
                } else {
                    option.classList.remove('active');
                }
            });
        }
        
        toggleLanguage() {
            const newLang = this.currentLanguage === 'zh' ? 'en' : 'zh';
            const newName = newLang === 'zh' ? '中文' : 'English';
            this.setLanguage(newLang, newName);
        }
        
        dispatchLanguageChangeEvent(language) {
            const event = new CustomEvent('languagechange', {
                detail: { language: language }
            });
            document.dispatchEvent(event);
        }
        
        // 获取当前语言
        getCurrentLanguage() {
            return this.currentLanguage;
        }
        
        // 获取翻译文本
        t(key) {
            const translations = this.translations[this.currentLanguage] || this.translations['zh'];
            return translations[key] || key;
        }
    }
    
    // 创建全局语言管理器实例
    window.languageManager = new LanguageManager();
    
    // 导出语言管理器到全局作用域
    window.LanguageManager = LanguageManager;
})();

// 语言切换工具函数
window.toggleLanguage = function() {
    if (window.languageManager) {
        window.languageManager.toggleLanguage();
    }
};

window.setLanguage = function(language) {
    if (window.languageManager) {
        const name = language === 'zh' ? '中文' : 'English';
        window.languageManager.setLanguage(language, name);
    }
};

window.getCurrentLanguage = function() {
    return window.languageManager ? window.languageManager.getCurrentLanguage() : 'zh';
};

window.t = function(key) {
    return window.languageManager ? window.languageManager.t(key) : key;
};
