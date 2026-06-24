#!/bin/bash

# OA 系统远程服务器部署脚本
# 适用于 Cloudflare + 真实服务器架构

set -e

echo "🚀 OA 系统生产环境部署脚本"
echo "=============================="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ 错误: Docker Compose 不可用"
    exit 1
fi

# 创建数据目录
echo "📁 创建数据目录..."
mkdir -p data/postgres
mkdir -p data/backups
mkdir -p nginx/ssl

# 生成 .env（如果不存在）
if [ ! -f .env ]; then
    echo "🔑 生成环境配置文件..."
    JWT_SECRET=$(openssl rand -hex 32)
    cat > .env << EOF
JWT_SECRET=${JWT_SECRET}
FRONTEND_URL=https://oa.yourdomain.com
DB_PASSWORD=oa_password
EOF
    echo "✅ 已创建 .env 文件，请修改其中的域名和数据库密码"
else
    echo "✅ .env 文件已存在"
fi

# 加载环境变量
set -a
source .env
set +a

# 停止旧服务
echo "🛑 停止旧服务..."
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

# 构建并启动
echo "🏗️  构建并启动服务..."
docker compose -f docker-compose.prod.yml up --build -d

# 等待数据库就绪
echo "⏳ 等待数据库就绪..."
sleep 5

# 执行数据库迁移（如需要）
# echo "🔄 执行数据库迁移..."
# docker compose -f docker-compose.prod.yml exec -T backend npx drizzle-kit migrate

echo ""
echo "✅ 部署完成！"
echo ""
docker compose -f docker-compose.prod.yml ps
echo ""
echo "🔗 访问地址:"
echo "  - 前端: ${FRONTEND_URL:-https://oa.yourdomain.com}"
echo "  - 后端 API: ${FRONTEND_URL:-https://oa.yourdomain.com}/api"
echo ""
echo "📖 常用命令:"
echo "  查看日志: docker compose -f docker-compose.prod.yml logs -f"
echo "  停止服务: docker compose -f docker-compose.prod.yml down"
echo "  重启服务: docker compose -f docker-compose.prod.yml restart"
echo ""
echo "⚠️  重要提醒:"
echo "  1. 请将 nginx/nginx.conf 中的 server_name 修改为你的真实域名"
echo "  2. 确保 Cloudflare DNS 的 A 记录指向本服务器公网 IP"
echo "  3. 确保服务器防火墙已开放 80 端口（Cloudflare 代理模式下只需 80）"
echo "  4. 如需源站直接处理 443，请参考文档配置 SSL 证书"
