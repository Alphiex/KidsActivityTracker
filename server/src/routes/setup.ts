import { Router } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../../generated/prisma';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

// One-time setup endpoint to create test user
// BLOCKED IN PRODUCTION for security
router.post('/setup/test-user', async (req, res) => {
  try {
    // Block this endpoint in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({
        success: false,
        error: 'Not found'
      });
    }

    // Check if setup key is provided
    const setupKey = req.headers['x-setup-key'];
    if (!process.env.SETUP_KEY || setupKey !== process.env.SETUP_KEY) {
      return res.status(403).json({
        success: false,
        error: 'Invalid setup key'
      });
    }

    const email = 'test@kidsactivitytracker.com';
    const password = 'Test123!';
    
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existing) {
      return res.json({
        success: true,
        message: 'Test user already exists',
        userId: existing.id
      });
    }
    
    // Create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name: 'Test User',
        isVerified: true,
        preferences: {
          theme: 'light',
          notifications: { email: true, push: true },
          viewType: 'card',
          hasCompletedOnboarding: true
        },
      }
    });
    
    res.json({
      success: true,
      message: 'Test user created',
      userId: user.id
    });
    
  } catch (error: any) {
    console.error('Setup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;