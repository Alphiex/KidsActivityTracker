const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function fixActivityTypes() {
  console.log('Starting direct activity type assignment...');
  
  try {
    // Get all activity types
    const types = await prisma.activityType.findMany();
    const typeMap = {};
    types.forEach(t => {
      typeMap[t.code] = t.id;
    });
    
    // Get all activity subtypes  
    const subtypes = await prisma.activitySubtype.findMany();
    const subtypeMap = {};
    subtypes.forEach(s => {
      subtypeMap[s.code] = s.id;
    });
    
    // Map based on subcategory and name patterns
    const mappingRules = [
      { pattern: /swimming|swim|aquatic/i, typeId: typeMap['swimming-aquatics'], subtypeCode: 'swimming-lessons' },
      { pattern: /soccer|basketball|volleyball|baseball|hockey/i, typeId: typeMap['team-sports'], subtypeCode: 'mixed' },
      { pattern: /tennis|badminton|squash|racquet/i, typeId: typeMap['racquet-sports'], subtypeCode: 'tennis' },
      { pattern: /martial arts|karate|taekwondo|judo|kung/i, typeId: typeMap['martial-arts'], subtypeCode: 'mixed-martial-arts' },
      { pattern: /dance|ballet|jazz|hip hop|tap/i, typeId: typeMap['dance'], subtypeCode: 'general-dance' },
      { pattern: /pottery|painting|drawing|visual|art|craft/i, typeId: typeMap['visual-arts'], subtypeCode: 'mixed-media' },
      { pattern: /music|piano|guitar|singing|choir/i, typeId: typeMap['music'], subtypeCode: 'general-music' },
      { pattern: /drama|theatre|acting/i, typeId: typeMap['performing-arts'], subtypeCode: 'drama' },
      { pattern: /skate|skating|hockey/i, typeId: typeMap['skating-wheels'], subtypeCode: 'ice-skating' },
      { pattern: /gymnastics|tumbling|acro/i, typeId: typeMap['gymnastics-movement'], subtypeCode: 'gymnastics' },
      { pattern: /camp|day camp/i, typeId: typeMap['camps'], subtypeCode: 'day-camps' },
      { pattern: /science|stem|coding|robot/i, typeId: typeMap['stem-education'], subtypeCode: 'science' },
      { pattern: /fitness|yoga|pilates|workout/i, typeId: typeMap['fitness-wellness'], subtypeCode: 'general-fitness' },
      { pattern: /outdoor|hiking|climbing|adventure/i, typeId: typeMap['outdoor-adventure'], subtypeCode: 'outdoor-exploration' },
      { pattern: /cooking|culinary|baking/i, typeId: typeMap['culinary-arts'], subtypeCode: 'cooking' },
      { pattern: /learn|play|general program/i, typeId: typeMap['early-development'], subtypeCode: 'play-based-learning' }
    ];
    
    // Process activities in batches
    const batchSize = 100;
    let processed = 0;
    let hasMore = true;
    
    while (hasMore) {
      const activities = await prisma.activity.findMany({
        where: { 
          activityTypeId: null,
          isActive: true 
        },
        take: batchSize,
        select: {
          id: true,
          name: true,
          category: true,
          subcategory: true
        }
      });
      
      if (activities.length === 0) {
        hasMore = false;
        break;
      }
      
      for (const activity of activities) {
        const searchText = `${activity.name} ${activity.subcategory || ''} ${activity.category}`.toLowerCase();
        
        let typeId = null;
        let subtypeId = null;
        
        // Find matching rule
        for (const rule of mappingRules) {
          if (rule.pattern.test(searchText)) {
            typeId = rule.typeId;
            subtypeId = subtypeMap[rule.subtypeCode] || null;
            break;
          }
        }
        
        // Default to 'other-activity' if no match
        if (!typeId) {
          typeId = typeMap['other-activity'];
          subtypeId = subtypeMap['other'] || null;
        }
        
        // Update the activity
        if (typeId) {
          await prisma.activity.update({
            where: { id: activity.id },
            data: { 
              activityTypeId: typeId,
              activitySubtypeId: subtypeId
            }
          });
          processed++;
        }
      }
      
      console.log(`Processed ${processed} activities...`);
    }
    
    // Final statistics
    const stats = {
      total: await prisma.activity.count({ where: { isActive: true } }),
      withType: await prisma.activity.count({ 
        where: { 
          isActive: true,
          activityTypeId: { not: null } 
        } 
      }),
      withSubtype: await prisma.activity.count({ 
        where: { 
          isActive: true,
          activitySubtypeId: { not: null } 
        } 
      })
    };
    
    console.log('\n✅ Activity type assignment complete!');
    console.log('Statistics:');
    console.log(`  Total activities: ${stats.total}`);
    console.log(`  With type assigned: ${stats.withType} (${Math.round(stats.withType/stats.total*100)}%)`);
    console.log(`  With subtype assigned: ${stats.withSubtype} (${Math.round(stats.withSubtype/stats.total*100)}%)`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixActivityTypes();