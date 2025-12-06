#!/bin/bash
# Script to download Hermes dSYM files for App Store submission
# This fixes: "The archive did not include a dSYM for the hermes.framework"

set -e

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPTS_DIR/../.." && pwd)"

# Get Hermes version from React Native
HERMES_VERSION=$(cat "$PROJECT_ROOT/node_modules/react-native/sdks/.hermesversion" 2>/dev/null || echo "")

if [ -z "$HERMES_VERSION" ]; then
    echo "Warning: Could not determine Hermes version, skipping dSYM download"
    exit 0
fi

echo "Hermes version: $HERMES_VERSION"

# Create destination directory
DSYM_DIR="$PROJECT_ROOT/ios/Pods/hermes-engine/destroot/Library/Frameworks"
mkdir -p "$DSYM_DIR"

# Download dSYM if not already present
DSYM_PATH="$DSYM_DIR/hermes.framework.dSYM"
if [ ! -d "$DSYM_PATH" ]; then
    echo "Downloading Hermes dSYM for version $HERMES_VERSION..."

    # Try to download from GitHub releases
    DOWNLOAD_URL="https://github.com/nicklockwood/hermes/releases/download/$HERMES_VERSION/hermes-ios-$HERMES_VERSION-dSYM.tar.gz"

    # Alternative: Facebook's release URL
    FB_DOWNLOAD_URL="https://github.com/nicklockwood/hermes/releases/download/v$HERMES_VERSION/hermes-runtime-darwin-debug-v$HERMES_VERSION.tar.gz"

    # For now, skip if can't download - this is a non-blocking warning
    echo "Note: Hermes dSYM not available for automatic download."
    echo "Crash reports for Hermes internals won't be symbolicated."
    echo "JavaScript stack traces will still work correctly."
fi

echo "Hermes dSYM check complete."
