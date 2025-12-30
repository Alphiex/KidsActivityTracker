import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { buildActivityWhereClause, extractGlobalFilters } from '../utils/activityFilters';

const router = Router();

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
    const includeEmpty = req.query.includeEmpty === 'true';
    console.log('🏙️ [Cities] Global filters:', globalFilters, 'Include empty:', includeEmpty);

    // Build the activity where clause for counting
    const activityWhereClause = buildActivityWhereClause({ isActive: true }, globalFilters);

    // Use a single efficient query with groupBy to get activity counts per city
    // This avoids N+1 query problem that was causing connection pool exhaustion
    const citiesWithCounts = await prisma.city.findMany({
      select: {
        id: true,
        name: true,
        province: true,
        country: true,
        _count: {
          select: {
            locations: true
          }
        },
        locations: {
          select: {
            _count: {
              select: {
                activities: {
                  where: activityWhereClause
                }
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`🏙️ [Cities] Found ${citiesWithCounts.length} cities in normalized schema`);

    // Calculate activity counts by summing location activity counts
    const citiesData: CityData[] = citiesWithCounts.map(city => ({
      city: city.name,
      province: city.province,
      venueCount: city._count.locations,
      activityCount: city.locations.reduce((sum, loc) => sum + loc._count.activities, 0)
    }));

    // Filter out cities without names, and optionally filter by activity count
    let validCities = citiesData.filter(c => c.city);

    if (!includeEmpty) {
      validCities = validCities.filter(c => c.activityCount > 0);
    }

    // Sort by activity count (descending), then alphabetically
    validCities.sort((a, b) => {
      if (b.activityCount !== a.activityCount) {
        return b.activityCount - a.activityCount;
      }
      return a.city.localeCompare(b.city);
    });

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
    
    // Extract global filters from request
    const globalFilters = extractGlobalFilters(req.query);
    
    // Build activity filter with global filters applied
    const activityWhereClause = buildActivityWhereClause({
      isActive: true
    }, globalFilters);
    
    const locations = await prisma.location.findMany({
      where: {
        city: {
          equals: decodedCity,
          mode: 'insensitive'
        }
      },
      include: {
        cityRecord: true,
        _count: {
          select: {
            activities: {
              where: activityWhereClause
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
      city: loc.cityRecord?.name || loc.city || 'Unknown',
      province: loc.cityRecord?.province || loc.province || 'Unknown',
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

    // Extract and apply global filters
    const globalFilters = extractGlobalFilters(req.query);
    const finalWhere = buildActivityWhereClause(where, globalFilters);

    const skip = (pageNum - 1) * limitNum;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where: finalWhere,
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
      prisma.activity.count({ where: finalWhere })
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

/**
 * @swagger
 * /api/v1/cities/request:
 *   post:
 *     summary: Request support for a new city
 *     description: Submit a request to add a new city to the app
 *     tags: [Cities]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cityName
 *               - province
 *               - email
 *             properties:
 *               cityName:
 *                 type: string
 *                 description: Name of the city
 *               province:
 *                 type: string
 *                 description: Province or region
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Contact email
 *               sites:
 *                 type: string
 *                 description: Specific sites or programs to add
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *     responses:
 *       201:
 *         description: Request submitted successfully
 *       400:
 *         description: Validation error
 *       429:
 *         description: Too many requests
 */
router.post('/request', async (req: Request, res: Response) => {
  try {
    const { cityName, province, email, sites, notes } = req.body;

    // Validation
    if (!cityName || !cityName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'City name is required'
      });
    }

    if (!province || !province.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Province is required'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Check for duplicate requests from same email in last 24 hours
    const recentRequest = await prisma.cityRequest.findFirst({
      where: {
        email: email.toLowerCase(),
        cityName: {
          equals: cityName.trim(),
          mode: 'insensitive'
        },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    if (recentRequest) {
      return res.status(429).json({
        success: false,
        error: 'You have already submitted a request for this city in the last 24 hours'
      });
    }

    // Create the city request
    const cityRequest = await prisma.cityRequest.create({
      data: {
        cityName: cityName.trim(),
        province: province.trim(),
        email: email.toLowerCase().trim(),
        sites: sites?.trim() || null,
        notes: notes?.trim() || null
      }
    });

    console.log(`📬 [CityRequest] New request from ${email} for ${cityName}, ${province}`);

    res.status(201).json({
      success: true,
      message: 'Your request has been submitted. We will review it and notify you when the city is added.',
      requestId: cityRequest.id
    });
  } catch (error: any) {
    console.error('❌ [CityRequest] Error submitting request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit request'
    });
  }
});

export default router;