const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../../generated/prisma');
const prisma = new PrismaClient();

/**
 * GET /api/v1/cities
 * Get all cities with venue and activity counts
 */
router.get('/', async (req, res) => {
  try {
    // Get cities with location and activity counts using normalized schema
    const cities = await prisma.city.findMany({
      include: {
        _count: {
          select: {
            locations: true
          }
        }
      }
    });
    
    // Get activity counts per city
    const citiesWithActivityCounts = await Promise.all(
      cities.map(async (city) => {
        const activityCount = await prisma.activity.count({
          where: {
            location: {
              cityId: city.id
            },
            isActive: true
          }
        });
        
        return {
          city: city.name,
          province: city.province,
          venueCount: city._count.locations,
          activityCount
        };
      })
    );
    
    res.json({
      success: true,
      data: citiesWithActivityCounts
    });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cities'
    });
  }
});

/**
 * GET /api/v1/cities/:city/locations
 * Get all locations/venues in a specific city
 */
router.get('/:city/locations', async (req, res) => {
  try {
    const { city } = req.params;
    const decodedCity = decodeURIComponent(city);
    
    // Build activity filter with global filters applied manually
    const activityWhere = {
      isActive: true
    };
    
    // Apply global filters
    const andConditions = [];
    
    // Hide closed activities
    if (req.query.hideClosedActivities === 'true') {
      andConditions.push({
        NOT: { registrationStatus: 'Closed' }
      });
    }
    
    // Hide full activities (no spots available)
    if (req.query.hideFullActivities === 'true') {
      andConditions.push({
        OR: [
          { spotsAvailable: { gt: 0 } },
          { spotsAvailable: null }
        ]
      });
    }
    
    // Apply AND conditions if any
    if (andConditions.length > 0) {
      activityWhere.AND = andConditions;
    }
    
    const locations = await prisma.location.findMany({
      where: {
        city: {
          name: {
            equals: decodedCity,
            mode: 'insensitive'
          }
        }
      },
      include: {
        city: true, // Include city data
        _count: {
          select: {
            activities: {
              where: activityWhere
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    const formattedLocations = locations.map(loc => ({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      city: loc.city?.name || 'Unknown',
      province: loc.city?.province || 'Unknown',
      postalCode: loc.postalCode,
      facility: loc.facility,
      latitude: loc.latitude,
      longitude: loc.longitude,
      activityCount: loc._count.activities,
      fullAddress: loc.fullAddress,
      mapUrl: loc.mapUrl
    }));
    
    res.json({
      success: true,
      data: {
        city: decodedCity,
        locations: formattedLocations,
        totalVenues: formattedLocations.length,
        totalActivities: formattedLocations.reduce((sum, loc) => sum + loc.activityCount, 0)
      }
    });
  } catch (error) {
    console.error('Error fetching city locations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch city locations'
    });
  }
});

/**
 * GET /api/v1/cities/:city/activities
 * Get all activities in a specific city
 */
router.get('/:city/activities', async (req, res) => {
  try {
    const { city } = req.params;
    const decodedCity = decodeURIComponent(city);
    const { 
      page = 1,
      limit = 50,
      activityType,
      ageCategory,
      requiresParent
    } = req.query;
    
    const where = {
      location: {
        city: {
          equals: decodedCity,
          mode: 'insensitive'
        }
      },
      isActive: true
    };
    
    if (activityType) {
      where.activityType = activityType;
    }
    
    if (ageCategory) {
      const category = await prisma.category.findUnique({
        where: { code: ageCategory }
      });
      
      if (category) {
        where.categories = {
          some: { categoryId: category.id }
        };
      }
    }
    
    if (requiresParent !== undefined) {
      where.requiresParent = requiresParent === 'true';
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
    
    res.json({
      success: true,
      data: {
        city: decodedCity,
        activities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching city activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch city activities'
    });
  }
});

module.exports = router;