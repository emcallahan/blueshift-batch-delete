#!/bin/bash

echo "========================================="
echo "Blueshift Batch Delete Tool - Installer"
echo "========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo ""
    echo "Please install Node.js from: https://nodejs.org"
    echo "Download the LTS (Long Term Support) version"
    echo ""
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "⚠️  Warning: Node.js version $NODE_VERSION detected"
    echo "This tool requires Node.js 16 or higher"
    echo "Please update Node.js from: https://nodejs.org"
    echo ""
    exit 1
fi

echo "✓ Node.js $(node -v) detected"
echo ""

# Install dependencies
echo "Installing dependencies..."
echo ""

if npm install; then
    echo ""
    echo "========================================="
    echo "✅ Installation successful!"
    echo "========================================="
    echo ""
    echo "To start the tool, run:"
    echo ""
    echo "  npm start"
    echo ""
    echo "Then open your browser to:"
    echo "  http://localhost:3000"
    echo ""
    echo "To stop the tool, press Ctrl+C"
    echo ""
    echo "See INSTALL.md for detailed usage instructions"
    echo "========================================="
else
    echo ""
    echo "❌ Installation failed"
    echo ""
    echo "Please check your internet connection and try again"
    echo "If the problem persists, try running: npm install"
    echo ""
    exit 1
fi
