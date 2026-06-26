#!/bin/bash
echo "Starting OA Dev Environment..."
echo "  Backend: http://localhost:3002"
echo "  Frontend: http://localhost:5173"

cd "$(dirname "$0")/backend"
PORT=3002 DB_PATH=./data/oa_dev.db npx tsx src/index.ts &
BACKEND_PID=$!

cd "$(dirname "$0")/frontend"
npx vite --port 5173 &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
