#!/usr/bin/env node

const { PrismaClient } = require('../generated/prisma');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    console.log('Creating test user in production database...');

    // Hash the password
    const hashedPassword = await bcrypt.hash('Test123!', 10);

    // Create or update the test user
    const user = await prisma.user.upsert({
      where: {
        email: 'test@kidsactivity.com'
      },
      update: {
        passwordHash: hashedPassword,
        name: 'Test User',
        isVerified: true // Skip email verification for test user
      },
      create: {
        email: 'test@kidsactivity.com',
        passwordHash: hashedPassword,
        name: 'Test User',
        isVerified: true // Skip email verification for test user
      }
    });

    console.log('✅ Test user created/updated successfully!');
    console.log('   Email: test@kidsactivity.com');
    console.log('   Password: Test123!');
    console.log('   User ID:', user.id);

    // Also create demo and parent accounts
    const demoPassword = await bcrypt.hash('Demo123!', 10);
    const demoUser = await prisma.user.upsert({
      where: {
        email: 'demo@kidsactivity.com'
      },
      update: {
        passwordHash: demoPassword,
        name: 'Demo User',
        isVerified: true
      },
      create: {
        email: 'demo@kidsactivity.com',
        passwordHash: demoPassword,
        name: 'Demo User',
        isVerified: true
      }
    });

    console.log('\n✅ Demo user created/updated successfully!');
    console.log('   Email: demo@kidsactivity.com');
    console.log('   Password: Demo123!');
    console.log('   User ID:', demoUser.id);

    const parentPassword = await bcrypt.hash('Parent123!', 10);
    const parentUser = await prisma.user.upsert({
      where: {
        email: 'parent@kidsactivity.com'
      },
      update: {
        passwordHash: parentPassword,
        name: 'Parent User',
        isVerified: true
      },
      create: {
        email: 'parent@kidsactivity.com',
        passwordHash: parentPassword,
        name: 'Parent User',
        isVerified: true
      }
    });

    console.log('\n✅ Parent user created/updated successfully!');
    console.log('   Email: parent@kidsactivity.com');
    console.log('   Password: Parent123!');
    console.log('   User ID:', parentUser.id);

  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();