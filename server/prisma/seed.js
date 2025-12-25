const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create NVRC provider
  const nvrc = await prisma.provider.upsert({
    where: { name: 'NVRC' },
    update: {},
    create: {
      name: 'NVRC',
      website: 'https://www.nvrc.ca',
      region: 'North Vancouver',
      platform: 'perfectmind',
      scraperConfig: {
        scraperClass: 'nvrcWorkingHierarchicalScraper',
        searchUrl: 'https://www.nvrc.ca/programs-memberships/find-program',
        ageGroups: [
          '0 - 6 years, Parent Participation',
          '0 - 6 years, On My Own',
          '5 - 13 years, School Age',
          '10 - 18 years, Youth'
        ],
        timeoutMinutes: 30
      },
      isActive: true
    }
  });

  console.log('✅ Created NVRC provider:', nvrc.id);

  // Create test city and locations
  const northVancouverCity = await prisma.city.upsert({
    where: {
      name_province_country: {
        name: 'North Vancouver',
        province: 'BC',
        country: 'Canada'
      }
    },
    update: {},
    create: {
      name: 'North Vancouver',
      province: 'BC',
      country: 'Canada'
    }
  });

  const locations = [
    {
      name: 'Ron Andrews Community Recreation Centre',
      address: '931 Lytton St',
      cityId: northVancouverCity.id,
      postalCode: 'V7H 2A4'
    },
    {
      name: 'Delbrook Community Recreation Centre',
      address: '851 West Queens Rd',
      cityId: northVancouverCity.id,
      postalCode: 'V7N 4E3'
    },
    {
      name: 'Harry Jerome Community Recreation Centre',
      address: '123 East 23rd St',
      cityId: northVancouverCity.id,
      postalCode: 'V7L 3C8'
    }
  ];

  for (const location of locations) {
    const created = await prisma.location.upsert({
      where: {
        name_address_cityId: {
          name: location.name,
          address: location.address,
          cityId: location.cityId
        }
      },
      update: {},
      create: location
    });
    console.log(`✅ Created location: ${created.name}`);
  }

  // Create a test user
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash('testpassword123', 12);
  
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: passwordHash,
      isVerified: true,
      verificationToken: null,
      resetToken: null,
      resetTokenExpiry: null,
      preferences: {
        ageRange: { min: 5, max: 12 },
        preferredCategories: ['Swimming', 'Camps'],
        maxCost: 200
      }
    }
  });

  console.log('✅ Created test user:', testUser.email);

  // Create Activity Types
  console.log('🏷️ Creating activity types...');
  const activityTypes = [
    { code: 'swimming-aquatics', name: 'Swimming & Aquatics', iconName: 'swim', displayOrder: 1 },
    { code: 'team-sports', name: 'Team Sports', iconName: 'basketball', displayOrder: 2 },
    { code: 'individual-sports', name: 'Individual Sports', iconName: 'run', displayOrder: 3 },
    { code: 'racquet-sports', name: 'Racquet Sports', iconName: 'tennis', displayOrder: 4 },
    { code: 'martial-arts', name: 'Martial Arts', iconName: 'karate', displayOrder: 5 },
    { code: 'dance', name: 'Dance', iconName: 'dance-ballroom', displayOrder: 6 },
    { code: 'visual-arts', name: 'Visual Arts', iconName: 'palette', displayOrder: 7 },
    { code: 'music', name: 'Music', iconName: 'music', displayOrder: 8 },
    { code: 'performing-arts', name: 'Performing Arts', iconName: 'drama-masks', displayOrder: 9 },
    { code: 'skating-wheels', name: 'Skating & Wheels', iconName: 'skate', displayOrder: 10 },
    { code: 'gymnastics-movement', name: 'Gymnastics & Movement', iconName: 'gymnastics', displayOrder: 11 },
    { code: 'camps', name: 'Camps', iconName: 'tent', displayOrder: 12 },
    { code: 'stem-education', name: 'STEM & Education', iconName: 'flask', displayOrder: 13 },
    { code: 'fitness-wellness', name: 'Fitness & Wellness', iconName: 'dumbbell', displayOrder: 14 },
    { code: 'outdoor-adventure', name: 'Outdoor & Adventure', iconName: 'tree', displayOrder: 15 },
    { code: 'culinary-arts', name: 'Culinary Arts', iconName: 'chef-hat', displayOrder: 16 },
    { code: 'language-culture', name: 'Language & Culture', iconName: 'translate', displayOrder: 17 },
    { code: 'special-needs-programs', name: 'Special Needs Programs', iconName: 'heart', displayOrder: 18 },
    { code: 'multi-sport', name: 'Multi-Sport', iconName: 'soccer', displayOrder: 19 },
    { code: 'life-skills-leadership', name: 'Life Skills & Leadership', iconName: 'account-group', displayOrder: 20 },
    { code: 'early-development', name: 'Early Development', iconName: 'baby-face-outline', displayOrder: 21 },
    { code: 'other-activity', name: 'Other Activity', iconName: 'tag', displayOrder: 22 }
  ];

  for (const activityType of activityTypes) {
    const created = await prisma.activityType.upsert({
      where: { code: activityType.code },
      update: { name: activityType.name, iconName: activityType.iconName, displayOrder: activityType.displayOrder },
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

  // Create Age Groups
  console.log('👶 Creating age groups...');
  const ageGroups = [
    { code: 'baby', label: 'Baby (0-2)', minAge: 0, maxAge: 2, displayOrder: 1 },
    { code: 'toddler', label: 'Toddler (2-4)', minAge: 2, maxAge: 4, displayOrder: 2 },
    { code: 'preschool', label: 'Preschool (4-6)', minAge: 4, maxAge: 6, displayOrder: 3 },
    { code: 'school-age', label: 'School Age (6-12)', minAge: 6, maxAge: 12, displayOrder: 4 },
    { code: 'teen', label: 'Teen (12-18)', minAge: 12, maxAge: 18, displayOrder: 5 },
  ];

  for (const ageGroup of ageGroups) {
    const created = await prisma.ageGroup.upsert({
      where: { code: ageGroup.code },
      update: { label: ageGroup.label, minAge: ageGroup.minAge, maxAge: ageGroup.maxAge, displayOrder: ageGroup.displayOrder },
      create: ageGroup
    });
    console.log(`✅ Created age group: ${created.label}`);
  }

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });