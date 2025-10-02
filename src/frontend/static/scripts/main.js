document.addEventListener("DOMContentLoaded", () => {
    // make variables
    let currentEmail = "";
    let currentInbox = [];

    // make element references
    const emailInput = document.getElementById('email-input');
    const emailPrefix = document.getElementById('email-prefix');
    const randomBtn = document.getElementById('random-btn');
    const customBtn = document.getElementById('custom-btn');
    const manageBtn = document.getElementById('manage-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const copyBtn = document.getElementById('copy-btn');
    const inboxList = document.getElementById('inbox-list');
    const placeholder = document.getElementById('inbox-placeholder');

    // Mailbox management elements
    const mailboxManagement = document.getElementById('mailbox-management');
    const closeManageBtn = document.getElementById('close-manage-btn');
    const createdTime = document.getElementById('created-time');
    const expiresTime = document.getElementById('expires-time');
    const emailCount = document.getElementById('email-count');
    const senderInput = document.getElementById('sender-input');
    const addSenderBtn = document.getElementById('add-sender-btn');
    const senderList = document.getElementById('sender-list');
    const extendMailboxBtn = document.getElementById('extend-mailbox-btn');
    const domainSelector = document.getElementById('domain-selector');

    // add event listeners
    copyBtn.addEventListener('click', copyToClipboard);
    randomBtn.addEventListener('click', generateRandomEmail);
    refreshBtn.addEventListener('click', fetchInbox);
    if (customBtn) customBtn.addEventListener('click', handleCustomEmail);
    if (manageBtn) manageBtn.addEventListener('click', showMailboxManagement);
    closeManageBtn.addEventListener('click', hideMailboxManagement);
    addSenderBtn.addEventListener('click', addSenderToWhitelist);
    extendMailboxBtn.addEventListener('click', extendMailbox);

    senderInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addSenderToWhitelist();
    });

    // function defnitions

    // copy email to clipboard
    async function copyToClipboard() {
        // 获取完整的邮箱地址
        const fullEmail = combineEmailAddress();
        if (!fullEmail) {
            showToast('No email to copy');
            return;
        }

        try {
            await navigator.clipboard.writeText(fullEmail);
            showToast('Email copied to clipboard!');
        } catch (err) {
            // 降级到旧方法
            emailInput.value = fullEmail;
            emailInput.select();
            document.execCommand('copy');
            showToast('Email copied!');
        }
    }

    // 显示提示消息
    function showToast(message) {
        // 创建提示元素
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        // 显示动画
        setTimeout(() => toast.classList.add('show'), 100);

        // 3秒后移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    // generate random email and assign it as the current email
    async function generateRandomEmail() {
        try {
            const newAddress = await getRandomAddress();
            console.log('获取随机地址:', newAddress);

            // 先更新域名选择器
            if (newAddress.available_domains) {
                updateDomainSelector(newAddress.available_domains);
            }

            // 已废弃：自动创建邮箱功能
            // 现在需要通过用户注册界面手动创建邮箱
            // if (newAddress.address) {
            //     await createMailboxIfNotExists(newAddress.address);
            // }

            // 更新邮箱地址显示
            updateEmail(newAddress.address);
        } catch (error) {
            console.error('生成随机邮箱失败:', error);
            showToast('Failed to generate random email');
        }
    }

    // 已废弃：创建邮箱功能已移至用户注册界面
    // 首页已重定向到管理员界面，此函数不再使用
    // async function createMailboxIfNotExists(address) {
    //     // 此函数调用的 /api/create_mailbox_v2 接口已被禁用
    //     // 现在只能通过 /api/register 接口创建邮箱（需要管理员密码）
    // }

    // update the current email
    function updateEmail(email) {
        currentEmail = email;
        emailInput.value = email;

        // 分离用户名和域名
        const [username, domain] = email.split('@');
        if (username && domain) {
            emailPrefix.value = username;
            domainSelector.value = domain;
        }

        fetchInbox();
    }
    
    // check if inboxes are different
    function haveInboxesChanged(oldInbox, newInbox) {
        if (oldInbox.length !== newInbox.length) {
            return true;
        }

        const oldEmailIds = new Set(oldInbox.map(email => email.Timestamp));
        const hasNewEmail = newInbox.some(email => !oldEmailIds.has(email.Timestamp));
        return hasNewEmail;
    }

    // format time
    function formatTime(timestamp) {
        const now = Math.floor(Date.now() / 1000);

        const secondsAgo = now - timestamp;

        const minute = 60;
        const hour = minute * 60;
        const day = hour * 24;

        if (secondsAgo >= day) {
            const days = Math.floor(secondsAgo / day);
            return `${days} days ago`;
        } else if (secondsAgo >= hour) {
            const hours = Math.floor(secondsAgo / hour);
            return `${hours} hours ago`;
        } else if (secondsAgo >= minute) {
            const minutes = Math.floor(secondsAgo / minute);
            return `${minutes} minutes ago`;
        } else {
            return `${secondsAgo} seconds ago`;
        }
    }

    // fetch the inbox from the server
    async function fetchInbox() {
        if (!currentEmail) return;

        refreshBtn.classList.add('loading');

        let password = localStorage.getItem(`${currentEmail}-password`);
        let newInbox = await getInbox(currentEmail, password);

        if (newInbox.error === "Unauthorized") {
            password = prompt("Enter password:");
            if (password) {
                localStorage.setItem(`${currentEmail}-password`, password);
                newInbox = await getInbox(currentEmail, password);
                if (newInbox.error === "Unauthorized") {
                    await generateRandomEmail();
                }
            } else {
                await generateRandomEmail();
            }
        } else if (newInbox.error === "Mailbox expired") {
            console.log(`[DEBUG] Mailbox ${currentEmail} expired, generating new one`);
            await generateRandomEmail();
            return;
        } else if (newInbox.error) {
            console.log(`[DEBUG] Error fetching inbox: ${newInbox.error}`);
            return;
        }

        if (haveInboxesChanged(currentInbox, newInbox)) {
            renderInbox(newInbox);
        }

        currentInbox = newInbox;

        refreshBtn.classList.remove('loading');
    }

    // render the inbox in the inbox element
    function renderInbox(inbox) {
        inboxList.innerHTML = '';
        if (inbox && inbox.length > 0) {
            placeholder.style.display = 'none';
            inbox.forEach(email => {
                const emailItem = document.createElement('li');
                emailItem.className = 'email-item open';
                emailItem.innerHTML = `
                    <div class="email-summary">
                        <div class="email-details">
                            <div class="sender">${email.From}</div>
                            <div class="subject">${email.Subject}</div>
                        </div>
                        <div class="time">${formatTime(email.Timestamp)}</div>
                    </div>
                    <div class="email-body">
                        <iframe class="email-body-iframe" srcdoc=""></iframe>
                    </div>
                `;
                inboxList.appendChild(emailItem);

                const iframe = emailItem.querySelector('.email-body-iframe');
                iframe.srcdoc = email.Body || '';

                const summary = emailItem.querySelector('.email-summary');
                summary.addEventListener('click', () => {
                    emailItem.classList.toggle('open');
                    if (emailItem.classList.contains('open')) {
                        iframe.srcdoc = email.Body || '';
                    }
                });
            });
        } else {
            placeholder.style.display = 'block';
        }
    }

    // use a custom email address
    function handleCustomEmail() {
        // 启用编辑模式
        emailPrefix.readOnly = false;
        emailPrefix.focus();
        emailPrefix.select();

        // 显示提示
        showToast('You can now edit the email address');

        // 添加一次性事件监听器，当失去焦点时禁用编辑
        emailPrefix.addEventListener('blur', function disableEdit() {
            emailPrefix.readOnly = true;
            emailPrefix.removeEventListener('blur', disableEdit);
        }, { once: true });
    }

    // Mailbox management functions
    async function showMailboxManagement() {
        if (!currentEmail) {
            alert('Please generate or enter an email address first');
            return;
        }

        try {
            console.log('获取邮箱管理信息:', currentEmail);
            const response = await fetch(`/api/mailbox_info_v2?address=${currentEmail}`);
            if (response.ok) {
                const data = await response.json();
                console.log('邮箱管理信息:', data);

                // Update mailbox info
                createdTime.textContent = data.created_at ? formatTime(data.created_at) : 'Unknown';
                expiresTime.textContent = data.expires_at ? formatTime(data.expires_at) : 'Unknown';
                emailCount.textContent = data.email_count;

                // Update sender whitelist
                updateSenderList(data.sender_whitelist);

                // Show management panel
                mailboxManagement.style.display = 'block';

                if (data.is_expired) {
                    alert('Warning: This mailbox has expired!');
                }
            } else if (response.status === 404) {
                // Mailbox doesn't exist yet, show default info
                createdTime.textContent = 'Not created';
                expiresTime.textContent = 'Not created';
                emailCount.textContent = '0';
                updateSenderList([]);
                mailboxManagement.style.display = 'block';
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Failed to load mailbox information');
        }
    }

    function hideMailboxManagement() {
        mailboxManagement.style.display = 'none';
    }

    function updateSenderList(senders) {
        senderList.innerHTML = '';
        senders.forEach(sender => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${sender}</span>
                <button class="remove-sender" onclick="removeSenderFromWhitelist('${sender}')">Remove</button>
            `;
            senderList.appendChild(li);
        });
    }

    async function addSenderToWhitelist() {
        const sender = senderInput.value.trim();
        if (!sender) {
            alert('Please enter a sender email or domain');
            return;
        }

        if (!currentEmail) {
            alert('No mailbox selected');
            return;
        }

        try {
            const response = await fetch(`/api/mailbox_whitelist?address=${currentEmail}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'add',
                    sender: sender
                })
            });

            if (response.ok) {
                senderInput.value = '';
                showMailboxManagement(); // Refresh the display
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Failed to add sender to whitelist');
        }
    }

    window.removeSenderFromWhitelist = async function(sender) {
        if (!currentEmail) {
            alert('No mailbox selected');
            return;
        }

        try {
            const response = await fetch(`/api/mailbox_whitelist?address=${currentEmail}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'remove',
                    sender: sender
                })
            });

            if (response.ok) {
                showMailboxManagement(); // Refresh the display
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Failed to remove sender from whitelist');
        }
    }

    async function extendMailbox() {
        if (!currentEmail) {
            alert('No mailbox selected');
            return;
        }

        try {
            const response = await fetch(`/api/extend_mailbox?address=${currentEmail}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    days: 30
                })
            });

            if (response.ok) {
                const data = await response.json();
                alert(data.message);
                showMailboxManagement(); // Refresh the display
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Failed to extend mailbox');
        }
    }

    // 注释掉自动创建邮箱功能，防止滥用
    // generate an email when the page loads
    // (async () => {
    //     await generateRandomEmail();
    // })();

    // 更新域名选择器
    function updateDomainSelector(domains) {
        domainSelector.innerHTML = '';
        domains.forEach(domain => {
            const option = document.createElement('option');
            option.value = domain;
            option.textContent = domain;
            domainSelector.appendChild(option);
        });
    }

    // 组合邮箱地址
    function combineEmailAddress() {
        const username = emailPrefix.value.trim();
        const domain = domainSelector.value;

        if (username && domain) {
            const newEmail = `${username}@${domain}`;
            currentEmail = newEmail;
            emailInput.value = newEmail;
            fetchInbox();
            return newEmail;
        }
        return null;
    }

    // 域名选择器事件
    domainSelector.addEventListener('change', async function() {
        const selectedDomain = this.value;
        if (selectedDomain && emailPrefix.value.trim()) {
            combineEmailAddress();
            // 已废弃：自动创建邮箱功能
            // const fullAddress = `${emailPrefix.value}@${selectedDomain}`;
            // await createMailboxIfNotExists(fullAddress);
        } else if (selectedDomain) {
            // 如果没有用户名，生成随机用户名
            const randomString = Math.random().toString(36).substring(2, 18);
            emailPrefix.value = randomString;
            combineEmailAddress();
            // 已废弃：自动创建邮箱功能
            // const fullAddress = `${randomString}@${selectedDomain}`;
            // await createMailboxIfNotExists(fullAddress);
        }
    });

    // 用户名输入事件
    emailPrefix.addEventListener('input', async function() {
        if (this.value.trim() && domainSelector.value) {
            combineEmailAddress();
            // 已废弃：自动创建邮箱功能
            // const fullAddress = `${this.value.trim()}@${domainSelector.value}`;
            // await createMailboxIfNotExists(fullAddress);
        }
    });

    // automatic inbox refreshing
    setInterval(fetchInbox, 5000);
});


