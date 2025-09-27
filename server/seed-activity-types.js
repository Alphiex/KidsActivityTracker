const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting activity types seed...');

  // Create Activity Types
  console.log('🏷️ Creating activity types...');
  const activityTypes = [
    { code: 'swimming-aquatics', name: 'Swimming & Aquatics', displayOrder: 1 },
    { code: 'team-sports', name: 'Team Sports', displayOrder: 2 },
    { code: 'individual-sports', name: 'Individual Sports', displayOrder: 3 },
    { code: 'racquet-sports', name: 'Racquet Sports', displayOrder: 4 },
    { code: 'martial-arts', name: 'Martial Arts', displayOrder: 5 },
    { code: 'dance', name: 'Dance', displayOrder: 6 },
    { code: 'visual-arts', name: 'Visual Arts', displayOrder: 7 },
    { code: 'music', name: 'Music', displayOrder: 8 },
    { code: 'performing-arts', name: 'Performing Arts', displayOrder: 9 },
    { code: 'skating-wheels', name: 'Skating & Wheels', displayOrder: 10 },
    { code: 'gymnastics-movement', name: 'Gymnastics & Movement', displayOrder: 11 },
    { code: 'camps', name: 'Camps', displayOrder: 12 },
    { code: 'stem-education', name: 'STEM & Education', displayOrder: 13 },
    { code: 'fitness-wellness', name: 'Fitness & Wellness', displayOrder: 14 },
    { code: 'outdoor-adventure', name: 'Outdoor & Adventure', displayOrder: 15 },
    { code: 'culinary-arts', name: 'Culinary Arts', displayOrder: 16 },
    { code: 'language-culture', name: 'Language & Culture', displayOrder: 17 },
    { code: 'special-needs-programs', name: 'Special Needs Programs', displayOrder: 18 },
    { code: 'multi-sport', name: 'Multi-Sport', displayOrder: 19 },
    { code: 'life-skills-leadership', name: 'Life Skills & Leadership', displayOrder: 20 },
    { code: 'early-development', name: 'Early Development', displayOrder: 21 },
    { code: 'other-activity', name: 'Other Activity', displayOrder: 22 }
  ];

  for (const activityType of activityTypes) {
    const created = await prisma.activityType.upsert({
      where: { code: activityType.code },
      update: { name: activityType.name, displayOrder: activityType.displayOrder },
      create: activityType
    });
    console.log(`✅ Created activity type: ${created.name}`);
  }

  // Create Activity Subtypes
  console.log('🏷️ Creating activity subtypes...');
  
  // Get the created activity types for reference
  const types = await prisma.activityType.findMany();
  const typeMap = {};
  types.forEach(type => {
    typeMap[type.code] = type.id;
  });

  const activitySubtypes = [
    // Swimming & Aquatics
    { code: 'swimming-lessons', name: 'Swimming Lessons', activityTypeId: typeMap['swimming-aquatics'] },
    { code: 'parent-child', name: 'Parent & Child', activityTypeId: typeMap['swimming-aquatics'] },
    { code: 'competitive', name: 'Competitive Swimming', activityTypeId: typeMap['swimming-aquatics'] },
    { code: 'aqua-fitness', name: 'Aqua Fitness', activityTypeId: typeMap['swimming-aquatics'] },
    { code: 'water-safety', name: 'Water Safety', activityTypeId: typeMap['swimming-aquatics'] },
    { code: 'adapted', name: 'Adapted Swimming', activityTypeId: typeMap['swimming-aquatics'] },
    
    // Racquet Sports
    { code: 'tennis', name: 'Tennis', activityTypeId: typeMap['racquet-sports'] },
    { code: 'badminton', name: 'Badminton', activityTypeId: typeMap['racquet-sports'] },
    { code: 'squash', name: 'Squash', activityTypeId: typeMap['racquet-sports'] },
    { code: 'pickleball', name: 'Pickleball', activityTypeId: typeMap['racquet-sports'] },
    
    // Team Sports
    { code: 'soccer', name: 'Soccer', activityTypeId: typeMap['team-sports'] },
    { code: 'basketball', name: 'Basketball', activityTypeId: typeMap['team-sports'] },
    { code: 'volleyball', name: 'Volleyball', activityTypeId: typeMap['team-sports'] },
    { code: 'baseball', name: 'Baseball', activityTypeId: typeMap['team-sports'] },
    { code: 'hockey', name: 'Hockey', activityTypeId: typeMap['team-sports'] },
    { code: 'football', name: 'Football', activityTypeId: typeMap['team-sports'] },
    { code: 'lacrosse', name: 'Lacrosse', activityTypeId: typeMap['team-sports'] },
    
    // Martial Arts
    { code: 'karate', name: 'Karate', activityTypeId: typeMap['martial-arts'] },
    { code: 'taekwondo', name: 'Taekwondo', activityTypeId: typeMap['martial-arts'] },
    { code: 'judo', name: 'Judo', activityTypeId: typeMap['martial-arts'] },
    { code: 'kung-fu', name: 'Kung Fu', activityTypeId: typeMap['martial-arts'] },
    { code: 'jiu-jitsu', name: 'Jiu-Jitsu', activityTypeId: typeMap['martial-arts'] },
    { code: 'boxing', name: 'Boxing', activityTypeId: typeMap['martial-arts'] },
    { code: 'kickboxing', name: 'Kickboxing', activityTypeId: typeMap['martial-arts'] },
    { code: 'self-defense', name: 'Self Defense', activityTypeId: typeMap['martial-arts'] },
    
    // Dance
    { code: 'ballet', name: 'Ballet', activityTypeId: typeMap['dance'] },
    { code: 'jazz', name: 'Jazz Dance', activityTypeId: typeMap['dance'] },
    { code: 'hip-hop', name: 'Hip Hop', activityTypeId: typeMap['dance'] },
    { code: 'tap', name: 'Tap Dance', activityTypeId: typeMap['dance'] },
    { code: 'contemporary', name: 'Contemporary Dance', activityTypeId: typeMap['dance'] },
    { code: 'ballroom', name: 'Ballroom Dance', activityTypeId: typeMap['dance'] },
    
    // Visual Arts
    { code: 'painting', name: 'Painting', activityTypeId: typeMap['visual-arts'] },
    { code: 'drawing', name: 'Drawing', activityTypeId: typeMap['visual-arts'] },
    { code: 'pottery', name: 'Pottery', activityTypeId: typeMap['visual-arts'] },
    { code: 'sculpture', name: 'Sculpture', activityTypeId: typeMap['visual-arts'] },
    { code: 'mixed-media', name: 'Mixed Media', activityTypeId: typeMap['visual-arts'] },
    { code: 'crafts', name: 'Crafts', activityTypeId: typeMap['visual-arts'] },
    
    // Music
    { code: 'piano', name: 'Piano', activityTypeId: typeMap['music'] },
    { code: 'guitar', name: 'Guitar', activityTypeId: typeMap['music'] },
    { code: 'singing', name: 'Singing', activityTypeId: typeMap['music'] },
    { code: 'drums', name: 'Drums', activityTypeId: typeMap['music'] },
    { code: 'violin', name: 'Violin', activityTypeId: typeMap['music'] },
    { code: 'band', name: 'Band', activityTypeId: typeMap['music'] },
    { code: 'orchestra', name: 'Orchestra', activityTypeId: typeMap['music'] },
    
    // Performing Arts
    { code: 'drama', name: 'Drama', activityTypeId: typeMap['performing-arts'] },
    { code: 'musical-theatre', name: 'Musical Theatre', activityTypeId: typeMap['performing-arts'] },
    { code: 'improv', name: 'Improv', activityTypeId: typeMap['performing-arts'] },
    
    // General subtypes for other categories
    { code: 'general', name: 'General', activityTypeId: typeMap['other-activity'] },
    { code: 'other', name: 'Other', activityTypeId: typeMap['other-activity'] }
  ];

  for (const subtype of activitySubtypes) {
    const created = await prisma.activitySubtype.upsert({
      where: {
        activityTypeId_code: {
          activityTypeId: subtype.activityTypeId,
          code: subtype.code
        }
      },
      update: { name: subtype.name },
      create: subtype
    });
    console.log(`✅ Created activity subtype: ${created.name}`);
  }

  console.log('🎉 Activity types seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });