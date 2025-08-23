require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const activityService = require('../database/services/activityService');
const userService = require('../database/services/userService');
const providerService = require('../database/services/providerService');
const scrapeJobService = require('../database/services/scrapeJobService');
const scraperJobService = require('../services/scraperJobService');
const { router: authRoutes, verifyToken } = require('./routes/auth');

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

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============= Authentication Routes =============
app.use('/api/auth', authRoutes);

// ============= Test Routes (temporary) =============
const testRoutes = require('./test-db');
app.use('/api/test', testRoutes);

// ============= Activity Endpoints =============

// Search activities with filters
app.get('/api/v1/activities', async (req, res) => {
  try {
    const filters = {
      ageMin: req.query.age_min ? parseInt(req.query.age_min) : undefined,
      ageMax: req.query.age_max ? parseInt(req.query.age_max) : undefined,
      costMax: req.query.cost_max ? parseFloat(req.query.cost_max) : undefined,
      categories: req.query.categories ? req.query.categories.split(',') : undefined,
      locations: req.query.locations ? req.query.locations.split(',') : undefined,
      providers: req.query.providers ? req.query.providers.split(',') : undefined,
      search: req.query.q,
      isActive: req.query.include_inactive !== 'true',
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 50
    };

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
app.post('/api/v1/favorites', async (req, res) => {
  try {
    const { userId, activityId, notes } = req.body;
    
    if (!userId || !activityId) {
      return res.status(400).json({
        success: false,
        error: 'userId and activityId are required'
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
app.delete('/api/v1/favorites/:userId/:activityId', async (req, res) => {
  try {
    await userService.removeFavorite(req.params.userId, req.params.activityId);
    
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
    const prisma = require('../database/config/database');
    const locations = await prisma.location.findMany({
      include: {
        _count: {
          select: {
            activities: { where: { isActive: true } }
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    res.json({
      success: true,
      locations
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all categories
app.get('/api/v1/categories', async (req, res) => {
  try {
    const prisma = require('../database/config/database');
    const categories = await prisma.activity.findMany({
      where: { isActive: true },
      distinct: ['category'],
      select: { category: true }
    });
    
    res.json({
      success: true,
      categories: categories.map(c => c.category).sort()
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= Scraper Job Endpoints =============

// Get scraper job history
app.get('/api/v1/scraper/jobs', async (req, res) => {
  try {
    const providerId = req.query.provider_id;
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    
    const jobs = await scrapeJobService.getJobHistory(providerId, limit);
    
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
    const jobStats = await scrapeJobService.getJobStatistics(days);
    const queueStats = await scraperJobService.getQueueStats();
    
    res.json({
      success: true,
      jobStats,
      queueStats
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
  try {
    const { providerId } = req.body;
    
    if (!providerId) {
      return res.status(400).json({
        success: false,
        error: 'providerId is required'
      });
    }

    const result = await scraperJobService.triggerScrape(providerId);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error triggering scrape:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= Admin Dashboard Stats =============

app.get('/api/v1/stats/dashboard', async (req, res) => {
  try {
    const [
      activityStats,
      jobStats,
      queueStats,
      providers
    ] = await Promise.all([
      activityService.getStatistics(),
      scrapeJobService.getJobStatistics(7),
      scraperJobService.getQueueStats(),
      providerService.getAllProviders()
    ]);

    res.json({
      success: true,
      dashboard: {
        activities: activityStats,
        jobs: jobStats,
        queue: queueStats,
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
    // Initialize scraper job service only if not disabled
    if (process.env.DISABLE_SCRAPING !== 'true') {
      await scraperJobService.initialize();
    } else {
      console.log('⏭️  Scraping disabled by environment variable');
    }

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
      await scraperJobService.shutdown();
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