/**
 * Script to standardize activity types in the database
 * Maps all variations to the canonical names from activity_types table
 */

const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Mapping from database variations to standard names
const ACTIVITY_TYPE_MAPPINGS = {
  // Sports variations
  'Sports - Team': 'Team Sports',
  'Sports Team': 'Team Sports',
  'Sports - Individual': 'Individual Sports',
  'Sports Individual': 'Individual Sports',
  
  // Arts variations
  'Arts & Crafts': 'Visual Arts',
  'Arts - Visual': 'Visual Arts',
  'Arts Visual': 'Visual Arts',
  'Arts - Music': 'Music',
  'Arts Music': 'Music',
  'Arts - Dance': 'Dance',
  'Arts Dance': 'Dance',
  'Theatre': 'Performing Arts',
  'Theater': 'Performing Arts',
  'Drama': 'Performing Arts',
  
  // Swimming variations
  'Swimming': 'Swimming & Aquatics',
  'Aquatics': 'Swimming & Aquatics',
  
  // Skating variations
  'Skating': 'Skating & Wheels',
  
  // Gymnastics variations
  'Gymnastics': 'Gymnastics & Movement',
  
  // Camp variations
  'Day Camps': 'Camps',
  'Summer Camp': 'Camps',
  'Camp': 'Camps',
  
  // Education variations
  'STEM': 'STEM & Education',
  'Educational': 'STEM & Education',
  'Education': 'STEM & Education',
  
  // Fitness variations
  'Fitness': 'Fitness & Wellness',
  'Yoga': 'Fitness & Wellness',
  'Wellness': 'Fitness & Wellness',
  
  // Outdoor variations
  'Outdoor': 'Outdoor & Adventure',
  'Adventure': 'Outdoor & Adventure',
  
  // Culinary variations
  'Cooking': 'Culinary Arts',
  
  // Language variations
  'Languages': 'Language & Culture',
  'Language': 'Language & Culture',
  
  // Special Needs variations
  'Special Needs': 'Special Needs Programs',
  
  // Leadership variations
  'Leadership': 'Life Skills & Leadership',
  'Life Skills': 'Life Skills & Leadership'
};

async function standardizeActivityTypes() {
  try {
    console.log('Starting activity type standardization...\n');
    
    // Get all unique activity types currently in use
    const currentTypes = await prisma.activity.groupBy({
      by: ['activityType'],
      where: {
        activityType: { not: null }
      },
      _count: { id: true }
    });
    
    console.log('Current activity types in database:');
    currentTypes.forEach(type => {
      console.log(`  "${type.activityType}": ${type._count.id} activities`);
    });
    console.log();
    
    // Get all standard activity types from activity_types table
    const standardTypes = await prisma.activityType.findMany({
      select: { name: true, code: true }
    });
    
    const standardTypeNames = new Set(standardTypes.map(t => t.name));
    console.log('Standard activity types from activity_types table:');
    standardTypes.forEach(type => {
      console.log(`  ${type.name} (${type.code})`);
    });
    console.log();
    
    // Update activities with non-standard types
    let totalUpdated = 0;
    
    for (const typeGroup of currentTypes) {
      const currentType = typeGroup.activityType;
      
      // Check if it needs mapping
      let standardType = currentType;
      
      // First check explicit mappings
      if (ACTIVITY_TYPE_MAPPINGS[currentType]) {
        standardType = ACTIVITY_TYPE_MAPPINGS[currentType];
      }
      // If not in standard types, try to find a match
      else if (!standardTypeNames.has(currentType)) {
        // Check if it's already a standard type (exact match)
        const exactMatch = Array.from(standardTypeNames).find(
          st => st.toLowerCase() === currentType.toLowerCase()
        );
        if (exactMatch) {
          standardType = exactMatch;
        }
      }
      
      // Update if needed
      if (standardType !== currentType) {
        console.log(`Updating "${currentType}" -> "${standardType}" (${typeGroup._count.id} activities)`);
        
        const result = await prisma.activity.updateMany({
          where: {
            activityType: currentType
          },
          data: {
            activityType: standardType
          }
        });
        
        totalUpdated += result.count;
        console.log(`  Updated ${result.count} activities`);
      }
    }
    
    console.log(`\nTotal activities updated: ${totalUpdated}`);
    
    // Verify the update
    console.log('\nVerifying standardization...');
    const updatedTypes = await prisma.activity.groupBy({
      by: ['activityType'],
      where: {
        activityType: { not: null }
      },
      _count: { id: true }
    });
    
    console.log('Activity types after standardization:');
    updatedTypes.forEach(type => {
      const isStandard = standardTypeNames.has(type.activityType);
      const marker = isStandard ? '✓' : '✗';
      console.log(`  ${marker} "${type.activityType}": ${type._count.id} activities`);
    });
    
    // Check for any remaining non-standard types
    const nonStandardTypes = updatedTypes.filter(
      type => !standardTypeNames.has(type.activityType)
    );
    
    if (nonStandardTypes.length > 0) {
      console.log('\n⚠️  Warning: Some non-standard activity types remain:');
      nonStandardTypes.forEach(type => {
        console.log(`  - "${type.activityType}": ${type._count.id} activities`);
      });
      console.log('\nThese may need manual review or additional mapping rules.');
    } else {
      console.log('\n✅ All activity types are now standardized!');
    }
    
  } catch (error) {
    console.error('Error standardizing activity types:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the standardization
standardizeActivityTypes();