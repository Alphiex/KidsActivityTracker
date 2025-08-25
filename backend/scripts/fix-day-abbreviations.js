/**
 * Script to fix day abbreviations in existing database records
 */

require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');
const { standardizeSchedule } = require('../utils/dayFormatter');

const prisma = new PrismaClient();

async function fixDayAbbreviations() {
  console.log('🔧 Starting day abbreviation fix...');
  
  try {
    // Get all activities with schedules
    const activities = await prisma.activity.findMany({
      where: {
        schedule: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        schedule: true
      }
    });
    
    console.log(`📊 Found ${activities.length} activities with schedules`);
    
    let updatedCount = 0;
    const updates = [];
    
    for (const activity of activities) {
      const standardized = standardizeSchedule(activity.schedule);
      
      if (standardized !== activity.schedule) {
        updates.push({
          id: activity.id,
          oldSchedule: activity.schedule,
          newSchedule: standardized,
          name: activity.name
        });
        
        // Update the activity
        await prisma.activity.update({
          where: { id: activity.id },
          data: { schedule: standardized }
        });
        
        updatedCount++;
        
        console.log(`✅ Fixed: "${activity.name}"`);
        console.log(`   Old: ${activity.schedule}`);
        console.log(`   New: ${standardized}`);
      }
    }
    
    console.log(`\n📈 Summary:`);
    console.log(`   Total activities: ${activities.length}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Unchanged: ${activities.length - updatedCount}`);
    
    if (updatedCount > 0) {
      console.log('\n📝 Updated activities:');
      updates.forEach(update => {
        console.log(`   - ${update.name}`);
        console.log(`     ${update.oldSchedule} → ${update.newSchedule}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error fixing day abbreviations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixDayAbbreviations();