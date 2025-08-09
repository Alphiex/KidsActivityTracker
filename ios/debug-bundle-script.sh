#!/bin/bash
set -e

echo "=== Bundle React Native Debug Script ==="
echo "NODE_BINARY: $NODE_BINARY"
echo "REACT_NATIVE_PATH: $REACT_NATIVE_PATH"
echo "CONFIGURATION: $CONFIGURATION"
echo "PLATFORM_NAME: $PLATFORM_NAME"
echo

# Export NODE_BINARY if not set
if [ -z "$NODE_BINARY" ]; then
    # Try multiple common node locations
    if [ -f "/opt/homebrew/bin/node" ]; then
        export NODE_BINARY="/opt/homebrew/bin/node"
    elif [ -f "/usr/local/bin/node" ]; then
        export NODE_BINARY="/usr/local/bin/node"
    elif [ -f "/usr/bin/node" ]; then
        export NODE_BINARY="/usr/bin/node"
    else
        # Try to find node using which with full PATH
        export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:$PATH"
        export NODE_BINARY=$(which node || echo "")
    fi
    echo "Set NODE_BINARY to: $NODE_BINARY"
fi

# Check if node exists
if [ ! -f "$NODE_BINARY" ] || [ -z "$NODE_BINARY" ]; then
    echo "ERROR: Node binary not found at: $NODE_BINARY"
    echo "Checking common locations:"
    ls -la /opt/homebrew/bin/node 2>/dev/null || echo "  /opt/homebrew/bin/node - not found"
    ls -la /usr/local/bin/node 2>/dev/null || echo "  /usr/local/bin/node - not found"
    ls -la /usr/bin/node 2>/dev/null || echo "  /usr/bin/node - not found"
    exit 1
fi

# Check React Native scripts
if [ -z "$REACT_NATIVE_PATH" ]; then
    echo "ERROR: REACT_NATIVE_PATH is not set"
    exit 1
fi

WITH_ENVIRONMENT="$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh"
REACT_NATIVE_XCODE="$REACT_NATIVE_PATH/scripts/react-native-xcode.sh"

if [ ! -f "$WITH_ENVIRONMENT" ]; then
    echo "ERROR: with-environment.sh not found at: $WITH_ENVIRONMENT"
    exit 1
fi

if [ ! -f "$REACT_NATIVE_XCODE" ]; then
    echo "ERROR: react-native-xcode.sh not found at: $REACT_NATIVE_XCODE"
    exit 1
fi

echo "Running React Native bundle script..."
/bin/sh -c "$WITH_ENVIRONMENT $REACT_NATIVE_XCODE"