
import sys
import threading
import time
from aiosmtpd.controller import Controller
from . import email_parser, inbox_handler

# Class for SMTP server logic
class SMTPServer:
    # This function is called when the server receives an email
    async def handle_DATA(self, server, session, envelope):
        try:
            # Check IP whitelist
            client_ip = session.peer[0] if session.peer else "unknown"
            if not inbox_handler.is_ip_whitelisted(client_ip):
                print(f"Rejected email from non-whitelisted IP: {client_ip}")
                return '550 Access denied - IP not whitelisted'

            parsed_email = email_parser.email_bytes_to_json(envelope.content)
            result = inbox_handler.recv_email(parsed_email)

            if result == "Email accepted":
                print(f"Email accepted from {client_ip} to {parsed_email.get('To', 'unknown')}")
                return '250 Message accepted for delivery'
            else:
                print(f"Email rejected: {result}")
                return f'550 {result}'

        except Exception as e:
            print(f"Error processing email: {e}")
            return '500 Could not process email'

# This function sets up and runs the SMTP server
def run_smtp_server(host: str = "0.0.0.0", port: int = 25):
    handler = SMTPServer()
    controller = Controller(handler, hostname=host, port=port)

    print(f"Starting SMTP server on {host}:{port}")
    try:
        controller.start()
        print(f"SMTP server started successfully on {host}:{port}")

        # 保持服务器运行
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("SMTP server shutting down...")
            controller.stop()

    except Exception as e:
        print(f"Failed to start SMTP server: {e}")
        print(f"Error details: {type(e).__name__}: {str(e)}")
        return