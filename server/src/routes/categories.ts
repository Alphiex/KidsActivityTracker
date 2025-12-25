import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { buildActivityWhereClause } from '../utils/activityFilters';

const router = Router();
const prisma = new PrismaClient();

// Define the age-based categories with their metadata
const AGE_CATEGORIES = [
  {
    id: 'early-years-parent',
    name: 'Early Years: Parent Participation',
    description: 'Activities for children 0-5 years that require parent participation',
    ageMin: 0,
    ageMax: 5,
    requiresParent: true,
    displayOrder: 1,
    categoryValues: ['Early Years: Parent Participation', 'Parent & Tot', 'Parent Participation']
  },
  {
    id: 'early-years-independent',
    name: 'Early Years: On My Own',
    description: 'Activities for children 3-5 years without parent participation',
    ageMin: 3,
    ageMax: 5,
    requiresParent: false,
    displayOrder: 2,
    categoryValues: ['Early Years: On My Own', 'Preschool', 'Early Years']
  },
  {
    id: 'school-age',
    name: 'School Age',
    description: 'Activities for elementary/middle school age children (5-13 years)',
    ageMin: 5,
    ageMax: 13,
    requiresParent: false,
    displayOrder: 3,
    categoryValues: ['School Age', 'Kids', 'Children']
  },
  {
    id: 'youth',
    name: 'Youth',
    description: 'Activities for teenagers (13-18 years)',
    ageMin: 13,
    ageMax: 18,
    requiresParent: false,
    displayOrder: 4,
    categoryValues: ['Youth', 'Teen', 'Teens']
  },
  {
    id: 'all-ages',
    name: 'All Ages & Family',
    description: 'Activities suitable for all ages or family participation',
    ageMin: 0,
    ageMax: 99,
    requiresParent: false,
    displayOrder: 5,
    categoryValues: ['All Ages & Family', 'Family', 'All Ages']
  }
];

/**
 * @swagger
 * /api/v1/categories:
 *   get:
 *     summary: Get all age-based categories with activity counts
 *     description: |
 *       Returns all 5 age-based categories (Early Years: Parent Participation, Early Years: On My Own,
 *       School Age, Youth, All Ages & Family) with activity counts.
 *       Used by: DashboardScreen "Browse by Category" section, AllCategoriesScreen.
 *       Navigation flow: Dashboard → Categories → Category Detail → Activities
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: hideClosedActivities
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *         description: Filter out closed activities from counts
 *       - in: query
 *         name: hideFullActivities
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *         description: Filter out full activities from counts
 *       - in: query
 *         name: includeActivityCounts
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'true'
 *         description: Whether to include activity counts (can be disabled for performance)
 *     responses:
 *       200:
 *         description: List of age-based categories with counts
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      hideClosedActivities = 'false',
      hideFullActivities = 'false',
      includeActivityCounts = 'true'
    } = req.query;

    console.log('📋 [Categories API] Request params:', {
      hideClosedActivities,
      hideFullActivities,
      includeActivityCounts
    });

    let categoriesWithCounts = AGE_CATEGORIES.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      ageMin: cat.ageMin,
      ageMax: cat.ageMax,
      requiresParent: cat.requiresParent,
      displayOrder: cat.displayOrder,
      activityCount: 0
    }));

    if (includeActivityCounts === 'true') {
      const globalFilters = {
        hideClosedActivities: hideClosedActivities === 'true',
        hideFullActivities: hideFullActivities === 'true'
      };

      // Get activity counts for each category based on the category string field
      categoriesWithCounts = await Promise.all(
        AGE_CATEGORIES.map(async (cat) => {
          const baseWhere = {
            isActive: true,
            category: { in: cat.categoryValues }
          };
          const activityWhereClause = buildActivityWhereClause(baseWhere, globalFilters);

          const count = await prisma.activity.count({
            where: activityWhereClause
          });

          return {
            id: cat.id,
            name: cat.name,
            description: cat.description,
            ageMin: cat.ageMin,
            ageMax: cat.ageMax,
            requiresParent: cat.requiresParent,
            displayOrder: cat.displayOrder,
            activityCount: count
          };
        })
      );
    }

    console.log('✅ [Categories API] Response:', {
      categoriesCount: categoriesWithCounts.length,
      firstCategory: categoriesWithCounts[0] ? {
        name: categoriesWithCounts[0].name,
        count: categoriesWithCounts[0].activityCount
      } : null
    });

    res.json({
      success: true,
      categories: categoriesWithCounts
    });
  } catch (error: any) {
    console.error('❌ [Categories API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

/**
 * @swagger
 * /api/v1/categories/{id}/activities:
 *   get:
 *     summary: Get activities for a specific age-based category
 */
