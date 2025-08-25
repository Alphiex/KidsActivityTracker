/**
 * Script to fix activity types that include age ranges
 * Separates activity type from age range and updates the database
 */

require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');
const { parseActivityType, extractAgeRangeFromText } = require('../scrapers/utils/activityTypeParser');

const prisma = new PrismaClient();

async function fixActivityTypes() {
  console.log('🔧 Starting activity type fix...');
  
  try {
    // Get all activities with subcategories that might contain age ranges
    const activities = await prisma.activity.findMany({
      where: {
        OR: [
          { subcategory: { contains: '(' } },
          { subcategory: { contains: 'yrs' } },
          { subcategory: { contains: 'years' } }
        ]
      },
      select: {
        id: true,
        name: true,
        category: true,
        subcategory: true,
        ageMin: true,
        ageMax: true,
        rawData: true
      }
    });
    
    console.log(`Found ${activities.length} activities with potential age ranges in subcategory`);
    
    let updated = 0;
    let errors = 0;
    
    for (const activity of activities) {
      try {
        // Parse the subcategory to extract clean type and age range
        const parsed = parseActivityType(activity.subcategory);
        
        // Prepare update data
        const updateData = {
          subcategory: parsed.type
        };
        
        // Update category if we extracted one
        if (parsed.category && !activity.category) {
          updateData.category = parsed.category;
        }
        
        // Update age range if we found one and current is default (0-18)
        if (parsed.ageMin !== null && parsed.ageMax !== null) {
          if (activity.ageMin === 0 && activity.ageMax === 18) {
            updateData.ageMin = parsed.ageMin;
            updateData.ageMax = parsed.ageMax;
          }
        }
        
        // Try to extract age from raw data if available and still using defaults
        if (activity.rawData && activity.ageMin === 0 && activity.ageMax === 18) {
          const rawData = typeof activity.rawData === 'string' ? JSON.parse(activity.rawData) : activity.rawData;
          if (rawData.ageRestrictions) {
            const extractedAge = extractAgeRangeFromText(rawData.ageRestrictions);
            if (extractedAge.min !== null) {
              updateData.ageMin = extractedAge.min;
              updateData.ageMax = extractedAge.max;
            }
          }
        }
        
        // Update the activity
        await prisma.activity.update({
          where: { id: activity.id },
          data: updateData
        });
        
        console.log(`✅ Updated: "${activity.subcategory}" -> "${parsed.type}" (${updateData.ageMin || activity.ageMin}-${updateData.ageMax || activity.ageMax} years)`);
        updated++;
        
      } catch (error) {
        console.error(`❌ Error updating activity ${activity.id}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated} activities`);
    console.log(`   Errors: ${errors}`);
    
    // Show current subcategory distribution
    console.log('\n📈 Current activity type distribution:');
    const typeCounts = await prisma.activity.groupBy({
      by: ['subcategory'],
      where: {
        isActive: true
      },
      _count: {
        subcategory: true
      },
      orderBy: {
        _count: {
          subcategory: 'desc'
        }
      },
      take: 20
    });
    
    typeCounts.forEach(type => {
      if (type.subcategory) {
        console.log(`   ${type.subcategory}: ${type._count.subcategory} activities`);
      }
    });
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixActivityTypes();