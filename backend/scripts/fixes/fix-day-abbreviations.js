const { PrismaClient } = require('../../generated/prisma');

async function fixDayAbbreviations() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Fixing day abbreviations in schedule field...\n');
    
    // Map of incorrect to correct abbreviations
    const dayMappings = {
      'Mons': 'Mon',
      'Tues': 'Tue',
      'Weds': 'Wed',
      'Thurs': 'Thu',
      'Thur': 'Thu',
      'Fris': 'Fri',
      'Sats': 'Sat',
      'Suns': 'Sun',
      'MONS': 'Mon',
      'TUES': 'Tue',
      'WEDS': 'Wed',
      'THURS': 'Thu',
      'THUR': 'Thu',
      'FRIS': 'Fri',
      'SATS': 'Sat',
      'SUNS': 'Sun'
    };
    
    // Get all activities with schedule field
    const activities = await prisma.activity.findMany({
      where: {
        schedule: { not: null }
      },
      select: {
        id: true,
        schedule: true
      }
    });
    
    console.log(`Found ${activities.length} activities with schedules`);
    
    let fixedCount = 0;
    
    for (const activity of activities) {
      let newSchedule = activity.schedule;
      let changed = false;
      
      // Replace each incorrect abbreviation
      for (const [wrong, correct] of Object.entries(dayMappings)) {
        if (newSchedule.includes(wrong)) {
          newSchedule = newSchedule.replace(new RegExp(wrong, 'g'), correct);
          changed = true;
        }
      }
      
      // Also fix any remaining issues with multiple spaces
      newSchedule = newSchedule.replace(/\s+/g, ' ').trim();
      
      if (changed) {
        await prisma.activity.update({
          where: { id: activity.id },
          data: { schedule: newSchedule }
        });
        fixedCount++;
        
        if (fixedCount % 100 === 0) {
          console.log(`Fixed ${fixedCount} activities...`);
        }
      }
    }
    
    console.log(`\n✅ Fixed ${fixedCount} activities with incorrect day abbreviations`);
    
    // Show some examples of fixed schedules
    const samples = await prisma.activity.findMany({
      where: {
        schedule: {
          contains: 'Wed'
        }
      },
      select: {
        name: true,
        schedule: true
      },
      take: 5
    });
    
    console.log('\nSample schedules after fix:');
    samples.forEach(s => {
      console.log(`  ${s.name}: ${s.schedule}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDayAbbreviations();