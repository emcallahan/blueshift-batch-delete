#!/bin/bash

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Clear the terminal
clear

echo "========================================"
echo "🔵 Blueshift Batch Delete Tool"
echo "========================================"
echo ""
echo "Starting server..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  First time setup detected"
    echo "Installing dependencies..."
    echo ""
    npm install
    echo ""
fi

# Start the server in the background and capture its PID
npm start &
SERVER_PID=$!
echo $SERVER_PID > .server.pid

# Wait a moment for server to start
sleep 3

echo ""
echo "✅ Server is running!"
echo "========================================"
echo ""
echo "Opening your browser..."
echo ""

# Open the browser
open http://localhost:3000

echo "The tool is now running in your browser."
echo ""
echo "⚠️  IMPORTANT: Keep this window open!"
echo "    Closing this window will stop the tool."
echo ""
echo "To stop the tool:"
echo "  - Double-click 'STOP - Blueshift Tool.command'"
echo "  - Or press Ctrl+C in this window"
echo ""
echo "========================================"
echo ""

# Wait for the server process
wait $SERVER_PID

# Cleanup
rm -f .server.pid

echo ""
echo "Server stopped."
echo ""
