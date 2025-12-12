import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { buildActivityWhereClause } from '../utils/activityFilters';

const router = Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/v1/locations:
 *   get:
 *     summary: Get all locations/venues
 *     description: |
 *       Returns a list of all locations (venues) with their activity counts.
 *       Used by FiltersScreen for location-based filtering.
 *     tags: [Locations]
 *     responses:
 *       200:
 *         description: List of all locations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 locations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       city:
 *                         type: string
 *                       _count:
 *                         type: object
 *                         properties:
 *                           activities:
 *                             type: integer
 *       500:
 *         description: Server error
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get all locations with their city and activity counts
    const locations = await prisma.location.findMany({
      include: {
        city: true,
        _count: {
          select: { activities: true }
        }
      },
      orderBy: [
        { city: { name: 'asc' } },
        { name: 'asc' }
      ]
    });

    // Format response
    const formattedLocations = locations.map(loc => ({
      id: loc.id,
      name: loc.name,
      city: loc.city?.name || 'Unknown',
      address: loc.address,
      fullAddress: loc.fullAddress,
      _count: loc._count
    }));

    res.json({
      success: true,
      locations: formattedLocations
    });
  } catch (error: any) {
    console.error('Error fetching locations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch locations'
    });
  }
});

/**
 * @swagger
 * /api/v1/locations/cities:
 *   get:
 *     summary: Get all cities with venue and activity counts
 *     description: |
 *       Returns a list of all cities that have active venues with activities. 
 *       Used by: LocationBrowseScreen, CityBrowseScreen for location-based navigation.
 *       Navigation flow: Dashboard → Browse by Location → Cities → Venues → Activities
 *     tags: [Locations]
 *     parameters:
 *       - in: query
 *         name: hideClosedActivities
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *         description: Filter out closed activities from counts
 *       - in: query
 *         name: hideFullActivities
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *         description: Filter out full activities (no spots available) from counts
 *     responses:
 *       200:
 *         description: List of cities with venue and activity counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 cities:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/City'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/cities', async (req: Request, res: Response) => {
  try {
    const { 
      hideClosedActivities = 'false',
      hideFullActivities = 'false'
    } = req.query;

    console.log('🏙️ [Cities API] Request params:', {
      hideClosedActivities,
      hideFullActivities
    });

    // Apply global filters using the same logic
    const globalFilters = {
      hideClosedActivities: hideClosedActivities === 'true',
      hideFullActivities: hideFullActivities === 'true'
    };

    // Get all cities with their locations
    const cities = await prisma.city.findMany({
      include: {
        locations: true
      },
      orderBy: { name: 'asc' }
    });

    // Calculate venue and activity counts for each city using consistent logic
    const citiesWithCounts = await Promise.all(
      cities.map(async (city) => {
        const venueCount = city.locations.length;
        
        // Count activities for this city using the SAME logic as venue/activity endpoints
        let totalActivityCount = 0;
        
        for (const location of city.locations) {
          const baseWhere: any = {
            isActive: true,
            locationId: location.id
          };

          const finalWhere = buildActivityWhereClause(baseWhere, globalFilters);
          const locationActivityCount = await prisma.activity.count({ where: finalWhere });
          totalActivityCount += locationActivityCount;
        }

        return {
          id: city.id,
          name: city.name,
          province: city.province,
          country: city.country,
          venueCount,
          activityCount: totalActivityCount,
          createdAt: city.createdAt,
          updatedAt: city.updatedAt
        };
      })
    );

    // Only show cities with activities
    const citiesWithActivities = citiesWithCounts.filter(city => city.activityCount > 0);

    console.log('✅ [Cities API] Response:', {
      citiesCount: citiesWithActivities.length,
      firstCity: citiesWithActivities[0] ? {
        name: citiesWithActivities[0].name,
        venueCount: citiesWithActivities[0].venueCount,
        activityCount: citiesWithActivities[0].activityCount
      } : null
    });

    res.json({
      success: true,
      cities: citiesWithActivities
    });
  } catch (error: any) {
    console.error('❌ [Cities API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cities'
    });
  }
});

/**
 * @swagger
 * /api/v1/locations/{cityId}/venues:
 *   get:
 *     summary: Get all venues in a city with activity counts
 *     description: |
 *       Returns all venues/locations within a specific city that have activities.
 *       Used by: CityBrowseScreen, LocationBrowseScreen for venue selection.
 *       Navigation flow: Cities → Venues → Activities
 *       FIXED: Now uses identical query logic to activity details for consistent counts!
 *     tags: [Locations]
 *     parameters:
 *       - in: path
 *         name: cityId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: City UUID to get venues for
 *       - in: query
 *         name: hideClosedActivities
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *         description: Filter out closed activities from counts
 *       - in: query
 *         name: hideFullActivities
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *         description: Filter out full activities from counts
 *     responses:
 *       200:
 *         description: List of venues with activity counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 city:
 *                   $ref: '#/components/schemas/City'
 *                 venues:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Location'
 *       404:
 *         description: City not found
 *       500:
 *         description: Server error
 */
