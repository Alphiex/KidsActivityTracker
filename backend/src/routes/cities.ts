import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';

const router = Router();
const prisma = new PrismaClient();

interface CityData {
  city: string;
  province: string | null;
  venueCount: number;
  activityCount: number;
}

/**
 * @route   GET /api/v1/cities
 * @desc    Get all cities with venue and activity counts
 * @access  Public
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get unique cities with counts
    const cities = await prisma.location.groupBy({
      by: ['city', 'province'],
      _count: {
        id: true
      },
      where: {
        city: { not: null }
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });
    
    // Get activity counts per city
    const citiesWithActivityCounts = await Promise.all(
      cities.map(async (city) => {
        const activityCount = await prisma.activity.count({
          where: {
            location: {
              city: city.city
            },
            isActive: true
          }
        });
        
        return {
          city: city.city || '',
          province: city.province,
          venueCount: city._count.id,
          activityCount
        } as CityData;
      })
    );
    
    // Filter out cities without names and sort by activity count
    const validCities = citiesWithActivityCounts
      .filter(c => c.city && c.activityCount > 0)
      .sort((a, b) => b.activityCount - a.activityCount);
    
    res.json({
      success: true,
      data: validCities,
      total: validCities.length
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
 * @route   GET /api/v1/cities/:city/locations
 * @desc    Get all locations/venues in a specific city
 * @access  Public
 */
router.get('/:city/locations', async (req: Request, res: Response) => {
  try {
    const { city } = req.params;
    const decodedCity = decodeURIComponent(city);
    
    const locations = await prisma.location.findMany({
      where: {
        city: {
          equals: decodedCity,
          mode: 'insensitive'
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
      orderBy: {
        name: 'asc'
      }
    });
    
    const formattedLocations = locations.map(loc => ({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      city: loc.city,
      province: loc.province,
      postalCode: loc.postalCode,
      facility: loc.facility,
      latitude: loc.latitude,
      longitude: loc.longitude,
      activityCount: loc._count.activities
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
 * @route   GET /api/v1/cities/:city/activities
 * @desc    Get all activities in a specific city
 * @access  Public
 */
router.get('/:city/activities', async (req: Request, res: Response) => {
  try {
    const { city } = req.params;
    const decodedCity = decodeURIComponent(city);
    const { 
      page = '1',
      limit = '50',
      activityType,
      ageCategory,
      requiresParent
    } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    
    const where: any = {
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
        where: { code: ageCategory as string }
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
    
    const skip = (pageNum - 1) * limitNum;
    
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip,
        take: limitNum,
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
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
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

export default router;