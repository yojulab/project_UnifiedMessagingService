#!/bin/bash

# 설정
PORT="${PORT:-3110}"
LOG_DIR="/apps/logs"
TODAY=$(date +"%Y%m%d")
LOG_FILE="$LOG_DIR/webserver_unified_messaging_${TODAY}.out"

echo "Checking for existing processes on port ${PORT}..."

# 프로세스 ID 탐색 (lsof -> netstat -> fuser)
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
    if [ -d "$LOG_DIR" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server stopped (Port: ${PORT}, PIDs: ${EXISTING_PIDS})" >> "$LOG_FILE"
    fi
else
    echo "No existing processes found on port ${PORT}"
fi
