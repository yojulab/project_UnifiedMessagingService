#!/bin/bash

# 프로젝트 루트 디렉토리 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 설정
PORT="${PORT:-3110}"
LOG_DIR="/apps/logs"
TODAY=$(date +"%Y%m%d")
LOG_FILE="$LOG_DIR/webserver_unified_messaging_${TODAY}.out"
MODE="${1:-start}" # 기본값: start (프로덕션), 인자로 dev 전달 가능 (예: ./restart_server.sh dev)

# 로그 폴더가 존재하는지 확인하고, 없다면 생성
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
    echo "Created log directory: $LOG_DIR"
fi

# 이미 실행 중인 서버 프로세스 확인 및 종료
echo "Checking for existing processes on port ${PORT}..."
EXISTING_PIDS=$(lsof -ti :${PORT} 2>/dev/null)
if [ -z "$EXISTING_PIDS" ]; then
    EXISTING_PIDS=$(netstat -tlpn 2>/dev/null | awk -v p=":${PORT}" '$4 ~ p"$" {split($7, a, "/"); if (a[1] ~ /^[0-9]+$/) print a[1]}')
fi
if [ -z "$EXISTING_PIDS" ] && command -v fuser >/dev/null 2>&1; then
    EXISTING_PIDS=$(fuser ${PORT}/tcp 2>/dev/null)
fi

if [ -n "$EXISTING_PIDS" ]; then
    echo "Killing existing processes: $EXISTING_PIDS"
    kill -9 $EXISTING_PIDS 2>/dev/null
    sleep 1
    echo "Processes terminated"
else
    echo "No existing processes found on port ${PORT}"
fi

# 서버 실행 (start 또는 dev)
if [ "$MODE" = "dev" ]; then
    echo "Starting Next.js in DEVELOPMENT mode on port ${PORT}..."
    NODE_OPTIONS='' nohup npm run dev -- -p "$PORT" > "$LOG_FILE" 2>&1 &
else
    # .next 빌드 디렉토리가 없으면 빌드 수행
    if [ ! -d ".next" ]; then
        echo "Building Next.js project..."
        npm run build
    fi
    echo "Starting Next.js in PRODUCTION mode on port ${PORT}..."
    NODE_OPTIONS='' nohup npm run start -- -p "$PORT" > "$LOG_FILE" 2>&1 &
fi

echo "Server started (MODE: $MODE, PORT: $PORT), logging to $LOG_FILE"