const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

// Enhanced subtype detection for each activity type
function detectSpecificSubtype(activity, activityType) {
  const name = activity.name?.toLowerCase() || '';
  const subcategory = activity.subcategory?.toLowerCase() || '';
  const combined = `${name} ${subcategory}`;
  
  switch(activityType) {
    case 'Dance':
      // Check for specific dance types
      if (combined.includes('ballet')) return 'Ballet';
      if (combined.includes('jazz')) return 'Jazz';
      if (combined.includes('hip hop') || combined.includes('hip-hop') || combined.includes('hiphop')) return 'Hip Hop';
      if (combined.includes('tap')) return 'Tap';
      if (combined.includes('contemporary')) return 'Contemporary';
      if (combined.includes('modern')) return 'Modern';
      if (combined.includes('bollywood')) return 'Bollywood';
      if (combined.includes('breakdance') || combined.includes('break dance')) return 'Breakdancing';
      if (combined.includes('ballroom')) return 'Ballroom';
      if (combined.includes('salsa')) return 'Salsa';
      if (combined.includes('latin')) return 'Latin';
      if (combined.includes('irish')) return 'Irish';
      if (combined.includes('folk')) return 'Folk';
      if (combined.includes('creative')) return 'Creative Movement';
      if (combined.includes('lyrical')) return 'Lyrical';
      if (combined.includes('acro')) return 'Acro Dance';
      // Only return General Dance if no specific type found
      return 'General Dance';
      
    case 'Music':
      // Check for specific music types
      if (combined.includes('piano')) return 'Piano';
      if (combined.includes('guitar')) return 'Guitar';
      if (combined.includes('violin')) return 'Violin';
      if (combined.includes('drum')) return 'Drums';
      if (combined.includes('voice') || combined.includes('vocal') || combined.includes('singing') || combined.includes('choir')) return 'Voice & Singing';
      if (combined.includes('ukulele')) return 'Ukulele';
      if (combined.includes('keyboard')) return 'Keyboard';
      if (combined.includes('flute')) return 'Flute';
      if (combined.includes('saxophone') || combined.includes('sax')) return 'Saxophone';
      if (combined.includes('trumpet')) return 'Trumpet';
      if (combined.includes('cello')) return 'Cello';
      if (combined.includes('clarinet')) return 'Clarinet';
      if (combined.includes('band')) return 'Band';
      if (combined.includes('orchestra')) return 'Orchestra';
      if (combined.includes('music theory')) return 'Music Theory';
      if (combined.includes('composition')) return 'Composition';
      return 'General Music';
      
    case 'Visual Arts':
      // Check for specific art types
      if (combined.includes('painting') || combined.includes('paint')) return 'Painting';
      if (combined.includes('drawing') || combined.includes('draw')) return 'Drawing';
      if (combined.includes('pottery') || combined.includes('ceramics') || combined.includes('clay')) return 'Pottery & Ceramics';
      if (combined.includes('sculpture') || combined.includes('sculpt')) return 'Sculpture';
      if (combined.includes('photography') || combined.includes('photo')) return 'Photography';
      if (combined.includes('digital art') || combined.includes('digital')) return 'Digital Art';
      if (combined.includes('craft')) return 'Crafts';
      if (combined.includes('mixed media')) return 'Mixed Media';
      if (combined.includes('printmaking') || combined.includes('print making')) return 'Printmaking';
      if (combined.includes('jewelry') || combined.includes('jewellery')) return 'Jewelry Making';
      if (combined.includes('textile') || combined.includes('fabric') || combined.includes('sewing')) return 'Textiles';
      if (combined.includes('watercolor') || combined.includes('watercolour')) return 'Watercolor';
      if (combined.includes('cartoon') || combined.includes('anime') || combined.includes('manga')) return 'Cartooning';
      if (combined.includes('calligraphy')) return 'Calligraphy';
      return 'General Art';
      
    case 'Fitness & Wellness':
      // Check for specific fitness types
      if (combined.includes('yoga')) return 'Yoga';
      if (combined.includes('pilates')) return 'Pilates';
      if (combined.includes('zumba')) return 'Zumba';
      if (combined.includes('aerobic')) return 'Aerobics';
      if (combined.includes('strength') || combined.includes('weight')) return 'Strength Training';
      if (combined.includes('cardio')) return 'Cardio';
      if (combined.includes('crossfit') || combined.includes('cross fit')) return 'CrossFit';
      if (combined.includes('bootcamp') || combined.includes('boot camp')) return 'Boot Camp';
      if (combined.includes('mindful') || combined.includes('meditation')) return 'Mindfulness';
      if (combined.includes('fitness')) return 'General Fitness';
      return 'Wellness';
      
    case 'Camps':
      // Check for specific camp types
      if (combined.includes('day camp') || combined.includes('full day')) return 'Full Day Camp';
      if (combined.includes('part day') || combined.includes('half day') || combined.includes('morning') || combined.includes('afternoon')) return 'Part Day Camp';
      if (combined.includes('overnight') || combined.includes('sleep away') || combined.includes('residential')) return 'Overnight Camp';
      if (combined.includes('sport')) return 'Sports Camp';
      if (combined.includes('art')) return 'Arts Camp';
      if (combined.includes('science')) return 'Science Camp';
      if (combined.includes('tech') || combined.includes('computer') || combined.includes('coding')) return 'Tech Camp';
      if (combined.includes('music')) return 'Music Camp';
      if (combined.includes('dance')) return 'Dance Camp';
      if (combined.includes('drama') || combined.includes('theatre') || combined.includes('theater')) return 'Drama Camp';
      if (combined.includes('nature') || combined.includes('outdoor') || combined.includes('adventure')) return 'Outdoor Camp';
      if (combined.includes('leader')) return 'Leadership Camp';
      if (combined.includes('specialty') || combined.includes('special')) return 'Specialty Camp';
      if (combined.includes('spring')) return 'Spring Camp';
      if (combined.includes('summer')) return 'Summer Camp';
      if (combined.includes('winter')) return 'Winter Camp';
      if (combined.includes('march') || combined.includes('break')) return 'March Break Camp';
      return 'General Camp';
      
    case 'Other':
      // Try to identify specific types for "Other"
      if (combined.includes('parent') && combined.includes('child')) return 'Parent & Child';
      if (combined.includes('birthday')) return 'Birthday Parties';
      if (combined.includes('drop-in') || combined.includes('drop in')) return 'Drop-in Programs';
      if (combined.includes('special event')) return 'Special Events';
      if (combined.includes('workshop')) return 'Workshops';
      if (combined.includes('club')) return 'Clubs';
      if (combined.includes('leadership')) return 'Leadership';
      if (combined.includes('volunteer')) return 'Volunteer Programs';
      return 'General Programs';
      
    default:
      // Return existing subtype if already set
      return activity.activitySubtype;
  }
}

