#!/bin/bash

# Maildrop Docker部署脚本
# 使用方法: ./deploy.sh [start|stop|restart|logs|update]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
}

# 检查配置文件
check_config() {
    if [ ! -f ".env" ]; then
        log_warn ".env文件不存在，从模板创建..."
        cp .env.production .env
        log_warn "请编辑 .env 文件配置你的域名和密码！"
        return 1
    fi
    
    # 检查关键配置
    if grep -q "yourdomain.com" .env; then
        log_warn "请在 .env 文件中设置你的域名！"
        return 1
    fi
    
    if grep -q "your_secure_password_here" .env; then
        log_warn "请在 .env 文件中设置安全的管理员密码！"
        return 1
    fi
    
    return 0
}

# 创建必要目录
create_dirs() {
    log_info "创建数据目录..."
    mkdir -p data logs ssl
    chmod 755 data logs
}

# 启动服务
start_service() {
    log_info "启动Maildrop服务..."
    docker-compose up -d
    
    log_info "等待服务启动..."
    sleep 10
    
    # 检查服务状态
    if docker-compose ps | grep -q "Up"; then
        log_info "服务启动成功！"
        log_info "Web界面: http://localhost:80"
        log_info "API测试: http://localhost:80/api-test"
        log_info "管理面板: http://localhost:80/admin"
    else
        log_error "服务启动失败，请查看日志"
        docker-compose logs
    fi
}

# 停止服务
stop_service() {
    log_info "停止Maildrop服务..."
    docker-compose down
}

# 重启服务
restart_service() {
    log_info "重启Maildrop服务..."
    docker-compose restart
}

# 查看日志
show_logs() {
    docker-compose logs -f
}

# 更新服务
update_service() {
    log_info "更新Maildrop服务..."
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
}

# 主函数
main() {
    check_docker
    
    case "${1:-start}" in
        start)
            create_dirs
            if check_config; then
                start_service
            else
                log_error "配置检查失败，请修改 .env 文件后重试"
                exit 1
            fi
            ;;
        stop)
            stop_service
            ;;
        restart)
            restart_service
            ;;
        logs)
            show_logs
            ;;
        update)
            update_service
            ;;
        *)
            echo "使用方法: $0 [start|stop|restart|logs|update]"
            echo ""
            echo "命令说明:"
            echo "  start   - 启动服务"
            echo "  stop    - 停止服务"
            echo "  restart - 重启服务"
            echo "  logs    - 查看日志"
            echo "  update  - 更新服务"
            exit 1
            ;;
    esac
}

main "$@"
