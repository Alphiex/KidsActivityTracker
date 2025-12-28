import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient, Prisma } from '../../generated/prisma';
import { verifyToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

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
 * @route   GET /api/admin/activities
 * @desc    Search and list activities with filters
 * @access  Admin
 */
router.get('/', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      search,
      providerId,
      city,
      category,
      isActive,
      isFeatured,
      hasManualEdits,
      page = '1',
      limit = '50',
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100); // Cap at 100
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.ActivityWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { externalId: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (providerId) {
      where.providerId = providerId as string;
    }

    if (city) {
      where.location = {
        city: { equals: city as string, mode: 'insensitive' }
      };
    }

    if (category) {
      where.category = { equals: category as string, mode: 'insensitive' };
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured === 'true';
    }

    if (hasManualEdits === 'true') {
      where.manuallyEditedFields = { isEmpty: false };
    }

    // Get activities
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          provider: {
            select: {
              id: true,
              name: true
            }
          },
          location: {
            select: {
              id: true,
              name: true,
              city: true
            }
          },
          activityType: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { [sortBy as string]: sortOrder }
      }),
      prisma.activity.count({ where })
    ]);

    res.json({
      success: true,
      activities: activities.map(a => ({
        id: a.id,
        name: a.name,
        category: a.category,
        provider: a.provider,
        location: a.location,
        activityType: a.activityType,
        ageMin: a.ageMin,
        ageMax: a.ageMax,
        cost: a.cost,
        isActive: a.isActive,
        isFeatured: a.isFeatured,
        featuredTier: a.featuredTier,
        manuallyEditedFields: a.manuallyEditedFields,
        manuallyEditedAt: a.manuallyEditedAt,
        updatedAt: a.updatedAt,
        registrationStatus: a.registrationStatus
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activities' });
  }
});

/**
 * @route   GET /api/admin/activities/providers
 * @desc    Get list of providers for dropdown
 * @access  Admin
 */
router.get('/providers', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const providers = await prisma.provider.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({ success: true, providers });
  } catch (error: any) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch providers' });
  }
});

/**
 * @route   GET /api/admin/activities/locations
 * @desc    Get list of locations for dropdown
 * @access  Admin
 */
router.get('/locations', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { search } = req.query;

    const where: Prisma.LocationWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { city: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const locations = await prisma.location.findMany({
      where,
      select: {
        id: true,
        name: true,
        city: true,
        address: true
      },
      orderBy: { name: 'asc' },
      take: 50
    });

    res.json({ success: true, locations });
  } catch (error: any) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch locations' });
  }
});

/**
 * @route   GET /api/admin/activities/activity-types
 * @desc    Get list of activity types for dropdown
 * @access  Admin
 */
router.get('/activity-types', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const activityTypes = await prisma.activityType.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        subtypes: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ success: true, activityTypes });
  } catch (error: any) {
    console.error('Error fetching activity types:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity types' });
  }
});

/**
 * @route   GET /api/admin/activities/:id
 * @desc    Get single activity with all details
 * @access  Admin
 */
router.get('/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            website: true
          }
        },
        location: true,
        activityType: true,
        activitySubtype: true
      }
    });

    if (!activity) {
      return res.status(404).json({ success: false, error: 'Activity not found' });
    }

    res.json({ success: true, activity });
  } catch (error: any) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity' });
  }
});

/**
 * @route   POST /api/admin/activities
 * @desc    Create a new activity
 * @access  Admin
 */