async function fixActivitySubtypes() {
  try {
    console.log('Starting to fix activity subtypes...\n');
    
    // Get all activities with generic or null subtypes
    const activities = await prisma.activity.findMany({
      where: {
        isActive: true,
        activityType: { not: null },
        OR: [
          { activitySubtype: null },
          { activitySubtype: { contains: 'General' } }
        ]
      },
      select: {
        id: true,
        name: true,
        subcategory: true,
        activityType: true,
        activitySubtype: true
      }
    });
    
    console.log(`Found ${activities.length} activities to review\n`);
    
    const updates = [];
    const stats = {};
    
    for (const activity of activities) {
      const newSubtype = detectSpecificSubtype(activity, activity.activityType);
      
      // Only update if we found a more specific subtype
      if (newSubtype && newSubtype !== activity.activitySubtype && !newSubtype.includes('General')) {
        updates.push({
          id: activity.id,
          oldSubtype: activity.activitySubtype,
          newSubtype: newSubtype,
          name: activity.name
        });
        
        // Track stats
        const key = `${activity.activityType}: ${activity.activitySubtype || 'NULL'} -> ${newSubtype}`;
        stats[key] = (stats[key] || 0) + 1;
      }
    }
    
    console.log(`Found ${updates.length} activities that need more specific subtypes\n`);
    
    if (updates.length > 0) {
      console.log('Sample updates:');
      updates.slice(0, 10).forEach(u => {
        console.log(`  ${u.name}`);
        console.log(`    ${u.oldSubtype || 'NULL'} -> ${u.newSubtype}`);
      });
      
      console.log('\nApplying updates...');
      
      // Apply updates sequentially to avoid connection issues
      for (let i = 0; i < updates.length; i++) {
        await prisma.activity.update({
          where: { id: updates[i].id },
          data: { activitySubtype: updates[i].newSubtype }
        });
        
        if (i % 50 === 0 || i === updates.length - 1) {
          process.stdout.write(`\rProcessed: ${i + 1}/${updates.length}`);
        }
      }
      
      console.log('\n\nUpdate complete!');
      
      console.log('\nUpdate statistics:');
      Object.entries(stats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20)
        .forEach(([change, count]) => {
          console.log(`  ${change}: ${count}`);
        });
    }
    
    // Show final distribution
    console.log('\n\nFinal subtype distribution for key activity types:');
    
    const keyTypes = ['Dance', 'Music', 'Visual Arts', 'Camps', 'Fitness & Wellness'];
    
    for (const type of keyTypes) {
      const subtypes = await prisma.activity.groupBy({
        by: ['activitySubtype'],
        _count: { id: true },
        where: {
          activityType: type,
          isActive: true
        },
        orderBy: { _count: { id: 'desc' } }
      });
      
      console.log(`\n${type}:`);
      subtypes.slice(0, 10).forEach(s => {
        console.log(`  ${s.activitySubtype}: ${s._count.id}`);
      });
    }
    
  } catch (error) {
    console.error('Error fixing subtypes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixActivitySubtypes();