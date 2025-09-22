// get the inbox from the server
async function getInbox(address, password = null) {
    const headers = {};

    if (password) {
        headers["Authorization"] = password;
    }

    console.log(`[DEBUG] Fetching inbox for: ${address}`);
    const response = await fetch(`/get_inbox?address=${address}`, { headers });
    console.log(`[DEBUG] Response status: ${response.status}`);

    if (response.status === 401) {
        console.log(`[DEBUG] Unauthorized access for: ${address}`);
        return { error: "Unauthorized" };
    }

    if (response.status === 410) {
        console.log(`[DEBUG] Mailbox expired: ${address}`);
        return { error: "Mailbox expired" };
    }

    const result = await response.json();
    console.log(`[DEBUG] Inbox result:`, result);
    return result;
}

// get a random email from the server
async function getRandomAddress() {
    const response = await fetch('/get_random_address');
    
    return await response.json();
}

// get a domain from the server
async function getDomain() {
    const response = await fetch('/get_domain');
    
    return await response.json();
}