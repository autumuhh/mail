import time
import uuid
import base64
from datetime import datetime
from email.parser import BytesParser
from email.message import Message
from email.header import decode_header

# Converts a Unix timestamp to a formatted string like this: Jan 01 at 00:00:00
def format_time(timestamp: float) -> str:
    dt_object = datetime.utcfromtimestamp(timestamp)
    return dt_object.strftime("%b %d at %H:%M:%S")

# Extracts the email address from a field that could contain a name and email like: Hailey Thomas <me@haileyy.dev>
def extract_email_address(field: str) -> str:
    if '<' in field and '>' in field:
        start = field.find('<') + 1
        end = field.find('>')
        return field[start:end]
    return field.strip()

# Decodes email header fields that may be encoded
def decode_email_header(header_value: str) -> str:
    """解码邮件头字段，支持Base64和其他编码"""
    if not header_value:
        return ""

    try:
        # 使用decode_header解码
        decoded_parts = decode_header(header_value)

        decoded_string = ""
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                if encoding:
                    # 指定编码的情况
                    try:
                        decoded_string += part.decode(encoding)
                    except (UnicodeDecodeError, LookupError):
                        # 如果指定编码失败，尝试utf-8
                        try:
                            decoded_string += part.decode('utf-8')
                        except UnicodeDecodeError:
                            # 最后尝试latin-1（通常可以解码任何字节序列）
                            decoded_string += part.decode('latin-1')
                else:
                    # 没有指定编码，可能是Base64
                    try:
                        # 尝试Base64解码
                        decoded_string += base64.b64decode(part).decode('utf-8')
                    except:
                        # 如果Base64解码失败，直接用utf-8解码
                        try:
                            decoded_string += part.decode('utf-8')
                        except UnicodeDecodeError:
                            decoded_string += part.decode('latin-1')
            else:
                # 已经是字符串
                decoded_string += str(part)

        return decoded_string
    except Exception:
        # 如果解码失败，返回原始值
        return header_value

# Parses raw email bytes into a JSON dictionary for easy processing
def email_bytes_to_json(data: bytes) -> dict:
    msg = BytesParser().parsebytes(data)
    
    to_field = extract_email_address(msg.get("To", ""))
    from_field = extract_email_address(msg.get("From", ""))
    
    current_timestamp = int(time.time())

    # 解码邮件主题
    raw_subject = msg.get("Subject", "No Subject")
    decoded_subject = decode_email_header(raw_subject)

    email_dict = {
        "id": str(uuid.uuid4()),  # 生成唯一ID
        "From": from_field,
        "To": to_field,
        "Subject": decoded_subject,
        "Timestamp": current_timestamp,
        "Sent": format_time(current_timestamp),
        "Body": "",
        "ContentType": "Text"
    }

    # Loop through parts of the message to find the body
    for part in msg.walk():
        content_type = part.get_content_type()
        if content_type == "text/plain" or content_type == "text/html":
            email_dict["Body"] = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8")
            if content_type == "text/plain":
                email_dict["ContentType"] = "Text"
            if content_type == "text/html":
                email_dict["ContentType"] = "HTML"


    return email_dict