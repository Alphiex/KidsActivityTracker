import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { verifyToken } from '../../middleware/auth';
import { vendorService } from '../../services/vendorService';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * @swagger
 * /api/vendor/auth/login:
 *   post:
 *     summary: Login to vendor portal
 *     tags: [Vendor - Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Find vendor by email
    const vendor = await prisma.vendor.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!vendor) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    if (!vendor.passwordHash) {
      return res.status(401).json({
        success: false,
        error: 'Password not set. Please contact support.',
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, vendor.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Check vendor status
    if (vendor.status !== 'ACTIVE' && vendor.status !== 'PENDING') {
      return res.status(403).json({
        success: false,
        error: `Vendor account is ${vendor.status.toLowerCase()}. Please contact support.`,
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        vendorId: vendor.id,
        email: vendor.email,
        type: 'vendor',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      vendor: {
        id: vendor.id,
        code: vendor.code,
        name: vendor.name,
        organizationName: vendor.name,
        email: vendor.email,
        status: vendor.status,
      },
    });
  } catch (error: any) {
    console.error('Vendor login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.',
    });
  }
});

/**
 * @swagger
 * /api/vendor/auth/register:
 *   post:
 *     summary: Register a new vendor organization
 *     tags: [Vendor - Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *               - organizationName
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *                 description: Contact person name
 *               organizationName:
 *                 type: string
 *               phone:
 *                 type: string
 *               website:
 *                 type: string
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, organizationName, phone, website } = req.body;

    if (!email || !password || !name || !organizationName) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, name, and organization name are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      });
    }

    // Check if email already exists
    const existingVendor = await prisma.vendor.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingVendor) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists',
      });
    }

    // Generate vendor code from organization name
    const code = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);

    // Check if code exists, append random suffix if needed
    let finalCode = code;
    const existingCode = await prisma.vendor.findUnique({
      where: { code },
    });
    if (existingCode) {
      finalCode = `${code}-${Date.now().toString(36).slice(-4)}`;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create vendor
    const vendor = await prisma.vendor.create({
      data: {
        code: finalCode,
        name: organizationName,
        email: email.toLowerCase(),
        contactName: name,
        contactPhone: phone,
        website,
        passwordHash,
        status: 'PENDING',
        requiresApproval: true,
      },
    });

    // Generate JWT token for auto-login
    const token = jwt.sign(
      {
        vendorId: vendor.id,
        email: vendor.email,
        type: 'vendor',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      vendor: {
        id: vendor.id,
        code: vendor.code,
        name: vendor.name,
        organizationName: vendor.name,
        email: vendor.email,
        status: vendor.status,
      },
      message: 'Vendor registration successful. Your account is pending approval.',
    });
  } catch (error: any) {
    console.error('Vendor registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Registration failed. Please try again.',
    });
  }
});

/**
 * @swagger
 * /api/vendor/auth/my-vendors:
 *   get:
 *     summary: Get vendors the current user belongs to
 *     tags: [Vendor - Auth]
 *     security:
 *       - bearerAuth: []
 */
router.get('/my-vendors', verifyToken, async (req: Request, res: Response) => {
  try {
    const vendorMemberships = await prisma.vendorUser.findMany({
      where: { userId: req.user!.id },
      include: {
        vendor: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            email: true,
            website: true,
          },
        },
      },
    });

    res.json({
      success: true,
      vendors: vendorMemberships.map(m => ({
        ...m.vendor,
        role: m.role,
        membershipId: m.id,
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
