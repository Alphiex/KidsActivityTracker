#!/bin/bash

echo "🔍 Finding and fixing all references to wrong GCP project..."
echo "============================================================"

WRONG_PROJECT="elevated-pod-459203-n5"
WRONG_PROJECT_NUM="44042034457"
CORRECT_PROJECT="kids-activity-tracker-2024"
CORRECT_PROJECT_NUM="205843686007"

# Find all files with wrong project references
echo ""
echo "📝 Files with wrong project references:"
echo "----------------------------------------"

# Create a list of files to fix (excluding node_modules, .git, etc.)
FILES_TO_FIX=$(grep -r "$WRONG_PROJECT\|$WRONG_PROJECT_NUM" . \
  --include="*.sh" \
  --include="*.js" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.json" \
  --include="*.yml" \
  --include="*.yaml" \
  --include="*.md" \
  --include="Dockerfile*" \
  --include="*.env*" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=build \
  --exclude-dir=dist \
  --exclude-dir=.next \
  --exclude-dir=archive_* \
  -l 2>/dev/null)

if [ -z "$FILES_TO_FIX" ]; then
  echo "✅ No files found with wrong project references!"
  exit 0
fi

echo "$FILES_TO_FIX" | while read -r file; do
  echo "  📄 $file"
done

echo ""
echo "🔧 Fixing references..."
echo "------------------------"

# Fix each file
echo "$FILES_TO_FIX" | while read -r file; do
  if [ -f "$file" ]; then
    # Skip the fix script itself and the project check script
    if [[ "$file" == *"fix-all-project-references.sh"* ]] || [[ "$file" == *".gcloud-project-check.sh"* ]]; then
      echo "  ⏭️  Skipping: $file (safety script)"
      continue
    fi
    
    # Create backup
    cp "$file" "${file}.backup-wrong-project"
    
    # Replace wrong project references
    sed -i '' \
      -e "s/$WRONG_PROJECT/$CORRECT_PROJECT/g" \
      -e "s/$WRONG_PROJECT_NUM/$CORRECT_PROJECT_NUM/g" \
      "$file"
    
    # Check if file was modified
    if ! diff -q "$file" "${file}.backup-wrong-project" > /dev/null; then
      echo "  ✅ Fixed: $file"
      rm "${file}.backup-wrong-project"
    else
      echo "  ⏭️  No changes: $file"
      rm "${file}.backup-wrong-project"
    fi
  fi
done

echo ""
echo "📋 Summary:"
echo "-----------"
echo "✅ All project references have been updated!"
echo ""
echo "🔒 Remember:"
echo "  - CORRECT project: $CORRECT_PROJECT"
echo "  - CORRECT project number: $CORRECT_PROJECT_NUM"
echo "  - API URL: https://kids-activity-api-$CORRECT_PROJECT_NUM.us-central1.run.app"
echo ""
echo "⚠️  NEVER use: $WRONG_PROJECT (that's for Murmans Picks!)"