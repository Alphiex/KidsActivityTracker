require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const activityService = require('../src/services/activityService');
const userService = require('../src/services/userService');
const providerService = require('../src/services/providerService');
// const scraperJobService = require('../src/services/scraperJobService'); // Not needed for API
const { router: authRoutes, verifyToken } = require('./routes/auth');
const activityTypesRoutes = require('./routes/activityTypes');
const categoriesRoutes = require('./routes/categories');
const citiesRoutes = require('./routes/cities');
const locationsRoutes = require('./routes/locations');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',') 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
};
app.use(cors(corsOptions));

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting - DISABLED FOR PRODUCTION
// Create no-op middleware that bypasses rate limiting
const limiter = (req, res, next) => {
  next();
};
app.use('/api/', limiter);

/* ORIGINAL RATE LIMITING CONFIGURATION (DISABLED)
const limiter = rateLimit({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);
*/

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint for deployment verification
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.1'
  });
});

// ============= Authentication Routes =============
app.use('/api/auth', authRoutes);

// ============= Activity Types Routes =============
app.use('/api/v1/activity-types', activityTypesRoutes);

// ============= Categories Routes =============
app.use('/api/v1/categories', categoriesRoutes);

// ============= Cities Routes =============
app.use('/api/v1/cities', citiesRoutes);

// ============= Locations Routes =============
app.use('/api/locations', locationsRoutes);

// ============= Test Routes (temporary) =============
// Removed test routes

// ============= Activity Endpoints =============

