document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const createMailboxBtn = document.getElementById('create-mailbox-btn');
    const sendEmailBtn = document.getElementById('send-email-btn');
    const viewMailboxBtn = document.getElementById('view-mailbox-btn');
    const viewEmailsBtn = document.getElementById('view-emails-btn');
    
    const customAddress = document.getElementById('custom-address');
    const retentionDays = document.getElementById('retention-days');
    const senderWhitelist = document.getElementById('sender-whitelist');
    const createResult = document.getElementById('create-result');
    
    const targetEmail = document.getElementById('target-email');
    const senderEmail = document.getElementById('sender-email');
    const emailSubject = document.getElementById('email-subject');
    const emailBody = document.getElementById('email-body');
    const sendResult = document.getElementById('send-result');
    
    const viewEmail = document.getElementById('view-email');
    const mailboxInfo = document.getElementById('mailbox-info');
    const emailsList = document.getElementById('emails-list');
    const closeDetailBtn = document.getElementById('close-detail-btn');
    
    const statusMessage = document.getElementById('status-message');

    // 事件监听器
    createMailboxBtn.addEventListener('click', createMailbox);
    sendEmailBtn.addEventListener('click', sendEmail);
    viewMailboxBtn.addEventListener('click', viewMailbox);
    viewEmailsBtn.addEventListener('click', viewEmails);
    closeDetailBtn.addEventListener('click', closeEmailDetail);
    
    // 快速发送方按钮
    document.querySelectorAll('.quick-sender-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sender = e.target.dataset.sender;
            senderEmail.value = sender;
            showStatus(`已设置发送方: ${sender}`, 'info');
        });
    });

    // 创建邮箱
    async function createMailbox() {
        const address = customAddress.value.trim();
        const days = parseInt(retentionDays.value) || 30;
        const whitelist = senderWhitelist.value.trim()
            .split('\n')
            .map(s => s.trim())
            .filter(s => s);

        const data = {
            retention_days: days,
            sender_whitelist: whitelist
        };

        if (address) {
            data.address = address;
        }

        try {
            createMailboxBtn.disabled = true;
            createMailboxBtn.textContent = '创建中...';

            const response = await fetch('/create_mailbox', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                showResult(createResult, `
                    <h3>✅ 邮箱创建成功</h3>
                    <p><strong>地址:</strong> ${result.address}</p>
                    <p><strong>创建时间:</strong> ${formatTime(result.created_at)}</p>
                    <p><strong>过期时间:</strong> ${formatTime(result.expires_at)}</p>
                    <p><strong>保留天数:</strong> ${result.retention_days}</p>
                    <p><strong>白名单:</strong> ${result.sender_whitelist.join(', ') || '无限制'}</p>
                `, 'success');
                
                // 自动填充到测试区域
                targetEmail.value = result.address;
                viewEmail.value = result.address;
                
                showStatus('邮箱创建成功！', 'success');
            } else {
                showResult(createResult, `❌ 创建失败: ${result.error}`, 'error');
                showStatus(`创建失败: ${result.error}`, 'error');
            }
        } catch (error) {
            showResult(createResult, `❌ 网络错误: ${error.message}`, 'error');
            showStatus('网络连接失败', 'error');
        } finally {
            createMailboxBtn.disabled = false;
            createMailboxBtn.textContent = '创建邮箱';
        }
    }

    // 发送邮件
    async function sendEmail() {
        const to = targetEmail.value.trim();
        const from = senderEmail.value.trim();
        const subject = emailSubject.value.trim();
        const body = emailBody.value.trim();

        if (!to || !from || !subject) {
            showStatus('请填写完整的邮件信息', 'error');
            return;
        }

        try {
            sendEmailBtn.disabled = true;
            sendEmailBtn.textContent = '发送中...';

            // 这里调用后端发送邮件的API（需要实现）
            const response = await fetch('/send_test_email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: to,
                    from: from,
                    subject: subject,
                    body: body
                })
            });

            if (response.ok) {
                const result = await response.json();
                showResult(sendResult, `✅ 邮件发送成功`, 'success');
                showStatus('邮件发送成功！', 'success');
            } else {
                const error = await response.json();
                showResult(sendResult, `❌ 发送失败: ${error.error || '未知错误'}`, 'error');
                showStatus('邮件发送失败', 'error');
            }
        } catch (error) {
            showResult(sendResult, `❌ 网络错误: ${error.message}`, 'error');
            showStatus('网络连接失败', 'error');
        } finally {
            sendEmailBtn.disabled = false;
            sendEmailBtn.textContent = '发送邮件';
        }
    }

    // 查看邮箱信息
    async function viewMailbox() {
        const email = viewEmail.value.trim();
        if (!email) {
            showStatus('请输入邮箱地址', 'error');
            return;
        }

        try {
            const response = await fetch(`/mailbox_info?address=${encodeURIComponent(email)}`);
            const result = await response.json();

            if (response.ok) {
                document.getElementById('info-address').textContent = result.address;
                document.getElementById('info-created').textContent = 
                    result.created_at ? formatTime(result.created_at) : '未知';
                document.getElementById('info-expires').textContent = 
                    result.expires_at ? formatTime(result.expires_at) : '未知';
                document.getElementById('info-count').textContent = result.email_count;
                document.getElementById('info-expired').textContent = 
                    result.is_expired ? '是' : '否';

                const whitelistDisplay = document.getElementById('whitelist-display');
                whitelistDisplay.innerHTML = '';
                if (result.sender_whitelist && result.sender_whitelist.length > 0) {
                    result.sender_whitelist.forEach(sender => {
                        const li = document.createElement('li');
                        li.textContent = sender;
                        whitelistDisplay.appendChild(li);
                    });
                } else {
                    const li = document.createElement('li');
                    li.textContent = '无限制';
                    li.style.fontStyle = 'italic';
                    whitelistDisplay.appendChild(li);
                }

                mailboxInfo.style.display = 'block';
                showStatus('邮箱信息加载成功', 'success');
            } else {
                showStatus(`获取邮箱信息失败: ${result.error}`, 'error');
                mailboxInfo.style.display = 'none';
            }
        } catch (error) {
            showStatus('网络连接失败', 'error');
            mailboxInfo.style.display = 'none';
        }
    }

    // 查看邮件列表
    async function viewEmails() {
        const email = viewEmail.value.trim();
        if (!email) {
            showStatus('请输入邮箱地址', 'error');
            return;
        }

        try {
            const response = await fetch(`/get_inbox?address=${encodeURIComponent(email)}`);
            const emails = await response.json();

            if (response.ok) {
                const emailsContent = document.getElementById('emails-content');
                emailsContent.innerHTML = '';

                if (emails.length === 0) {
                    emailsContent.innerHTML = '<p>暂无邮件</p>';
                } else {
                    emails.forEach(email => {
                        const emailDiv = document.createElement('div');
                        emailDiv.className = 'email-item';
                        emailDiv.innerHTML = `
                            <div class="email-header">
                                <span class="email-from">来自: ${email.From || '未知'}</span>
                                <span class="email-time">${formatTime(email.Timestamp)}</span>
                            </div>
                            <div class="email-subject">${email.Subject || '无主题'}</div>
                            <div class="email-body">${(email.Body || '无内容').substring(0, 100)}${email.Body && email.Body.length > 100 ? '...' : ''}</div>
                            <button class="btn btn-primary view-detail-btn" data-email-id="${email.id}" data-address="${viewEmail.value.trim()}">查看详情</button>
                        `;
                        emailsContent.appendChild(emailDiv);
                    });

                    // 添加查看详情按钮事件
                    document.querySelectorAll('.view-detail-btn').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const emailId = this.getAttribute('data-email-id');
                            const address = viewEmail.value.trim();
                            viewEmailDetail(address, emailId);
                        });
                    });
                }

                emailsList.style.display = 'block';
                showStatus(`加载了 ${emails.length} 封邮件`, 'success');
            } else {
                showStatus(`获取邮件失败: ${emails.error}`, 'error');
                emailsList.style.display = 'none';
            }
        } catch (error) {
            showStatus('网络连接失败', 'error');
            emailsList.style.display = 'none';
        }
    }

    // 查看邮件详情
    async function viewEmailDetail(address, emailId) {
        if (!address || !emailId) {
            showStatus('邮箱地址或邮件ID缺失', 'error');
            return;
        }

        try {
            const response = await fetch(`/get_email?address=${encodeURIComponent(address)}&id=${encodeURIComponent(emailId)}`);
            const email = await response.json();

            if (response.ok) {
                // 填充邮件详情
                document.getElementById('detail-from').textContent = email.From || '未知';
                document.getElementById('detail-to').textContent = email.To || '未知';
                document.getElementById('detail-subject').textContent = email.Subject || '无主题';
                document.getElementById('detail-time').textContent = formatTime(email.Timestamp);
                document.getElementById('detail-id').textContent = email.id || '未知';
                document.getElementById('detail-body-content').textContent = email.Body || '无内容';

                // 显示详情面板
                document.getElementById('email-detail').style.display = 'block';
                showStatus('邮件详情加载成功', 'success');
            } else {
                showStatus(`获取邮件详情失败: ${email.error}`, 'error');
            }
        } catch (error) {
            showStatus('网络连接失败', 'error');
        }
    }

    // 关闭邮件详情
    function closeEmailDetail() {
        document.getElementById('email-detail').style.display = 'none';
    }

    // 显示结果
    function showResult(element, content, type) {
        element.innerHTML = content;
        element.className = `result-box ${type}`;
        element.style.display = 'block';
    }

    // 显示状态消息
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';

        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }

    // 格式化时间
    function formatTime(timestamp) {
        if (!timestamp) return '未知';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString('zh-CN');
    }
});
