// 主题切换功能
(function() {
    'use strict';
    
    // 主题管理类
    class ThemeManager {
        constructor() {
            this.currentTheme = this.getStoredTheme() || 'dark';
            this.themeToggle = null;
            this.init();
        }
        
        init() {
            // 设置初始主题
            this.applyTheme(this.currentTheme);
            
            // 等待DOM加载完成后绑定事件
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.bindEvents());
            } else {
                this.bindEvents();
            }
        }
        
        bindEvents() {
            // 获取所有主题切换按钮（防止重复）
            const themeToggles = document.querySelectorAll('.theme-toggle');

            // 移除重复的按钮，只保留第一个
            if (themeToggles.length > 1) {
                for (let i = 1; i < themeToggles.length; i++) {
                    themeToggles[i].remove();
                }
            }

            this.themeToggle = document.getElementById('theme-toggle');
            if (this.themeToggle) {
                // 移除可能存在的旧事件监听器
                this.themeToggle.replaceWith(this.themeToggle.cloneNode(true));
                this.themeToggle = document.getElementById('theme-toggle');

                this.themeToggle.addEventListener('click', () => this.toggleTheme());

                // 添加键盘快捷键支持 (Ctrl/Cmd + Shift + T)
                document.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
                        e.preventDefault();
                        this.toggleTheme();
                    }
                });
            }
        }
        
        getStoredTheme() {
            try {
                return localStorage.getItem('theme');
            } catch (e) {
                console.warn('无法访问localStorage，使用默认主题');
                return null;
            }
        }
        
        storeTheme(theme) {
            try {
                localStorage.setItem('theme', theme);
            } catch (e) {
                console.warn('无法保存主题设置到localStorage');
            }
        }
        
        applyTheme(theme) {
            const html = document.documentElement;
            
            if (theme === 'light') {
                html.setAttribute('data-theme', 'light');
            } else {
                html.removeAttribute('data-theme');
            }
            
            this.currentTheme = theme;
            this.storeTheme(theme);
            
            // 触发主题变更事件
            this.dispatchThemeChangeEvent(theme);
        }
        
        toggleTheme() {
            const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
            this.applyTheme(newTheme);
            
            // 添加切换动画效果
            this.addToggleAnimation();
        }
        
        addToggleAnimation() {
            if (this.themeToggle) {
                this.themeToggle.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    this.themeToggle.style.transform = 'scale(1)';
                }, 150);
            }
        }
        
        dispatchThemeChangeEvent(theme) {
            const event = new CustomEvent('themechange', {
                detail: { theme: theme }
            });
            document.dispatchEvent(event);
        }
        
        // 获取当前主题
        getCurrentTheme() {
            return this.currentTheme;
        }
        
        // 设置特定主题
        setTheme(theme) {
            if (theme === 'light' || theme === 'dark') {
                this.applyTheme(theme);
            }
        }
    }
    
    // 创建全局主题管理器实例
    window.themeManager = new ThemeManager();
    
    // 监听系统主题变化（可选功能）
    if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            // 只有在用户没有手动设置主题时才跟随系统
            if (!localStorage.getItem('theme')) {
                const systemTheme = e.matches ? 'dark' : 'light';
                window.themeManager.setTheme(systemTheme);
            }
        });
    }
    
    // 导出主题管理器到全局作用域
    window.ThemeManager = ThemeManager;
})();

// 主题切换工具函数
window.toggleTheme = function() {
    if (window.themeManager) {
        window.themeManager.toggleTheme();
    }
};

window.setTheme = function(theme) {
    if (window.themeManager) {
        window.themeManager.setTheme(theme);
    }
};

window.getCurrentTheme = function() {
    return window.themeManager ? window.themeManager.getCurrentTheme() : 'dark';
};
