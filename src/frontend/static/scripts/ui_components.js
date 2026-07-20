// Maildrop 共享交互组件：只提供页面真正复用的图标、反馈、对话框和忙碌状态。
(function () {
    'use strict';

    const currentScriptUrl = document.currentScript && document.currentScript.src;
    const spriteUrl = currentScriptUrl
        ? new URL('../icons/maildrop-icons.svg', currentScriptUrl).href
        : '/static/icons/maildrop-icons.svg';

    const iconAliases = Object.freeze({
        mail: 'mail',
        'mail-open': 'mail',
        inbox: 'inbox',
        key: 'key',
        eye: 'eye',
        'eye-off': 'eye-off',
        arrow: 'arrow-right',
        'arrow-right': 'arrow-right',
        back: 'arrow-left',
        'arrow-left': 'arrow-left',
        'chevron-left': 'chevron-left',
        'chevron-right': 'chevron-right',
        'chevron-down': 'chevron-down',
        shield: 'shield',
        theme: 'theme',
        sun: 'sun',
        info: 'info',
        refresh: 'refresh',
        search: 'search',
        check: 'check',
        'check-all': 'check-all',
        'check-circle': 'check-circle',
        success: 'check-circle',
        error: 'alert-circle',
        warning: 'alert-triangle',
        ban: 'alert-circle',
        trash: 'trash',
        copy: 'copy',
        clock: 'clock',
        calendar: 'calendar',
        'calendar-plus': 'calendar',
        hourglass: 'hourglass',
        'hourglass-end': 'hourglass',
        stopwatch: 'stopwatch',
        list: 'list',
        'list-alt': 'list-alt',
        dot: 'dot',
        swap: 'swap',
        shuffle: 'swap',
        close: 'close',
        plus: 'plus',
        minus: 'minus',
        edit: 'edit',
        pen: 'edit',
        'external-link': 'external-link',
        link: 'external-link',
        download: 'download',
        upload: 'upload',
        dashboard: 'dashboard',
        layers: 'layers',
        'layer-group': 'layers',
        audit: 'audit',
        history: 'audit',
        settings: 'settings',
        user: 'user',
        users: 'users',
        'user-plus': 'user-plus',
        'user-shield': 'user-shield',
        register: 'user-plus',
        lock: 'lock',
        unlock: 'unlock',
        logout: 'logout',
        'log-out': 'logout',
        'log-in': 'key',
        code: 'code',
        'file-code': 'code',
        test: 'code',
        globe: 'globe',
        network: 'globe',
        database: 'database',
        server: 'server',
        storage: 'hard-drive',
        'hard-drive': 'hard-drive',
        activity: 'activity',
        bolt: 'activity',
        branch: 'activity',
        filter: 'filter',
        save: 'save',
        menu: 'menu',
        spinner: 'spinner',
        question: 'question',
        at: 'mail',
        tag: 'list-alt',
        sparkles: 'activity',
        'chart-pie': 'dashboard',
        undo: 'refresh'
    });

    const dialogOpeners = new WeakMap();
    let dialogAccessibleNameSequence = 0;

    function normalizeIconName(name) {
        return iconAliases[String(name || '').toLowerCase()] || 'question';
    }

    function normalizeClassName(className) {
        return String(className || '')
            .split(/\s+/)
            .filter((item) => /^[A-Za-z0-9_-]+$/.test(item))
            .join(' ');
    }

    function icon(name, className = '') {
        const target = normalizeIconName(name);
        const classes = ['icon', normalizeClassName(className)].filter(Boolean).join(' ');
        return `<svg class="${classes}" aria-hidden="true" focusable="false"><use href="${spriteUrl}#${target}"></use></svg>`;
    }

    function ensureToastRegion() {
        let region = document.getElementById('toast-region');
        if (region) {
            region.classList.add('ui-toast-region');
            return region;
        }

        region = document.createElement('div');
        region.id = 'toast-region';
        region.className = 'ui-toast-region';
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-atomic', 'false');
        document.body.appendChild(region);
        return region;
    }

    function toast(message, type = 'info', options = {}) {
        const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
        const region = ensureToastRegion();
        const item = document.createElement('div');
        const messageNode = document.createElement('span');
        const closeButton = document.createElement('button');
        const iconName = safeType === 'success' ? 'check-circle' : safeType === 'error' ? 'error' : safeType === 'warning' ? 'warning' : 'info';

        item.className = 'ui-toast';
        item.dataset.type = safeType;
        item.setAttribute('role', safeType === 'error' ? 'alert' : 'status');
        item.innerHTML = icon(iconName, 'ui-toast-icon');

        messageNode.className = 'ui-toast-message';
        messageNode.textContent = String(message || '');
        item.appendChild(messageNode);

        closeButton.type = 'button';
        closeButton.className = 'ui-toast-close';
        closeButton.setAttribute('aria-label', '关闭通知');
        closeButton.innerHTML = icon('close');
        closeButton.addEventListener('click', () => item.remove());
        item.appendChild(closeButton);

        // 最多保留三条通知，避免连续请求把关键操作遮挡住。
        while (region.children.length >= 3) {
            region.firstElementChild.remove();
        }
        region.appendChild(item);

        const defaultDuration = safeType === 'error' ? 6000 : 4000;
        const duration = Number.isFinite(options.duration) ? options.duration : defaultDuration;
        if (!options.persistent && duration > 0) {
            let timer = window.setTimeout(() => item.remove(), duration);
            const pause = () => window.clearTimeout(timer);
            const resume = () => {
                window.clearTimeout(timer);
                timer = window.setTimeout(() => item.remove(), Math.min(duration, 2000));
            };
            item.addEventListener('mouseenter', pause);
            item.addEventListener('mouseleave', resume);
            item.addEventListener('focusin', pause);
            item.addEventListener('focusout', resume);
        }

        return item;
    }

    function getFocusableElements(container) {
        return Array.from(container.querySelectorAll(
            'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
    }

    function handleDialogKeydown(event) {
        if (event.key === 'Escape' && !(event.currentTarget instanceof HTMLDialogElement)) {
            // 非原生后台弹窗没有浏览器默认的 Escape 行为，优先复用其关闭按钮以完成清理和焦点归还。
            const closeControl = event.currentTarget.querySelector(
                '[data-dialog-close], [data-action="close"], .modal-close'
            );
            if (closeControl instanceof HTMLElement) {
                event.preventDefault();
                closeControl.click();
            } else {
                closeDialog(event.currentTarget);
            }
            return;
        }

        if (event.key !== 'Tab') {
            return;
        }
        const focusable = getFocusableElements(event.currentTarget);
        if (!focusable.length) {
            event.preventDefault();
            event.currentTarget.focus();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function openDialog(dialog, opener = document.activeElement) {
        if (!(dialog instanceof HTMLElement)) {
            return false;
        }

        dialogOpeners.set(dialog, opener instanceof HTMLElement ? opener : null);
        dialog.classList.add('ui-dialog');
        // 弹窗必须带可访问名称；统一关联首个标题，避免各页面重复维护 aria-labelledby。
        if (!dialog.hasAttribute('aria-label') && !dialog.hasAttribute('aria-labelledby')) {
            const title = dialog.querySelector('[data-dialog-title], .modal-header h1, .modal-header h2, .modal-header h3, .modal-header h4, .dialog-header h1, .dialog-header h2, .dialog-header h3, .dialog-header h4');
            if (title instanceof HTMLElement) {
                if (!title.id) {
                    dialogAccessibleNameSequence += 1;
                    title.id = `ui-dialog-title-${dialogAccessibleNameSequence}`;
                }
                dialog.setAttribute('aria-labelledby', title.id);
            }
        }
        const description = dialog.querySelector('[data-dialog-description]');
        if (!dialog.hasAttribute('aria-describedby') && description instanceof HTMLElement) {
            if (!description.id) {
                dialogAccessibleNameSequence += 1;
                description.id = `ui-dialog-description-${dialogAccessibleNameSequence}`;
            }
            dialog.setAttribute('aria-describedby', description.id);
        }
        if (dialog instanceof HTMLDialogElement) {
            if (!dialog.open) {
                dialog.showModal();
            }
        } else {
            dialog.hidden = false;
            dialog.classList.add('is-open');
            dialog.setAttribute('role', dialog.getAttribute('role') || 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-hidden', 'false');
            dialog.addEventListener('keydown', handleDialogKeydown);
        }

        const focusable = getFocusableElements(dialog);
        window.requestAnimationFrame(() => (focusable[0] || dialog).focus());
        return true;
    }

    function closeDialog(dialog) {
        if (!(dialog instanceof HTMLElement)) {
            return false;
        }

        if (dialog instanceof HTMLDialogElement) {
            if (dialog.open) {
                dialog.close();
            }
        } else {
            dialog.hidden = true;
            dialog.classList.remove('is-open');
            dialog.setAttribute('aria-hidden', 'true');
            dialog.removeEventListener('keydown', handleDialogKeydown);
        }

        const opener = dialogOpeners.get(dialog);
        dialogOpeners.delete(dialog);
        if (opener && opener.isConnected) {
            window.requestAnimationFrame(() => opener.focus());
        }
        return true;
    }

    function setBusy(element, busy, label = '') {
        if (!(element instanceof HTMLElement)) {
            return;
        }

        const isBusy = Boolean(busy);
        element.setAttribute('aria-busy', String(isBusy));
        if ('disabled' in element) {
            element.disabled = isBusy;
        }

        if (isBusy) {
            if (!element.dataset.uiOriginalHtml) {
                element.dataset.uiOriginalHtml = element.innerHTML;
            }
            element.replaceChildren();
            const spinner = document.createElement('span');
            spinner.className = 'ui-spinner';
            spinner.setAttribute('aria-hidden', 'true');
            element.appendChild(spinner);
            if (label) {
                const text = document.createElement('span');
                text.textContent = label;
                element.appendChild(text);
            }
        } else if (element.dataset.uiOriginalHtml) {
            element.innerHTML = element.dataset.uiOriginalHtml;
            delete element.dataset.uiOriginalHtml;
        }
    }

    document.addEventListener('click', (event) => {
        const closeControl = event.target.closest('[data-dialog-close]');
        if (!closeControl) {
            return;
        }
        const dialog = closeControl.closest('dialog, [role="dialog"]');
        closeDialog(dialog);
    });

    window.MaildropUI = Object.freeze({
        icon,
        toast,
        openDialog,
        closeDialog,
        setBusy
    });
})();