router.get('/:id/activities', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      limit = '50',
      offset = '0',
      sortBy = 'dateStart',
      sortOrder = 'asc',
      hideClosedActivities = 'false',
      hideFullActivities = 'false',
      search,
      ageMin,
      ageMax,
      costMin,
      costMax,
      startDate,
      endDate,
      dayOfWeek,
      locations
    } = req.query;

    console.log('🎯 [Category Activities API] Request:', {
      categoryId: id,
      limit,
      offset,
      hideClosedActivities,
      hideFullActivities
    });

    // Find the category by id
    const category = AGE_CATEGORIES.find(cat => cat.id === id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // Build base where clause using category string values
    const baseWhere: any = {
      isActive: true,
      category: { in: category.categoryValues }
    };

    // Add search filter
    if (search) {
      baseWhere.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { location: { name: { contains: search as string, mode: 'insensitive' } } }
      ];
    }

    // Add age filters
    if (ageMin !== undefined || ageMax !== undefined) {
      const andConditions = [];
      if (ageMin !== undefined) {
        andConditions.push({
          OR: [
            { ageMin: { lte: parseInt(ageMin as string) } },
            { ageMin: null }
          ]
        });
      }
      if (ageMax !== undefined) {
        andConditions.push({
          OR: [
            { ageMax: { gte: parseInt(ageMax as string) } },
            { ageMax: null }
          ]
        });
      }
      if (andConditions.length > 0) {
        baseWhere.AND = baseWhere.AND ? [...(Array.isArray(baseWhere.AND) ? baseWhere.AND : [baseWhere.AND]), ...andConditions] : andConditions;
      }
    }

    // Add cost filters
    if (costMin !== undefined || costMax !== undefined) {
      const costFilter: any = {};
      if (costMin !== undefined) costFilter.gte = parseFloat(costMin as string);
      if (costMax !== undefined) costFilter.lte = parseFloat(costMax as string);
      baseWhere.cost = costFilter;
    }

    // Add date filters
    if (startDate) {
      baseWhere.dateEnd = { gte: new Date(startDate as string) };
    }
    if (endDate) {
      baseWhere.dateStart = { lte: new Date(endDate as string) };
    }

    // Add day of week filter
    if (dayOfWeek) {
      const days = Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek];
      baseWhere.dayOfWeek = { hasSome: days };
    }

    // Add location filter
    if (locations) {
      const locationList = Array.isArray(locations) ? locations as string[] : (locations as string).split(',').map(l => l.trim());
      const isLocationId = locationList[0] && typeof locationList[0] === 'string' && locationList[0].match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

      if (isLocationId) {
        baseWhere.locationId = { in: locationList };
      } else {
        baseWhere.location = {
          OR: [
            { name: { in: locationList } },
            { city: { in: locationList } }
          ]
        };
      }
    }

    // Apply global filters
    const globalFilters = {
      hideClosedActivities: hideClosedActivities === 'true',
      hideFullActivities: hideFullActivities === 'true'
    };

    const finalWhere = buildActivityWhereClause(baseWhere, globalFilters);

    // Get activities and total count
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where: finalWhere,
        include: {
          provider: true,
          location: {
            include: {
              cityRecord: true
            }
          },
          activityType: true,
          activitySubtype: true,
          _count: {
            select: { favorites: true }
          }
        },
        orderBy: { [sortBy as string]: sortOrder },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.activity.count({ where: finalWhere })
    ]);

    console.log('✅ [Category Activities API] Response:', {
      categoryName: category.name,
      totalActivities: total,
      returnedActivities: activities.length
    });

    res.json({
      success: true,
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
        ageMin: category.ageMin,
        ageMax: category.ageMax,
        requiresParent: category.requiresParent,
        displayOrder: category.displayOrder
      },
      activities,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error: any) {
    console.error('❌ [Category Activities API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category activities'
    });
  }
});

export default router;
