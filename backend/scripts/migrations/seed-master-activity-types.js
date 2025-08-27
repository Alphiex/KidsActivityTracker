const { PrismaClient } = require('./generated/prisma');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seedMasterActivityTypes() {
  try {
    console.log('🌱 Seeding Activity Types from ACTIVITY_TYPES_MASTER_LIST.json...\n');
    
    // Read the master list
    const masterListPath = path.join(__dirname, '..', 'ACTIVITY_TYPES_MASTER_LIST.json');
    const masterList = JSON.parse(fs.readFileSync(masterListPath, 'utf-8'));
    
    // Clear existing activity types and subtypes (but keep activities)
    console.log('Clearing existing activity types and subtypes...');
    await prisma.activitySubtype.deleteMany({});
    await prisma.activityType.deleteMany({});
    
    let typeCount = 0;
    let subtypeCount = 0;
    
    // Process each activity type
    for (let i = 0; i < masterList.activityTypes.length; i++) {
      const typeData = masterList.activityTypes[i];
      
      // Create the activity type
      const activityType = await prisma.activityType.create({
        data: {
          code: typeData.type.toLowerCase()
            .replace(/\s+&\s+/g, '-')
            .replace(/\s+-\s+/g, '-')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, ''),
          name: typeData.type,
          description: typeData.description,
          displayOrder: i + 1
        }
      });
      
      console.log(`✅ Created activity type: ${typeData.type}`);
      typeCount++;
      
      // Create subtypes for this activity type
      if (typeData.subtypes && typeData.subtypes.length > 0) {
        for (const subtypeName of typeData.subtypes) {
          const subtypeCode = `${typeData.type.toLowerCase().replace(/[^a-z]/g, '')}-${subtypeName.toLowerCase()
            .replace(/\s+&\s+/g, '-')
            .replace(/\s+-\s+/g, '-')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')}`;
            
          try {
            await prisma.activitySubtype.create({
              data: {
                code: subtypeCode,
                name: subtypeName,
                activityType: {
                  connect: { id: activityType.id }
                },
                description: `${subtypeName} activities`
              }
            });
            subtypeCount++;
          } catch (err) {
            if (err.code !== 'P2002') { // Ignore unique constraint errors
              throw err;
            }
          }
        }
        console.log(`   Added ${typeData.subtypes.length} subtypes`);
      }
    }
    
    console.log(`\n✅ Successfully created ${typeCount} activity types and ${subtypeCount} subtypes!`);
    
    // Now link existing activities to these types
    console.log('\n🔗 Linking existing activities to activity types...\n');
    
    const activities = await prisma.activity.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        subcategory: true,
        category: true,
        activityType: true,
        activitySubtype: true
      }
    });
    
    console.log(`Found ${activities.length} activities to process...`);
    
    // Get all activity types and subtypes for matching
    const allTypes = await prisma.activityType.findMany({
      include: { subtypes: true }
    });
    
    // Create mapping for easier lookup
    const typeMap = {};
    const subtypeMap = {};
    
    allTypes.forEach(type => {
      typeMap[type.name.toLowerCase()] = type.name;
      type.subtypes.forEach(subtype => {
        subtypeMap[subtype.name.toLowerCase()] = {
          type: type.name,
          subtype: subtype.name
        };
      });
    });
    
    let updatedCount = 0;
    const updateBatch = [];
    
    for (const activity of activities) {
      let newType = activity.activityType;
      let newSubtype = activity.activitySubtype;
      
      // Try to match based on name or subcategory
      const nameLower = activity.name.toLowerCase();
      const subcategoryLower = (activity.subcategory || '').toLowerCase();
      
      // First, check for direct subtype matches
      for (const [subtypeKey, mapping] of Object.entries(subtypeMap)) {
        if (nameLower.includes(subtypeKey) || subcategoryLower.includes(subtypeKey)) {
          newType = mapping.type;
          newSubtype = mapping.subtype;
          break;
        }
      }
      
      // If no subtype match, check for type matches
      if (!newSubtype) {
        // Check for swimming/aquatic activities
        if (nameLower.includes('swim') || nameLower.includes('aqua') || 
            subcategoryLower.includes('swim') || subcategoryLower.includes('aqua')) {
          newType = 'Swimming & Aquatics';
          
          if (nameLower.includes('learn')) newSubtype = 'Learn to Swim';
          else if (nameLower.includes('lifeguard')) newSubtype = 'Lifeguard Training';
          else if (nameLower.includes('safety')) newSubtype = 'Water Safety';
          else if (nameLower.includes('adapted')) newSubtype = 'Adapted Swimming';
          else if (nameLower.includes('leadership')) newSubtype = 'Aquatic Leadership';
          else if (nameLower.includes('fitness')) newSubtype = 'Aqua Fitness';
        }
        // Team Sports
        else if (nameLower.includes('basketball')) {
          newType = 'Team Sports';
          newSubtype = 'Basketball';
        }
        else if (nameLower.includes('soccer') || nameLower.includes('football')) {
          newType = 'Team Sports';
          newSubtype = nameLower.includes('soccer') ? 'Soccer' : 'Football';
        }
        else if (nameLower.includes('volleyball')) {
          newType = 'Team Sports';
          newSubtype = 'Volleyball';
        }
        else if (nameLower.includes('hockey')) {
          newType = 'Team Sports';
          newSubtype = nameLower.includes('ice') ? 'Ice Hockey' : 
                      nameLower.includes('field') ? 'Field Hockey' : 'Hockey';
        }
        else if (nameLower.includes('baseball')) {
          newType = 'Team Sports';
          newSubtype = 'Baseball';
        }
        // Racquet Sports
        else if (nameLower.includes('tennis') && !nameLower.includes('table')) {
          newType = 'Racquet Sports';
          newSubtype = 'Tennis';
        }
        else if (nameLower.includes('badminton')) {
          newType = 'Racquet Sports';
          newSubtype = 'Badminton';
        }
        else if (nameLower.includes('squash')) {
          newType = 'Racquet Sports';
          newSubtype = 'Squash';
        }
        else if (nameLower.includes('pickleball')) {
          newType = 'Racquet Sports';
          newSubtype = 'Pickleball';
        }
        else if (nameLower.includes('table tennis') || nameLower.includes('ping pong')) {
          newType = 'Racquet Sports';
          newSubtype = 'Table Tennis';
        }
        // Martial Arts
        else if (nameLower.includes('karate')) {
          newType = 'Martial Arts';
          newSubtype = 'Karate';
        }
        else if (nameLower.includes('taekwondo') || nameLower.includes('tae kwon do')) {
          newType = 'Martial Arts';
          newSubtype = 'Taekwondo';
        }
        else if (nameLower.includes('judo')) {
          newType = 'Martial Arts';
          newSubtype = 'Judo';
        }
        else if (nameLower.includes('boxing')) {
          newType = 'Martial Arts';
          newSubtype = nameLower.includes('kick') ? 'Kickboxing' : 'Boxing';
        }
        else if (nameLower.includes('martial') || subcategoryLower.includes('martial')) {
          newType = 'Martial Arts';
        }
        // Dance
        else if (nameLower.includes('ballet')) {
          newType = 'Dance';
          newSubtype = 'Ballet';
        }
        else if (nameLower.includes('hip hop') || nameLower.includes('hiphop')) {
          newType = 'Dance';
          newSubtype = 'Hip Hop';
        }
        else if (nameLower.includes('jazz') && nameLower.includes('dance')) {
          newType = 'Dance';
          newSubtype = 'Jazz Dance';
        }
        else if (nameLower.includes('tap')) {
          newType = 'Dance';
          newSubtype = 'Tap Dance';
        }
        else if (nameLower.includes('dance') || subcategoryLower.includes('dance')) {
          newType = 'Dance';
        }
        // Gymnastics
        else if (nameLower.includes('gymnastic')) {
          newType = 'Gymnastics & Movement';
          newSubtype = 'Artistic Gymnastics';
        }
        else if (nameLower.includes('trampoline')) {
          newType = 'Gymnastics & Movement';
          newSubtype = 'Trampoline';
        }
        else if (nameLower.includes('tumbling')) {
          newType = 'Gymnastics & Movement';
          newSubtype = 'Tumbling';
        }
        else if (nameLower.includes('parkour')) {
          newType = 'Gymnastics & Movement';
          newSubtype = 'Parkour';
        }
        // Skating & Wheels
        else if (nameLower.includes('skating') || nameLower.includes('skate')) {
          newType = 'Skating & Wheels';
          if (nameLower.includes('figure')) newSubtype = 'Figure Skating';
          else if (nameLower.includes('hockey')) newSubtype = 'Ice Hockey';
          else if (nameLower.includes('inline') || nameLower.includes('roller')) newSubtype = 'Roller Skating';
          else newSubtype = 'Ice Skating';
        }
        else if (nameLower.includes('skateboard')) {
          newType = 'Skating & Wheels';
          newSubtype = 'Skateboarding';
        }
        // Arts
        else if (nameLower.includes('paint') || nameLower.includes('draw') || 
                 nameLower.includes('art') || subcategoryLower.includes('art')) {
          newType = 'Visual Arts';
          if (nameLower.includes('paint')) newSubtype = 'Painting';
          else if (nameLower.includes('draw')) newSubtype = 'Drawing';
          else if (nameLower.includes('pottery') || nameLower.includes('ceramic')) newSubtype = 'Pottery & Ceramics';
          else if (nameLower.includes('craft')) newSubtype = 'Crafts';
        }
        // Music
        else if (nameLower.includes('piano')) {
          newType = 'Music';
          newSubtype = 'Piano';
        }
        else if (nameLower.includes('guitar')) {
          newType = 'Music';
          newSubtype = 'Guitar';
        }
        else if (nameLower.includes('drum')) {
          newType = 'Music';
          newSubtype = 'Drums';
        }
        else if (nameLower.includes('violin')) {
          newType = 'Music';
          newSubtype = 'Violin';
        }
        else if (nameLower.includes('voice') || nameLower.includes('vocal') || nameLower.includes('singing')) {
          newType = 'Music';
          newSubtype = 'Voice';
        }
        else if (nameLower.includes('music') || subcategoryLower.includes('music')) {
          newType = 'Music';
        }
        // Drama & Theatre
        else if (nameLower.includes('drama') || nameLower.includes('theatre') || 
                 nameLower.includes('theater') || nameLower.includes('acting')) {
          newType = 'Performing Arts';
          newSubtype = 'Drama & Theatre';
        }
        // STEM
        else if (nameLower.includes('science') || nameLower.includes('robot') || 
                 nameLower.includes('coding') || nameLower.includes('engineering')) {
          newType = 'STEM';
          if (nameLower.includes('robot')) newSubtype = 'Robotics';
          else if (nameLower.includes('coding') || nameLower.includes('programming')) newSubtype = 'Coding';
          else if (nameLower.includes('science')) newSubtype = 'Science';
          else if (nameLower.includes('engineering')) newSubtype = 'Engineering';
        }
        // Outdoor
        else if (nameLower.includes('camp') || subcategoryLower.includes('camp')) {
          newType = 'Camps';
          if (nameLower.includes('day')) newSubtype = 'Day Camps';
          else if (nameLower.includes('overnight')) newSubtype = 'Overnight Camps';
          else if (nameLower.includes('summer')) newSubtype = 'Summer Camps';
          else if (nameLower.includes('spring')) newSubtype = 'Spring Break Camps';
        }
        else if (nameLower.includes('hiking') || nameLower.includes('outdoor')) {
          newType = 'Outdoor & Adventure';
        }
        // Fitness
        else if (nameLower.includes('yoga')) {
          newType = 'Fitness & Wellness';
          newSubtype = 'Yoga';
        }
        else if (nameLower.includes('fitness') || nameLower.includes('gym')) {
          newType = 'Fitness & Wellness';
        }
        // Educational
        else if (nameLower.includes('tutor') || nameLower.includes('homework')) {
          newType = 'Educational';
          newSubtype = 'Tutoring';
        }
        else if (nameLower.includes('language') || nameLower.includes('french') || 
                 nameLower.includes('spanish') || nameLower.includes('mandarin')) {
          newType = 'Educational';
          newSubtype = 'Language Learning';
        }
        else if (nameLower.includes('reading') || nameLower.includes('writing')) {
          newType = 'Educational';
          newSubtype = 'Reading & Writing';
        }
      }
      
      // Update the activity if we found a type
      if (newType && newType !== activity.activityType) {
        updateBatch.push({
          id: activity.id,
          activityType: newType,
          activitySubtype: newSubtype
        });
        updatedCount++;
        
        if (updatedCount % 100 === 0) {
          console.log(`  Processed ${updatedCount} activities...`);
        }
      }
    }
    
    // Execute updates in batches
    console.log(`\nUpdating ${updateBatch.length} activities with activity types...`);
    
    for (const update of updateBatch) {
      await prisma.activity.update({
        where: { id: update.id },
        data: {
          activityType: update.activityType,
          activitySubtype: update.activitySubtype
        }
      });
    }
    
    console.log(`\n✅ Successfully updated ${updatedCount} activities!`);
    
    // Show summary
    const typeSummary = await prisma.activity.groupBy({
      by: ['activityType'],
      _count: { id: true },
      where: { 
        isActive: true,
        activityType: { not: null }
      },
      orderBy: { _count: { id: 'desc' } }
    });
    
    console.log('\n📊 Activity Type Distribution:');
    typeSummary.forEach(t => {
      console.log(`   ${t.activityType}: ${t._count.id} activities`);
    });
    
    // Count activities with subtypes
    const withSubtypes = await prisma.activity.count({
      where: { 
        activitySubtype: { not: null },
        isActive: true
      }
    });
    
    console.log(`\n📊 Activities with subtypes: ${withSubtypes}`);
    
  } catch (error) {
    console.error('❌ Error seeding activity types:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedMasterActivityTypes();