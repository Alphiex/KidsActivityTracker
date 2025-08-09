const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function seedActivities() {
  try {
    console.log('🌱 Seeding test activities...');

    // Get or create provider
    const provider = await prisma.provider.upsert({
      where: { name: 'NVRC' },
      update: {},
      create: {
        name: 'NVRC',
        website: 'https://www.nvrc.ca',
        scraperConfig: {},
        isActive: true
      }
    });

    // Get or create location
    const location = await prisma.location.upsert({
      where: {
        name_address: {
          name: 'Ron Andrews Community Recreation Centre',
          address: '931 Lytton St'
        }
      },
      update: {},
      create: {
        name: 'Ron Andrews Community Recreation Centre',
        address: '931 Lytton St',
        city: 'North Vancouver',
        province: 'BC',
        postalCode: 'V7H 2A4'
      }
    });

    // Sample activities
    const activities = [
      {
        name: 'Youth Basketball League',
        category: 'Team Sports',
        subcategory: 'Basketball',
        description: 'Join our competitive youth basketball league. Learn fundamentals, teamwork, and have fun!',
        ageMin: 10,
        ageMax: 14,
        cost: 250,
        registrationStart: new Date('2025-08-01'),
        registrationEnd: new Date('2025-08-31'),
        dateStart: new Date('2025-09-01'),
        dateEnd: new Date('2025-12-01'),
        daysOfWeek: ['Monday', 'Wednesday'],
        timeStart: '16:00',
        timeEnd: '17:30',
        capacity: 20,
        registeredCount: 12,
        waitlistCount: 0
      },
      {
        name: 'Swimming Lessons - Level 3',
        category: 'Aquatics',
        subcategory: 'Swimming',
        description: 'Intermediate swimming lessons focusing on stroke improvement and endurance.',
        ageMin: 6,
        ageMax: 12,
        cost: 120,
        registrationStart: new Date('2025-08-01'),
        registrationEnd: new Date('2025-08-20'),
        dateStart: new Date('2025-08-25'),
        dateEnd: new Date('2025-10-25'),
        daysOfWeek: ['Saturday'],
        timeStart: '09:00',
        timeEnd: '10:00',
        capacity: 8,
        registeredCount: 6,
        waitlistCount: 2
      },
      {
        name: 'Kids Soccer Skills',
        category: 'Team Sports',
        subcategory: 'Soccer',
        description: 'Develop soccer skills in a fun, non-competitive environment.',
        ageMin: 5,
        ageMax: 8,
        cost: 180,
        registrationStart: new Date('2025-08-05'),
        registrationEnd: new Date('2025-08-25'),
        dateStart: new Date('2025-09-05'),
        dateEnd: new Date('2025-11-05'),
        daysOfWeek: ['Tuesday', 'Thursday'],
        timeStart: '15:30',
        timeEnd: '16:30',
        capacity: 16,
        registeredCount: 14,
        waitlistCount: 0
      },
      {
        name: 'Teen Volleyball Drop-In',
        category: 'Team Sports',
        subcategory: 'Volleyball',
        description: 'Drop-in volleyball for teens. All skill levels welcome!',
        ageMin: 13,
        ageMax: 18,
        cost: 5,
        registrationOpen: true,
        dateStart: new Date('2025-08-01'),
        dateEnd: new Date('2025-12-31'),
        daysOfWeek: ['Friday'],
        timeStart: '19:00',
        timeEnd: '21:00',
        capacity: 30,
        registeredCount: 0,
        waitlistCount: 0,
        dropIn: true
      },
      {
        name: 'Parent & Tot Gymnastics',
        category: 'Individual Sports',
        subcategory: 'Gymnastics',
        description: 'Introduction to gymnastics for toddlers with parent participation.',
        ageMin: 1,
        ageMax: 3,
        cost: 95,
        registrationStart: new Date('2025-08-10'),
        registrationEnd: new Date('2025-08-30'),
        dateStart: new Date('2025-09-10'),
        dateEnd: new Date('2025-11-10'),
        daysOfWeek: ['Wednesday'],
        timeStart: '10:00',
        timeEnd: '10:45',
        capacity: 10,
        registeredCount: 8,
        waitlistCount: 1
      }
    ];

    // Create activities
    for (const activity of activities) {
      const created = await prisma.activity.create({
        data: {
          ...activity,
          providerId: provider.id,
          locationId: location.id,
          locationName: location.name,
          courseName: activity.name,
          courseId: `NVRC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          registrationOpen: activity.registrationOpen || (activity.registrationStart ? new Date() >= activity.registrationStart && new Date() <= activity.registrationEnd : true),
          isActive: true,
          scraperLastUpdate: new Date()
        }
      });
      console.log(`✅ Created activity: ${created.name}`);
    }

    const count = await prisma.activity.count();
    console.log(`\n✨ Total activities in database: ${count}`);

  } catch (error) {
    console.error('Error seeding activities:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedActivities();