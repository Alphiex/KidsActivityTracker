/**
 * Comprehensive migration script to:
 * 1. Standardize all activity types
 * 2. Assign proper subtypes based on activity names and subcategories
 * 3. Link activities to the correct types and subtypes
 */

const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Mapping from various activity type names to standard names
const ACTIVITY_TYPE_MAPPINGS = {
  // Sports variations
  'Sports - Team': 'Team Sports',
  'Sports Team': 'Team Sports',
  'Sports - Individual': 'Individual Sports',
  'Sports Individual': 'Individual Sports',
  'Sports': 'Multi-Sport', // General sports to multi-sport
  
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
  'Private Lessons Swimming': 'Swimming & Aquatics',
  'Swimming - Aquatic Leadership': 'Swimming & Aquatics',
  
  // Skating variations
  'Skating': 'Skating & Wheels',
  
  // Gymnastics variations
  'Gymnastics': 'Gymnastics & Movement',
  
  // Camp variations
  'Day Camps': 'Camps',
  'Summer Camp': 'Camps',
  'Camp': 'Camps',
  'Part Day Camp': 'Camps',
  'Full Day Camp': 'Camps',
  
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
  'Life Skills': 'Life Skills & Leadership',
  
  // Music variations
  'Private Lessons Music': 'Music'
};

