const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function mapAllActivities() {
  console.log('Starting comprehensive activity mapping...\n');
  
  // Get all activity types and subtypes for reference
  const activityTypes = await prisma.activityType.findMany({
    include: { subtypes: true }
  });
  
  // Create lookup maps
  const typeMap = new Map();
  const subtypeMap = new Map();
  
  activityTypes.forEach(type => {
    typeMap.set(type.code, type);
    typeMap.set(type.name.toLowerCase(), type);
    type.subtypes.forEach(subtype => {
      subtypeMap.set(`${type.code}:${subtype.code}`, subtype);
      subtypeMap.set(`${type.name.toLowerCase()}:${subtype.name.toLowerCase()}`, subtype);
    });
  });

  // Define comprehensive mapping rules
  const mappingRules = [
    // Skating and Ice Sports  
    { 
      match: (a) => a.subcategory?.includes('Skate') || a.name?.includes('Skating') || a.name?.includes('Figure Skating'),
      typeCode: 'skating-wheels',
      getSubtype: (a) => {
        if (a.name?.includes('Figure') || a.subcategory?.includes('Figure')) return 'figure-skating';
        if (a.name?.includes('Hockey') || a.subcategory?.includes('Hockey')) return 'ice-hockey';
        if (a.name?.includes('Speed') || a.subcategory?.includes('Speed')) return 'speed-skating';
        return 'ice-skating';
      }
    },
    
    // Climbing
    {
      match: (a) => a.category === 'Climbing' || a.subcategory?.includes('Climbing') || a.name?.includes('Climbing'),
      typeCode: 'outdoor-adventure',
      getSubtype: (a) => {
        if (a.name?.includes('Bouldering')) return 'bouldering';
        return 'rock-climbing';
      }
    },
    
    // Cooking and Culinary
    {
      match: (a) => a.category === 'Cooking' || a.subcategory?.includes('Cooking') || 
                    a.name?.includes('Chef') || a.name?.includes('Kitchen') || a.name?.includes('Culinary') ||
                    a.name?.includes('Baking'),
      typeCode: 'culinary-arts',
      getSubtype: (a) => {
        if (a.name?.includes('Baking')) return 'baking';
        return 'cooking';
      }
    },
    
    // Preschool and Early Education
    {
      match: (a) => a.subcategory?.includes('Preschool') || a.name?.includes('Preschool'),
      typeCode: 'early-development',
      getSubtype: () => 'preschool'
    },
    
    // Babysitting and Leadership
    {
      match: (a) => a.name?.includes('Babysitter') || a.name?.includes('Home Alone') || 
                    a.subcategory?.includes('Leadership') || a.subcategory?.includes('Certifications'),
      typeCode: 'life-skills-leadership',
      getSubtype: (a) => {
        if (a.name?.includes('Babysitter')) return 'babysitting';
        if (a.name?.includes('Home Alone')) return 'safety-skills';
        return 'leadership';
      }
    },
    
    // Kids Night Out and Special Events
    {
      match: (a) => a.category === 'Kids Night Out' || a.name?.includes('Night Out'),
      typeCode: 'camps',
      getSubtype: () => 'special-programs'
    },
    
    // Arts and Crafts
    {
      match: (a) => a.name?.includes('Art') || a.name?.includes('Clay') || a.name?.includes('Canvas') ||
                    a.name?.includes('Paint') || a.name?.includes('Draw') || a.name?.includes('Craft') ||
                    a.subcategory?.includes('Mixed Media') || a.name?.includes('Creature') || 
                    a.name?.includes('Creative'),
      typeCode: 'visual-arts',
      getSubtype: (a) => {
        if (a.name?.includes('Clay') || a.name?.includes('Pottery')) return 'pottery-ceramics';
        if (a.name?.includes('Paint') || a.name?.includes('Watercolour')) return 'painting';
        if (a.name?.includes('Draw')) return 'drawing';
        if (a.name?.includes('Craft')) return 'crafts';
        return 'mixed-media';
      }
    },
    
    // Building and Construction
    {
      match: (a) => a.name?.includes('Builder') || a.name?.includes('Lego') || a.name?.includes('Construction') ||
                    a.name?.includes('Einstein'),
      typeCode: 'stem-education',
      getSubtype: () => 'stem'
    },
    
    // Learn & Play Programs
    {
      match: (a) => a.subcategory === 'Learn & Play' || a.name?.includes('Learn & Play'),
      typeCode: 'early-development',
      getSubtype: () => 'parent-tot'
    },
    
    // Toddler Programs
    {
      match: (a) => a.name?.includes('Toddler') || a.name?.includes('Kids Club'),
      typeCode: 'early-development',
      getSubtype: () => 'parent-tot'
    },
    
    // Spin/Cycling Classes
    {
      match: (a) => a.subcategory === 'Spin' || a.name?.includes('Spin') || a.name?.includes('Cycling'),
      typeCode: 'fitness-wellness',
      getSubtype: () => 'cycling-spin'
    },
    
    // General Fitness
    {
      match: (a) => a.category?.includes('Fitness') || a.name?.includes('Fitness') || 
                    a.name?.includes('Workout') || a.name?.includes('Exercise') || a.name?.includes('Bodyweight'),
      typeCode: 'fitness-wellness',
      getSubtype: () => 'general-fitness'
    },
    
    // Dance (for any missed dance activities)
    {
      match: (a) => a.name?.includes('Dance') || a.name?.includes('Ballet') || 
                    a.name?.includes('Hip Hop') || a.name?.includes('Jazz'),
      typeCode: 'dance',
      getSubtype: (a) => {
        if (a.name?.includes('Ballet')) return 'ballet';
        if (a.name?.includes('Hip Hop')) return 'hip-hop';
        if (a.name?.includes('Jazz')) return 'jazz';
        if (a.name?.includes('Tap')) return 'tap';
        if (a.name?.includes('Contemporary')) return 'contemporary';
        return 'general-dance';
      }
    },
    
    // Gymnastics (for any missed)
    {
      match: (a) => a.name?.includes('Gymnastics') || a.name?.includes('Tumbling'),
      typeCode: 'gymnastics-movement',
      getSubtype: (a) => {
        if (a.name?.includes('Rhythmic')) return 'rhythmic';
        if (a.name?.includes('Trampoline')) return 'trampoline';
        if (a.name?.includes('Tumbling')) return 'tumbling';
        return 'artistic';
      }
    },
    
    // Music (for any missed)
    {
      match: (a) => a.name?.includes('Music') || a.name?.includes('Piano') || 
                    a.name?.includes('Guitar') || a.name?.includes('Drum') || a.name?.includes('Sing'),
      typeCode: 'music',
      getSubtype: (a) => {
        if (a.name?.includes('Piano')) return 'piano';
        if (a.name?.includes('Guitar')) return 'guitar';
        if (a.name?.includes('Drum')) return 'drums';
        if (a.name?.includes('Sing') || a.name?.includes('Voice')) return 'voice';
        return 'general-music';
      }
    },
    
    // Camps
    {
      match: (a) => a.name?.includes('Camp') || a.category?.includes('Camp'),
      typeCode: 'camps',
      getSubtype: (a) => {
        if (a.name?.includes('Winter')) return 'holiday-camps';
        if (a.name?.includes('Pro D')) return 'day-camps';
        if (a.name?.includes('Summer')) return 'summer-camps';
        return 'day-camps';
      }
    },
    
    // Multi-sport Programs
    {
      match: (a) => a.name?.includes('Multisport') || a.name?.includes('FUNdamentals'),
      typeCode: 'multi-sport',
      getSubtype: () => 'multi-sport-programs'
    },
    
    // Swimming Safety Programs
    {
      match: (a) => a.name?.includes('Bronze') && (a.name?.includes('Star') || a.name?.includes('Cross') || 
                    a.name?.includes('Medallion')),
      typeCode: 'swimming-aquatics',
      getSubtype: () => 'lifeguarding'
    },
    
    // School Programs
    {
      match: (a) => a.subcategory?.includes('School Programs') || a.name?.includes('Buddies'),
      typeCode: 'camps',
      getSubtype: () => 'after-school'
    },
    
    // Youth Programs
    {
      match: (a) => a.name?.includes('Youth Centre'),
      typeCode: 'life-skills-leadership',
      getSubtype: () => 'youth-programs'
    },
    
    // Default mapping for General Programs
    {
      match: (a) => a.subcategory === 'General Programs' || !a.subcategory,
      typeCode: 'other-activity',
      getSubtype: () => 'general'
    }
  ];

  // Process unmapped activities
  const unmappedActivities = await prisma.activity.findMany({
    where: {
      isActive: true,
      activityTypeId: null
    }
  });

  console.log(`Found ${unmappedActivities.length} unmapped activities\n`);

  let mapped = 0;
  let failed = 0;
  const updates = [];

  for (const activity of unmappedActivities) {
    let typeCode = null;
    let subtypeCode = null;
    
    // Apply mapping rules
    for (const rule of mappingRules) {
      if (rule.match(activity)) {
        typeCode = rule.typeCode;
        subtypeCode = rule.getSubtype(activity);
        break;
      }
    }
    
    if (!typeCode) {
      console.log(`❌ Could not map: ${activity.name} (${activity.category}/${activity.subcategory})`);
      failed++;
      continue;
    }
    
    // Look up the type and subtype
    const activityType = typeMap.get(typeCode);
    if (!activityType) {
      console.log(`❌ Type not found: ${typeCode} for ${activity.name}`);
      failed++;
      continue;
    }
    
    const subtypeKey = `${typeCode}:${subtypeCode}`;
    let activitySubtype = subtypeMap.get(subtypeKey);
    
    // If subtype not found, try to find it in the type's subtypes
    if (!activitySubtype) {
      activitySubtype = activityType.subtypes.find(s => s.code === subtypeCode);
    }
    
    // If still not found, use a general/other subtype
    if (!activitySubtype) {
      activitySubtype = activityType.subtypes.find(s => 
        s.code.includes('other') || s.code.includes('general')
      );
    }
    
    if (activityType && activitySubtype) {
      updates.push({
        id: activity.id,
        activityTypeId: activityType.id,
        activitySubtypeId: activitySubtype.id
      });
      mapped++;
    } else {
      console.log(`❌ Subtype not found: ${subtypeCode} for ${activity.name}`);
      failed++;
    }
  }

  // Batch update activities
  console.log(`\nMapping ${updates.length} activities...`);
  
  for (const update of updates) {
    await prisma.activity.update({
      where: { id: update.id },
      data: {
        activityTypeId: update.activityTypeId,
        activitySubtypeId: update.activitySubtypeId
      }
    });
  }

  console.log('\n=== Mapping Complete ===');
  console.log(`✅ Successfully mapped: ${mapped}`);
  console.log(`❌ Failed to map: ${failed}`);
  
  // Final verification
  const stillUnmapped = await prisma.activity.count({
    where: {
      isActive: true,
      activityTypeId: null
    }
  });
  
  console.log(`\n📊 Remaining unmapped activities: ${stillUnmapped}`);
  
  // Show updated statistics
  const typeStats = await prisma.activityType.findMany({
    include: {
      _count: {
        select: {
          activities: {
            where: { isActive: true }
          }
        }
      }
    },
    orderBy: { displayOrder: 'asc' }
  });
  
  console.log('\n📈 Updated Activity Type Counts:');
  for (const type of typeStats) {
    if (type._count.activities > 0) {
      console.log(`  ${type.name}: ${type._count.activities} activities`);
    }
  }
}

mapAllActivities()
  .then(() => {
    console.log('\n✅ Comprehensive mapping completed successfully!');
  })
  .catch((error) => {
    console.error('❌ Error during mapping:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });