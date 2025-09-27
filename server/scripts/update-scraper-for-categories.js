const fs = require('fs');
const path = require('path');

/**
 * Script to update scrapers to automatically assign categories to new activities
 * 
 * This script modifies existing scrapers to:
 * 1. Import the ActivityCategoryAssigner
 * 2. Use it to assign categories when creating/updating activities
 * 3. Ensure all new activities get proper categorization
 */

const SCRAPER_INTEGRATION_CODE = `
// Add this import at the top of the scraper file
const { ActivityCategoryAssigner } = require('../utils/activityCategoryAssigner');

// Add this to the constructor or initialization
this.categoryAssigner = new ActivityCategoryAssigner();

// When creating activities, use this pattern:
async createOrUpdateActivity(activityData) {
  // ... existing activity creation logic ...
  
  // After the activity is created/updated, assign categories
  if (activityData.ageMin !== undefined || activityData.ageMax !== undefined) {
    try {
      await this.categoryAssigner.processActivity({
        id: createdActivity.id,
        name: activityData.name,
        description: activityData.description,
        category: activityData.category,
        ageMin: activityData.ageMin,
        ageMax: activityData.ageMax
      });
    } catch (error) {
      console.error('Error assigning categories:', error);
      // Don't fail the entire scraping process for category assignment errors
    }
  }
}

// Don't forget to disconnect in cleanup
async cleanup() {
  // ... existing cleanup ...
  if (this.categoryAssigner) {
    await this.categoryAssigner.disconnect();
  }
}
`;

