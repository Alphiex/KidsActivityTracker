#!/bin/bash

# This script is used by Xcode to start the Metro bundler

# Change to project root directory
cd "${SRCROOT}/.."

# Export node path for nvm users
export NODE_BINARY=$(command -v node)

# Check if Metro bundler is already running
if curl -s "http://localhost:8081/status" | grep -q "packager-status:running"; then
    echo "Metro bundler is already running on port 8081"
else
    echo "Starting Metro bundler..."
    # Start Metro bundler in the background
    npx react-native start --port 8081 &
    
    # Wait for Metro to start
    sleep 5
    
    # Keep the script running
    echo "Metro bundler started. This window will remain open."
    
    # Keep the terminal open
    while true; do
        sleep 1
    done
fi