router.get('/:cityId/venues', async (req: Request, res: Response) => {
  try {
    const { cityId } = req.params;
    const { 
      hideClosedActivities = 'false',
      hideFullActivities = 'false'
    } = req.query;

    console.log('🏢 [Venues API] Request:', {
      cityId,
      hideClosedActivities,
      hideFullActivities
    });

    // Verify city exists
    const city = await prisma.city.findUnique({
      where: { id: cityId }
    });

    if (!city) {
      return res.status(404).json({
        success: false,
        error: 'City not found'
      });
    }

    // Get all venues in the city
    const venues = await prisma.location.findMany({
      where: { cityId },
      orderBy: { name: 'asc' }
    });

    // For each venue, calculate activity count using the SAME logic as the activities endpoint
    const venuesWithActivities = await Promise.all(
      venues.map(async (venue) => {
        // Build the exact same WHERE clause as in the activities endpoint
        const baseWhere: any = {
          isActive: true,
          locationId: venue.id
        };

        // Apply global filters using the same utility function
        const globalFilters = {
          hideClosedActivities: hideClosedActivities === 'true',
          hideFullActivities: hideFullActivities === 'true'
        };

        const finalWhere = buildActivityWhereClause(baseWhere, globalFilters);

        // Count activities using the exact same WHERE clause as the detail endpoint
        const activityCount = await prisma.activity.count({ where: finalWhere });

        return {
          id: venue.id,
          name: venue.name,
          address: venue.address,
          postalCode: venue.postalCode,
          latitude: venue.latitude,
          longitude: venue.longitude,
          facility: venue.facility,
          fullAddress: venue.fullAddress,
          mapUrl: venue.mapUrl,
          phoneNumber: venue.phoneNumber,
          website: venue.website,
          activityCount,
          createdAt: venue.createdAt,
          updatedAt: venue.updatedAt
        };
      })
    );

    // Only return venues with activities
    const venuesWithActivitiesFiltered = venuesWithActivities.filter(venue => venue.activityCount > 0);

    console.log('✅ [Venues API] Response:', {
      cityName: city.name,
      venuesCount: venuesWithActivitiesFiltered.length,
      firstVenue: venuesWithActivitiesFiltered[0] ? {
        name: venuesWithActivitiesFiltered[0].name,
        activityCount: venuesWithActivitiesFiltered[0].activityCount
      } : null
    });

    res.json({
      success: true,
      city,
      venues: venuesWithActivitiesFiltered
    });
  } catch (error: any) {
    console.error('❌ [Venues API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch venues'
    });
  }
});

/**
 * @swagger
 * /api/v1/locations/{venueId}/activities:
 *   get:
 *     summary: Get activities at a specific venue
 *     description: |
 *       Returns paginated list of activities at a specific venue/location.
 *       Used by: ActivityListScreen when filtering by location.
 *       Navigation flow: Cities → Venues → Activities (this endpoint)
 *       Supports extensive filtering, sorting, and pagination.
 *     tags: [Locations]
 *     parameters:
 *       - in: path
 *         name: venueId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Venue/Location UUID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: string
 *           default: '50'
 *         description: Number of activities to return (max 100)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: string
 *           default: '0'
 *         description: Number of activities to skip for pagination
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [dateStart, name, cost, registrationDate]
 *           default: 'dateStart'
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: 'asc'
 *         description: Sort direction
 *       - in: query
 *         name: hideClosedActivities
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *         description: Filter out closed activities
 *       - in: query
 *         name: hideFullActivities
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *         description: Filter out full activities
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in activity name and description
 *       - in: query
 *         name: activityType
 *         schema:
 *           type: string
 *         description: Filter by activity type ID or name
 *       - in: query
 *         name: activitySubtype
 *         schema:
 *           type: string
 *         description: Filter by activity subtype ID or name
 *       - in: query
 *         name: ageMin
 *         schema:
 *           type: string
 *         description: Minimum age requirement
 *       - in: query
 *         name: ageMax
 *         schema:
 *           type: string
 *         description: Maximum age requirement
 *       - in: query
 *         name: costMin
 *         schema:
 *           type: string
 *         description: Minimum cost filter
 *       - in: query
 *         name: costMax
 *         schema:
 *           type: string
 *         description: Maximum cost filter
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter activities starting after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter activities ending before this date
 *       - in: query
 *         name: dayOfWeek
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by days of the week
 *     responses:
 *       200:
 *         description: Paginated list of activities at venue
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 venue:
 *                   $ref: '#/components/schemas/Location'
 *                 activities:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Activity'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationResponse'
 *       404:
 *         description: Venue not found
 *       500:
 *         description: Server error
 */
