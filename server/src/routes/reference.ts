import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { buildActivityWhereClause, extractGlobalFilters } from '../utils/activityFilters';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/reference/activity-types
 * @desc    Get all activity types with activity counts
 * @access  Public
 */
router.get('/activity-types', async (req: Request, res: Response) => {
  try {
    const globalFilters = extractGlobalFilters(req.query);
    
    // Get all activity type records
    const activityTypes = await prisma.activityType.findMany({
      orderBy: { displayOrder: 'asc' }
    });

    // Format the response with filtered counts
    const typesWithCounts = await Promise.all(
      activityTypes.map(async (type) => {
        const count = await prisma.activity.count({
          where: buildActivityWhereClause({ activityTypeId: type.id }, globalFilters)
        });
        return {
          code: type.code,
          name: type.name,
          displayName: type.name,
          activityCount: count,
          displayOrder: type.displayOrder
        };
      })
    );

    res.json({
      success: true,
      data: typesWithCounts,
      total: typesWithCounts.length
    });
  } catch (error: any) {
    console.error('Error fetching activity types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity types'
    });
  }
});

/**
 * @route   GET /api/v1/reference/activity-types/:typeCode
 * @desc    Get activity type details with subtypes and counts
 * @access  Public
 */
router.get('/activity-types/:typeCode', async (req: Request, res: Response) => {
  try {
    const { typeCode } = req.params;
    const globalFilters = extractGlobalFilters(req.query);
    
    // Find the activity type by code
    const activityType = await prisma.activityType.findUnique({
      where: { code: typeCode },
      include: {
        subtypes: {
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    if (!activityType) {
      return res.status(404).json({
        success: false,
        error: 'Activity type not found'
      });
    }

    // Get counts for each subtype with global filters
    const subtypesWithCounts = await Promise.all(
      activityType.subtypes.map(async (subtype) => {
        const count = await prisma.activity.count({
          where: buildActivityWhereClause({ activitySubtypeId: subtype.id }, globalFilters)
        });
        return {
          code: subtype.code,
          name: subtype.name,
          activityCount: count
        };
      })
    );

    // Count total activities for this type with global filters
    const totalActivities = await prisma.activity.count({
      where: buildActivityWhereClause({ activityTypeId: activityType.id }, globalFilters)
    });

    res.json({
      success: true,
      data: {
        code: activityType.code,
        name: activityType.name,
        totalActivities,
        subtypes: subtypesWithCounts.sort((a, b) => b.activityCount - a.activityCount)
      }
    });
  } catch (error: any) {
    console.error('Error fetching activity type details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity type details'
    });
  }
});

/**
 * @route   GET /api/v1/reference/categories
 * @desc    Get all age-based categories with counts
 * @access  Public
 */
// TODO: Implement categories once Category model is added to schema
// router.get('/categories', async (req: Request, res: Response) => {
//   try {
//     const categories = await prisma.category.findMany({
//       orderBy: { displayOrder: 'asc' },
//       include: {
//         _count: {
//           select: { activities: true }
//         }
//       }
//     });
//
//     const categoriesWithCounts = categories.map(cat => ({
//       code: cat.code,
//       name: cat.name,
//       description: cat.description,
//       ageMin: cat.ageMin,
//       ageMax: cat.ageMax,
//       activityCount: cat._count.activities,
//       displayOrder: cat.displayOrder
//     }));
//
//     res.json({
//       success: true,
//       data: categoriesWithCounts,
//       total: categoriesWithCounts.length
//     });
//   } catch (error: any) {
//     console.error('Error fetching categories:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to fetch categories'
//     });
//   }
// });

export default router;