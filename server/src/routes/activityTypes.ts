import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { buildActivityWhereClause, extractGlobalFilters } from '../utils/activityFilters';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/activity-types
 * @desc    Get all activity types with their subtypes
 * @access  Public
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const globalFilters = extractGlobalFilters(req.query);
    
    const activityTypes = await prisma.activityType.findMany({
      include: {
        subtypes: {
          orderBy: { name: 'asc' }
        },
        _count: {
          select: { activities: true }
        }
      },
      orderBy: { displayOrder: 'asc' }
    });

    // Transform the data to include activity counts
    const typesWithCounts = await Promise.all(
      activityTypes.map(async (type) => {
        // Count active activities for this type with filters
        const activeCount = await prisma.activity.count({
          where: buildActivityWhereClause({ activityTypeId: type.id }, globalFilters)
        });

        // Get subtype counts
        const subtypesWithCounts = await Promise.all(
          type.subtypes.map(async (subtype) => {
            const count = await prisma.activity.count({
              where: buildActivityWhereClause({ activitySubtypeId: subtype.id }, globalFilters)
            });
            return {
              ...subtype,
              activityCount: count
            };
          })
        );

        return {
          id: type.id,
          code: type.code,
          name: type.name,
          displayOrder: type.displayOrder,
          activityCount: activeCount,
          subtypes: subtypesWithCounts
        };
      })
    );

    res.json({
      success: true,
      data: typesWithCounts
    });
  } catch (error: any) {
    console.error('Activity types fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity types'
    });
  }
});

/**
 * @route   GET /api/v1/activity-types/:typeCode
 * @desc    Get a specific activity type with its subtypes
 * @access  Public
 */
router.get('/:typeCode', async (req: Request, res: Response) => {
  try {
    const { typeCode } = req.params;
    const globalFilters = extractGlobalFilters(req.query);

    const activityType = await prisma.activityType.findUnique({
      where: { code: typeCode },
      include: {
        subtypes: {
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!activityType) {
      return res.status(404).json({
        success: false,
        error: 'Activity type not found'
      });
    }

    // Get counts for each subtype with global filters applied
    const subtypesWithCounts = await Promise.all(
      activityType.subtypes.map(async (subtype) => {
        const count = await prisma.activity.count({
          where: buildActivityWhereClause({ activitySubtypeId: subtype.id }, globalFilters)
        });
        return {
          ...subtype,
          activityCount: count
        };
      })
    );

    // Count total active activities for this type with global filters applied
    const totalCount = await prisma.activity.count({
      where: buildActivityWhereClause({ activityTypeId: activityType.id }, globalFilters)
    });

    res.json({
      success: true,
      activityType: {
        ...activityType,
        subtypes: subtypesWithCounts,
        totalActivityCount: totalCount
      }
    });
  } catch (error: any) {
    console.error('Activity type detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity type details'
    });
  }
});

/**
 * @route   GET /api/v1/activity-types/:typeCode/subtypes/:subtypeCode/activities
 * @desc    Get activities for a specific subtype
 * @access  Public
 */
router.get('/:typeCode/subtypes/:subtypeCode/activities', async (req: Request, res: Response) => {
  try {
    const { typeCode, subtypeCode } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    // Find the activity type first
    const activityType = await prisma.activityType.findUnique({
      where: { code: typeCode }
    });

    if (!activityType) {
      return res.status(404).json({
        success: false,
        error: 'Activity type not found'
      });
    }

    // Find the subtype with the compound unique key
    const subtype = await prisma.activitySubtype.findUnique({
      where: { 
        activityTypeId_code: {
          activityTypeId: activityType.id,
          code: subtypeCode
        }
      }
    });

    if (!subtype) {
      return res.status(404).json({
        success: false,
        error: 'Activity subtype not found'
      });
    }

    // Get activities for this subtype
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where: {
          activitySubtypeId: subtype.id,
          isActive: true
        },
        include: {
          provider: true,
          location: true,
          _count: {
            select: { favorites: true }
          }
        },
        orderBy: { dateStart: 'asc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.activity.count({
        where: {
          activitySubtypeId: subtype.id,
          isActive: true
        }
      })
    ]);

    res.json({
      success: true,
      activities,
      total,
      hasMore: parseInt(offset as string) + parseInt(limit as string) < total,
      subtype: {
        id: subtype.id,
        code: subtype.code,
        name: subtype.name
      }
    });
  } catch (error: any) {
    console.error('Subtype activities error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subtype activities'
    });
  }
});

export default router;