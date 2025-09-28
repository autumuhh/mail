// get the inbox from the server
async function getInbox(address, password = null) {
    const headers = {};

    if (password) {
        headers["Authorization"] = password;
    }

    console.log(`[DEBUG] Fetching inbox for: ${address}`);
    const response = await fetch(`/api/get_inbox?address=${address}`, { headers });
    console.log(`[DEBUG] Response status: ${response.status}`);

    if (response.status === 401) {
        console.log(`[DEBUG] Unauthorized access for: ${address}`);
        return { error: "Unauthorized" };
    }

    if (response.status === 410) {
        console.log(`[DEBUG] Mailbox expired: ${address}`);
        return { error: "Mailbox expired" };
    }

    try {
        const result = await response.json();
        console.log(`[DEBUG] Inbox result:`, result);
        return result;
    } catch (error) {
        console.error(`[DEBUG] JSON parse error:`, error);
        return { error: "Invalid response format" };
    }
}

// get a random email from the server
async function getRandomAddress() {
    try {
        const response = await fetch('/api/get_random_address');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('获取随机地址失败:', error);
        throw error;
    }
}

// get a domain from the server
async function getDomain() {
    try {
        const response = await fetch('/api/get_domain');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('获取域名失败:', error);
        throw error;
    }
}