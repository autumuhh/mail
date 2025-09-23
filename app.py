import os
import threading
import time
import config
from src.backend.flask_app import run_flask_server
from src.backend.smtp_server import run_smtp_server
from src.backend import inbox_handler

def cleanup_emails_periodically():
    """Background task to clean up expired emails periodically"""
    # Determine cleanup interval based on retention time
    if config.EMAIL_RETENTION_SECONDS > 0:
        cleanup_interval = max(5, config.EMAIL_RETENTION_SECONDS // 2)  # Clean every half retention time, min 5 seconds
    else:
        cleanup_interval = 3600  # 1 hour for day-based retention

    print(f"Email cleanup will run every {cleanup_interval} seconds")

    while True:
        try:
            inbox = inbox_handler.read_inbox()

            # Clean expired emails
            cleaned_inbox = inbox_handler.clean_expired_emails(inbox)

            # Clean expired mailboxes
            cleaned_inbox = inbox_handler.clean_expired_mailboxes(cleaned_inbox)

            # Count changes
            mailboxes_before = len(inbox)
            mailboxes_after = len(cleaned_inbox)

            # Count emails
            emails_before = 0
            emails_after = 0

            for mailbox_data in inbox.values():
                if isinstance(mailbox_data, list):
                    emails_before += len(mailbox_data)
                else:
                    emails_before += len(mailbox_data.get("emails", []))

            for mailbox_data in cleaned_inbox.values():
                if isinstance(mailbox_data, list):
                    emails_after += len(mailbox_data)
                else:
                    emails_after += len(mailbox_data.get("emails", []))

            if emails_before != emails_after or mailboxes_before != mailboxes_after:
                inbox_handler.write_inbox(cleaned_inbox)
                print(f"Cleanup completed - Mailboxes: {mailboxes_before}→{mailboxes_after}, Emails: {emails_before}→{emails_after}")
        except Exception as e:
            print(f"Error during cleanup: {e}")

        time.sleep(cleanup_interval)

def check_admin_privileges():
    """Check if running with admin privileges (cross-platform)"""
    try:
        # Windows
        import ctypes
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        # Unix/Linux
        try:
            return os.geteuid() == 0
        except AttributeError:
            # If neither works, assume we have privileges
            return True

if __name__ == "__main__":
    # 检查是否在Docker环境中
    is_docker = os.path.exists('/.dockerenv') or os.environ.get('DOCKER_CONTAINER', False)

    if not check_admin_privileges() and not is_docker:
        print("Warning: This script should be run with administrator privileges to bind to port 25")
        print("You can still run it, but SMTP server might not work properly on port 25")
        print("Continuing anyway...")
    elif not check_admin_privileges() and is_docker:
        print("Running in Docker container - continuing without admin privileges check")

    flask_thread = threading.Thread(target=run_flask_server, args=(config.FLASK_HOST, config.FLASK_PORT))
    smtp_thread = threading.Thread(target=run_smtp_server, args=(config.SMTP_HOST, config.SMTP_PORT))
    cleanup_thread = threading.Thread(target=cleanup_emails_periodically, daemon=True)

    flask_thread.start()
    smtp_thread.start()
    cleanup_thread.start()

    try:
        flask_thread.join()
        smtp_thread.join()
    except KeyboardInterrupt:
        print("Stopping server.")
        os._exit(0)