#!/bin/bash

# 本地一键上传到远程服务器并部署
# 用法:
#   1. 密码登录: export SSHPASS=你的密码 && ./deploy-to-server.sh root
#   2. 密钥登录: ./deploy-to-server.sh root

set -e

REMOTE_HOST="39.102.146.217"
REMOTE_USER="${1:-root}"
REMOTE_DIR="/opt/oa-system"
LOCAL_DIR="/Users/tianli/oa-system-extracted/oa-system"

echo "🚀 准备部署 OA 系统到远程服务器"
echo "   服务器: ${REMOTE_USER}@${REMOTE_HOST}"
echo "   目录: ${REMOTE_DIR}"
echo ""

# 检查 expect
if [ -n "$SSHPASS" ] && ! command -v expect > /dev/null 2>&1; then
    echo "❌ 需要 expect 来实现自动密码登录"
    exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

# 包装 SSH 命令
run_ssh() {
    local cmd="$1"
    if [ -n "$SSHPASS" ]; then
        expect <<EOF
set timeout 60
spawn ssh ${SSH_OPTS} "${REMOTE_USER}@${REMOTE_HOST}" "${cmd}"
expect "password:"
send "${SSHPASS}\r"
expect eof
catch wait result
exit [lindex \$result 3]
EOF
    else
        ssh ${SSH_OPTS} "${REMOTE_USER}@${REMOTE_HOST}" "${cmd}"
    fi
}

# 包装 SCP 命令
run_scp() {
    local src="$1"
    local dst="$2"
    if [ -n "$SSHPASS" ]; then
        expect <<EOF
set timeout 300
spawn scp ${SSH_OPTS} "${src}" "${dst}"
expect "password:"
send "${SSHPASS}\r"
expect eof
catch wait result
exit [lindex \$result 3]
EOF
    else
        scp ${SSH_OPTS} "${src}" "${dst}"
    fi
}

# 本地打包
echo "📦 本地打包中..."
cd "$(dirname "${LOCAL_DIR}")"
tar czvf /tmp/oa-system-deploy.tar.gz \
    --exclude='*/.git' \
    --exclude='*/.DS_Store' \
    --exclude='*/node_modules' \
    --exclude='*/dist' \
    --exclude='*/data/postgres' \
    --exclude='*/data/backups' \
    "$(basename "${LOCAL_DIR}")"

# 上传并部署
echo "📤 上传包到服务器..."
run_scp "/tmp/oa-system-deploy.tar.gz" "${REMOTE_USER}@${REMOTE_HOST}:/tmp/"

echo "🔧 在服务器上解压并部署..."
run_ssh "mkdir -p ${REMOTE_DIR} && cd /opt && tar xzvf /tmp/oa-system-deploy.tar.gz && cd ${REMOTE_DIR} && bash deploy-remote.sh"

echo ""
echo "✅ 部署完成！"
echo ""
echo "🔗 访问地址: https://oa.wuhanyuce.com"
echo ""
echo "⚠️  如果这是首次部署，请确认:"
echo "   1. Cloudflare DNS A 记录 oa.wuhanyuce.com 指向 39.102.146.217"
echo "   2. Cloudflare 代理状态为开启（橙色云朵）"
echo "   3. 服务器防火墙已开放 80 端口"
