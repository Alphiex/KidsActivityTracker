#!/bin/bash

# This script ensures Metro bundler is running for Xcode debugging

echo "Checking Metro bundler status..."

# Function to start Metro
start_metro() {
    echo "Starting Metro bundler..."
    cd "$(dirname "$0")/.."
    
    # Kill any existing Metro processes
    pkill -f "react-native.*metro" || true
    pkill -f "node.*metro" || true
    
    # Clear cache
    rm -rf $TMPDIR/metro-*
    rm -rf $TMPDIR/haste-map-*
    
    # Start Metro in a new Terminal window
    osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"' && npx react-native start --reset-cache"'
    
    # Wait for Metro to start
    echo "Waiting for Metro to start..."
    sleep 5
    
    # Check if Metro is running
    for i in {1..10}; do
        if curl -s "http://localhost:8081/status" 2>/dev/null | grep -q "packager-status:running"; then
            echo "✅ Metro bundler is running!"
            return 0
        fi
        echo "Waiting for Metro... ($i/10)"
        sleep 2
    done
    
    echo "⚠️ Metro bundler might not be running properly. Check the Terminal window."
    return 1
}

# Check if Metro is already running
if curl -s "http://localhost:8081/status" 2>/dev/null | grep -q "packager-status:running"; then
    echo "✅ Metro bundler is already running!"
else
    start_metro
fi