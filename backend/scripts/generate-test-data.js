const { PrismaClient } = require('../generated/prisma');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// Test data generation
async function generateTestData() {
  console.log('🚀 Starting test data generation...');
  
  try {
    // Create test users
    console.log('Creating test users...');
    const users = [];
    
    // Main test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const mainUser = await prisma.user.create({
      data: {
        id: uuidv4(),
        email: 'test@example.com',
        password: hashedPassword,
        name: 'Test User',
        isEmailVerified: true,
        emailVerificationToken: null
      }
    });
    users.push(mainUser);
    console.log('✅ Created main test user: test@example.com');

    // Additional test users
    for (let i = 1; i <= 3; i++) {
      const user = await prisma.user.create({
        data: {
          id: uuidv4(),
          email: `user${i}@example.com`,
          password: hashedPassword,
          name: `Test User ${i}`,
          isEmailVerified: true,
          emailVerificationToken: null
        }
      });
      users.push(user);
    }
    console.log(`✅ Created ${users.length} test users`);

    // Create test children for main user
    console.log('\nCreating test children...');
    const children = [];
    
    const childData = [
      { name: 'Emma', age: 8, gender: 'female', interests: ['swimming', 'arts', 'music'] },
      { name: 'Liam', age: 10, gender: 'male', interests: ['sports', 'camps', 'martial_arts'] },
      { name: 'Sophia', age: 6, gender: 'female', interests: ['dance', 'early_years', 'learn_and_play'] },
      { name: 'Noah', age: 12, gender: 'male', interests: ['sports', 'swimming', 'camps'] }
    ];

    for (const data of childData) {
      const child = await prisma.child.create({
        data: {
          id: uuidv4(),
          name: data.name,
          age: data.age,
          gender: data.gender,
          interests: data.interests,
          avatarUrl: `https://api.dicebear.com/6.x/avataaars/svg?seed=${data.name}`,
          userId: mainUser.id,
          isActive: true
        }
      });
      children.push(child);
    }
    console.log(`✅ Created ${children.length} test children`);

    // Create test providers
    console.log('\nCreating test providers...');
    const providers = [];
    
    const providerData = [
      { 
        id: 'nvrc',
        name: 'North Vancouver Recreation Commission',
        website: 'https://www.nvrc.ca',
        email: 'info@nvrc.ca',
        phone: '604-987-7529'
      },
      {
        id: 'vancouver-parks',
        name: 'Vancouver Parks and Recreation',
        website: 'https://vancouver.ca/parks-recreation-culture',
        email: 'parks@vancouver.ca',
        phone: '604-873-7000'
      },
      {
        id: 'burnaby-rec',
        name: 'Burnaby Parks and Recreation',
        website: 'https://www.burnaby.ca/recreation',
        email: 'recreation@burnaby.ca',
        phone: '604-294-7450'
      }
    ];

    for (const data of providerData) {
      const provider = await prisma.provider.create({ data });
      providers.push(provider);
    }
    console.log(`✅ Created ${providers.length} test providers`);

    // Create test locations
    console.log('\nCreating test locations...');
    const locations = [];
    
    const locationData = [
      {
        id: uuidv4(),
        name: 'Ron Andrews Community Centre',
        address: '931 Lytton St',
        city: 'North Vancouver',
        province: 'BC',
        postalCode: 'V7H 2A5',
        latitude: 49.3214,
        longitude: -123.0726,
        providerId: 'nvrc'
      },
      {
        id: uuidv4(),
        name: 'Delbrook Community Centre',
        address: '600 West Queens Rd',
        city: 'North Vancouver',
        province: 'BC',
        postalCode: 'V7N 2L3',
        latitude: 49.3274,
        longitude: -123.0522,
        providerId: 'nvrc'
      },
      {
        id: uuidv4(),
        name: 'Hillcrest Centre',
        address: '4575 Clancy Loranger Way',
        city: 'Vancouver',
        province: 'BC',
        postalCode: 'V5Y 2M4',
        latitude: 49.2444,
        longitude: -123.1089,
        providerId: 'vancouver-parks'
      }
    ];

    for (const data of locationData) {
      const location = await prisma.location.create({ data });
      locations.push(location);
    }
    console.log(`✅ Created ${locations.length} test locations`);

    // Create test activities
    console.log('\nCreating test activities...');
    const activities = [];
    
    const activityTypes = ['swimming', 'sports', 'arts', 'music', 'dance', 'camps', 'martial_arts'];
    const activityNames = [
      'Beginner Swimming Lessons',
      'Youth Basketball League',
      'Kids Art Workshop',
      'Piano for Beginners',
      'Ballet Fundamentals',
      'Summer Adventure Camp',
      'Karate for Kids',
      'Soccer Skills Development',
      'Creative Drawing Class',
      'Guitar Lessons',
      'Hip Hop Dance',
      'Spring Break Camp',
      'Taekwondo Training',
      'Swimming - Advanced',
      'Volleyball Club'
    ];

    for (let i = 0; i < 30; i++) {
      const activity = await prisma.activity.create({
        data: {
          id: uuidv4(),
          externalId: `test-activity-${i}`,
          name: activityNames[i % activityNames.length],
          description: `Join us for an exciting ${activityNames[i % activityNames.length]} program designed for children. This activity focuses on skill development, fun, and building confidence.`,
          category: activityTypes[Math.floor(Math.random() * activityTypes.length)],
          activityType: [activityTypes[Math.floor(Math.random() * activityTypes.length)]],
          ageMin: 5 + Math.floor(Math.random() * 3),
          ageMax: 8 + Math.floor(Math.random() * 6),
          cost: Math.floor(Math.random() * 200) + 50,
          registrationRequired: true,
          dropIn: Math.random() > 0.7,
          schedule: {
            dayOfWeek: ['Monday', 'Wednesday', 'Friday'][Math.floor(Math.random() * 3)],
            startTime: ['09:00', '10:30', '14:00', '16:00'][Math.floor(Math.random() * 4)],
            endTime: ['10:00', '11:30', '15:00', '17:00'][Math.floor(Math.random() * 4)],
            duration: 60
          },
          startDate: new Date('2025-01-15'),
          endDate: new Date('2025-03-31'),
          locationId: locations[Math.floor(Math.random() * locations.length)].id,
          providerId: providers[Math.floor(Math.random() * providers.length)].id,
          capacity: 20,
          remainingSpots: Math.floor(Math.random() * 15) + 5,
          tags: ['beginner-friendly', 'skill-development', 'fun'],
          featured: Math.random() > 0.8,
          isActive: true
        }
      });
      activities.push(activity);
    }
    console.log(`✅ Created ${activities.length} test activities`);

    // Link some activities to children
    console.log('\nLinking activities to children...');
    let linkedCount = 0;
    
    for (const child of children) {
      // Each child gets 2-5 activities
      const numActivities = Math.floor(Math.random() * 4) + 2;
      const childActivities = activities
        .filter(a => a.ageMin <= child.age && a.ageMax >= child.age)
        .sort(() => Math.random() - 0.5)
        .slice(0, numActivities);
      
      for (const activity of childActivities) {
        const statuses = ['interested', 'registered', 'waitlisted', 'completed'];
        await prisma.childActivity.create({
          data: {
            childId: child.id,
            activityId: activity.id,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            registeredAt: Math.random() > 0.5 ? new Date() : null,
            notes: Math.random() > 0.7 ? 'Looking forward to this activity!' : null,
            isFavorite: Math.random() > 0.7
          }
        });
        linkedCount++;
      }
    }
    console.log(`✅ Created ${linkedCount} child-activity links`);

    // Create some favorites for the main user
    console.log('\nCreating user favorites...');
    const favoriteActivities = activities.slice(0, 5);
    for (const activity of favoriteActivities) {
      await prisma.favorite.create({
        data: {
          userId: mainUser.id,
          activityId: activity.id
        }
      });
    }
    console.log(`✅ Created 5 favorites for main user`);

    // Create test invitations
    console.log('\nCreating test invitations...');
    const invitation = await prisma.invitation.create({
      data: {
        id: uuidv4(),
        fromUserId: mainUser.id,
        toEmail: 'friend@example.com',
        childId: children[0].id,
        status: 'pending',
        permission: 'view',
        message: 'I would like to share Emma\'s activity schedule with you.',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });
    console.log('✅ Created test invitation');

    // Create a shared child relationship
    console.log('\nCreating shared child relationship...');
    const sharedChild = await prisma.sharedChild.create({
      data: {
        childId: children[1].id,
        sharedWithUserId: users[1].id,
        sharedByUserId: mainUser.id,
        permission: 'manage'
      }
    });
    console.log('✅ Created shared child relationship');

    // Summary
    console.log('\n📊 Test Data Generation Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Children: ${children.length}`);
    console.log(`   - Providers: ${providers.length}`);
    console.log(`   - Locations: ${locations.length}`);
    console.log(`   - Activities: ${activities.length}`);
    console.log(`   - Child-Activity Links: ${linkedCount}`);
    console.log(`   - Favorites: 5`);
    console.log(`   - Invitations: 1`);
    console.log(`   - Shared Children: 1`);
    
    console.log('\n✅ Test data generation completed successfully!');
    console.log('\n🔑 Login credentials:');
    console.log('   Email: test@example.com');
    console.log('   Password: password123');
    
  } catch (error) {
    console.error('❌ Error generating test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  generateTestData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { generateTestData };