#!/bin/bash
# This script is called by Xcode to ensure Metro is running

# Only run this in Debug configuration
if [ "${CONFIGURATION}" != "Debug" ]; then
    exit 0
fi

# Check if Metro is already running
if curl -s "http://localhost:8081/status" 2>/dev/null | grep -q "packager-status:running"; then
    echo "Metro bundler is already running"
    exit 0
fi

# Start Metro in a new Terminal window
echo "Starting Metro bundler in new Terminal window..."
osascript <<EOF
tell application "Terminal"
    do script "cd \"$SRCROOT/..\" && npx react-native start"
    activate
end tell
EOF

echo "Metro bundler will start in a new Terminal window"