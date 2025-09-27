const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../../generated/prisma');
const prisma = new PrismaClient();

/**
 * GET /api/locations
 * Get all unique locations with counts for the app's location preferences screen
 */
router.get('/', async (req, res) => {
  try {
    // Get all unique locations with activity counts
    const locations = await prisma.location.findMany({
      where: {
        activities: {
          some: {
            isActive: true
          }
        }
      },
      include: {
        _count: {
          select: {
            activities: {
              where: {
                isActive: true
              }
            }
          }
        }
      },
      orderBy: [
        { city: 'asc' },
        { name: 'asc' }
      ]
    });
    
    // Group locations by city
    const citiesMap = new Map();
    
    locations.forEach(location => {
      if (!citiesMap.has(location.city)) {
        citiesMap.set(location.city, {
          city: location.city,
          province: location.province,
          locations: [],
          totalActivities: 0
        });
      }
      
      const cityData = citiesMap.get(location.city);
      cityData.locations.push({
        id: location.id,
        name: location.name,
        address: location.address,
        activityCount: location._count.activities
      });
      cityData.totalActivities += location._count.activities;
    });
    
    const cities = Array.from(citiesMap.values()).map(city => ({
      ...city,
      locationCount: city.locations.length
    }));
    
    res.json({
      success: true,
      data: cities
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch locations'
    });
  }
});

module.exports = router;