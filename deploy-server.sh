#!/bin/bash

# OA 系统部署脚本 - 服务器生产环境
set -e

echo "🚀 开始部署 OA 系统到服务器..."

# 1. 检查环境
echo "📋 检查环境..."
if ! command -v node &> /dev/null; then
    echo "❌ 错误: Node.js 未安装"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ 错误: npm 未安装"
    exit 1
fi

# 2. 安装 PM2 (如果未安装)
echo "📦 检查 PM2..."
if ! command -v pm2 &> /dev/null; then
    echo "   安装 PM2..."
    npm install -g pm2
fi

# 3. 安装后端依赖
echo "📦 安装后端依赖..."
cd /Volumes/YUCE/宇测OA\ 系统/oa-system/backend
npm install

# 4. 安装前端依赖
echo "📦 安装前端依赖..."
cd /Volumes/YUCE/宇测OA\ 系统/oa-system/frontend
npm install

# 5. 创建日志目录
mkdir -p /Volumes/YUCE/宇测OA\ 系统/oa-system/logs

# 6. 使用 PM2 启动服务
echo "🏗️ 启动服务..."

# 停止旧进程
pm2 delete all 2>/dev/null || true

# 启动后端 (使用 npx tsx)
cd /Volumes/YUCE/宇测OA\ 系统/oa-system/backend
pm2 start npx --name oa-backend -- tsx src/index.ts &

# 启动前端 (使用 npx vite)
cd /Volumes/YUCE/宇测OA\ 系统/oa-system/frontend
pm2 start npx --name oa-frontend -- vite --host 0.0.0.0 &

# 7. 保存 PM2 进程列表（开机自启）
echo "💾 保存 PM2 配置..."
pm2 save

# 8. 设置开机自启
pm2 startup 2>/dev/null || true

# 9. 配置 Nginx 反向代理 (可选)
if command -v nginx &> /dev/null; then
    echo "🌐 配置 Nginx..."
    # 检查 nginx 配置
    if [ ! -f /opt/homebrew/etc/nginx/servers/oa.conf ]; then
        cat > /tmp/oa-nginx.conf << 'NGINX'
server {
    listen 80;
    server_name 192.168.1.17;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
    fi
fi

echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 服务状态:"
pm2 status
echo ""
echo "🔗 访问地址:"
echo "  - 前端: http://192.168.1.17"
echo "  - 后端 API: http://192.168.1.17:3000"
echo ""
echo "📖 常用命令:"
echo "  查看日志: pm2 logs"
echo "  停止服务: pm2 delete all"
echo "  重启服务: pm2 restart all"