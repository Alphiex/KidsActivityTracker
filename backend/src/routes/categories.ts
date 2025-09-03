import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { buildActivityWhereClause } from '../utils/activityFilters';

const router = Router();
const prisma = new PrismaClient();

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 categories:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 *             example:
 *               success: true
 *               categories:
 *                 - id: "uuid-1"
 *                   name: "Early Years: Parent Participation"
 *                   description: "Activities for children 0-5 years that require parent participation"
 *                   ageMin: 0
 *                   ageMax: 5
 *                   requiresParent: true
 *                   activityCount: 45
 *                 - id: "uuid-2"
 *                   name: "School Age"
 *                   description: "Activities for elementary/middle school age children (5-13 years)"
 *                   ageMin: 5
 *                   ageMax: 13
 *                   requiresParent: false
 *                   activityCount: 234
 *       500:
 *         description: Server error
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

    // Get all categories ordered by display order
    const categories = await prisma.category.findMany({
      orderBy: { displayOrder: 'asc' }
    });

    let categoriesWithCounts = categories;

    if (includeActivityCounts === 'true') {
      // Build activity filter for global filters
      const baseActivityWhere = {
        isUpdated: true
      };

      const globalFilters = {
        hideClosedActivities: hideClosedActivities === 'true',
        hideFullActivities: hideFullActivities === 'true'
      };

      const activityWhereClause = buildActivityWhereClause(baseActivityWhere, globalFilters);

      // Get activity counts for each category
      categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          const count = await prisma.activity.count({
            where: {
              ...activityWhereClause,
              categories: {
                some: {
                  categoryId: category.id
                }
              }
            }
          });

          return {
            ...category,
            activityCount: count
          };
        })
      );
    }

    console.log('✅ [Categories API] Response:', {
      categoriesCount: categoriesWithCounts.length,
      firstCategory: categoriesWithCounts[0] ? {
        name: categoriesWithCounts[0].name,
        count: (categoriesWithCounts[0] as any).activityCount
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
 *     description: |
 *       Returns paginated activities that belong to a specific age-based category.
 *       Used by: CategoryDetailScreen for displaying activities in a category.
 *       Navigation flow: Dashboard → Categories → Category Detail (this endpoint) → Activity Detail
 *       Supports extensive filtering, sorting, and search within the category.
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Category UUID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: string
 *           default: '50'
 *         description: Number of activities to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: string
 *           default: '0'
 *         description: Number of activities to skip for pagination
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [dateStart, name, cost, registrationDate]
 *           default: 'dateStart'
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: 'asc'
 *         description: Sort direction
 *       - in: query
 *         name: hideClosedActivities
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *         description: Filter out closed activities
 *       - in: query
 *         name: hideFullActivities
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *         description: Filter out full activities
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in activity name and description
 *       - in: query
 *         name: ageMin
 *         schema:
 *           type: string
 *         description: Minimum age requirement
 *       - in: query
 *         name: ageMax
 *         schema:
 *           type: string
 *         description: Maximum age requirement
 *       - in: query
 *         name: costMin
 *         schema:
 *           type: string
 *         description: Minimum cost filter
 *       - in: query
 *         name: costMax
 *         schema:
 *           type: string
 *         description: Maximum cost filter
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter activities starting after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter activities ending before this date
 *       - in: query
 *         name: dayOfWeek
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by days of the week
 *       - in: query
 *         name: locations
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by location IDs or names
 *     responses:
 *       200:
 *         description: Paginated activities in category
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 category:
 *                   $ref: '#/components/schemas/Category'
 *                 activities:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Activity'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationResponse'
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
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
      // Additional filter parameters
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

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // Build base where clause
    const baseWhere: any = {
      isUpdated: true,
      categories: {
        some: {
          categoryId: id
        }
      }
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
            { city: { name: { in: locationList } } }
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
              city: true
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
      category,
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