import { Router, Request, Response } from 'express';
import { Prisma } from '../../../generated/prisma';
import { prisma } from '../../lib/prisma';
import { requireVendorAuth, requireVendorRole } from '../../middleware/vendorAuth';

const router = Router();

/**
 * @swagger
 * /api/vendor/{vendorId}/activities:
 *   get:
 *     summary: List vendor's activities
 *     tags: [Vendor - Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 */
router.get('/', requireVendorAuth(), async (req: Request, res: Response) => {
  try {
    const { page, limit, search, category, isActive } = req.query;

    const pageNum = page ? parseInt(page as string) : 1;
    const limitNum = limit ? parseInt(limit as string) : 20;
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.ActivityWhereInput = {
      vendorId: req.vendor!.id,
      ...(search && {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
          { externalId: { contains: search as string, mode: 'insensitive' } },
        ],
      }),
      ...(category && { category: category as string }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
    };

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          externalId: true,
          name: true,
          category: true,
          subcategory: true,
          description: true,
          dateStart: true,
          dateEnd: true,
          startTime: true,
          endTime: true,
          dayOfWeek: true,
          cost: true,
          ageMin: true,
          ageMax: true,
          locationName: true,
          fullAddress: true,
          isActive: true,
          isUpdated: true,
          isFeatured: true,
          featuredTier: true,
          spotsAvailable: true,
          totalSpots: true,
          registrationStatus: true,
          lastImportedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.activity.count({ where }),
    ]);

    res.json({
      success: true,
      activities,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/vendor/{vendorId}/activities/{id}:
 *   get:
 *     summary: Get activity details
 *     tags: [Vendor - Activities]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', requireVendorAuth(), async (req: Request, res: Response) => {
  try {
    const activity = await prisma.activity.findUnique({
      where: { id: req.params.id },
      include: {
        location: true,
        provider: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found',
      });
    }

    // Verify activity belongs to this vendor
    if (activity.vendorId !== req.vendor!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.json({
      success: true,
      activity,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/vendor/{vendorId}/activities/{id}:
 *   put:
 *     summary: Update activity
 *     tags: [Vendor - Activities]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', requireVendorAuth('ADMIN'), async (req: Request, res: Response) => {
  try {
    const activity = await prisma.activity.findUnique({
      where: { id: req.params.id },
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found',
      });
    }

    // Verify activity belongs to this vendor
    if (activity.vendorId !== req.vendor!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Allowed fields for vendor update
    const {
      name,
      description,
      category,
      subcategory,
      dateStart,
      dateEnd,
      startTime,
      endTime,
      dayOfWeek,
      cost,
      ageMin,
      ageMax,
      locationName,
      fullAddress,
      latitude,
      longitude,
      instructor,
      spotsAvailable,
      totalSpots,
      registrationUrl,
      registrationStatus,
      prerequisites,
      whatToBring,
      isActive,
    } = req.body;

    const updated = await prisma.activity.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(subcategory !== undefined && { subcategory }),
        ...(dateStart !== undefined && { dateStart: new Date(dateStart) }),
        ...(dateEnd !== undefined && { dateEnd: new Date(dateEnd) }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(dayOfWeek !== undefined && { dayOfWeek }),
        ...(cost !== undefined && { cost }),
        ...(ageMin !== undefined && { ageMin }),
        ...(ageMax !== undefined && { ageMax }),
        ...(locationName !== undefined && { locationName }),
        ...(fullAddress !== undefined && { fullAddress }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(instructor !== undefined && { instructor }),
        ...(spotsAvailable !== undefined && { spotsAvailable }),
        ...(totalSpots !== undefined && { totalSpots }),
        ...(registrationUrl !== undefined && { registrationUrl }),
        ...(registrationStatus !== undefined && { registrationStatus }),
        ...(prerequisites !== undefined && { prerequisites }),
        ...(whatToBring !== undefined && { whatToBring }),
        ...(isActive !== undefined && { isActive }),
        isUpdated: true,
      },
    });

    res.json({
      success: true,
      activity: updated,
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
 * /api/vendor/{vendorId}/activities/{id}:
 *   delete:
 *     summary: Deactivate activity (soft delete)
 *     tags: [Vendor - Activities]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', requireVendorAuth('ADMIN'), async (req: Request, res: Response) => {
  try {
    const activity = await prisma.activity.findUnique({
      where: { id: req.params.id },
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found',
      });
    }

    // Verify activity belongs to this vendor
    if (activity.vendorId !== req.vendor!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Soft delete - just mark as inactive
    await prisma.activity.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Activity deactivated',
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
 * /api/vendor/{vendorId}/activities/stats:
 *   get:
 *     summary: Get activity statistics
 *     tags: [Vendor - Activities]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats/summary', requireVendorAuth(), async (req: Request, res: Response) => {
  try {
    const [total, active, featured, byCategory] = await Promise.all([
      prisma.activity.count({
        where: { vendorId: req.vendor!.id },
      }),
      prisma.activity.count({
        where: { vendorId: req.vendor!.id, isActive: true },
      }),
      prisma.activity.count({
        where: { vendorId: req.vendor!.id, isFeatured: true },
      }),
      prisma.activity.groupBy({
        by: ['category'],
        where: { vendorId: req.vendor!.id },
        _count: true,
      }),
    ]);

    res.json({
      success: true,
      stats: {
        total,
        active,
        inactive: total - active,
        featured,
        byCategory: byCategory.map(c => ({
          category: c.category,
          count: c._count,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/vendor/{vendorId}/activities/bulk-update:
 *   post:
 *     summary: Bulk update activities
 *     tags: [Vendor - Activities]
 *     security:
 *       - bearerAuth: []
 */
router.post('/bulk-update', requireVendorAuth('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { activityIds, updates } = req.body;

    if (!activityIds || !Array.isArray(activityIds) || activityIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Activity IDs array is required',
      });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Updates object is required',
      });
    }

    // Verify all activities belong to this vendor
    const activities = await prisma.activity.findMany({
      where: {
        id: { in: activityIds },
      },
      select: { id: true, vendorId: true },
    });

    const unauthorized = activities.filter(a => a.vendorId !== req.vendor!.id);
    if (unauthorized.length > 0) {
      return res.status(403).json({
        success: false,
        error: 'Some activities do not belong to this vendor',
      });
    }

    // Only allow certain fields for bulk update
    const allowedFields = ['isActive', 'category', 'subcategory'];
    const sanitizedUpdates: Record<string, any> = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid update fields provided',
      });
    }

    // Perform bulk update
    const result = await prisma.activity.updateMany({
      where: {
        id: { in: activityIds },
        vendorId: req.vendor!.id,
      },
      data: sanitizedUpdates,
    });

    res.json({
      success: true,
      updated: result.count,
      message: `Updated ${result.count} activities`,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
