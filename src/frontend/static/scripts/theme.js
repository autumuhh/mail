// 全站主题只保存视觉偏好；邮箱地址、密钥和 API 凭据不经过本模块。
(function () {
    'use strict';

    const STORAGE_KEY = 'maildrop_theme';
    const THEMES = Object.freeze(['auto', 'light', 'dark']);
    const LABELS = Object.freeze({
        auto: '跟随系统',
        light: '浅色',
        dark: '深色'
    });

    class ThemeManager {
        constructor() {
            this.currentTheme = this.readTheme();
            this.applyTheme(this.currentTheme, false);
            this.bindWhenReady();
            this.bindSystemPreference();
        }

        readTheme() {
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                return THEMES.includes(saved) ? saved : 'auto';
            } catch (error) {
                console.warn('无法读取主题偏好，将跟随系统主题。');
                return 'auto';
            }
        }

        storeTheme(theme) {
            try {
                sessionStorage.setItem(STORAGE_KEY, theme);
            } catch (error) {
                console.warn('无法保存主题偏好，本次会话仍可继续使用。');
            }
        }

        bindWhenReady() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.bindEvents(), { once: true });
            } else {
                this.bindEvents();
            }
        }

        bindEvents() {
            document.querySelectorAll('#theme-toggle, [data-theme-toggle]').forEach((button) => {
                // 兼容后台现有内联调用，避免同一次点击被切换两次。
                if (!String(button.getAttribute('onclick') || '').includes('toggleTheme')) {
                    button.addEventListener('click', () => this.toggleTheme());
                }
                this.updateButton(button);
            });

            document.addEventListener('keydown', (event) => {
                if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 't') {
                    event.preventDefault();
                    this.toggleTheme();
                }
            });
        }

        bindSystemPreference() {
            if (!window.matchMedia) {
                return;
            }
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', () => {
                if (this.currentTheme === 'auto') {
                    this.dispatchThemeChange();
                }
            });
        }

        applyTheme(theme, persist = true) {
            const safeTheme = THEMES.includes(theme) ? theme : 'auto';
            document.documentElement.dataset.theme = safeTheme;
            this.currentTheme = safeTheme;
            if (persist) {
                this.storeTheme(safeTheme);
            }
            document.querySelectorAll('#theme-toggle, [data-theme-toggle]').forEach((button) => this.updateButton(button));
            this.dispatchThemeChange();
        }

        resolvedTheme() {
            if (this.currentTheme !== 'auto') {
                return this.currentTheme;
            }
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        updateButton(button) {
            if (!(button instanceof HTMLElement)) {
                return;
            }
            const label = LABELS[this.currentTheme];
            button.setAttribute('aria-label', `主题：${label}`);
            button.title = `当前主题：${label}，点击切换`;
            button.dataset.themeValue = this.currentTheme;
        }

        toggleTheme() {
            const index = THEMES.indexOf(this.currentTheme);
            const next = THEMES[(index + 1) % THEMES.length];
            this.applyTheme(next);
            return next;
        }

        setTheme(theme) {
            if (!THEMES.includes(theme)) {
                return false;
            }
            this.applyTheme(theme);
            return true;
        }

        dispatchThemeChange() {
            document.dispatchEvent(new CustomEvent('themechange', {
                detail: {
                    theme: this.currentTheme,
                    resolvedTheme: this.resolvedTheme()
                }
            }));
        }
    }

    const manager = new ThemeManager();
    window.themeManager = manager;
    window.ThemeManager = ThemeManager;
    window.toggleTheme = () => manager.toggleTheme();
    window.setTheme = (theme) => manager.setTheme(theme);
    window.getCurrentTheme = () => manager.currentTheme;
})();