router.post('/',
  verifyToken,
  requireAdmin,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('providerId').notEmpty().withMessage('Provider is required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const adminUser = (req as any).adminUser;
      const data = req.body;

      // All fields are manually edited since this is a new manual entry
      const allFields = Object.keys(data).filter(k =>
        !['id', 'createdAt', 'updatedAt', 'manuallyEditedFields', 'manuallyEditedAt', 'manuallyEditedBy'].includes(k)
      );

      // Generate a unique externalId for manually created activities
      const externalId = `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const activity = await prisma.activity.create({
        data: {
          ...data,
          externalId,
          isActive: data.isActive ?? true,
          manuallyEditedFields: allFields,
          manuallyEditedAt: new Date(),
          manuallyEditedBy: adminUser.userId
        },
        include: {
          provider: { select: { id: true, name: true } },
          location: { select: { id: true, name: true, city: true } }
        }
      });

      res.status(201).json({ success: true, activity });
    } catch (error: any) {
      console.error('Error creating activity:', error);
      res.status(500).json({ success: false, error: 'Failed to create activity' });
    }
  }
);

/**
 * @route   PUT /api/admin/activities/:id
 * @desc    Update an activity (tracks manually edited fields)
 * @access  Admin
 */
router.put('/:id',
  verifyToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const adminUser = (req as any).adminUser;
      const updateData = req.body;

      // Get current activity to compare changes
      const currentActivity = await prisma.activity.findUnique({
        where: { id }
      });

      if (!currentActivity) {
        return res.status(404).json({ success: false, error: 'Activity not found' });
      }

      // Determine which fields were changed
      const changedFields: string[] = [];
      const fieldsToTrack = [
        'name', 'description', 'fullDescription', 'category', 'subcategory',
        'startTime', 'endTime', 'dayOfWeek', 'dateStart', 'dateEnd', 'schedule', 'dates',
        'locationId', 'locationName', 'fullAddress',
        'registrationUrl', 'registrationStatus', 'registrationButtonText',
        'registrationDate', 'registrationEndDate', 'spotsAvailable', 'totalSpots',
        'cost', 'costIncludesTax', 'taxAmount',
        'ageMin', 'ageMax',
        'isFeatured', 'featuredTier', 'featuredStartDate', 'featuredEndDate',
        'isActive', 'activityTypeId', 'activitySubtypeId'
      ];

      for (const field of fieldsToTrack) {
        if (updateData[field] !== undefined) {
          const currentValue = (currentActivity as any)[field];
          const newValue = updateData[field];

          // Check if value actually changed
          if (JSON.stringify(currentValue) !== JSON.stringify(newValue)) {
            changedFields.push(field);
          }
        }
      }

      // Merge with existing manually edited fields
      const existingManualFields = currentActivity.manuallyEditedFields || [];
      const newManualFields = [...new Set([...existingManualFields, ...changedFields])];

      // Remove fields we don't want to update directly
      const {
        id: _,
        createdAt,
        updatedAt,
        manuallyEditedFields,
        manuallyEditedAt,
        manuallyEditedBy,
        providerId, // Don't allow changing provider
        externalId, // Don't allow changing externalId
        ...safeUpdateData
      } = updateData;

      const activity = await prisma.activity.update({
        where: { id },
        data: {
          ...safeUpdateData,
          manuallyEditedFields: newManualFields,
          manuallyEditedAt: new Date(),
          manuallyEditedBy: adminUser.userId
        },
        include: {
          provider: { select: { id: true, name: true } },
          location: { select: { id: true, name: true, city: true } },
          activityType: { select: { id: true, name: true } },
          activitySubtype: { select: { id: true, name: true } }
        }
      });

      res.json({
        success: true,
        activity,
        changedFields,
        message: changedFields.length > 0
          ? `Updated ${changedFields.length} field(s). These fields are now protected from scraper updates.`
          : 'No changes detected.'
      });
    } catch (error: any) {
      console.error('Error updating activity:', error);
      res.status(500).json({ success: false, error: 'Failed to update activity' });
    }
  }
);

/**
 * @route   PUT /api/admin/activities/:id/unlock-fields
 * @desc    Remove manual edit locks on specific fields
 * @access  Admin
 */
router.put('/:id/unlock-fields',
  verifyToken,
  requireAdmin,
  [
    body('fields').isArray().withMessage('Fields must be an array')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const { fields } = req.body;

      const currentActivity = await prisma.activity.findUnique({
        where: { id },
        select: { manuallyEditedFields: true }
      });

      if (!currentActivity) {
        return res.status(404).json({ success: false, error: 'Activity not found' });
      }

      // Remove specified fields from the locked list
      const updatedFields = (currentActivity.manuallyEditedFields || [])
        .filter(f => !fields.includes(f));

      await prisma.activity.update({
        where: { id },
        data: {
          manuallyEditedFields: updatedFields
        }
      });

      res.json({
        success: true,
        message: `Unlocked ${fields.length} field(s). Scrapers can now update these fields.`,
        unlockedFields: fields,
        remainingLockedFields: updatedFields
      });
    } catch (error: any) {
      console.error('Error unlocking fields:', error);
      res.status(500).json({ success: false, error: 'Failed to unlock fields' });
    }
  }
);

/**
 * @route   DELETE /api/admin/activities/:id
 * @desc    Delete an activity
 * @access  Admin
 */
router.delete('/:id',
  verifyToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if activity exists
      const activity = await prisma.activity.findUnique({
        where: { id },
        select: { id: true, name: true }
      });

      if (!activity) {
        return res.status(404).json({ success: false, error: 'Activity not found' });
      }

      // Delete related records first
      await prisma.$transaction([
        prisma.childActivity.deleteMany({ where: { activityId: id } }),
        prisma.favorite.deleteMany({ where: { activityId: id } }),
        prisma.activityHistory.deleteMany({ where: { activityId: id } }),
        prisma.activitySession.deleteMany({ where: { activityId: id } }),
        prisma.activityPrerequisite.deleteMany({ where: { activityId: id } }),
        prisma.activity.delete({ where: { id } })
      ]);

      res.json({
        success: true,
        message: `Activity "${activity.name}" has been deleted.`
      });
    } catch (error: any) {
      console.error('Error deleting activity:', error);
      res.status(500).json({ success: false, error: 'Failed to delete activity' });
    }
  }
);

export default router;
