
import sys
import threading
import time
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
from aiosmtpd.controller import Controller
from . import email_parser, inbox_handler

# 配置日志
logger = logging.getLogger(__name__)

# 线程池用于执行同步的数据库操作
_executor = ThreadPoolExecutor(max_workers=4)

# Class for SMTP server logic
class SMTPServer:
    # This function is called when the server receives an email
    async def handle_DATA(self, server, session, envelope):
        try:
            # Check IP whitelist
            client_ip = session.peer[0] if session.peer else "unknown"
            if not inbox_handler.is_ip_whitelisted(client_ip):
                logger.warning(f"Rejected email from non-whitelisted IP: {client_ip}")
                return '550 Access denied - IP not whitelisted'

            parsed_email = email_parser.email_bytes_to_json(envelope.content)

            # 使用线程池执行同步的数据库操作，避免阻塞事件循环
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                _executor,
                inbox_handler.recv_email,
                parsed_email
            )

            if result == "Email accepted":
                logger.info(f"Email accepted from {client_ip} to {parsed_email.get('To', 'unknown')}")
                return '250 Message accepted for delivery'
            else:
                logger.warning(f"Email rejected: {result}")
                return f'550 {result}'

        except Exception as e:
            logger.error(f"Error processing email: {e}", exc_info=True)
            return '500 Could not process email'

# This function sets up and runs the SMTP server
def run_smtp_server(host: str = "0.0.0.0", port: int = 25):
    handler = SMTPServer()
    controller = Controller(handler, hostname=host, port=port, ready_timeout=30)

    logger.info(f"Starting SMTP server on {host}:{port}")
    try:
        controller.start()
        logger.info(f"SMTP server started successfully on {host}:{port}")

        # 等待服务器完全就绪
        logger.debug("Waiting for SMTP server to be ready...")
        time.sleep(2)

        # 保持服务器运行
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("SMTP server shutting down...")
            controller.stop()

    except Exception as e:
        logger.error(f"Failed to start SMTP server: {e}", exc_info=True)
        return
