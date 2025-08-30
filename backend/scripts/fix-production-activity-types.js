const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function fixActivityTypes() {
  console.log('Fixing activity types in production database (using string fields)...\n');
  
  // Mapping rules for activity types
  const typeMappings = [
    // Team Sports
    { match: ['Basketball', 'Soccer', 'Baseball', 'Hockey', 'Volleyball', 'Softball', 'Football'], type: 'Team Sports' },
    
    // Racquet Sports
    { match: ['Tennis', 'Badminton', 'Squash', 'Table Tennis', 'Pickleball', 'Racquet'], type: 'Racquet Sports' },
    
    // Martial Arts
    { match: ['Martial Arts', 'Karate', 'Taekwondo', 'Judo', 'Kung Fu', 'Self Defense', 'Aikido', 'Boxing', 'Kickboxing'], type: 'Martial Arts' },
    
    // Dance
    { match: ['Dance', 'Ballet', 'Hip Hop', 'Jazz', 'Tap', 'Contemporary', 'Bollywood', 'Ballroom', 'Modern'], type: 'Dance' },
    
    // Swimming & Aquatics
    { match: ['Swimming', 'Swim', 'Aqua', 'Water Safety', 'Lifeguard', 'Bronze'], type: 'Swimming & Aquatics' },
    
    // Gymnastics & Movement
    { match: ['Gymnastics', 'Tumbling', 'Parkour', 'Ninja', 'Movement', 'Acrobatics'], type: 'Gymnastics & Movement' },
    
    // Visual Arts
    { match: ['Art', 'Paint', 'Draw', 'Clay', 'Craft', 'Creative', 'Canvas', 'Pottery'], type: 'Visual Arts' },
    
    // Music
    { match: ['Music', 'Piano', 'Guitar', 'Drum', 'Sing', 'Voice', 'Violin', 'Band'], type: 'Music' },
    
    // STEM Education
    { match: ['Science', 'STEM', 'Robotics', 'Coding', 'Engineering', 'Math', 'Lego', 'Builder'], type: 'STEM Education' },
    
    // Skating
    { match: ['Skating', 'Figure Skating', 'Speed Skating', 'Ice Skating', 'Roller'], type: 'Skating & Wheels' },
    
    // Outdoor Adventure
    { match: ['Climbing', 'Rock Climbing', 'Bouldering', 'Outdoor', 'Adventure', 'Hiking'], type: 'Outdoor Adventure' },
    
    // Fitness & Wellness
    { match: ['Fitness', 'Yoga', 'Pilates', 'Workout', 'Exercise', 'Spin', 'Cycling'], type: 'Fitness & Wellness' },
    
    // Drama & Theatre
    { match: ['Drama', 'Theatre', 'Acting', 'Musical Theatre', 'Improv', 'Performance'], type: 'Drama & Theatre' },
    
    // Life Skills
    { match: ['Babysitter', 'Home Alone', 'Leadership', 'First Aid', 'Safety'], type: 'Life Skills & Leadership' },
    
    // Camps
    { match: ['Camp', 'Pro D Day', 'Spring Break', 'Winter Break', 'Summer Camp'], type: 'Camps' },
    
    // Early Development
    { match: ['Preschool', 'Toddler', 'Parent & Tot', 'Early Years'], type: 'Early Development' },
    
    // Multi-Sport
    { match: ['Multisport', 'FUNdamentals', 'All Sports'], type: 'Multi-Sport' },
  ];
  
  let updatedCount = 0;
  
  // Process each mapping rule
  for (const rule of typeMappings) {
    for (const keyword of rule.match) {
      const result = await prisma.activity.updateMany({
        where: {
          OR: [
            { name: { contains: keyword, mode: 'insensitive' } },
            { subcategory: { contains: keyword, mode: 'insensitive' } }
          ],
          isActive: true
        },
        data: {
          activityType: rule.type
        }
      });
      
      if (result.count > 0) {
        console.log(`Updated ${result.count} activities with keyword "${keyword}" to type: ${rule.type}`);
        updatedCount += result.count;
      }
    }
  }
  
  // Fix specific known issues
  console.log('\nApplying specific fixes...');
  
  // Fix activities that have category but no activityType
  const categorizedNoType = await prisma.activity.updateMany({
    where: {
      activityType: null,
      category: { not: null },
      isActive: true
    },
    data: {
      activityType: prisma.activity.fields.category
    }
  });
  
  if (categorizedNoType.count > 0) {
    console.log(`Updated ${categorizedNoType.count} activities using their category field`);
    updatedCount += categorizedNoType.count;
  }
  
  console.log(`\n✅ Total activities updated: ${updatedCount}`);
  
  // Show updated counts
  const typeCounts = await prisma.activity.groupBy({
    by: ['activityType'],
    where: {
      isActive: true,
      activityType: { not: null }
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });
  
  console.log('\n📊 Updated activity type distribution:');
  typeCounts.forEach(tc => {
    console.log(`  ${tc.activityType}: ${tc._count.id} activities`);
  });
  
  const totalActive = await prisma.activity.count({ where: { isActive: true } });
  const withType = await prisma.activity.count({ 
    where: { isActive: true, activityType: { not: null } } 
  });
  
  console.log(`\n📈 Coverage: ${withType}/${totalActive} activities have activity type (${(withType/totalActive*100).toFixed(1)}%)`);
}

fixActivityTypes()
  .then(() => {
    console.log('\n✅ Activity types fixed successfully!');
  })
  .catch((error) => {
    console.error('❌ Error fixing activity types:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });