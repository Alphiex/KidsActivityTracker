#!/usr/bin/env node

const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function seedDatabase() {
  console.log('🌱 Seeding database...\n');

  try {
    // Seed ActivityType table
    // NOTE: Use the canonical activity type names from server/src/constants/activityTypes.js
    console.log('📚 Creating activity types...');
    const activityTypes = [
      { code: 'swimming-aquatics', name: 'Swimming & Aquatics', description: 'Water-based activities and swimming lessons', iconName: 'swim', displayOrder: 1 },
      { code: 'team-sports', name: 'Team Sports', description: 'Team-based sports like soccer, basketball, hockey', iconName: 'basketball', displayOrder: 2 },
      { code: 'individual-sports', name: 'Individual Sports', description: 'Individual sports like tennis, golf, gymnastics', iconName: 'run', displayOrder: 3 },
      { code: 'visual-arts', name: 'Visual Arts', description: 'Visual arts, crafts, and creative activities', iconName: 'palette', displayOrder: 4 },
      { code: 'music', name: 'Music', description: 'Music lessons and performances', iconName: 'music-note', displayOrder: 5 },
      { code: 'dance', name: 'Dance', description: 'Dance classes and performances', iconName: 'dance-ballroom', displayOrder: 6 },
      { code: 'martial-arts', name: 'Martial Arts', description: 'Karate, Kung Fu, and other martial arts', iconName: 'karate', displayOrder: 7 },
      { code: 'camps', name: 'Camps', description: 'Day camps and holiday programs', iconName: 'tent', displayOrder: 8 }
    ];

    for (const type of activityTypes) {
      await prisma.activityType.upsert({
        where: { code: type.code },
        update: type,
        create: type
      });
    }
    console.log(`✅ Created ${activityTypes.length} activity types\n`);

    // Seed sample activities
    console.log('🎯 Creating sample activities...');
    const activities = [
      {
        externalId: 'swim-001',
        name: 'Beginner Swimming Lessons',
        description: 'Learn the basics of swimming in a safe environment',
        cost: 120,
        ageMin: 5,
        ageMax: 8,
        location: 'North Vancouver Recreation Centre',
        address: '123 Main St, North Vancouver, BC',
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-03-15'),
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        registrationUrl: 'https://example.com/register/swim-001',
        registrationStatus: 'Open',
        spotsAvailable: 5,
        activityType: 'Swimming & Aquatics',
        category: 'Swimming & Aquatics',
        provider: 'North Vancouver Recreation & Culture'
      },
      {
        externalId: 'soccer-001',
        name: 'Youth Soccer League',
        description: 'Join our fun and competitive youth soccer league',
        cost: 200,
        ageMin: 8,
        ageMax: 12,
        location: 'Parkgate Community Centre',
        address: '3625 Banff Ct, North Vancouver, BC',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-05-30'),
        startTime: '3:30 PM',
        endTime: '5:00 PM',
        registrationUrl: 'https://example.com/register/soccer-001',
        registrationStatus: 'Open',
        spotsAvailable: 12,
        activityType: 'Team Sports',
        category: 'Team Sports',
        provider: 'North Vancouver Recreation & Culture'
      },
      {
        externalId: 'art-001',
        name: 'Kids Art Workshop',
        description: 'Express creativity through painting and drawing',
        cost: 85,
        ageMin: 6,
        ageMax: 10,
        location: 'Lynn Valley Community Centre',
        address: '456 Valley Rd, North Vancouver, BC',
        startDate: new Date('2025-01-20'),
        endDate: new Date('2025-02-20'),
        startTime: '2:00 PM',
        endTime: '3:30 PM',
        registrationUrl: 'https://example.com/register/art-001',
        registrationStatus: 'Open',
        spotsAvailable: 8,
        activityType: 'Arts',
        category: 'Arts',
        provider: 'North Vancouver Recreation & Culture'
      },
      {
        externalId: 'dance-001',
        name: 'Ballet for Beginners',
        description: 'Introduction to classical ballet techniques',
        cost: 150,
        ageMin: 4,
        ageMax: 7,
        location: 'Delbrook Community Centre',
        address: '789 Delbrook Ave, North Vancouver, BC',
        startDate: new Date('2025-01-10'),
        endDate: new Date('2025-03-20'),
        startTime: '4:00 PM',
        endTime: '5:00 PM',
        registrationUrl: 'https://example.com/register/dance-001',
        registrationStatus: 'Full',
        spotsAvailable: 0,
        activityType: 'Dance',
        category: 'Dance',
        provider: 'North Vancouver Recreation & Culture'
      },
      {
        externalId: 'camp-001',
        name: 'Spring Break Adventure Camp',
        description: 'Fun-filled activities during spring break',
        cost: 250,
        ageMin: 7,
        ageMax: 12,
        location: 'Ron Andrews Community Centre',
        address: '931 Lytton St, North Vancouver, BC',
        startDate: new Date('2025-03-17'),
        endDate: new Date('2025-03-28'),
        startTime: '9:00 AM',
        endTime: '4:00 PM',
        registrationUrl: 'https://example.com/register/camp-001',
        registrationStatus: 'Open',
        spotsAvailable: 20,
        activityType: 'Camps',
        category: 'Camps',
        provider: 'North Vancouver Recreation & Culture'
      },
      {
        externalId: 'music-001',
        name: 'Piano Lessons for Kids',
        description: 'Learn to play piano with experienced instructors',
        cost: 180,
        ageMin: 6,
        ageMax: 14,
        location: 'North Vancouver Music School',
        address: '321 Music Lane, North Vancouver, BC',
        startDate: new Date('2025-01-05'),
        endDate: new Date('2025-04-30'),
        startTime: '5:00 PM',
        endTime: '6:00 PM',
        registrationUrl: 'https://example.com/register/music-001',
        registrationStatus: 'Closed',
        spotsAvailable: 0,
        activityType: 'Music',
        category: 'Music',
        provider: 'North Vancouver Recreation & Culture'
      }
    ];

    let createdCount = 0;
    for (const activity of activities) {
      const existing = await prisma.activity.findFirst({
        where: { externalId: activity.externalId }
      });

      if (!existing) {
        await prisma.activity.create({ data: activity });
        createdCount++;
        console.log(`   ✅ Created: ${activity.name}`);
      } else {
        await prisma.activity.update({
          where: { id: existing.id },
          data: activity
        });
        console.log(`   🔄 Updated: ${activity.name}`);
      }
    }

    console.log(`\n✅ Database seeded successfully!`);
    console.log(`   - Activity types: ${activityTypes.length}`);
    console.log(`   - Activities: ${activities.length}`);

    // Check totals
    const totalActivities = await prisma.activity.count();
    const totalTypes = await prisma.activityType.count();
    console.log(`\n📊 Database totals:`);
    console.log(`   - Total activity types: ${totalTypes}`);
    console.log(`   - Total activities: ${totalActivities}`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedDatabase()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });