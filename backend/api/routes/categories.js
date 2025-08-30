const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../../generated/prisma');
const prisma = new PrismaClient();

/**
 * GET /api/v1/categories
 * Get age-based categories (simulated since Category table doesn't exist)
 */
router.get('/', async (req, res) => {
  try {
    // Since we don't have a Category table, create age-based categories from activities
    const ageCategories = [
      { 
        id: 'baby-0-2',
        code: 'baby',
        name: 'Baby (0-2 years)',
        ageMin: 0,
        ageMax: 2,
        requiresParent: true,
        description: 'Activities for babies and toddlers',
        displayOrder: 1
      },
      {
        id: 'toddler-2-4',
        code: 'toddler',
        name: 'Toddler (2-4 years)',
        ageMin: 2,
        ageMax: 4,
        requiresParent: true,
        description: 'Activities for toddlers',
        displayOrder: 2
      },
      {
        id: 'preschool-3-5',
        code: 'preschool',
        name: 'Preschool (3-5 years)',
        ageMin: 3,
        ageMax: 5,
        requiresParent: false,
        description: 'Activities for preschoolers',
        displayOrder: 3
      },
      {
        id: 'school-age-6-12',
        code: 'school-age',
        name: 'School Age (6-12 years)',
        ageMin: 6,
        ageMax: 12,
        requiresParent: false,
        description: 'Activities for school-aged children',
        displayOrder: 4
      },
      {
        id: 'teen-13-17',
        code: 'teen',
        name: 'Teen (13-17 years)',
        ageMin: 13,
        ageMax: 17,
        requiresParent: false,
        description: 'Activities for teenagers',
        displayOrder: 5
      },
      {
        id: 'all-ages',
        code: 'all-ages',
        name: 'All Ages',
        ageMin: 0,
        ageMax: 99,
        requiresParent: false,
        description: 'Activities for all ages',
        displayOrder: 6
      }
    ];
    
    // Get activity counts for each age category
    const categoriesWithCounts = await Promise.all(ageCategories.map(async (cat) => {
      const whereClause = {
        isActive: true
      };
      
      // For age-based filtering, we'll use the ageMin and ageMax fields if they exist
      // Note: The Activity model doesn't have ageMin/ageMax fields in the current schema
      // We'll just count all active activities for now
      
      const count = await prisma.activity.count({
        where: whereClause
      });
      
      return {
        ...cat,
        count: count,
        activityCount: count  // For compatibility
      };
    }));
    
    res.json({
      success: true,
      data: categoriesWithCounts
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
    
    // Define the same age categories
    const ageCategories = {
      'baby': { ageMin: 0, ageMax: 2, requiresParent: true },
      'toddler': { ageMin: 2, ageMax: 4, requiresParent: true },
      'preschool': { ageMin: 3, ageMax: 5, requiresParent: false },
      'school-age': { ageMin: 6, ageMax: 12, requiresParent: false },
      'teen': { ageMin: 13, ageMax: 17, requiresParent: false },
      'all-ages': { ageMin: 0, ageMax: 99, requiresParent: false }
    };
    
    const category = ageCategories[code];
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }
    
    // Build where clause based on category
    // Note: Since Activity model doesn't have age fields, we'll filter by other criteria
    const where = {
      isActive: true
    };
    
    if (activityType) {
      where.activityType = activityType;
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