// Function to determine subtype based on activity name and subcategory
function determineSubtype(activity, activityType) {
  const name = (activity.name || '').toLowerCase();
  const subcategory = (activity.subcategory || '').toLowerCase();
  const combined = `${name} ${subcategory}`;
  
  switch (activityType) {
    case 'Team Sports':
      if (combined.includes('basketball')) return 'Basketball';
      if (combined.includes('soccer') || combined.includes('football') && !combined.includes('flag')) return 'Soccer';
      if (combined.includes('volleyball')) return 'Volleyball';
      if (combined.includes('baseball')) return 'Baseball';
      if (combined.includes('softball')) return 'Softball';
      if (combined.includes('hockey') && !combined.includes('floor')) return 'Hockey';
      if (combined.includes('floor hockey')) return 'Floor Hockey';
      if (combined.includes('flag football')) return 'Flag Football';
      if (combined.includes('football') && !combined.includes('soccer')) return 'Football';
      if (combined.includes('lacrosse')) return 'Lacrosse';
      if (combined.includes('rugby')) return 'Rugby';
      if (combined.includes('cricket')) return 'Cricket';
      if (combined.includes('ultimate') || combined.includes('frisbee')) return 'Ultimate Frisbee';
      return 'Other Team Sports';
      
    case 'Individual Sports':
      if (combined.includes('track') || combined.includes('field')) return 'Track & Field';
      if (combined.includes('running') || combined.includes('run')) return 'Running';
      if (combined.includes('cycling') || combined.includes('bike')) return 'Cycling';
      if (combined.includes('golf')) return 'Golf';
      if (combined.includes('bowling')) return 'Bowling';
      if (combined.includes('archery')) return 'Archery';
      if (combined.includes('fencing')) return 'Fencing';
      if (combined.includes('climb')) return 'Rock Climbing';
      if (combined.includes('cross country')) return 'Cross Country';
      if (combined.includes('triathlon')) return 'Triathlon';
      return 'Other Individual Sports';
      
    case 'Swimming & Aquatics':
      if (combined.includes('learn to swim') || combined.includes('lessons')) return 'Learn to Swim';
      if (combined.includes('competitive') || combined.includes('club')) return 'Competitive Swimming';
      if (combined.includes('diving')) return 'Diving';
      if (combined.includes('water polo')) return 'Water Polo';
      if (combined.includes('synchronized')) return 'Synchronized Swimming';
      if (combined.includes('aqua') && (combined.includes('fit') || combined.includes('aerobic'))) return 'Aqua Fitness';
      if (combined.includes('lifeguard')) return 'Lifeguarding';
      if (combined.includes('camp')) return 'Swim Camp';
      return 'Learn to Swim'; // Default for swimming
      
    case 'Martial Arts':
      if (combined.includes('karate')) return 'Karate';
      if (combined.includes('taekwondo') || combined.includes('tkd')) return 'Taekwondo';
      if (combined.includes('judo')) return 'Judo';
      if (combined.includes('jiu') || combined.includes('jitsu') || combined.includes('bjj')) return 'Jiu-Jitsu';
      if (combined.includes('kung fu') || combined.includes('kungfu')) return 'Kung Fu';
      if (combined.includes('aikido')) return 'Aikido';
      if (combined.includes('boxing') && !combined.includes('kick')) return 'Boxing';
      if (combined.includes('kickbox')) return 'Kickboxing';
      if (combined.includes('mma') || combined.includes('mixed martial')) return 'Mixed Martial Arts';
      if (combined.includes('self') && combined.includes('defen')) return 'Self Defense';
      return 'Other Martial Arts';
      
    case 'Racquet Sports':
      if (combined.includes('tennis') && !combined.includes('table')) return 'Tennis';
      if (combined.includes('badminton')) return 'Badminton';
      if (combined.includes('squash')) return 'Squash';
      if (combined.includes('racquetball')) return 'Racquetball';
      if (combined.includes('pickleball')) return 'Pickleball';
      if (combined.includes('table tennis') || combined.includes('ping pong')) return 'Table Tennis';
      return 'Other Racquet Sports';
      
    case 'Dance':
      if (combined.includes('ballet')) return 'Ballet';
      if (combined.includes('jazz')) return 'Jazz';
      if (combined.includes('tap')) return 'Tap';
      if (combined.includes('hip hop') || combined.includes('hiphop')) return 'Hip Hop';
      if (combined.includes('contemporary')) return 'Contemporary';
      if (combined.includes('modern')) return 'Modern';
      if (combined.includes('ballroom')) return 'Ballroom';
      if (combined.includes('latin')) return 'Latin';
      if (combined.includes('salsa')) return 'Salsa';
      if (combined.includes('bollywood')) return 'Bollywood';
      if (combined.includes('irish')) return 'Irish';
      if (combined.includes('african')) return 'African';
      if (combined.includes('break')) return 'Breakdancing';
      if (combined.includes('creative') && combined.includes('movement')) return 'Creative Movement';
      return 'Other Dance';
      
    case 'Visual Arts':
      if (combined.includes('paint')) return 'Painting';
      if (combined.includes('draw')) return 'Drawing';
      if (combined.includes('sculpt')) return 'Sculpture';
      if (combined.includes('pottery')) return 'Pottery';
      if (combined.includes('ceramic')) return 'Ceramics';
      if (combined.includes('photo')) return 'Photography';
      if (combined.includes('digital')) return 'Digital Art';
      if (combined.includes('print')) return 'Printmaking';
      if (combined.includes('mixed media')) return 'Mixed Media';
      if (combined.includes('craft')) return 'Crafts';
      if (combined.includes('jewelry')) return 'Jewelry Making';
      if (combined.includes('fashion')) return 'Fashion Design';
      return 'Other Visual Arts';
      
    case 'Music':
      if (combined.includes('piano')) return 'Piano';
      if (combined.includes('guitar')) return 'Guitar';
      if (combined.includes('violin')) return 'Violin';
      if (combined.includes('drum')) return 'Drums';
      if (combined.includes('voice') || combined.includes('sing') || combined.includes('vocal')) return 'Voice/Singing';
      if (combined.includes('band')) return 'Band';
      if (combined.includes('orchestra')) return 'Orchestra';
      if (combined.includes('choir')) return 'Choir';
      if (combined.includes('ukulele')) return 'Ukulele';
      if (combined.includes('brass')) return 'Brass Instruments';
      if (combined.includes('woodwind') || combined.includes('flute') || combined.includes('clarinet')) return 'Woodwind Instruments';
      if (combined.includes('theory')) return 'Music Theory';
      if (combined.includes('production')) return 'Music Production';
      return 'Other Music';
      
    case 'Performing Arts':
      if (combined.includes('drama')) return 'Drama';
      if (combined.includes('musical') && combined.includes('theatre')) return 'Musical Theatre';
      if (combined.includes('acting')) return 'Acting';
      if (combined.includes('improv')) return 'Improv';
      if (combined.includes('comedy')) return 'Comedy';
      if (combined.includes('circus')) return 'Circus Arts';
      if (combined.includes('magic')) return 'Magic';
      if (combined.includes('puppet')) return 'Puppetry';
      if (combined.includes('film')) return 'Film Making';
      return 'Other Performing Arts';
      
    case 'Skating & Wheels':
      if (combined.includes('ice skat') || (combined.includes('skating') && !combined.includes('roller') && !combined.includes('inline'))) return 'Ice Skating';
      if (combined.includes('figure skat')) return 'Figure Skating';
      if (combined.includes('speed skat')) return 'Speed Skating';
      if (combined.includes('roller skat')) return 'Roller Skating';
      if (combined.includes('inline') || combined.includes('rollerblade')) return 'Inline Skating';
      if (combined.includes('skateboard')) return 'Skateboarding';
      if (combined.includes('scooter')) return 'Scootering';
      if (combined.includes('bmx')) return 'BMX';
      return 'Other Skating';
      
    case 'Gymnastics & Movement':
      if (combined.includes('artistic')) return 'Artistic Gymnastics';
      if (combined.includes('rhythmic')) return 'Rhythmic Gymnastics';
      if (combined.includes('trampoline')) return 'Trampoline';
      if (combined.includes('tumbling')) return 'Tumbling';
      if (combined.includes('acro')) return 'Acrobatics';
      if (combined.includes('parkour')) return 'Parkour';
      if (combined.includes('ninja')) return 'Ninja Training';
      if (combined.includes('cheer')) return 'Cheerleading';
      return 'Artistic Gymnastics'; // Default for gymnastics
      
    case 'Camps':
      if (combined.includes('day camp')) return 'Day Camp';
      if (combined.includes('sport')) return 'Sports Camp';
      if (combined.includes('art')) return 'Arts Camp';
      if (combined.includes('science')) return 'Science Camp';
      if (combined.includes('tech') || combined.includes('computer') || combined.includes('coding')) return 'Tech Camp';
      if (combined.includes('outdoor')) return 'Outdoor Camp';
      if (combined.includes('adventure')) return 'Adventure Camp';
      if (combined.includes('leadership')) return 'Leadership Camp';
      if (combined.includes('march break')) return 'March Break Camp';
      if (combined.includes('winter')) return 'Winter Camp';
      if (combined.includes('summer')) return 'Summer Camp';
      return 'Day Camp'; // Default for camps
      
    case 'STEM & Education':
      if (combined.includes('robot')) return 'Robotics';
      if (combined.includes('coding') || combined.includes('programming')) return 'Coding';
      if (combined.includes('science')) return 'Science';
      if (combined.includes('chemistry')) return 'Chemistry';
      if (combined.includes('physics')) return 'Physics';
      if (combined.includes('biology')) return 'Biology';
      if (combined.includes('engineer')) return 'Engineering';
      if (combined.includes('math')) return 'Mathematics';
      if (combined.includes('computer')) return 'Computer Science';
      if (combined.includes('electronic')) return 'Electronics';
      if (combined.includes('game') && combined.includes('develop')) return 'Game Development';
      if (combined.includes('minecraft')) return 'Minecraft';
      if (combined.includes('lego')) return 'LEGO';
      return 'Other STEM';
      
    case 'Fitness & Wellness':
      if (combined.includes('yoga')) return 'Yoga';
      if (combined.includes('pilates')) return 'Pilates';
      if (combined.includes('fitness')) return 'Fitness Training';
      if (combined.includes('strength')) return 'Strength Training';
      if (combined.includes('cardio')) return 'Cardio';
      if (combined.includes('zumba')) return 'Zumba';
      if (combined.includes('aerobic')) return 'Aerobics';
      if (combined.includes('mindful')) return 'Mindfulness';
      if (combined.includes('meditat')) return 'Meditation';
      if (combined.includes('crossfit')) return 'CrossFit Kids';
      return 'Other Fitness';
      
    case 'Multi-Sport':
      if (combined.includes('sampler')) return 'Sport Sampler';
      if (combined.includes('fundamental')) return 'Fundamentals';
      if (combined.includes('active start')) return 'Active Start';
      if (combined.includes('mix')) return 'Sport Mix';
      return 'Sport Sampler';
      
    case 'Early Development':
      if (combined.includes('parent') && combined.includes('tot')) return 'Parent & Tot';
      if (combined.includes('preschool')) return 'Preschool Programs';
      if (combined.includes('kindergym')) return 'Kindergym';
      if (combined.includes('sensory')) return 'Sensory Play';
      if (combined.includes('music') && combined.includes('movement')) return 'Music & Movement';
      if (combined.includes('story')) return 'Story Time';
      return 'Other Early Development';
      
    default:
      return 'Other';
  }
}

