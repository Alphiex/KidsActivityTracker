import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/categories
 * @desc    Get all activity categories with counts
 * @access  Public
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    // Get categories with activity counts
    const categories = await prisma.activity.groupBy({
      by: ['category'],
      where: {
        isActive: true,
        category: {
          not: null
        }
      },
      _count: {
        _all: true
      },
      orderBy: {
        _count: {
          _all: 'desc'
        }
      }
    });

    const categoriesWithCounts = categories.map(cat => ({
      name: cat.category,
      count: cat._count._all
    }));

    res.json({
      success: true,
      categories: categoriesWithCounts
    });
  } catch (error: any) {
    console.error('Categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

/**
 * @route   GET /api/v1/locations
 * @desc    Get all locations with active activities
 * @access  Public
 */
router.get('/locations', async (req: Request, res: Response) => {
  try {
    // Only get locations that have active activities
    const locations = await prisma.location.findMany({
      where: {
        activities: {
          some: {
            isActive: true
          }
        },
        // We'll filter bad locations in JavaScript to avoid TypeScript issues
      },
      include: {
        _count: {
          select: { 
            activities: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Filter out locations with names that are clearly activity descriptions
    const cleanedLocations = locations.filter(loc => {
      const name = loc.name;
      // Check if name is too long (likely a description)
      if (name.length > 100) return false;
      // Check if name contains newlines or special formatting
      if (name.includes('\n') || name.includes('\r')) return false;
      // Check if name contains activity keywords
      if (name.match(/lesson|class|program|registration|#\d{6}/i)) return false;
      return true;
    });

    res.json({
      success: true,
      locations: cleanedLocations.map(loc => ({
        id: loc.id,
        name: loc.name.trim(),
        address: loc.address,
        city: loc.city,
        province: loc.province,
        postalCode: loc.postalCode,
        facility: loc.facility,
        activityCount: loc._count.activities
      }))
    });
  } catch (error: any) {
    console.error('Locations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch locations'
    });
  }
});

/**
 * @route   GET /api/v1/providers
 * @desc    Get all active providers
 * @access  Public
 */
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers = await prisma.provider.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        website: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      providers
    });
  } catch (error: any) {
    console.error('Providers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch providers'
    });
  }
});

/**
 * @route   GET /api/v1/age-groups
 * @desc    Get age groups with activity counts
 * @access  Public
 */
router.get('/age-groups', async (req: Request, res: Response) => {
  try {
    const ageGroups = [
      { id: '0-2', name: '0-2 years', min: 0, max: 2 },
      { id: '3-5', name: '3-5 years', min: 3, max: 5 },
      { id: '6-8', name: '6-8 years', min: 6, max: 8 },
      { id: '9-12', name: '9-12 years', min: 9, max: 12 },
      { id: '13+', name: '13+ years', min: 13, max: 99 }
    ];

    // Get counts for each age group
    const groupsWithCounts = await Promise.all(
      ageGroups.map(async (group) => {
        const count = await prisma.activity.count({
          where: {
            isActive: true,
            ageMin: { lte: group.max },
            ageMax: { gte: group.min }
          }
        });
        return {
          ...group,
          count
        };
      })
    );

    res.json({
      success: true,
      ageGroups: groupsWithCounts
    });
  } catch (error: any) {
    console.error('Age groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch age groups'
    });
  }
});

/**
 * @route   GET /api/v1/activity-types
 * @desc    Get activity types (subcategories) with counts
 * @access  Public
 */
router.get('/activity-types', async (req: Request, res: Response) => {
  try {
    // Get subcategories with activity counts
    const activityTypes = await prisma.activity.groupBy({
      by: ['subcategory'],
      where: {
        isActive: true,
        subcategory: {
          not: null
        }
      },
      _count: {
        _all: true
      },
      orderBy: {
        _count: {
          _all: 'desc'
        }
      }
    });

    const typesWithCounts = activityTypes.map(type => ({
      name: type.subcategory,
      count: type._count._all
    }));

    res.json({
      success: true,
      activityTypes: typesWithCounts
    });
  } catch (error: any) {
    console.error('Activity types error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity types'
    });
  }
});

export default router;