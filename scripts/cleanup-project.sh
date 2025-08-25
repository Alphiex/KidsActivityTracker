#!/bin/bash

# Project cleanup script for KidsActivityTracker
# This script organizes the project structure and removes unused files

echo "🧹 Starting project cleanup..."

# Create archive directory for old files
ARCHIVE_DIR="./archive_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$ARCHIVE_DIR"

echo "📁 Archive directory: $ARCHIVE_DIR"

# ===== STEP 1: Clean up test files =====
echo ""
echo "1️⃣ Archiving test files..."

# Find and move test files
find . -name "test-*.js" -not -path "./node_modules/*" -not -path "./.git/*" -exec mv {} "$ARCHIVE_DIR/" \; 2>/dev/null
find . -name "test-*.sh" -not -path "./node_modules/*" -not -path "./.git/*" -exec mv {} "$ARCHIVE_DIR/" \; 2>/dev/null
find . -name "*-test.js" -not -path "./node_modules/*" -not -path "./.git/*" -exec mv {} "$ARCHIVE_DIR/" \; 2>/dev/null

# Keep only production test files in __tests__ directory
echo "  ✓ Test files archived"

# ===== STEP 2: Clean up duplicate deployment scripts =====
echo ""
echo "2️⃣ Consolidating deployment scripts..."

# Create organized backend scripts directory
mkdir -p backend/scripts/deploy
mkdir -p backend/scripts/scraper
mkdir -p backend/scripts/database
mkdir -p backend/scripts/utils

# Move deployment scripts to organized folders
mv backend/deploy-api-manual.sh backend/scripts/deploy/ 2>/dev/null
mv backend/deploy-scraper*.sh backend/scripts/scraper/ 2>/dev/null
mv backend/deploy-comprehensive-scraper.sh backend/scripts/scraper/ 2>/dev/null
mv backend/deploy-enhanced-scraper.sh backend/scripts/scraper/ 2>/dev/null
mv backend/deploy-systematic-scraper.sh backend/scripts/scraper/ 2>/dev/null

# Archive old deployment scripts
mv backend/deploy.sh "$ARCHIVE_DIR/" 2>/dev/null
mv backend/deploy-code-only.sh "$ARCHIVE_DIR/" 2>/dev/null
mv backend/deploy-package.sh "$ARCHIVE_DIR/" 2>/dev/null

echo "  ✓ Deployment scripts organized"

# ===== STEP 3: Clean up database scripts =====
echo ""
echo "3️⃣ Organizing database scripts..."

