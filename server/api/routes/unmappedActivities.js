const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../../generated/prisma');
const prisma = new PrismaClient();

/**
 * GET /api/v1/unmapped-activities
 * Admin endpoint to get unmapped activities for review
 */
router.get('/', async (req, res) => {
  try {
    const { 
      reviewed = false,
      page = 1,
      limit = 50 
    } = req.query;
    
    const where = {};
    if (reviewed !== 'all') {
      where.reviewed = reviewed === 'true';
    }
    
    const skip = (page - 1) * limit;
    
    const [unmappedActivities, total] = await Promise.all([
      prisma.unmappedActivity.findMany({
        where,
        skip,
        take: limit,
        include: {
          activity: {
            select: {
              id: true,
              name: true,
              category: true,
              subcategory: true,
              description: true,
              ageMin: true,
              ageMax: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.unmappedActivity.count({ where })
    ]);
    
    // Group by original category for summary
    const categorySummary = await prisma.unmappedActivity.groupBy({
      by: ['originalCategory', 'originalSubcategory'],
      _count: { id: true },
      where: { reviewed: false }
    });
    
    res.json({
      success: true,
      data: {
        activities: unmappedActivities,
        summary: {
          total,
          unreviewed: await prisma.unmappedActivity.count({ where: { reviewed: false } }),
          reviewed: await prisma.unmappedActivity.count({ where: { reviewed: true } }),
          byCategory: categorySummary
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching unmapped activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unmapped activities'
    });
  }
});

/**
 * POST /api/v1/unmapped-activities/:id/map
 * Map an unmapped activity to proper type/subtype
 */
router.post('/:id/map', async (req, res) => {
  try {
    const { id } = req.params;
    const { activityType, activitySubtype, notes } = req.body;
    
    if (!activityType || !activitySubtype) {
      return res.status(400).json({
        success: false,
        error: 'activityType and activitySubtype are required'
      });
    }
    
    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get the unmapped activity
      const unmapped = await tx.unmappedActivity.findUnique({
        where: { id }
      });
      
      if (!unmapped) {
        throw new Error('Unmapped activity not found');
      }
      
      // Update the actual activity
      const updatedActivity = await tx.activity.update({
        where: { id: unmapped.activityId },
        data: {
          activityType,
          activitySubtype
        }
      });
      
      // Mark unmapped activity as reviewed
      const updatedUnmapped = await tx.unmappedActivity.update({
        where: { id },
        data: {
          reviewed: true,
          mappedType: activityType,
          mappedSubtype: activitySubtype,
          notes,
          reviewedAt: new Date(),
          reviewedBy: 'admin' // TODO: Get from auth context
        }
      });
      
      return { activity: updatedActivity, unmapped: updatedUnmapped };
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error mapping activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to map activity'
    });
  }
});

/**
 * POST /api/v1/unmapped-activities/map-bulk
 * Map multiple unmapped activities at once
 */
router.post('/map-bulk', async (req, res) => {
  try {
    const { mappings } = req.body;
    
    if (!Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'mappings array is required'
      });
    }
    
    const results = {
      success: [],
      failed: []
    };
    
    // Process each mapping
    for (const mapping of mappings) {
      try {
        const { unmappedId, activityType, activitySubtype } = mapping;
        
        await prisma.$transaction(async (tx) => {
          const unmapped = await tx.unmappedActivity.findUnique({
            where: { id: unmappedId }
          });
          
          if (!unmapped) {
            throw new Error(`Unmapped activity ${unmappedId} not found`);
          }
          
          await tx.activity.update({
            where: { id: unmapped.activityId },
            data: {
              activityType,
              activitySubtype
            }
          });
          
          await tx.unmappedActivity.update({
            where: { id: unmappedId },
            data: {
              reviewed: true,
              mappedType: activityType,
              mappedSubtype: activitySubtype,
              reviewedAt: new Date(),
              reviewedBy: 'admin'
            }
          });
        });
        
        results.success.push(unmappedId);
      } catch (error) {
        results.failed.push({
          id: mapping.unmappedId,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error bulk mapping activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk map activities'
    });
  }
});

module.exports = router;