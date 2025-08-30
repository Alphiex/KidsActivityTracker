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
    const { includeSubtypes = 'true' } = req.query; // Default to true for compatibility
    
    // Get all activity types with subtypes
    const activityTypes = await prisma.activityType.findMany({
      where: {
        // Exclude "Other Activity" from normal filters
        code: { not: 'other-activity' }
      },
      orderBy: { displayOrder: 'asc' },
      include: {
        subtypes: {
          orderBy: { displayOrder: 'asc' }
        }
      }
    });
    
    // Get activity counts for each type by counting activities with that activityTypeId
    const typeCounts = [];
    for (const type of activityTypes) {
      const count = await prisma.activity.count({
        where: {
          isActive: true,
          activityTypeId: type.id
        }
      });
      typeCounts.push({
        activityTypeId: type.id,
        _count: { id: count }
      });
    }
    
    // Get activity counts for each subtype
    const subtypeCounts = [];
    for (const type of activityTypes) {
      for (const subtype of type.subtypes) {
        const count = await prisma.activity.count({
          where: {
            isActive: true,
            activityTypeId: type.id,
            activitySubtypeId: subtype.id
          }
        });
        if (count > 0) {
          subtypeCounts.push({
            activityTypeId: type.id,
            activitySubtypeId: subtype.id,
            _count: { id: count }
          });
        }
      }
      
      // Also count activities with this type but no subtype (null subtypeId)
      const noSubtypeCount = await prisma.activity.count({
        where: {
          isActive: true,
          activityTypeId: type.id,
          activitySubtypeId: null
        }
      });
      
      if (noSubtypeCount > 0) {
        subtypeCounts.push({
          activityTypeId: type.id,
          activitySubtypeId: 'no-subtype',
          _count: { id: noSubtypeCount }
        });
      }
    }
    
    // Create count maps
    const typeCountMap = {};
    typeCounts.forEach(tc => {
      typeCountMap[tc.activityTypeId] = tc._count.id;
    });
    
    const subtypeCountMap = {};
    subtypeCounts.forEach(sc => {
      const key = `${sc.activityTypeId}:${sc.activitySubtypeId}`;
      subtypeCountMap[key] = sc._count.id;
    });
    
    // Format the response with counts
    const formattedTypes = activityTypes.map(type => {
      const typeWithCount = {
        id: type.id,
        code: type.code,
        name: type.name,
        displayOrder: type.displayOrder,
        activityCount: typeCountMap[type.id] || 0
      };
      
      // Add subtypes with their counts if requested
      if (includeSubtypes === 'true' && type.subtypes) {
        typeWithCount.subtypes = type.subtypes.map(subtype => ({
          id: subtype.id,
          activityTypeId: subtype.activityTypeId,
          code: subtype.code,
          name: subtype.name,
          description: subtype.description,
          imageUrl: subtype.imageUrl,
          displayOrder: subtype.displayOrder,
          createdAt: subtype.createdAt,
          updatedAt: subtype.updatedAt,
          activityCount: subtypeCountMap[`${type.id}:${subtype.id}`] || 0
        }));
        
        // Add "Other" category for activities without subtypes if they exist
        const noSubtypeCount = subtypeCountMap[`${type.id}:no-subtype`] || 0;
        if (noSubtypeCount > 0) {
          typeWithCount.subtypes.push({
            id: 'no-subtype',
            activityTypeId: type.id,
            code: 'other',
            name: 'Other',
            description: 'Other activities in this category',
            imageUrl: null,
            displayOrder: 999,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            activityCount: noSubtypeCount
          });
        }
      }
      
      return typeWithCount;
    });
    
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
      activityTypeId: activityType.id,
      isActive: true
    };
    
    if (subtype) {
      if (subtype === 'other' || subtype === 'no-subtype') {
        // Show activities without a subtype
        where.activitySubtypeId = null;
      } else {
        // Find the subtype by code or name
        const subtypeRecord = await prisma.activitySubtype.findFirst({
          where: {
            OR: [
              { code: subtype },
              { name: subtype }
            ],
            activityTypeId: activityType.id
          }
        });
        
        if (subtypeRecord) {
          where.activitySubtypeId = subtypeRecord.id;
        }
      }
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