# Move database scripts
mv backend/*-import*.sh backend/scripts/database/ 2>/dev/null
mv backend/*-cloud*.sh backend/scripts/database/ 2>/dev/null
mv backend/run-*migration*.sh backend/scripts/database/ 2>/dev/null
mv backend/setup-*.sh backend/scripts/database/ 2>/dev/null
mv backend/reset-*.sh backend/scripts/database/ 2>/dev/null

echo "  ✓ Database scripts organized"

# ===== STEP 4: Clean up image-related scripts =====
echo ""
echo "4️⃣ Consolidating image scripts..."

# Archive old image download scripts (keeping only the latest)
mv scripts/download-*.sh "$ARCHIVE_DIR/" 2>/dev/null
mv scripts/fix-*.sh "$ARCHIVE_DIR/" 2>/dev/null
mv scripts/create-placeholder-images.sh "$ARCHIVE_DIR/" 2>/dev/null

# Keep only the main image replacement script
echo "  ✓ Image scripts consolidated"

# ===== STEP 5: Remove image backup directories =====
echo ""
echo "5️⃣ Removing image backup directories..."

# Remove all image backup directories
rm -rf src/assets/images/activities_backup_* 2>/dev/null

echo "  ✓ Image backups removed"

# ===== STEP 6: Clean up root directory scripts =====
echo ""
echo "6️⃣ Organizing root scripts..."

# Archive old/duplicate scripts
mv build-test.sh "$ARCHIVE_DIR/" 2>/dev/null
mv clean-build.sh "$ARCHIVE_DIR/" 2>/dev/null
mv clean-rn-cache.sh "$ARCHIVE_DIR/" 2>/dev/null
mv deploy-scraper-only.sh "$ARCHIVE_DIR/" 2>/dev/null
mv diagnose-xcode-build.sh "$ARCHIVE_DIR/" 2>/dev/null
mv fix-ios-setup.sh "$ARCHIVE_DIR/" 2>/dev/null
mv fix-metro-connection.sh "$ARCHIVE_DIR/" 2>/dev/null
mv generate_icons.sh "$ARCHIVE_DIR/" 2>/dev/null
mv install-maps.sh "$ARCHIVE_DIR/" 2>/dev/null
mv TEST_API.sh "$ARCHIVE_DIR/" 2>/dev/null
mv test-api.sh "$ARCHIVE_DIR/" 2>/dev/null
mv start-backend.sh "$ARCHIVE_DIR/" 2>/dev/null

echo "  ✓ Root scripts organized"

# ===== STEP 7: Clean up scraper directory =====
echo ""
echo "7️⃣ Cleaning scraper directory..."

# Remove old scraper directory if backend has the latest
if [ -d "scraper" ] && [ -d "backend/scrapers" ]; then
    mv scraper "$ARCHIVE_DIR/" 2>/dev/null
    echo "  ✓ Old scraper directory archived"
fi

# ===== STEP 8: Clean up logs and temp files =====
echo ""
echo "8️⃣ Removing logs and temp files..."

# Remove log files
find . -name "*.log" -not -path "./node_modules/*" -not -path "./.git/*" -delete 2>/dev/null
find . -name "npm-debug.log*" -delete 2>/dev/null
find . -name "yarn-error.log*" -delete 2>/dev/null

# Remove temp files
find . -name ".DS_Store" -delete 2>/dev/null
find . -name "Thumbs.db" -delete 2>/dev/null
find . -name "*~" -delete 2>/dev/null
find . -name "*.tmp" -delete 2>/dev/null

echo "  ✓ Logs and temp files removed"

# ===== STEP 9: Organize scripts directory =====
echo ""
echo "9️⃣ Organizing scripts directory..."

# Create organized structure
mkdir -p scripts/development
mkdir -p scripts/deployment
mkdir -p scripts/utilities
mkdir -p scripts/setup

# Move scripts to appropriate folders
mv scripts/dev-*.sh scripts/development/ 2>/dev/null
mv scripts/setup-*.sh scripts/setup/ 2>/dev/null
mv scripts/complete-setup.sh scripts/setup/ 2>/dev/null
mv scripts/migrate-*.sh scripts/setup/ 2>/dev/null

echo "  ✓ Scripts directory organized"

# ===== STEP 10: Create .gitignore updates =====
echo ""
echo "🔟 Updating .gitignore..."

cat >> .gitignore << 'EOF'

# Archives and backups
archive_*/
*_backup_*/
*.backup
*.old

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Test files (outside of __tests__)
test-*.js
test-*.sh
*-test.js

# Temporary files
*.tmp
*.temp
.DS_Store
Thumbs.db
*~

# Image backups
src/assets/images/activities_backup_*/

# Generated files
generated/
dist/
build/

EOF

echo "  ✓ .gitignore updated"

# ===== Final Summary =====
echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Summary:"
echo "  - Archive created at: $ARCHIVE_DIR"
echo "  - Test files archived: $(find "$ARCHIVE_DIR" -name "test-*" 2>/dev/null | wc -l | tr -d ' ')"
echo "  - Scripts organized into categories"
echo "  - Image backups removed"
echo "  - Logs and temp files cleaned"
echo ""
echo "💡 Next steps:"
echo "  1. Review files in $ARCHIVE_DIR"
echo "  2. Delete archive if not needed: rm -rf $ARCHIVE_DIR"
echo "  3. Update documentation to reflect new structure"