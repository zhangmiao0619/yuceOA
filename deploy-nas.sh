#!/bin/bash
# OA 系统 NAS 一键部署脚本
# 支持: 群晖、威联通、TrueNAS、Unraid、通用 Linux NAS

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  OA 系统 NAS 一键部署脚本${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

# 检查 Docker
echo "🔍 检查 Docker 环境..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    echo "请先安装 Docker:"
    echo "  - 群晖: 套件中心安装 Container Manager"
    echo "  - 威联通: App Center 安装 Container Station"
    echo "  - 其他 NAS: 请参考官方文档安装 Docker"
    exit 1
fi

if ! docker compose version &> /dev/null 2>&1 && ! docker-compose version &> /dev/null 2>&1; then
    echo -e "${RED}❌ Docker Compose 未安装${NC}"
    echo "请安装 Docker Compose 插件"
    exit 1
fi

echo -e "${GREEN}✅ Docker 环境正常${NC}"
echo ""

# 检测 NAS 类型和推荐路径
echo "🔍 检测 NAS 系统..."
NAS_TYPE="通用 Linux"
DEFAULT_DATA_PATH="./data"

if [ -d "/volume1" ]; then
    NAS_TYPE="群晖 Synology"
    DEFAULT_DATA_PATH="/volume1/docker/oa-system/data"
elif [ -d "/share" ]; then
    NAS_TYPE="威联通 QNAP"
    DEFAULT_DATA_PATH="/share/Container/oa-system/data"
elif [ -d "/mnt" ] && [ -d "/usr/bin/apt" ] || [ -d "/usr/bin/opkg" ]; then
    if [ -f "/etc/synoinfo.conf" ]; then
        NAS_TYPE="群晖 Synology"
        DEFAULT_DATA_PATH="/volume1/docker/oa-system/data"
    fi
fi

echo -e "${GREEN}✅ 检测到 NAS 类型: $NAS_TYPE${NC}"
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "📝 创建环境配置文件..."
    
    # 生成随机 JWT 密钥
    if command -v openssl > /dev/null 2>&1; then
        JWT_SECRET=$(openssl rand -hex 32)
    else
        JWT_SECRET="$(date +%s%N | sha256sum | head -c 64)"
    fi
    
    # 生成随机数据库密码
    if command -v openssl > /dev/null 2>&1; then
        DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-16)
    else
        DB_PASSWORD="oa-$(date +%s%N | sha256sum | head -c 12)"
    fi
    
    cat > .env << EOF
# OA 系统环境配置
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')

# 数据库密码
DB_PASSWORD=${DB_PASSWORD}

# JWT 密钥
JWT_SECRET=${JWT_SECRET}

# 访问地址（请修改为实际地址）
FRONTEND_URL=http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'localhost')

# 数据存储路径
NAS_DATA_PATH=${DEFAULT_DATA_PATH}

# 端口配置
HTTP_PORT=80
BACKEND_PORT=3000
DB_PORT=5432

# 企业微信（可选）
WECHAT_CORP_ID=
WECHAT_SECRET=
EOF

    echo -e "${GREEN}✅ 已创建 .env 文件${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  请编辑 .env 文件修改以下配置：${NC}"
    echo "   1. FRONTEND_URL - 改为你的 NAS IP 或域名"
    echo "   2. NAS_DATA_PATH - 数据存储路径（当前: $DEFAULT_DATA_PATH）"
    echo "   3. DB_PASSWORD - 数据库密码（已自动生成）"
    echo ""
    echo "编辑命令: nano .env 或 vi .env"
    echo ""
    
    read -p "是否立即编辑 .env 文件? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command -v nano > /dev/null 2>&1; then
            nano .env
        elif command -v vi > /dev/null 2>&1; then
            vi .env
        else
            echo -e "${RED}未找到编辑器，请手动编辑 .env 文件${NC}"
        fi
    fi
    echo ""
fi

# 加载环境变量
set -a
source .env
set +a

# 创建数据目录
echo "📁 创建数据目录..."
mkdir -p "${NAS_DATA_PATH}/postgres"
mkdir -p "${NAS_DATA_PATH}/uploads"
mkdir -p "${NAS_DATA_PATH}/backups"
mkdir -p "${NAS_DATA_PATH}/postgres"

echo -e "${GREEN}✅ 数据目录: ${NAS_DATA_PATH}${NC}"
echo ""

# 检查端口占用
echo "🔍 检查端口占用..."
PORT_CONFLICT=false

if command -v netstat > /dev/null 2>&1; then
    if netstat -tuln 2>/dev/null | grep -q ":${HTTP_PORT} "; then
        echo -e "${YELLOW}⚠️  端口 ${HTTP_PORT} 已被占用${NC}"
        PORT_CONFLICT=true
    fi
    if netstat -tuln 2>/dev/null | grep -q ":${DB_PORT} "; then
        echo -e "${YELLOW}⚠️  端口 ${DB_PORT} 已被占用${NC}"
        PORT_CONFLICT=true
    fi
fi

if [ "$PORT_CONFLICT" = true ]; then
    echo ""
    echo -e "${YELLOW}建议修改 .env 文件中的端口配置：${NC}"
    echo "  HTTP_PORT=8080"
    echo "  DB_PORT=5433"
    echo ""
    read -p "是否继续部署? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "部署已取消"
        exit 0
    fi
fi

echo ""

# 构建并启动服务
echo "🏗️  构建并启动服务..."
echo "这可能需要几分钟，请耐心等待..."
echo ""

if docker compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose -f docker-compose.nas.yml"
else
    COMPOSE_CMD="docker-compose -f docker-compose.nas.yml"
fi

$COMPOSE_CMD down 2>/dev/null || true
$COMPOSE_CMD pull
$COMPOSE_CMD up --build -d

# 等待数据库初始化
echo ""
echo "⏳ 等待数据库初始化..."
sleep 10

# 检查服务状态
echo ""
echo "🔍 检查服务状态..."
$COMPOSE_CMD ps

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  ✅ OA 系统部署完成！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "📋 访问地址:"
echo -e "   ${GREEN}http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'localhost'):${HTTP_PORT}${NC}"
echo ""
echo "🔑 默认管理员账号:"
echo "   用户名: admin"
echo "   密码: admin123"
echo ""
echo -e "${YELLOW}⚠️  首次登录后请立即修改密码！${NC}"
echo ""
echo "📖 常用命令:"
echo "   查看日志: $COMPOSE_CMD logs -f"
echo "   停止服务: $COMPOSE_CMD down"
echo "   重启服务: $COMPOSE_CMD restart"
echo "   备份数据: ./scripts/backup-nas.sh"
echo ""
echo "📁 数据存储路径: ${NAS_DATA_PATH}"
echo ""
