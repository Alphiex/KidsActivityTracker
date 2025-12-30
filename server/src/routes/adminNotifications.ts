import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../middleware/auth';

const router = Router();

// Admin middleware - verify user has admin role
const requireAdmin = async (req: Request, res: Response, next: any) => {
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

    (req as any).adminUser = adminUser;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to verify admin access' });
  }
};

/**
 * @route   GET /api/admin/notifications
 * @desc    Get admin notifications
 * @access  Admin
 */
router.get('/',
  verifyToken,
  requireAdmin,
  [
    query('unreadOnly').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const unreadOnly = req.query.unreadOnly === 'true';
      const limit = parseInt(req.query.limit as string) || 20;

      const where = unreadOnly ? { isRead: false } : {};

      const [notifications, unreadCount] = await Promise.all([
        prisma.adminNotification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        prisma.adminNotification.count({
          where: { isRead: false },
        }),
      ]);

      res.json({
        notifications,
        unreadCount,
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
    }
  }
);

/**
 * @route   GET /api/admin/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  Admin
 */
router.get('/unread-count',
  verifyToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const count = await prisma.adminNotification.count({
        where: { isRead: false },
      });

      res.json({ count });
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch unread count' });
    }
  }
);

/**
 * @route   POST /api/admin/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Admin
 */
router.post('/:id/read',
  verifyToken,
  requireAdmin,
  [
    param('id').isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const adminUser = (req as any).adminUser;

      const notification = await prisma.adminNotification.update({
        where: { id },
        data: {
          isRead: true,
          readBy: adminUser.userId,
          readAt: new Date(),
        },
      });

      res.json({ success: true, notification });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ success: false, error: 'Notification not found' });
      }
      console.error('Failed to mark notification as read:', error);
      res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
    }
  }
);

/**
 * @route   POST /api/admin/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Admin
 */
router.post('/mark-all-read',
  verifyToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminUser = (req as any).adminUser;

      const result = await prisma.adminNotification.updateMany({
        where: { isRead: false },
        data: {
          isRead: true,
          readBy: adminUser.userId,
          readAt: new Date(),
        },
      });

      res.json({ success: true, count: result.count });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' });
    }
  }
);

export default router;