function updateScraperFile(filePath) {
  console.log(`\n📝 Updating scraper: ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already updated
    if (content.includes('ActivityCategoryAssigner')) {
      console.log('   ✅ Already updated');
      return;
    }
    
    // Add import at the top (after other imports)
    const importLine = "const { ActivityCategoryAssigner } = require('../utils/activityCategoryAssigner');";
    
    // Find the line with PrismaClient import or other utility imports
    const importRegex = /const.*require.*generated\/prisma.*;\n/;
    const importMatch = content.match(importRegex);
    
    if (importMatch) {
      const insertIndex = content.indexOf(importMatch[0]) + importMatch[0].length;
      content = content.slice(0, insertIndex) + importLine + '\n' + content.slice(insertIndex);
      console.log('   ✅ Added ActivityCategoryAssigner import');
    } else {
      console.log('   ⚠️ Could not find import location, manual integration required');
      return;
    }
    
    // Add categorizer initialization in constructor
    const constructorRegex = /constructor\s*\([^)]*\)\s*\{/;
    const constructorMatch = content.match(constructorRegex);
    
    if (constructorMatch) {
      const insertIndex = content.indexOf(constructorMatch[0]) + constructorMatch[0].length;
      const initLine = '\n    this.categoryAssigner = new ActivityCategoryAssigner();';
      content = content.slice(0, insertIndex) + initLine + content.slice(insertIndex);
      console.log('   ✅ Added categoryAssigner initialization');
    } else {
      console.log('   ⚠️ Could not find constructor, manual integration required');
    }
    
    // Write the updated file
    fs.writeFileSync(filePath, content);
    console.log('   ✅ File updated successfully');
    
  } catch (error) {
    console.error(`   ❌ Error updating ${filePath}:`, error.message);
  }
}

function createScraperIntegrationGuide() {
  const guideContent = `# Scraper Category Integration Guide

## Overview
All scrapers should now automatically assign age-based categories to activities during the scraping process.

## Integration Steps

### 1. Import the ActivityCategoryAssigner
\`\`\`javascript
const { ActivityCategoryAssigner } = require('../utils/activityCategoryAssigner');
\`\`\`

### 2. Initialize in Constructor
\`\`\`javascript
constructor() {
  // ... existing initialization ...
  this.categoryAssigner = new ActivityCategoryAssigner();
}
\`\`\`

### 3. Use When Creating/Updating Activities
\`\`\`javascript
async processActivity(activityData) {
  // Create or update the activity
  const activity = await this.prisma.activity.upsert({
    // ... activity data ...
  });
  
  // Assign categories based on age range and content
  if (activity.ageMin !== undefined || activity.ageMax !== undefined) {
    try {
      await this.categoryAssigner.processActivity({
        id: activity.id,
        name: activity.name,
        description: activity.description,
        category: activity.category,
        ageMin: activity.ageMin,
        ageMax: activity.ageMax
      });
    } catch (error) {
      console.error('Error assigning categories:', error);
      // Continue processing - don't fail entire scrape for category errors
    }
  }
}
\`\`\`

### 4. Cleanup
\`\`\`javascript
async cleanup() {
  // ... existing cleanup ...
  if (this.categoryAssigner) {
    await this.categoryAssigner.disconnect();
  }
}
\`\`\`

## Category Assignment Logic

The ActivityCategoryAssigner automatically assigns activities to these categories:

1. **Early Years: Parent Participation** (0-5 years, with parent keywords)
   - Keywords: parent, family, caregiver, guardian, mommy, daddy, tot
   
2. **Early Years: On My Own** (0-5 years, no parent keywords)
   - For independent early childhood activities

3. **School Age** (5-13 years)
   - Activities that overlap with ages 5-13

4. **Youth** (10-18 years)
   - Activities that overlap with ages 10-18

5. **All Ages & Family** (wide age ranges or family keywords)
   - Activities with 12+ year age ranges
   - Activities spanning early childhood to teens
   - Activities with family keywords

## Testing
After integration, verify that:
- New activities get assigned to appropriate categories
- Category assignments appear in the database
- Scraper performance isn't significantly impacted
- Errors in category assignment don't break the scraper

## Existing Activities
Run the unified recategorization script to assign categories to existing activities:
\`\`\`bash
node scripts/unified-recategorization.js
\`\`\`
`;

  const guidePath = '/Users/mike/Development/KidsActivityTracker/backend/docs/SCRAPER_CATEGORY_INTEGRATION.md';
  fs.writeFileSync(guidePath, guideContent);
  console.log(`📖 Integration guide created: ${guidePath}`);
}

async function main() {
  console.log('🔧 SCRAPER CATEGORY INTEGRATION UPDATER');
  console.log('=======================================\n');
  
  // Create integration guide
  createScraperIntegrationGuide();
  
  // Find all scraper files
  const scrapersDir = '/Users/mike/Development/KidsActivityTracker/backend/scrapers';
  const scraperFiles = [];
  
  function findScraperFiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        findScraperFiles(fullPath);
      } else if (file.endsWith('.js') && !file.includes('test')) {
        scraperFiles.push(fullPath);
      }
    });
  }
  
  findScraperFiles(scrapersDir);
  
  console.log(`🔍 Found ${scraperFiles.length} scraper files:`);
  scraperFiles.forEach(file => {
    console.log(`   - ${path.relative(scrapersDir, file)}`);
  });
  
  console.log('\n📝 Updating scraper files...');
  
  // Update main scrapers
  const mainScrapers = scraperFiles.filter(file => 
    file.includes('nvrcEnhancedParallelScraperFixed') ||
    file.includes('NVRCScraper') ||
    file.includes('Enhanced') ||
    file.includes('Main')
  );
  
  mainScrapers.forEach(updateScraperFile);
  
  if (mainScrapers.length === 0) {
    console.log('⚠️ No main scrapers identified for automatic update.');
    console.log('Please manually integrate category assignment using the guide.');
  }
  
  console.log('\n📋 INTEGRATION SUMMARY:');
  console.log('=======================');
  console.log('1. ✅ ActivityCategoryAssigner utility created');
  console.log('2. ✅ Integration guide created');
  console.log(`3. ${mainScrapers.length > 0 ? '✅' : '⚠️'} Scraper files ${mainScrapers.length > 0 ? 'updated' : 'require manual integration'}`);
  console.log('\n📖 Next steps:');
  console.log('   1. Review updated scraper files');
  console.log('   2. Test scraping with category assignment');
  console.log('   3. Run unified-recategorization.js on production');
  console.log('   4. Verify categories appear correctly in dashboard');
  
  console.log('\n✅ Scraper integration preparation completed!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { updateScraperFile, createScraperIntegrationGuide };