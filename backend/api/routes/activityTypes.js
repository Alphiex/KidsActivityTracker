const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../../generated/prisma');
const prisma = new PrismaClient();
const imageService = require('../../services/imageService');

/**
 * GET /api/v1/activity-types
 * Get all activity types (for filters) - NOT subtypes
 */
router.get('/', async (req, res) => {
  try {
    const { includeSubtypes = false } = req.query;
    
    const activityTypes = await prisma.activityType.findMany({
      where: {
        // Exclude "Other Activity" from normal filters
        code: { not: 'other-activity' }
      },
      orderBy: { displayOrder: 'asc' },
      include: includeSubtypes === 'true' ? {
        subtypes: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      } : false,
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        iconName: true,
        imageUrl: true,
        displayOrder: true,
        ...(includeSubtypes === 'true' ? { subtypes: true } : {})
      }
    });
    
    // Get activity counts for each type
    const typeCounts = await prisma.activity.groupBy({
      by: ['activityType'],
      _count: { id: true },
      where: {
        isActive: true
      }
    });
    
    const countMap = {};
    typeCounts.forEach(tc => {
      countMap[tc.activityType] = tc._count.id;
    });
    
    const formattedTypes = activityTypes.map(type => ({
      ...type,
      activityCount: countMap[type.name] || 0
    }));
    
    res.json({
      success: true,
      data: formattedTypes
    });
  } catch (error) {
    console.error('Error fetching activity types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity types'
    });
  }
});

/**
 * GET /api/v1/activity-types/:code
 * Get a specific activity type with its subtypes
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const activityType = await prisma.activityType.findUnique({
      where: { code },
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
    
    // Get count of activities for this type
    const activityCount = await prisma.activity.count({
      where: {
        activityType: activityType.name,
        isActive: true
      }
    });
    
    // Get subtype counts
    const subtypeCounts = await prisma.activity.groupBy({
      by: ['activitySubtype'],
      _count: { id: true },
      where: {
        activityType: activityType.name,
        isActive: true
      }
    });
    
    const subtypeCountMap = {};
    subtypeCounts.forEach(sc => {
      subtypeCountMap[sc.activitySubtype] = sc._count.id;
    });
    
    const formattedSubtypes = activityType.subtypes.map(sub => ({
      ...sub,
      activityCount: subtypeCountMap[sub.name] || 0
    }));
    
    res.json({
      success: true,
      data: {
        ...activityType,
        subtypes: formattedSubtypes,
        activityCount
      }
    });
  } catch (error) {
    console.error('Error fetching activity type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity type'
    });
  }
});

/**
 * GET /api/v1/activity-types/:code/activities
 * Get activities for a specific activity type
 */
router.get('/:code/activities', async (req, res) => {
  try {
    const { code } = req.params;
    const {
      subtype,
      category,
      requiresParent,
      ageMin,
      ageMax,
      page = 1,
      limit = 50,
      search
    } = req.query;
    
    const activityType = await prisma.activityType.findUnique({
      where: { code }
    });
    
    if (!activityType) {
      return res.status(404).json({
        success: false,
        error: 'Activity type not found'
      });
    }
    
    // Build where clause
    const where = {
      activityType: activityType.name,
      isActive: true
    };
    
    if (subtype) {
      where.activitySubtype = subtype;
    }
    
    if (category) {
      const categoryRecord = await prisma.category.findUnique({
        where: { code: category }
      });
      
      if (categoryRecord) {
        where.categories = {
          some: { categoryId: categoryRecord.id }
        };
      }
    }
    
    if (requiresParent !== undefined) {
      where.requiresParent = requiresParent === 'true';
    }
    
    if (ageMin) {
      where.ageMax = { gte: parseInt(ageMin) };
    }
    
    if (ageMax) {
      where.ageMin = { lte: parseInt(ageMax) };
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip,
        take: limit,
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
    
    // Enhance activities with image URLs
    const enhancedActivities = await imageService.enhanceActivitiesWithImages(activities);
    
    res.json({
      success: true,
      data: {
        activities: enhancedActivities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activities'
    });
  }
});

module.exports = router;