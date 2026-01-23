#!/bin/bash

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

clear

echo "========================================"
echo "🔵 Blueshift Batch Delete Tool"
echo "========================================"
echo ""
echo "Stopping server..."
echo ""

# Check if PID file exists
if [ -f ".server.pid" ]; then
    PID=$(cat .server.pid)
    if ps -p $PID > /dev/null; then
        kill $PID
        rm -f .server.pid
        echo "✅ Server stopped successfully"
    else
        rm -f .server.pid
        echo "Server was not running"
    fi
else
    # Try to find and kill node process running server.js
    pkill -f "node server.js"
    echo "✅ Server stopped"
fi

echo ""
echo "========================================"
echo ""
echo "Press any key to close this window..."
read -n 1
