#!/bin/bash
# OA 系统启动脚本

echo "启动 OA 系统..."

# 停止旧进程
pkill -f "tsx.*src/index" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# 启动后端
cd "/Volumes/YUCE/宇测OA 系统/oa-system/backend"
echo "启动后端..."
npx tsx src/index.ts > /tmp/oa-backend.log 2>&1 &
BACKEND_PID=$!
echo "后端 PID: $BACKEND_PID"

# 启动前端
cd "/Volumes/YUCE/宇测OA 系统/oa-system/frontend"
echo "启动前端..."
npm run dev > /tmp/oa-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "前端 PID: $FRONTEND_PID"

# 保存 PID
echo "$BACKEND_PID $FRONTEND_PID" > /tmp/oa-pids.txt

echo ""
echo "OA 系统已启动!"
echo "后端: http://localhost:3000"
echo "前端: http://localhost:5173"
echo ""
echo "查看日志: tail -f /tmp/oa-backend.log /tmp/oa-frontend.log"