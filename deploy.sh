#!/bin/bash

# OA 系统部署脚本
# 用于 Mac mini 本地部署

set -e

echo "🚀 OA 系统部署脚本"
echo "===================="

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    echo "请先安装 Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# 检查 Docker Compose
if ! docker compose version &> /dev/null; then
    echo "❌ 错误: Docker Compose 不可用"
    exit 1
fi

# 创建必要目录
echo "📁 创建数据目录..."
mkdir -p data/postgres
mkdir -p data/backups

# 生成随机 JWT 密钥
if [ ! -f .env ]; then
    echo "🔑 生成环境配置文件..."
    JWT_SECRET=$(openssl rand -hex 32)
    cat > .env << EOF
JWT_SECRET=${JWT_SECRET}
FRONTEND_URL=http://localhost
EOF
    echo "✅ 已创建 .env 文件"
fi

# 加载环境变量
set -a
source .env
set +a

# 启动服务
echo "🏗️  构建并启动服务..."
docker compose up --build -d

echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 服务状态:"
docker compose ps
echo ""
echo "🔗 访问地址:"
echo "  - 前端: http://localhost"
echo "  - 后端 API: http://localhost:3000"
echo ""
echo "📖 常用命令:"
echo "  查看日志: docker compose logs -f"
echo "  停止服务: docker compose down"
echo "  重启服务: docker compose restart"
echo "  备份数据: ./scripts/backup.sh"
echo ""