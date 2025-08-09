const { PrismaClient } = require('../generated/prisma');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function seedTestUser() {
  try {
    console.log('Creating test user...');
    
    // User credentials
    const email = 'test@kidsactivitytracker.com';
    const password = 'Test123!';
    const name = 'Test User';
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      console.log('\n✓ User already exists!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Email:', email);
      console.log('Password:', password);
      console.log('User ID:', existingUser.id);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
        isVerified: true, // Pre-verified, no email needed
        preferences: {
          theme: 'light',
          notifications: {
            email: true,
            push: true
          },
          viewType: 'card',
          hasCompletedOnboarding: true
        }
      }
    });
    
    console.log('\n✓ User created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('User ID:', user.id);
    console.log('Name:', name);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nYou can now log in with these credentials!');
    
  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestUser();