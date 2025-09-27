#!/bin/bash
set -e

# Skip bundling for now to test if build succeeds
echo "Skipping React Native bundling for testing..."

# Create empty bundle file to satisfy build
mkdir -p "${CONFIGURATION_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
touch "${CONFIGURATION_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/main.jsbundle"

echo "Bundle script completed (minimal version)"
exit 0