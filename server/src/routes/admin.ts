import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { verifyToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/admin/profile
 * @desc    Get admin profile - verifies user has admin access
 * @access  Authenticated + Admin
 */
router.get('/profile', verifyToken, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { userId: req.user.id }
    });

    if (!adminUser || !['SUPER_ADMIN', 'ADMIN'].includes(adminUser.role)) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    res.json({
      success: true,
      admin: {
        id: adminUser.id,
        role: adminUser.role,
        user
      }
    });
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch admin profile' });
  }
});

export default router;
