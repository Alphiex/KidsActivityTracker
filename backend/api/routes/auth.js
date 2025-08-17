const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('../../generated/prisma');

const router = express.Router();

// Only initialize Prisma if DATABASE_URL is available
let prisma;
if (process.env.DATABASE_URL) {
  prisma = new PrismaClient();
} else {
  console.warn('⚠️  No DATABASE_URL provided, auth routes will return mock responses');
}

// JWT configuration - Use the secret names that match what's in Cloud Run
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

// Helper functions
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  
  return {
    accessToken,
    refreshToken,
    accessTokenExpiry: Date.now() + ACCESS_TOKEN_EXPIRY * 1000,
    refreshTokenExpiry: Date.now() + REFRESH_TOKEN_EXPIRY * 1000
  };
};

// Verify token middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
    req.userId = decoded.userId;
    next();
  });
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phoneNumber } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required'
      });
    }

    if (!prisma) {
      // Mock response for testing without database
      const mockUser = {
        id: crypto.randomBytes(16).toString('hex'),
        email,
        name,
        phoneNumber,
        isVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const tokens = generateTokens(mockUser.id);
      
      return res.json({
        success: true,
        message: 'User registered successfully (mock)',
        user: mockUser,
        tokens
      });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
        phoneNumber,
        isVerified: false,
        verificationToken: crypto.randomBytes(32).toString('hex')
      }
    });

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Return user data without password
    const { passwordHash: _, verificationToken: __, ...userWithoutSensitive } = user;

    res.json({
      success: true,
      message: 'User registered successfully',
      user: userWithoutSensitive,
      tokens
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Registration failed'
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (!prisma) {
      // Mock response for testing without database
      if (email === 'test@kidsactivitytracker.com' && password === 'test123') {
        const mockUser = {
          id: 'test-user-id',
          email,
          name: 'Test User',
          phoneNumber: null,
          isVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        const tokens = generateTokens(mockUser.id);
        
        return res.json({
          success: true,
          message: 'Login successful (mock)',
          user: mockUser,
          tokens
        });
      } else {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Return user data without password
    const { passwordHash: _, verificationToken: __, ...userWithoutSensitive } = user;

    res.json({
      success: true,
      message: 'Login successful',
      user: userWithoutSensitive,
      tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    // Verify refresh token
    jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired refresh token'
        });
      }

      // Generate new tokens
      const tokens = generateTokens(decoded.userId);

      res.json({
        success: true,
        tokens
      });
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Token refresh failed'
    });
  }
});

// Logout (optional - just for completeness)
router.post('/logout', verifyToken, async (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // This endpoint is just for consistency
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Get profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        children: true,
        favorites: {
          include: {
            activity: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Return user data without password
    const { passwordHash: _, verificationToken: __, ...userWithoutSensitive } = user;

    res.json({
      success: true,
      profile: userWithoutSensitive
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch profile'
    });
  }
});

// Update profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, phoneNumber, preferences } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data: {
        name,
        phoneNumber,
        preferences,
        updatedAt: new Date()
      }
    });

    // Return user data without password
    const { password: _, verificationToken: __, ...userWithoutSensitive } = updatedUser;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: userWithoutSensitive
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update profile'
    });
  }
});

// Check auth status
router.get('/check', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        authenticated: false,
        error: 'User not found'
      });
    }

    // Return user data without password
    const { passwordHash: _, verificationToken: __, ...userWithoutSensitive } = user;

    res.json({
      success: true,
      authenticated: true,
      user: userWithoutSensitive
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({
      success: false,
      authenticated: false,
      error: error.message || 'Auth check failed'
    });
  }
});

// Password related endpoints (stubs for now)
router.post('/forgot-password', async (req, res) => {
  res.json({
    success: true,
    message: 'Password reset email functionality not implemented yet'
  });
});

router.post('/reset-password', async (req, res) => {
  res.json({
    success: true,
    message: 'Password reset functionality not implemented yet'
  });
});

router.post('/change-password', verifyToken, async (req, res) => {
  res.json({
    success: true,
    message: 'Password change functionality not implemented yet'
  });
});

router.get('/verify-email', async (req, res) => {
  res.json({
    success: true,
    message: 'Email verification functionality not implemented yet'
  });
});

router.post('/resend-verification', async (req, res) => {
  res.json({
    success: true,
    message: 'Email verification resend functionality not implemented yet'
  });
});

module.exports = { router, verifyToken };