router.get('/:venueId/activities', async (req: Request, res: Response) => {
  try {
    const { venueId } = req.params;
    const {
      limit = '50',
      offset = '0',
      sortBy = 'dateStart',
      sortOrder = 'asc',
      hideClosedActivities = 'false',
      hideFullActivities = 'false',
      // Additional filter parameters
      search,
      activityType,
      activitySubtype,
      ageMin,
      ageMax,
      costMin,
      costMax,
      startDate,
      endDate,
      dayOfWeek
    } = req.query;

    console.log('🎯 [Venue Activities API] Request:', {
      venueId,
      limit,
      offset,
      hideClosedActivities,
      hideFullActivities
    });

    // Verify venue exists
    const venue = await prisma.location.findUnique({
      where: { id: venueId },
      include: {
        city: true
      }
    });

    if (!venue) {
      return res.status(404).json({
        success: false,
        error: 'Venue not found'
      });
    }

    // Build base where clause
    const baseWhere: any = {
      isActive: true,
      locationId: venueId
    };

    // Add search filter
    if (search) {
      baseWhere.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Add activity type filters
    if (activityType) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activityType as string);
      if (isUuid) {
        baseWhere.activityTypeId = activityType;
      } else {
        const activityTypeRecord = await prisma.activityType.findFirst({
          where: {
            OR: [
              { code: (activityType as string).toLowerCase().replace(/\s+/g, '-') },
              { name: { equals: activityType as string, mode: 'insensitive' } }
            ]
          }
        });
        if (activityTypeRecord) {
          baseWhere.activityTypeId = activityTypeRecord.id;
        }
      }
    }

    if (activitySubtype) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activitySubtype as string);
      if (isUuid) {
        baseWhere.activitySubtypeId = activitySubtype;
      } else {
        const subtypeWhere: any = {
          OR: [
            { code: (activitySubtype as string).toLowerCase().replace(/\s+/g, '-') },
            { name: { equals: activitySubtype as string, mode: 'insensitive' } }
          ]
        };
        if (baseWhere.activityTypeId) {
          subtypeWhere.activityTypeId = baseWhere.activityTypeId;
        }
        const activitySubtypeRecord = await prisma.activitySubtype.findFirst({
          where: subtypeWhere
        });
        if (activitySubtypeRecord) {
          baseWhere.activitySubtypeId = activitySubtypeRecord.id;
        }
      }
    }

    // Add age filters
    if (ageMin !== undefined || ageMax !== undefined) {
      const andConditions = [];
      if (ageMin !== undefined) {
        andConditions.push({
          OR: [
            { ageMin: { lte: parseInt(ageMin as string) } },
            { ageMin: null }
          ]
        });
      }
      if (ageMax !== undefined) {
        andConditions.push({
          OR: [
            { ageMax: { gte: parseInt(ageMax as string) } },
            { ageMax: null }
          ]
        });
      }
      if (andConditions.length > 0) {
        baseWhere.AND = baseWhere.AND ? [...(Array.isArray(baseWhere.AND) ? baseWhere.AND : [baseWhere.AND]), ...andConditions] : andConditions;
      }
    }

    // Add cost filters
    if (costMin !== undefined || costMax !== undefined) {
      const costFilter: any = {};
      if (costMin !== undefined) costFilter.gte = parseFloat(costMin as string);
      if (costMax !== undefined) costFilter.lte = parseFloat(costMax as string);
      baseWhere.cost = costFilter;
    }

    // Add date filters
    if (startDate) {
      baseWhere.dateEnd = { gte: new Date(startDate as string) };
    }
    if (endDate) {
      baseWhere.dateStart = { lte: new Date(endDate as string) };
    }

    // Add day of week filter
    if (dayOfWeek) {
      const days = Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek];
      baseWhere.dayOfWeek = { hasSome: days };
    }

    // Apply global filters
    const globalFilters = {
      hideClosedActivities: hideClosedActivities === 'true',
      hideFullActivities: hideFullActivities === 'true'
    };

    const finalWhere = buildActivityWhereClause(baseWhere, globalFilters);

    // Get activities and total count
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where: finalWhere,
        include: {
          provider: true,
          location: {
            include: {
              city: true
            }
          },
          activityType: true,
          activitySubtype: true,
          _count: {
            select: { favorites: true }
          }
        },
        orderBy: { [sortBy as string]: sortOrder },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.activity.count({ where: finalWhere })
    ]);

    console.log('✅ [Venue Activities API] Response:', {
      venueName: venue.name,
      totalActivities: total,
      returnedActivities: activities.length
    });

    res.json({
      success: true,
      venue,
      activities,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error: any) {
    console.error('❌ [Venue Activities API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch venue activities'
    });
  }
});

export default router;