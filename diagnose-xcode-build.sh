#!/bin/bash

echo "=== Xcode Build Diagnosis ==="
echo

# Check Metro bundler
echo "1. Checking Metro bundler status..."
curl -s http://localhost:8081/status || echo "Metro bundler not running"
echo

# Check node version
echo "2. Node version:"
which node && node --version
echo

# Check if React Native path is correct
echo "3. React Native path:"
REACT_NATIVE_PATH="../node_modules/react-native"
if [ -d "$REACT_NATIVE_PATH" ]; then
    echo "✓ React Native found at: $REACT_NATIVE_PATH"
else
    echo "✗ React Native not found at: $REACT_NATIVE_PATH"
fi
echo

# Check if scripts exist
echo "4. Checking React Native scripts:"
if [ -f "$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh" ]; then
    echo "✓ with-environment.sh exists"
else
    echo "✗ with-environment.sh not found"
fi

if [ -f "$REACT_NATIVE_PATH/scripts/react-native-xcode.sh" ]; then
    echo "✓ react-native-xcode.sh exists"
else
    echo "✗ react-native-xcode.sh not found"
fi
echo

# Check for TypeScript errors
echo "5. Checking for TypeScript errors..."
cd /Users/mike/Development/KidsActivityTracker
npx tsc --noEmit 2>&1 | head -10 || echo "No TypeScript errors"
echo

# Check for missing modules
echo "6. Checking imports..."
grep -r "from '\.\./screens/" src/ | grep -v "activities/" | head -10 || echo "No problematic imports found"
echo

echo "=== Diagnosis Complete ==="