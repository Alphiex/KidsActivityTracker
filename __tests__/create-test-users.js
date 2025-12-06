#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    console.log('Creating test users in production database...');

    // Create test user
    const testPassword = await bcrypt.hash('Test123!', 10);
    const testUser = await prisma.user.upsert({
      where: {
        email: 'test@kidsactivity.com'
      },
      update: {
        passwordHash: testPassword,
        name: 'Test User',
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
      create: {
        email: 'test@kidsactivity.com',
        passwordHash: testPassword,
        name: 'Test User',
        isEmailVerified: true,
      }
    });

    console.log('✅ Test user created/updated successfully!');
    console.log('   Email: test@kidsactivity.com');
    console.log('   Password: Test123!');
    console.log('   User ID:', testUser.id);

    // Create demo user
    const demoPassword = await bcrypt.hash('Demo123!', 10);
    const demoUser = await prisma.user.upsert({
      where: {
        email: 'demo@kidsactivity.com'
      },
      update: {
        passwordHash: demoPassword,
        name: 'Demo User',
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
      create: {
        email: 'demo@kidsactivity.com',
        passwordHash: demoPassword,
        name: 'Demo User',
        isEmailVerified: true,
      }
    });

    console.log('\n✅ Demo user created/updated successfully!');
    console.log('   Email: demo@kidsactivity.com');
    console.log('   Password: Demo123!');
    console.log('   User ID:', demoUser.id);

    // Create parent user
    const parentPassword = await bcrypt.hash('Parent123!', 10);
    const parentUser = await prisma.user.upsert({
      where: {
        email: 'parent@kidsactivity.com'
      },
      update: {
        passwordHash: parentPassword,
        name: 'Parent User',
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
      create: {
        email: 'parent@kidsactivity.com',
        passwordHash: parentPassword,
        name: 'Parent User',
        isEmailVerified: true,
      }
    });

    console.log('\n✅ Parent user created/updated successfully!');
    console.log('   Email: parent@kidsactivity.com');
    console.log('   Password: Parent123!');
    console.log('   User ID:', parentUser.id);

  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();