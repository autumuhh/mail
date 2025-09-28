import json
import re
import os
import time
import ipaddress
import config

# Reads the contents of the inbox.json file and returns it as a dictionary
def read_inbox() -> dict:
    try:
        with open(config.INBOX_FILE_NAME, "r") as f:
            data = json.load(f)
            # Ensure new data structure compatibility
            if data and isinstance(list(data.values())[0], list):
                # Old format: convert to new format
                new_data = {}
                current_time = int(time.time())
                for address, emails in data.items():
                    new_data[address] = {
                        "created_at": current_time,
                        "expires_at": current_time + (config.MAILBOX_RETENTION_DAYS * 24 * 60 * 60),
                        "sender_whitelist": [],
                        "emails": emails
                    }
                write_inbox(new_data)
                return new_data
            return data
    except:
        return {}

# Writes a dictionary to the inbox.json file
def write_inbox(data: dict):
    with open(config.INBOX_FILE_NAME, "w") as f:
        json.dump(data, f, indent=4)

# Clears inbox if it exceeds maximum
def check_inbox_size():
    if not os.path.exists(config.INBOX_FILE_NAME):
        return

    if os.path.getsize(config.INBOX_FILE_NAME) > config.MAX_INBOX_SIZE:
        write_inbox({})

# Removes emails older than the retention period
def clean_expired_emails(inbox: dict) -> dict:
    current_time = int(time.time())
    cutoff_time = current_time - config.EMAIL_RETENTION_TIME

    cleaned_inbox = {}
    for address, mailbox_data in inbox.items():
        if isinstance(mailbox_data, list):  # Old format compatibility
            valid_emails = [email for email in mailbox_data if email.get('Timestamp', 0) > cutoff_time]
            if valid_emails:
                cleaned_inbox[address] = valid_emails
        else:  # New format
            emails = mailbox_data.get("emails", [])
            valid_emails = [email for email in emails if email.get('Timestamp', 0) > cutoff_time]
            if valid_emails or not is_mailbox_expired(mailbox_data):
                mailbox_data["emails"] = valid_emails
                cleaned_inbox[address] = mailbox_data

    return cleaned_inbox

# Limits the number of emails per address
def limit_emails_per_address(emails: list) -> list:
    # Sort emails by timestamp (newest first) and keep only the latest ones
    emails.sort(key=lambda x: x.get('Timestamp', 0), reverse=True)
    return emails[:config.MAX_EMAILS_PER_ADDRESS]

# Create or get mailbox with lifecycle management
def create_or_get_mailbox(address: str) -> dict:
    inbox = read_inbox()
    current_time = int(time.time())

    if address not in inbox:
        # Create new mailbox
        inbox[address] = {
            "created_at": current_time,
            "expires_at": current_time + (config.MAILBOX_RETENTION_DAYS * 24 * 60 * 60),
            "sender_whitelist": [],
            "emails": []
        }
        write_inbox(inbox)

    return inbox[address]

# Check if mailbox is expired
def is_mailbox_expired(mailbox_data: dict) -> bool:
    current_time = int(time.time())
    return current_time > mailbox_data.get("expires_at", 0)

# Clean expired mailboxes
def clean_expired_mailboxes(inbox: dict) -> dict:
    current_time = int(time.time())
    cleaned_inbox = {}

    for address, mailbox_data in inbox.items():
        if not is_mailbox_expired(mailbox_data):
            cleaned_inbox[address] = mailbox_data

    return cleaned_inbox

# Check sender whitelist for a mailbox
def is_sender_allowed(mailbox_data: dict, sender_email: str) -> bool:
    if not config.ENABLE_SENDER_WHITELIST:
        return True

    sender_whitelist = mailbox_data.get("sender_whitelist", [])
    if not sender_whitelist:  # Empty whitelist means allow all
        return True

    # Check exact match and domain match
    sender_domain = sender_email.split('@')[-1] if '@' in sender_email else ''

    for allowed in sender_whitelist:
        if allowed == sender_email:  # Exact match
            return True
        if allowed.startswith('@') and allowed[1:] == sender_domain:  # Domain match
            return True
        if allowed.startswith('*@') and allowed[2:] == sender_domain:  # Wildcard domain match
            return True

    return False

# Add sender to whitelist
def add_sender_to_whitelist(address: str, sender: str) -> bool:
    inbox = read_inbox()
    if address in inbox:
        whitelist = inbox[address].get("sender_whitelist", [])
        if sender not in whitelist:
            whitelist.append(sender)
            inbox[address]["sender_whitelist"] = whitelist
            write_inbox(inbox)
            return True
    return False

# Remove sender from whitelist
def remove_sender_from_whitelist(address: str, sender: str) -> bool:
    inbox = read_inbox()
    if address in inbox:
        whitelist = inbox[address].get("sender_whitelist", [])
        if sender in whitelist:
            whitelist.remove(sender)
            inbox[address]["sender_whitelist"] = whitelist
            write_inbox(inbox)
            return True
    return False

# Check if IP is in whitelist
def is_ip_whitelisted(client_ip: str) -> bool:
    if not config.ENABLE_IP_WHITELIST:
        return True  # If whitelist is disabled, allow all IPs

    try:
        client_addr = ipaddress.ip_address(client_ip)
        whitelist_entries = [entry.strip() for entry in config.IP_WHITELIST.split(',')]

        for entry in whitelist_entries:
            try:
                # Check if it's a single IP or CIDR block
                if '/' in entry:
                    network = ipaddress.ip_network(entry, strict=False)
                    if client_addr in network:
                        return True
                else:
                    allowed_ip = ipaddress.ip_address(entry)
                    if client_addr == allowed_ip:
                        return True
            except ValueError:
                continue  # Skip invalid entries

        return False
    except ValueError:
        return False  # Invalid IP address

# Adds a new email to the inbox
def recv_email(email_json: dict):
    recipient = email_json.get('To')
    sender = email_json.get('From')

    if not recipient:
        return "No recipient specified"

    # Import database handler if database is enabled
    if config.USE_DATABASE:
        try:
            from . import db_inbox_handler
            return db_inbox_handler.recv_email(email_json)
        except ImportError:
            print("Warning: Database enabled but db_inbox_handler not available, falling back to JSON")
        except Exception as e:
            print(f"Error using database handler: {e}, falling back to JSON")

    # Fallback to JSON storage
    check_inbox_size()
    inbox = read_inbox()

    # Clean expired emails and mailboxes first
    inbox = clean_expired_emails(inbox)
    inbox = clean_expired_mailboxes(inbox)

    # Create or get mailbox
    mailbox_data = create_or_get_mailbox(recipient)

    # Check if mailbox is expired
    if is_mailbox_expired(mailbox_data):
        return f"Mailbox {recipient} has expired"

    # Check sender whitelist
    if not is_sender_allowed(mailbox_data, sender):
        return f"Sender {sender} not allowed for mailbox {recipient}"

    # Add the new email
    mailbox_data["emails"].append(email_json)

    # Limit emails per address
    mailbox_data["emails"] = limit_emails_per_address(mailbox_data["emails"])

    # Update inbox
    inbox[recipient] = mailbox_data
    write_inbox(inbox)

    return "Email accepted"