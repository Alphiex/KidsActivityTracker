/**
 * Script to link existing activities to ActivityType and ActivitySubtype tables
 * using proper foreign key relationships
 */

const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function linkActivitiesToTypes() {
  try {
    console.log('Starting to link activities to types and subtypes...\n');
    
    // Get all activity types and subtypes
    const activityTypes = await prisma.activityType.findMany({
      include: {
        subtypes: true
      }
    });
    
    // Create lookup maps
    const typeByName = new Map();
    const subtypeByNameAndType = new Map();
    
    activityTypes.forEach(type => {
      typeByName.set(type.name, type);
      type.subtypes.forEach(subtype => {
        const key = `${type.name}:${subtype.name}`;
        subtypeByNameAndType.set(key, subtype);
      });
    });
    
    // Process activities by analyzing their name, category, and subcategory
    const activities = await prisma.activity.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        name: true,
        category: true,
        subcategory: true
      }
    });
    
    console.log(`Processing ${activities.length} activities...\n`);
    
    let updatedCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      const updates = [];
      
      for (const activity of batch) {
        const result = determineTypeAndSubtype(activity, typeByName, subtypeByNameAndType);
        
        if (result.typeId || result.subtypeId) {
          updates.push({
            where: { id: activity.id },
            data: {
              activityTypeId: result.typeId,
              activitySubtypeId: result.subtypeId
            }
          });
        }
      }
      
      // Batch update
      if (updates.length > 0) {
        for (const update of updates) {
          await prisma.activity.update(update);
          updatedCount++;
        }
      }
      
      if ((i + batchSize) % 1000 === 0 || i + batchSize >= activities.length) {
        console.log(`Processed ${Math.min(i + batchSize, activities.length)} of ${activities.length} activities...`);
      }
    }
    
    console.log(`\n✅ Linked ${updatedCount} activities to types and subtypes`);
    
    // Verify the linking
    console.log('\nVerification:');
    const linkedActivities = await prisma.activity.count({
      where: {
        isActive: true,
        activityTypeId: { not: null }
      }
    });
    
    const withSubtype = await prisma.activity.count({
      where: {
        isActive: true,
        activitySubtypeId: { not: null }
      }
    });
    
    console.log(`  Activities with type: ${linkedActivities}`);
    console.log(`  Activities with subtype: ${withSubtype}`);
    
    // Show distribution
    console.log('\nActivity distribution by type:');
    for (const type of activityTypes) {
      const count = await prisma.activity.count({
        where: {
          activityTypeId: type.id,
          isActive: true
        }
      });
      
      if (count > 0) {
        console.log(`  ${type.name}: ${count} activities`);
      }
    }
    
  } catch (error) {
    console.error('Error linking activities:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function determineTypeAndSubtype(activity, typeByName, subtypeByNameAndType) {
  const name = (activity.name || '').toLowerCase();
  const category = (activity.category || '').toLowerCase();
  const subcategory = (activity.subcategory || '').toLowerCase();
  const combined = `${name} ${category} ${subcategory}`;
  
  let typeId = null;
  let subtypeId = null;
  let typeName = null;
  
  // First, try to determine the type based on subcategory or category patterns
  
  // Swimming activities
  if (subcategory.includes('swimming') || subcategory.includes('aquatic') || 
      category.includes('swimming') || name.includes('swim')) {
    typeName = 'Swimming & Aquatics';
  }
  // Dance activities
  else if (subcategory.includes('dance') || category.includes('dance') ||
           subcategory.includes('ballet') || subcategory.includes('jazz') ||
           subcategory.includes('hip hop') || subcategory.includes('tap')) {
    typeName = 'Dance';
  }
  // Martial Arts
  else if (subcategory.includes('martial') || category.includes('martial') ||
           combined.includes('karate') || combined.includes('taekwondo') ||
           combined.includes('judo') || combined.includes('kung fu') ||
           combined.includes('aikido') || combined.includes('self defense')) {
    typeName = 'Martial Arts';
  }
  // Music
  else if (subcategory.includes('music') || category.includes('music') ||
           combined.includes('piano') || combined.includes('guitar') ||
           combined.includes('violin') || combined.includes('drum') ||
           combined.includes('choir') || combined.includes('band')) {
    typeName = 'Music';
  }
  // Visual Arts
  else if ((subcategory.includes('art') && !subcategory.includes('martial')) ||
           subcategory.includes('craft') || subcategory.includes('paint') ||
           subcategory.includes('draw') || subcategory.includes('pottery')) {
    typeName = 'Visual Arts';
  }
  // Skating
  else if (subcategory.includes('skating') || subcategory.includes('hockey') ||
           category.includes('skating')) {
    typeName = 'Skating & Wheels';
  }
  // Gymnastics
  else if (subcategory.includes('gymnastics') || category.includes('gymnastics')) {
    typeName = 'Gymnastics & Movement';
  }
  // Camps
  else if (subcategory.includes('camp') || category.includes('camp')) {
    typeName = 'Camps';
  }
  // Tennis and Racquet Sports
  else if (combined.includes('tennis') || combined.includes('badminton') ||
           combined.includes('squash') || combined.includes('racquetball') ||
           combined.includes('pickleball')) {
    typeName = 'Racquet Sports';
  }
  // Team Sports
  else if (combined.includes('basketball') || combined.includes('soccer') ||
           combined.includes('volleyball') || combined.includes('baseball') ||
           combined.includes('softball') || combined.includes('football') ||
           combined.includes('lacrosse') || combined.includes('rugby')) {
    typeName = 'Team Sports';
  }
  // Individual Sports
  else if (combined.includes('track') || combined.includes('field') ||
           combined.includes('running') || combined.includes('golf') ||
           combined.includes('bowling') || combined.includes('archery')) {
    typeName = 'Individual Sports';
  }
  // Fitness
  else if (combined.includes('yoga') || combined.includes('pilates') ||
           combined.includes('fitness') || combined.includes('zumba')) {
    typeName = 'Fitness & Wellness';
  }
  // STEM
  else if (combined.includes('robot') || combined.includes('coding') ||
           combined.includes('science') || combined.includes('stem') ||
           combined.includes('minecraft') || combined.includes('lego')) {
    typeName = 'STEM & Education';
  }
  // Theatre/Drama
  else if (combined.includes('theatre') || combined.includes('theater') ||
           combined.includes('drama') || combined.includes('acting')) {
    typeName = 'Performing Arts';
  }
  // Sports (general)
  else if (subcategory.includes('sports') || category.includes('sports')) {
    typeName = 'Multi-Sport';
  }
  
  // Get the type ID
  if (typeName) {
    const type = typeByName.get(typeName);
    if (type) {
      typeId = type.id;
      
      // Now determine the subtype
      subtypeId = determineSubtypeForType(activity, typeName, type, subtypeByNameAndType);
    }
  }
  
  return { typeId, subtypeId };
}

function determineSubtypeForType(activity, typeName, type, subtypeByNameAndType) {
  const name = (activity.name || '').toLowerCase();
  const subcategory = (activity.subcategory || '').toLowerCase();
  const combined = `${name} ${subcategory}`;
  
  let subtypeName = null;
  
  switch (typeName) {
    case 'Swimming & Aquatics':
      if (combined.includes('learn to swim') || combined.includes('lessons')) subtypeName = 'Learn to Swim';
      else if (combined.includes('competitive')) subtypeName = 'Competitive Swimming';
      else if (combined.includes('diving')) subtypeName = 'Diving';
      else if (combined.includes('water polo')) subtypeName = 'Water Polo';
      else if (combined.includes('synchronized')) subtypeName = 'Synchronized Swimming';
      else if (combined.includes('aqua fit')) subtypeName = 'Aqua Fitness';
      else if (combined.includes('lifeguard')) subtypeName = 'Lifeguarding';
      else subtypeName = 'Learn to Swim'; // Default
      break;
      
    case 'Team Sports':
      if (combined.includes('basketball')) subtypeName = 'Basketball';
      else if (combined.includes('soccer')) subtypeName = 'Soccer';
      else if (combined.includes('volleyball')) subtypeName = 'Volleyball';
      else if (combined.includes('baseball')) subtypeName = 'Baseball';
      else if (combined.includes('softball')) subtypeName = 'Softball';
      else if (combined.includes('hockey') && !combined.includes('floor')) subtypeName = 'Hockey';
      else if (combined.includes('floor hockey')) subtypeName = 'Floor Hockey';
      else if (combined.includes('football')) subtypeName = 'Football';
      else if (combined.includes('lacrosse')) subtypeName = 'Lacrosse';
      else if (combined.includes('rugby')) subtypeName = 'Rugby';
      else if (combined.includes('cricket')) subtypeName = 'Cricket';
      else subtypeName = 'Other Team Sports';
      break;
      
    case 'Racquet Sports':
      if (combined.includes('tennis') && !combined.includes('table')) subtypeName = 'Tennis';
      else if (combined.includes('badminton')) subtypeName = 'Badminton';
      else if (combined.includes('squash')) subtypeName = 'Squash';
      else if (combined.includes('racquetball')) subtypeName = 'Racquetball';
      else if (combined.includes('pickleball')) subtypeName = 'Pickleball';
      else if (combined.includes('table tennis') || combined.includes('ping pong')) subtypeName = 'Table Tennis';
      else subtypeName = 'Tennis'; // Default for racquet sports
      break;
      
    case 'Martial Arts':
      if (combined.includes('karate')) subtypeName = 'Karate';
      else if (combined.includes('taekwondo')) subtypeName = 'Taekwondo';
      else if (combined.includes('judo')) subtypeName = 'Judo';
      else if (combined.includes('jiu') || combined.includes('jitsu')) subtypeName = 'Jiu-Jitsu';
      else if (combined.includes('kung fu')) subtypeName = 'Kung Fu';
      else if (combined.includes('aikido')) subtypeName = 'Aikido';
      else if (combined.includes('boxing') && !combined.includes('kick')) subtypeName = 'Boxing';
      else if (combined.includes('kickbox')) subtypeName = 'Kickboxing';
      else if (combined.includes('self defense')) subtypeName = 'Self Defense';
      else subtypeName = 'Mixed Martial Arts';
      break;
      
    case 'Dance':
      if (combined.includes('ballet')) subtypeName = 'Ballet';
      else if (combined.includes('jazz')) subtypeName = 'Jazz';
      else if (combined.includes('tap')) subtypeName = 'Tap';
      else if (combined.includes('hip hop')) subtypeName = 'Hip Hop';
      else if (combined.includes('contemporary')) subtypeName = 'Contemporary';
      else if (combined.includes('modern')) subtypeName = 'Modern';
      else if (combined.includes('ballroom')) subtypeName = 'Ballroom';
      else if (combined.includes('latin')) subtypeName = 'Latin';
      else if (combined.includes('salsa')) subtypeName = 'Salsa';
      else if (combined.includes('bollywood')) subtypeName = 'Bollywood';
      else if (combined.includes('irish')) subtypeName = 'Irish';
      else if (combined.includes('african')) subtypeName = 'African';
      else if (combined.includes('break')) subtypeName = 'Breakdancing';
      else if (combined.includes('creative')) subtypeName = 'Creative Movement';
      else subtypeName = 'Other Dance';
      break;
      
    case 'Music':
      if (combined.includes('piano')) subtypeName = 'Piano';
      else if (combined.includes('guitar')) subtypeName = 'Guitar';
      else if (combined.includes('violin')) subtypeName = 'Violin';
      else if (combined.includes('drum')) subtypeName = 'Drums';
      else if (combined.includes('voice') || combined.includes('sing')) subtypeName = 'Voice/Singing';
      else if (combined.includes('band')) subtypeName = 'Band';
      else if (combined.includes('orchestra')) subtypeName = 'Orchestra';
      else if (combined.includes('choir')) subtypeName = 'Choir';
      else if (combined.includes('ukulele')) subtypeName = 'Ukulele';
      else subtypeName = 'Other Music';
      break;
      
    case 'Visual Arts':
      if (combined.includes('paint')) subtypeName = 'Painting';
      else if (combined.includes('draw')) subtypeName = 'Drawing';
      else if (combined.includes('sculpt')) subtypeName = 'Sculpture';
      else if (combined.includes('pottery')) subtypeName = 'Pottery';
      else if (combined.includes('ceramic')) subtypeName = 'Ceramics';
      else if (combined.includes('photo')) subtypeName = 'Photography';
      else if (combined.includes('digital')) subtypeName = 'Digital Art';
      else if (combined.includes('craft')) subtypeName = 'Crafts';
      else if (combined.includes('jewelry')) subtypeName = 'Jewelry Making';
      else subtypeName = 'Other Visual Arts';
      break;
      
    case 'Skating & Wheels':
      if (combined.includes('ice skat') || (combined.includes('skat') && !combined.includes('roller'))) subtypeName = 'Ice Skating';
      else if (combined.includes('figure')) subtypeName = 'Figure Skating';
      else if (combined.includes('hockey')) subtypeName = 'Hockey'; // Ice hockey in skating context
      else if (combined.includes('speed')) subtypeName = 'Speed Skating';
      else if (combined.includes('roller')) subtypeName = 'Roller Skating';
      else if (combined.includes('inline') || combined.includes('rollerblade')) subtypeName = 'Inline Skating';
      else if (combined.includes('skateboard')) subtypeName = 'Skateboarding';
      else subtypeName = 'Ice Skating'; // Default
      break;
      
    case 'Gymnastics & Movement':
      if (combined.includes('artistic')) subtypeName = 'Artistic Gymnastics';
      else if (combined.includes('rhythmic')) subtypeName = 'Rhythmic Gymnastics';
      else if (combined.includes('trampoline')) subtypeName = 'Trampoline';
      else if (combined.includes('tumbling')) subtypeName = 'Tumbling';
      else if (combined.includes('parkour')) subtypeName = 'Parkour';
      else if (combined.includes('ninja')) subtypeName = 'Ninja Training';
      else if (combined.includes('cheer')) subtypeName = 'Cheerleading';
      else subtypeName = 'Artistic Gymnastics'; // Default
      break;
      
    case 'Camps':
      if (combined.includes('day camp')) subtypeName = 'Day Camp';
      else if (combined.includes('sport')) subtypeName = 'Sports Camp';
      else if (combined.includes('art')) subtypeName = 'Arts Camp';
      else if (combined.includes('science')) subtypeName = 'Science Camp';
      else if (combined.includes('tech') || combined.includes('coding')) subtypeName = 'Tech Camp';
      else if (combined.includes('outdoor')) subtypeName = 'Outdoor Camp';
      else if (combined.includes('march break')) subtypeName = 'March Break Camp';
      else if (combined.includes('winter')) subtypeName = 'Winter Camp';
      else if (combined.includes('summer')) subtypeName = 'Summer Camp';
      else subtypeName = 'Day Camp'; // Default
      break;
      
    default:
      // For other types, try to find a matching subtype
      const subtypes = type.subtypes || [];
      for (const subtype of subtypes) {
        if (combined.includes(subtype.name.toLowerCase())) {
          subtypeName = subtype.name;
          break;
        }
      }
      if (!subtypeName && subtypes.length > 0) {
        // Find the "Other" subtype or use the first one
        const otherSubtype = subtypes.find(s => s.name.includes('Other'));
        subtypeName = otherSubtype ? otherSubtype.name : subtypes[0].name;
      }
  }
  
  // Get the subtype ID
  if (subtypeName) {
    const key = `${typeName}:${subtypeName}`;
    const subtype = subtypeByNameAndType.get(key);
    return subtype ? subtype.id : null;
  }
  
  return null;
}

// Run the linking
linkActivitiesToTypes();