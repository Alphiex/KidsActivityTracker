import { PrismaClient } from '../generated/prisma';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // User details
    const email = 'test@kidsactivitytracker.com';
    const password = 'Test123!';
    const name = 'Test User';
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      console.log('User already exists:', email);
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        emailVerified: true, // Set as verified so no email is needed
        isActive: true,
        preferences: {
          theme: 'light',
          notifications: {
            email: true,
            push: true
          }
        }
      }
    });
    
    console.log('User created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('User ID:', user.id);
    console.log('Name:', name);
    console.log('Email Verified:', user.emailVerified);
    
  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();