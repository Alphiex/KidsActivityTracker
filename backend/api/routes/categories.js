const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../../generated/prisma');
const prisma = new PrismaClient();

/**
 * GET /api/v1/categories
 * Get all age-based categories
 */
router.get('/', async (req, res) => {
  try {
    // First get categories with just the count
    const categories = await prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { activities: true }
        }
      }
    });
    
    // For each category, get unique activity count separately
    const formattedCategories = await Promise.all(categories.map(async (cat) => {
      // Get unique activity names for this category
      const uniqueActivities = await prisma.activity.findMany({
        where: {
          categories: {
            some: { categoryId: cat.id }
          },
          isActive: true
        },
        select: {
          name: true
        },
        distinct: ['name']
      });
      
      return {
        id: cat.id,
        code: cat.code,
        name: cat.name,
        ageMin: cat.ageMin,
        ageMax: cat.ageMax,
        requiresParent: cat.requiresParent,
        description: cat.description,
        displayOrder: cat.displayOrder,
        activityCount: cat._count.activities,  // Total sessions
        uniqueActivityCount: uniqueActivities.length  // Unique activities
      };
    }));
    
    res.json({
      success: true,
      data: formattedCategories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

/**
 * GET /api/v1/categories/:code/activities
 * Get activities for a specific category
 */
router.get('/:code/activities', async (req, res) => {
  try {
    const { code } = req.params;
    const { 
      activityType,
      requiresParent,
      page = 1,
      limit = 50,
      search,
      groupByName = 'false'  // Default to false to show all sessions
    } = req.query;
    
    // Allow higher limits for category browsing, but cap at 500 for performance
    const requestedLimit = Math.min(parseInt(limit) || 50, 500);
    
    const category = await prisma.category.findUnique({
      where: { code }
    });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }
    
    // Build where clause
    const where = {
      categories: {
        some: { categoryId: category.id }
      },
      isActive: true
    };
    
    if (activityType) {
      where.activityType = activityType;
    }
    
    if (requiresParent !== undefined) {
      where.requiresParent = requiresParent === 'true';
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { activityType: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const parsedPage = parseInt(page) || 1;
    const skip = (parsedPage - 1) * requestedLimit;
    
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip: groupByName === 'true' ? undefined : skip,
        take: groupByName === 'true' ? undefined : requestedLimit,
        include: {
          location: true,
          provider: {
            select: { name: true }
          },
          categories: {
            include: {
              category: true
            }
          }
        },
        orderBy: { dateStart: 'asc' }
      }),
      prisma.activity.count({ where })
    ]);
    
    // If groupByName is true, group activities by name
    let processedActivities = activities;
    let processedTotal = total;
    
    if (groupByName === 'true') {
      const groupedMap = new Map();
      
      activities.forEach(activity => {
        if (!groupedMap.has(activity.name)) {
          // Keep the first occurrence with all sessions bundled
          groupedMap.set(activity.name, {
            ...activity,
            sessions: [activity]
          });
        } else {
          // Add this session to the existing group
          groupedMap.get(activity.name).sessions.push(activity);
        }
      });
      
      // Convert map to array and apply pagination
      const grouped = Array.from(groupedMap.values());
      processedTotal = grouped.length;
      processedActivities = grouped.slice(skip, skip + requestedLimit);
    }
    
    res.json({
      success: true,
      data: {
        activities: processedActivities,
        pagination: {
          page: parsedPage,
          limit: requestedLimit,
          total: processedTotal,
          totalPages: Math.ceil(processedTotal / requestedLimit)
        },
        grouped: groupByName === 'true'
      }
    });
  } catch (error) {
    console.error('Error fetching category activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activities'
    });
  }
});

module.exports = router;