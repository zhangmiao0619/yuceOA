#!/bin/bash
# OA系统服务管理脚本

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

start() {
    echo "启动 OA 系统..."
    
    # 停止旧进程
    killall -9 node 2>/dev/null
    sleep 2
    
    # 启动后端
    cd /Users/yuce/.openclaw/workspace/oa-system/backend
    node ./node_modules/.bin/tsx watch src/index.ts > /tmp/oa-backend.log 2>&1 &
    echo $! > /tmp/oa-backend.pid
    
    # 等待后端
    for i in {1..10}; do
        curl -s http://localhost:3000/health >/dev/null 2>&1 && break
        sleep 1
    done
    
    # 启动前端
    cd /Users/yuce/.openclaw/workspace/oa-system/frontend  
    node ./node_modules/.bin/vite --host 0.0.0.0 > /tmp/oa-frontend.log 2>&1 &
    echo $! > /tmp/oa-frontend.pid
    
    # 等待前端
    for i in {1..10}; do
        curl -s http://localhost:5173/ >/dev/null 2>&1 && break
        sleep 1
    done
    
    echo "✅ OA 系统已启动"
    echo "   前端: http://localhost:5173"
    echo "   后端: http://localhost:3000"
}

stop() {
    echo "停止 OA 系统..."
    killall -9 node 2>/dev/null
    echo "✅ 已停止"
}

status() {
    curl -s http://localhost:3000/health >/dev/null 2>&1 && echo "✅ 后端正常" || echo "❌ 后端断开"
    curl -s http://localhost:5173/ >/dev/null 2>&1 && echo "✅ 前端正常" || echo "❌ 前端断开"
}

case "$1" in
    start) start ;;
    stop) stop ;;
    restart) stop; sleep 2; start ;;
    status) status ;;
    *) echo "用法: $0 {start|stop|restart|status}" ;;
esac
