import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { verifyToken } from '../../middleware/auth';
import { vendorService } from '../../services/vendorService';

const router = Router();

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
 *               - code
 *               - name
 *               - email
 *             properties:
 *               code:
 *                 type: string
 *                 description: Unique vendor code (e.g., "acme-sports")
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               website:
 *                 type: string
 *               contactName:
 *                 type: string
 */
router.post('/register', verifyToken, async (req: Request, res: Response) => {
  try {
    const { code, name, email, website, contactName } = req.body;

    if (!code || !name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Code, name, and email are required',
      });
    }

    // Create vendor with the current user as owner
    const vendor = await vendorService.createVendor({
      code,
      name,
      email,
      website,
      contactName,
    });

    // Add current user as owner
    await vendorService.addVendorUser(vendor.id, req.user!.id, 'OWNER');

    res.status(201).json({
      success: true,
      vendor,
      message: 'Vendor registration submitted. Awaiting admin verification.',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
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
