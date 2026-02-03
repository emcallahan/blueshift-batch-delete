#!/bin/bash

clear

echo "========================================"
echo "📦 Packaging Tool for Mac Team"
echo "========================================"
echo ""

# Clean up
echo "Cleaning up temporary files..."
rm -rf node_modules
rm -rf logs
rm -rf uploads
rm -f .DS_Store
rm -f .server.pid
echo "✓ Cleanup complete"
echo ""

# Create zip file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ZIP_NAME="blueshift-batch-delete-mac_${TIMESTAMP}.zip"

echo "Creating Mac distribution package: $ZIP_NAME"
echo ""

zip -r "$ZIP_NAME" . \
  -x "*.DS_Store" \
  -x ".git/*" \
  -x "*.zip" \
  -x "package-for-distribution.sh" \
  -x "node_modules/*" \
  -x "logs/*" \
  -x "uploads/*" \
  -x ".env" \
  -x ".server.pid" \
  -q

echo ""
echo "========================================"
echo "✅ Package Created Successfully!"
echo "========================================"
echo ""
echo "File: $ZIP_NAME"
echo ""
echo "SHARE THIS WITH YOUR TEAM:"
echo ""
echo "1. Send $ZIP_NAME via email/Slack/Drive"
echo ""
echo "2. Include these instructions:"
echo "   'Unzip, then double-click:"
echo "    - install.sh (first time only)"
echo "    - START - Blueshift Tool.command (to use)"
echo "    - STOP - Blueshift Tool.command (when done)"
echo ""
echo "   For help, open LAUNCHER.html or START HERE.md'"
echo ""
echo "See SHARE-WITH-TEAM.txt for detailed sharing guide"
echo "========================================"
echo ""
