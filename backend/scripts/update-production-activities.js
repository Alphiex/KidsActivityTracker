const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function updateProductionActivities() {
  console.log('Updating production activities with proper types and subtypes...\n');
  
  try {
    // First, populate activityType string field based on subcategory patterns
    const mappingRules = [
      // Team Sports
      { keywords: ['Basketball', 'Soccer', 'Baseball', 'Hockey', 'Volleyball', 'Softball', 'Football', 'Lacrosse', 'Rugby'], type: 'Team Sports' },
      
      // Racquet Sports
      { keywords: ['Tennis', 'Badminton', 'Squash', 'Table Tennis', 'Pickleball', 'Racquetball'], type: 'Racquet Sports' },
      
      // Martial Arts
      { keywords: ['Martial Arts', 'Karate', 'Taekwondo', 'Judo', 'Kung Fu', 'Self Defense', 'Aikido', 'Boxing', 'Kickboxing', 'Jiu-Jitsu', 'MMA'], type: 'Martial Arts' },
      
      // Dance
      { keywords: ['Dance', 'Ballet', 'Hip Hop', 'Jazz', 'Tap', 'Contemporary', 'Bollywood', 'Ballroom', 'Modern', 'Lyrical', 'Breakdance'], type: 'Dance' },
      
      // Swimming & Aquatics
      { keywords: ['Swimming', 'Swim', 'Aqua', 'Water Safety', 'Lifeguard', 'Bronze', 'Diving', 'Synchronized', 'Water Polo'], type: 'Swimming & Aquatics' },
      
      // Gymnastics & Movement
      { keywords: ['Gymnastics', 'Tumbling', 'Parkour', 'Ninja', 'Movement', 'Acrobatics', 'Trampoline', 'Rhythmic'], type: 'Gymnastics & Movement' },
      
      // Visual Arts
      { keywords: ['Art', 'Paint', 'Draw', 'Clay', 'Craft', 'Creative', 'Canvas', 'Pottery', 'Sculpture', 'Mixed Media'], type: 'Visual Arts' },
      
      // Music
      { keywords: ['Music', 'Piano', 'Guitar', 'Drum', 'Sing', 'Voice', 'Violin', 'Band', 'Orchestra', 'Choir'], type: 'Music' },
      
      // STEM Education
      { keywords: ['Science', 'STEM', 'Robotics', 'Coding', 'Engineering', 'Math', 'Lego', 'Builder', 'Technology', 'Computer'], type: 'STEM & Technology' },
      
      // Skating
      { keywords: ['Skating', 'Figure Skating', 'Speed Skating', 'Ice Skating', 'Roller', 'Skateboard', 'Inline'], type: 'Skating & Wheels' },
      
      // Outdoor Adventure
      { keywords: ['Climbing', 'Rock Climbing', 'Bouldering', 'Outdoor', 'Adventure', 'Hiking', 'Camping', 'Nature'], type: 'Outdoor & Adventure' },
      
      // Fitness & Wellness
      { keywords: ['Fitness', 'Yoga', 'Pilates', 'Workout', 'Exercise', 'Spin', 'Cycling', 'Strength', 'Cardio', 'Zumba'], type: 'Fitness & Wellness' },
      
      // Drama & Theatre
      { keywords: ['Drama', 'Theatre', 'Acting', 'Musical Theatre', 'Improv', 'Performance', 'Stage'], type: 'Performing Arts' },
      
      // Life Skills
      { keywords: ['Babysitter', 'Home Alone', 'Leadership', 'First Aid', 'Safety', 'Life Skills'], type: 'Life Skills & Leadership' },
      
      // Camps
      { keywords: ['Camp', 'Pro D Day', 'Spring Break', 'Winter Break', 'Summer Camp', 'Day Camp', 'Holiday'], type: 'Camps' },
      
      // Early Development
      { keywords: ['Preschool', 'Toddler', 'Parent & Tot', 'Early Years', 'Kindergym', 'Little'], type: 'Early Development' },
      
      // Multi-Sport
      { keywords: ['Multisport', 'FUNdamentals', 'All Sports', 'Sport Sampler'], type: 'Multi-Sport' },
      
      // Individual Sports
      { keywords: ['Golf', 'Track', 'Cross Country', 'Running', 'Athletics'], type: 'Individual Sports' },
      
      // Winter Sports
      { keywords: ['Ski', 'Snowboard', 'Winter Sports', 'Alpine', 'Nordic'], type: 'Winter Sports' },
      
      // Culinary Arts
      { keywords: ['Cooking', 'Baking', 'Chef', 'Culinary', 'Kitchen', 'Food'], type: 'Culinary Arts' },
    ];
    
    let totalUpdated = 0;
    
    // Process each mapping rule
    for (const rule of mappingRules) {
      for (const keyword of rule.keywords) {
        const result = await prisma.$executeRawUnsafe(`
          UPDATE "Activity"
          SET "activityType" = $1,
              "activitySubtype" = CASE 
                WHEN "subcategory" IS NOT NULL THEN "subcategory"
                ELSE $2
              END
          WHERE ("name" ILIKE '%' || $2 || '%' OR "subcategory" ILIKE '%' || $2 || '%')
          AND "isActive" = true
          AND ("activityType" IS NULL OR "activityType" = '')
        `, rule.type, keyword);
        
        if (result > 0) {
          console.log(`Updated ${result} activities with keyword "${keyword}" to type: ${rule.type}`);
          totalUpdated += result;
        }
      }
    }
    
    // Now link to ActivityType and ActivitySubtype tables
    console.log('\nLinking activities to type and subtype tables...');
    
    // Get all activity types
    const activityTypes = await prisma.activityType.findMany({
      include: { subtypes: true }
    });
    
    const typeMap = new Map();
    const subtypeMap = new Map();
    
    activityTypes.forEach(type => {
      typeMap.set(type.name, type);
      type.subtypes.forEach(subtype => {
        subtypeMap.set(`${type.name}:${subtype.name}`, subtype);
      });
    });
    
    // Update activities with foreign keys
    const activitiesToUpdate = await prisma.$queryRaw`
      SELECT id, "activityType", "activitySubtype"
      FROM "Activity"
      WHERE "activityType" IS NOT NULL
      AND "activityTypeId" IS NULL
      AND "isActive" = true
    `;
    
    console.log(`Found ${activitiesToUpdate.length} activities to link to type tables`);
    
    let linkedCount = 0;
    for (const activity of activitiesToUpdate) {
      const activityType = typeMap.get(activity.activityType);
      if (activityType) {
        const updateData = {
          activityTypeId: activityType.id
        };
        
        // Try to find matching subtype
        if (activity.activitySubtype) {
          const subtypeKey = `${activity.activityType}:${activity.activitySubtype}`;
          let subtype = subtypeMap.get(subtypeKey);
          
          // If exact match not found, try to find a close match
          if (!subtype) {
            const possibleSubtype = activityType.subtypes.find(s => 
              s.name.toLowerCase().includes(activity.activitySubtype.toLowerCase()) ||
              activity.activitySubtype.toLowerCase().includes(s.name.toLowerCase())
            );
            if (possibleSubtype) {
              subtype = possibleSubtype;
            }
          }
          
          // If still not found, use a general subtype
          if (!subtype) {
            subtype = activityType.subtypes.find(s => 
              s.code.includes('general') || s.code.includes('other')
            );
          }
          
          if (subtype) {
            updateData.activitySubtypeId = subtype.id;
          }
        }
        
        await prisma.activity.update({
          where: { id: activity.id },
          data: updateData
        });
        
        linkedCount++;
        if (linkedCount % 100 === 0) {
          console.log(`Linked ${linkedCount} activities...`);
        }
      }
    }
    
    console.log(`\n✅ Successfully linked ${linkedCount} activities to type tables`);
    
    // Final statistics
    const stats = await prisma.$queryRaw`
      SELECT "activityType", COUNT(*) as count
      FROM "Activity"
      WHERE "isActive" = true
      AND "activityType" IS NOT NULL
      GROUP BY "activityType"
      ORDER BY count DESC
    `;
    
    console.log('\n📊 Final activity type distribution:');
    stats.forEach(s => {
      console.log(`  ${s.activityType}: ${s.count} activities`);
    });
    
    // Check coverage
    const total = await prisma.activity.count({ where: { isActive: true } });
    const withTypeResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Activity"
      WHERE "isActive" = true
      AND "activityType" IS NOT NULL
    `;
    const withType = Number(withTypeResult[0].count);
    
    const withTypeIdResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Activity"
      WHERE "isActive" = true
      AND "activityTypeId" IS NOT NULL
    `;
    const withTypeId = Number(withTypeIdResult[0].count);
    
    console.log(`\n📈 Coverage Statistics:`);
    console.log(`  Total active activities: ${total}`);
    console.log(`  With activityType field: ${withType} (${(withType/total*100).toFixed(1)}%)`);
    console.log(`  With activityTypeId foreign key: ${withTypeId} (${(withTypeId/total*100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('❌ Error updating activities:', error);
    throw error;
  }
}

updateProductionActivities()
  .then(() => {
    console.log('\n✅ Production activities updated successfully!');
  })
  .catch((error) => {
    console.error('❌ Failed to update production activities:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });