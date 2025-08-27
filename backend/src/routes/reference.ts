import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/reference/activity-types
 * @desc    Get all activity types with activity counts
 * @access  Public
 */
router.get('/activity-types', async (req: Request, res: Response) => {
  try {
    // Get all activity types with counts
    const activityTypeCounts = await prisma.activity.groupBy({
      by: ['activityType'],
      where: {
        isActive: true,
        activityType: { not: null }
      },
      _count: { id: true }
    });

    // Get all activity type records for display names and order
    const activityTypes = await prisma.activityType.findMany({
      orderBy: { displayOrder: 'asc' }
    });

    // Create a map for quick lookup
    const typeMap = new Map(activityTypes.map(t => [t.name, t]));

    // Combine counts with type metadata
    const typesWithCounts = activityTypeCounts
      .map(item => {
        const typeInfo = typeMap.get(item.activityType || '');
        return {
          code: typeInfo?.code || item.activityType?.toLowerCase().replace(/\s+/g, '-'),
          name: item.activityType,
          displayName: typeInfo?.name || item.activityType,
          activityCount: item._count.id,
          displayOrder: typeInfo?.displayOrder || 999
        };
      })
      .filter(item => item.name) // Filter out nulls
      .sort((a, b) => a.displayOrder - b.displayOrder);

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
    
    // Convert code to name (e.g., "team-sports" -> "Team Sports")
    const typeName = typeCode.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    // Get all activities for this type
    const activities = await prisma.activity.findMany({
      where: {
        activityType: typeName,
        isActive: true
      },
      select: {
        activitySubtype: true
      }
    });

    // Count by subtype
    const subtypeCounts = activities.reduce((acc, activity) => {
      const subtype = activity.activitySubtype || 'General';
      acc[subtype] = (acc[subtype] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Convert to array and sort
    const subtypes = Object.entries(subtypeCounts)
      .map(([name, count]) => ({
        code: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        activityCount: count
      }))
      .sort((a, b) => b.activityCount - a.activityCount);

    res.json({
      success: true,
      data: {
        code: typeCode,
        name: typeName,
        totalActivities: activities.length,
        subtypes
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
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { activities: true }
        }
      }
    });

    const categoriesWithCounts = categories.map(cat => ({
      code: cat.code,
      name: cat.name,
      description: cat.description,
      ageMin: cat.ageMin,
      ageMax: cat.ageMax,
      activityCount: cat._count.activities,
      displayOrder: cat.displayOrder
    }));

    res.json({
      success: true,
      data: categoriesWithCounts,
      total: categoriesWithCounts.length
    });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

export default router;