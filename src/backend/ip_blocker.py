"""
IP临时封禁管理器
用于防止恶意请求和暴力破解
"""

import time
from typing import Dict, Optional
from threading import Lock
import config

class IPBlocker:
    def __init__(self):
        # 存储被封禁的IP和解封时间戳
        self.blocked_ips: Dict[str, float] = {}
        # 存储IP的失败尝试次数和时间戳
        self.failed_attempts: Dict[str, list] = {}
        self.lock = Lock()

        # 从配置文件读取配置
        self.block_duration = config.IP_BLOCK_DURATION  # 封禁时长（秒）
        self.max_attempts = config.IP_MAX_FAILED_ATTEMPTS  # 最大失败尝试次数
        self.attempt_window = config.IP_ATTEMPT_WINDOW  # 尝试窗口时间（秒）

        print(f"[IP Blocker] 初始化完成 - 封禁时长: {self.block_duration}秒, 最大尝试: {self.max_attempts}次, 窗口时间: {self.attempt_window}秒")
    
    def is_blocked(self, ip: str) -> bool:
        """检查IP是否被封禁"""
        with self.lock:
            if ip in self.blocked_ips:
                unblock_time = self.blocked_ips[ip]
                current_time = time.time()
                
                if current_time < unblock_time:
                    # 仍在封禁期内
                    return True
                else:
                    # 封禁期已过，解除封禁
                    del self.blocked_ips[ip]
                    if ip in self.failed_attempts:
                        del self.failed_attempts[ip]
                    return False
            return False
    
    def record_failed_attempt(self, ip: str) -> bool:
        """
        记录失败尝试
        返回True表示IP被封禁，False表示未被封禁
        """
        with self.lock:
            current_time = time.time()
            
            # 初始化或清理过期的尝试记录
            if ip not in self.failed_attempts:
                self.failed_attempts[ip] = []
            
            # 移除窗口时间之外的旧记录
            self.failed_attempts[ip] = [
                timestamp for timestamp in self.failed_attempts[ip]
                if current_time - timestamp < self.attempt_window
            ]
            
            # 添加新的失败记录
            self.failed_attempts[ip].append(current_time)
            
            # 检查是否超过最大尝试次数
            if len(self.failed_attempts[ip]) >= self.max_attempts:
                # 封禁IP
                self.blocked_ips[ip] = current_time + self.block_duration
                print(f"[IP Blocker] IP {ip} 已被封禁 {self.block_duration} 秒（失败尝试 {len(self.failed_attempts[ip])} 次）")
                return True
            
            return False
    
    def get_remaining_block_time(self, ip: str) -> Optional[int]:
        """获取IP剩余封禁时间（秒）"""
        with self.lock:
            if ip in self.blocked_ips:
                remaining = int(self.blocked_ips[ip] - time.time())
                return max(0, remaining)
            return None
    
    def unblock_ip(self, ip: str):
        """手动解除IP封禁"""
        with self.lock:
            if ip in self.blocked_ips:
                del self.blocked_ips[ip]
            if ip in self.failed_attempts:
                del self.failed_attempts[ip]
            print(f"[IP Blocker] IP {ip} 已手动解除封禁")
    
    def get_blocked_ips(self) -> Dict[str, int]:
        """获取所有被封禁的IP及其剩余时间"""
        with self.lock:
            current_time = time.time()
            return {
                ip: int(unblock_time - current_time)
                for ip, unblock_time in self.blocked_ips.items()
                if unblock_time > current_time
            }
    
    def cleanup_expired(self):
        """清理过期的封禁记录"""
        with self.lock:
            current_time = time.time()
            expired_ips = [
                ip for ip, unblock_time in self.blocked_ips.items()
                if unblock_time <= current_time
            ]
            for ip in expired_ips:
                del self.blocked_ips[ip]
                if ip in self.failed_attempts:
                    del self.failed_attempts[ip]
            
            if expired_ips:
                print(f"[IP Blocker] 清理了 {len(expired_ips)} 个过期封禁记录")

# 全局IP封禁管理器实例
ip_blocker = IPBlocker()