// Search activities with filters
app.get('/api/v1/activities', async (req, res) => {
  try {
    const filters = {
      ageMin: req.query.age_min ? parseInt(req.query.age_min) : undefined,
      ageMax: req.query.age_max ? parseInt(req.query.age_max) : undefined,
      costMin: req.query.cost_min ? parseFloat(req.query.cost_min) : undefined,
      costMax: req.query.cost_max ? parseFloat(req.query.cost_max) : undefined,
      categories: req.query.categories ? req.query.categories.split(',') : undefined,
      activityTypes: req.query.activity_types ? req.query.activity_types.split(',') : 
                     req.query.activityType ? [req.query.activityType] : undefined,
      locations: req.query.locations ? req.query.locations.split(',') : 
                 req.query.location ? [req.query.location] : undefined,
      locationIds: req.query.locationIds ? req.query.locationIds.split(',') :
                   req.query.locationId ? [req.query.locationId] : undefined,
      providers: req.query.providers ? req.query.providers.split(',') : undefined,
      search: req.query.q || req.query.search,
      subcategory: req.query.subcategory,
      daysOfWeek: req.query.days_of_week ? req.query.days_of_week.split(',') : undefined,
      // Temporarily disable isActive filter since all test data has expired dates
      // TODO: Update test data with future dates or implement better date handling
      isActive: req.query.include_inactive === 'false' ? true : undefined,
      excludeClosed: req.query.exclude_closed === 'true' || req.query.hide_closed_activities === 'true' || req.query.hideClosedActivities === 'true',
      excludeFull: req.query.exclude_full === 'true' || req.query.hide_full_activities === 'true' || req.query.hideFullActivities === 'true',
      // Date filters for API-level filtering
      createdAfter: req.query.created_after,
      updatedAfter: req.query.updated_after,
      startDateAfter: req.query.start_date_after,
      startDateBefore: req.query.start_date_before,
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 50
    };
    
    // Debug logging
    console.log('API Request filters:', {
      subcategory: filters.subcategory,
      categories: filters.categories,
      activityTypes: filters.activityTypes,
      locations: filters.locations,
      costMax: filters.costMax
    });

    const result = await activityService.searchActivities(filters);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error searching activities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single activity
app.get('/api/v1/activities/:id', async (req, res) => {
  try {
    const activity = await activityService.getActivityById(req.params.id);
    
    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    res.json({
      success: true,
      activity
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get activity statistics
app.get('/api/v1/activities/stats/summary', async (req, res) => {
  try {
    const stats = await activityService.getStatistics();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= User Endpoints =============

// Create/update user
app.post('/api/v1/users', async (req, res) => {
  try {
    const { email, name, preferences } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const user = await userService.upsertUser(email, { name, preferences });
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user by email
app.get('/api/v1/users/:email', async (req, res) => {
  try {
    const user = await userService.getUserByEmail(req.params.email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= Favorites Endpoints =============

// Add favorite
app.post('/api/v1/favorites', verifyToken, async (req, res) => {
  try {
    const { activityId, notes } = req.body;
    const userId = req.userId; // From auth token
    
    if (!activityId) {
      return res.status(400).json({
        success: false,
        error: 'activityId is required'
      });
    }

    const favorite = await userService.addFavorite(userId, activityId, notes);
    
    res.json({
      success: true,
      favorite
    });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Remove favorite
app.delete('/api/v1/favorites/:activityId', verifyToken, async (req, res) => {
  try {
    const userId = req.userId; // From auth token
    await userService.removeFavorite(userId, req.params.activityId);
    
    res.json({
      success: true,
      message: 'Favorite removed'
    });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get favorites (requires authentication)
app.get('/api/v1/favorites', verifyToken, async (req, res) => {
  try {
    // Use the authenticated user's ID from the token
    const userId = req.userId;
    const includeInactive = req.query.include_inactive === 'true';
    
    const favorites = await userService.getUserFavorites(
      userId, 
      includeInactive
    );
    
    res.json({
      success: true,
      favorites
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user favorites
app.get('/api/v1/users/:userId/favorites', async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const favorites = await userService.getUserFavorites(
      req.params.userId, 
      includeInactive
    );
    
    res.json({
      success: true,
      favorites
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get recommended activities
app.get('/api/v1/users/:userId/recommendations', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const recommendations = await userService.getRecommendedActivities(
      req.params.userId,
      limit
    );
    
    res.json({
      success: true,
      recommendations
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user statistics
app.get('/api/v1/users/:userId/stats', verifyToken, async (req, res) => {
  try {
    const prisma = require('../src/config/database');
    const userId = req.params.userId;
    
    // Get favorites count
    const favoritesCount = await prisma.favorite.count({
      where: { userId }
    });
    
    // Get children count
    const childrenCount = await prisma.child.count({
      where: { userId }
    });
    
    // Get enrolled activities count (activities that children are enrolled in)
    const enrolledCount = await prisma.childActivity.count({
      where: {
        child: {
          userId
        },
        status: 'enrolled'
      }
    });
    
    res.json({
      success: true,
      stats: {
        favorites: favoritesCount,
        children: childrenCount,
        enrolled: enrolledCount
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= Provider Endpoints =============

// Get all providers
app.get('/api/v1/providers', async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const providers = await providerService.getAllProviders(includeInactive);
    
    res.json({
      success: true,
      providers
    });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get provider statistics
app.get('/api/v1/providers/:id/stats', async (req, res) => {
  try {
    const stats = await providerService.getProviderStatistics(req.params.id);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching provider stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= Location Endpoints =============

// Get all locations
app.get('/api/v1/locations', async (req, res) => {
  try {
    const prisma = require('../src/config/database');
    // Only get locations that have active activities
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
            activities: { where: { isActive: true } }
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    // Filter out bad location names and transform to expected format
    const cleanedLocations = locations
      .filter(loc => {
        const name = loc.name;
        // Check if name is too long (likely a description)
        if (name.length > 100) return false;
        // Check if name contains newlines or special formatting
        if (name.includes('\n') || name.includes('\r')) return false;
        // Check if name contains activity keywords
        if (name.match(/lesson|class|program|registration|#\d{6}/i)) return false;
        return true;
      })
      .map(loc => ({
        id: loc.id,
        name: loc.name.trim(),
        address: loc.address,
        city: loc.city,
        province: loc.province,
        postalCode: loc.postalCode,
        facility: loc.facility,
        activityCount: loc._count.activities
      }));
    
    res.json({
      success: true,
      locations: cleanedLocations
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Categories route is handled by the router at /api/v1/categories

// Get age groups with activity counts
app.get('/api/v1/age-groups', async (req, res) => {
  try {
    const ageGroups = [
      { id: '0-2', name: '0-2 years', min: 0, max: 2 },
      { id: '3-5', name: '3-5 years', min: 3, max: 5 },
      { id: '6-8', name: '6-8 years', min: 6, max: 8 },
      { id: '9-12', name: '9-12 years', min: 9, max: 12 },
      { id: '13+', name: '13+ years', min: 13, max: 99 }
    ];

    const prisma = require('../src/config/database');
    
    // Get counts for each age group
    const groupsWithCounts = await Promise.all(
      ageGroups.map(async (group) => {
        const count = await prisma.activity.count({
          where: {
            isActive: true,
            ageMin: { lte: group.max },
            ageMax: { gte: group.min }
          }
        });
        return {
          ...group,
          count
        };
      })
    );

    res.json({
      success: true,
      ageGroups: groupsWithCounts
    });
  } catch (error) {
    console.error('Error fetching age groups:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Activity types are now handled by the activityTypes router
// app.get('/api/v1/activity-types', ...) - REMOVED - see routes/activityTypes.js

// ============= Scraper Job Endpoints =============

// Get scraper job history
app.get('/api/v1/scraper/jobs', async (req, res) => {
  try {
    const providerId = req.query.provider_id;
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    
    // const jobs = await scrapeJobService.getJobHistory(providerId, limit);
    const jobs = []; // scrapeJobService not available in API-only mode
    
    res.json({
      success: true,
      jobs
    });
  } catch (error) {
    console.error('Error fetching job history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get scraper job statistics
app.get('/api/v1/scraper/stats', async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days) : 7;
    // const jobStats = await scrapeJobService.getJobStatistics(days);
    const jobStats = null; // scrapeJobService not available in API-only mode
    // const queueStats = await scraperJobService.getQueueStats();
    
    res.json({
      success: true,
      jobStats,
      queueStats: null // scraperJobService not available in API-only mode
    });
  } catch (error) {
    console.error('Error fetching scraper stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Trigger manual scrape
app.post('/api/v1/scraper/trigger', async (req, res) => {
  // Scraper not available in API-only mode
  res.status(503).json({
    success: false,
    error: 'Scraper service not available in API-only mode'
  });
});

// ============= Admin Dashboard Stats =============

app.get('/api/v1/stats/dashboard', async (req, res) => {
  try {
    const [
      activityStats,
      jobStats,
      // queueStats,
      providers
    ] = await Promise.all([
      activityService.getStatistics(),
      // scrapeJobService.getJobStatistics(7),
      Promise.resolve(null), // scrapeJobService not available in API-only mode
      // scraperJobService.getQueueStats(), // Not available in API-only mode
      providerService.getAllProviders()
    ]);

    res.json({
      success: true,
      dashboard: {
        activities: activityStats,
        jobs: jobStats,
        queue: null, // scraperJobService not available in API-only mode
        providers: providers.map(p => ({
          id: p.id,
          name: p.name,
          activeActivities: p._count.activities,
          totalJobs: p._count.scrapeJobs
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
async function startServer() {
  try {
    // Run migration to ensure schema is up to date
    const { ensureIsUpdatedColumn } = require('../src/utils/runMigration');
    await ensureIsUpdatedColumn();
    
    // Scraper job service not available in API-only mode
    console.log('⏭️  Running in API-only mode (no scraper service)');

    // Start Express server
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API server running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('\nAvailable endpoints:');
      console.log('- GET  /api/v1/activities');
      console.log('- GET  /api/v1/activities/:id');
      console.log('- GET  /api/v1/activities/stats/summary');
      console.log('- POST /api/v1/users');
      console.log('- GET  /api/v1/users/:email');
      console.log('- POST /api/v1/favorites');
      console.log('- GET  /api/v1/users/:userId/favorites');
      console.log('- GET  /api/v1/providers');
      console.log('- GET  /api/v1/locations');
      console.log('- GET  /api/v1/categories');
      console.log('- GET  /api/v1/scraper/jobs');
      console.log('- POST /api/v1/scraper/trigger');
      console.log('- GET  /api/v1/stats/dashboard');
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      // scraperJobService.shutdown() not needed in API-only mode
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;