async function migrateActivityTypesAndSubtypes() {
  try {
    console.log('Starting comprehensive activity type and subtype migration...\n');
    
    // Step 1: Get all unique activity types currently in use
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
    
    // Step 2: Standardize activity types
    console.log('Standardizing activity types...');
    let totalUpdated = 0;
    
    for (const typeGroup of currentTypes) {
      const currentType = typeGroup.activityType;
      const standardType = ACTIVITY_TYPE_MAPPINGS[currentType] || currentType;
      
      if (standardType !== currentType) {
        console.log(`  Updating "${currentType}" -> "${standardType}" (${typeGroup._count.id} activities)`);
        
        const result = await prisma.activity.updateMany({
          where: {
            activityType: currentType
          },
          data: {
            activityType: standardType
          }
        });
        
        totalUpdated += result.count;
      }
    }
    
    console.log(`✓ Standardized ${totalUpdated} activities\n`);
    
    // Step 3: Assign subtypes based on activity names and subcategories
    console.log('Assigning activity subtypes...');
    
    // Get all standardized activity types
    const standardTypes = await prisma.activity.groupBy({
      by: ['activityType'],
      where: {
        activityType: { not: null }
      }
    });
    
    let subtypeUpdates = 0;
    
    for (const typeGroup of standardTypes) {
      const activityType = typeGroup.activityType;
      console.log(`\nProcessing ${activityType}...`);
      
      // Get all activities of this type
      const activities = await prisma.activity.findMany({
        where: {
          activityType: activityType
        },
        select: {
          id: true,
          name: true,
          subcategory: true,
          activitySubtype: true
        }
      });
      
      // Group by determined subtype to batch updates
      const subtypeGroups = {};
      
      for (const activity of activities) {
        const subtype = determineSubtype(activity, activityType);
        if (!subtypeGroups[subtype]) {
          subtypeGroups[subtype] = [];
        }
        subtypeGroups[subtype].push(activity.id);
      }
      
      // Batch update activities by subtype
      for (const [subtype, activityIds] of Object.entries(subtypeGroups)) {
        const result = await prisma.activity.updateMany({
          where: {
            id: { in: activityIds }
          },
          data: {
            activitySubtype: subtype
          }
        });
        
        if (result.count > 0) {
          console.log(`  ${subtype}: ${result.count} activities`);
          subtypeUpdates += result.count;
        }
      }
    }
    
    console.log(`\n✓ Assigned subtypes to ${subtypeUpdates} activities\n`);
    
    // Step 4: Verify the migration
    console.log('Verification Summary:');
    console.log('====================\n');
    
    const finalTypes = await prisma.activity.groupBy({
      by: ['activityType', 'activitySubtype'],
      where: {
        activityType: { not: null },
        isActive: true
      },
      _count: { id: true },
      orderBy: [
        { activityType: 'asc' },
        { _count: { id: 'desc' } }
      ]
    });
    
    let currentType = '';
    finalTypes.forEach(item => {
      if (item.activityType !== currentType) {
        currentType = item.activityType;
        console.log(`\n${currentType}:`);
      }
      console.log(`  - ${item.activitySubtype || 'Not assigned'}: ${item._count.id} activities`);
    });
    
    // Check for any activities without subtypes
    const withoutSubtype = await prisma.activity.count({
      where: {
        activityType: { not: null },
        activitySubtype: null,
        isActive: true
      }
    });
    
    if (withoutSubtype > 0) {
      console.log(`\n⚠️  Warning: ${withoutSubtype} activities still without subtypes`);
    } else {
      console.log('\n✅ All active activities have been assigned subtypes!');
    }
    
    // Final summary
    const totalActivities = await prisma.activity.count({
      where: { isActive: true }
    });
    const withType = await prisma.activity.count({
      where: {
        activityType: { not: null },
        isActive: true
      }
    });
    const withSubtype = await prisma.activity.count({
      where: {
        activitySubtype: { not: null },
        isActive: true
      }
    });
    
    console.log('\nFinal Statistics:');
    console.log(`  Total active activities: ${totalActivities}`);
    console.log(`  With activity type: ${withType} (${Math.round(withType/totalActivities*100)}%)`);
    console.log(`  With subtype: ${withSubtype} (${Math.round(withSubtype/totalActivities*100)}%)`);
    
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateActivityTypesAndSubtypes();