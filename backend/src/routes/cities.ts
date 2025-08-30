import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { buildActivityWhereClause, extractGlobalFilters } from '../utils/activityFilters';

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
    console.log('🏙️ [Cities] Fetching cities with counts...');
    const globalFilters = extractGlobalFilters(req.query);
    console.log('🏙️ [Cities] Global filters:', globalFilters);
    
    // Get unique cities with counts - filter out null cities after grouping
    const citiesRaw = await prisma.location.groupBy({
      by: ['city', 'province'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });
    
    // Filter out null cities
    const cities = citiesRaw.filter(c => c.city !== null);
    
    console.log(`🏙️ [Cities] Found ${cities.length} unique cities`);
    
    // Get activity counts per city with global filters
    const citiesWithActivityCounts = await Promise.all(
      cities.map(async (city) => {
        const activityCount = await prisma.activity.count({
          where: buildActivityWhereClause({
            location: {
              city: city.city
            }
          }, globalFilters)
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
  } catch (error: any) {
    console.error('❌ [Cities] Error fetching cities:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cities',
      details: error.message
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
      // Find the activity type by code
      const activityTypeRecord = await prisma.activityType.findUnique({
        where: { code: activityType as string }
      });
      
      if (activityTypeRecord) {
        where.activityTypeId = activityTypeRecord.id;
      }
    }
    
    // TODO: Implement age category filtering once Category model is added
    // if (ageCategory) {
    //   const category = await prisma.category.findUnique({
    //     where: { code: ageCategory as string }
    //   });
    //   
    //   if (category) {
    //     where.categories = {
    //       some: { categoryId: category.id }
    //     };
    //   }
    // }
    
    // TODO: Implement parent requirement filtering once field is added
    // if (requiresParent !== undefined) {
    //   where.requiresParent = requiresParent === 'true';
    // }
    
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
          activityType: true,
          activitySubtype: true
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