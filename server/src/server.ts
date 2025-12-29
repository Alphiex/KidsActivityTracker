import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import { PrismaClient } from '../generated/prisma';
import { v4 as uuidv4 } from 'uuid';
import { swaggerSpec, swaggerUi } from './swagger/config';

// Import routes
import authRoutes from './routes/auth';
import childrenRoutes from './routes/children';
import childActivitiesRoutes from './routes/childActivities';
import invitationsRoutes from './routes/invitations';
import sharingRoutes from './routes/sharing';
import sharedActivitiesRoutes from './routes/sharedActivities';
import setupRoutes from './routes/setup';
import activitiesRoutes from './routes/activities';
import activityTypesRoutes from './routes/activityTypes';
import referenceRoutes from './routes/reference';
import citiesRoutes from './routes/cities';
import categoriesRoutes from './routes/categories';
import locationsRoutes from './routes/locations';
import partnersRoutes from './routes/partners';
import subscriptionsRoutes from './routes/subscriptions';
import webhooksRoutes from './routes/webhooks';
import analyticsRoutes from './routes/analytics';
import adminPartnersRoutes from './routes/adminPartners';
import partnerPortalRoutes from './routes/partnerPortal';
import adminRoutes from './routes/admin';
import adminActivitiesRoutes from './routes/adminActivities';
import adminMonitoringRoutes from './routes/adminMonitoring';
import vendorRoutes from './routes/vendor';
import aiRoutes from './ai/routes';

// Import AI module
import { initializeAI } from './ai';

// Import services
import { subscriptionService } from './services/subscriptionService';

// Import middleware
import { apiLimiter, verifyToken, optionalAuth } from './middleware/auth';

// Load environment variables
dotenv.config();

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Redis for AI caching (optional - gracefully handles unavailability)
let redis: Redis | null = null;
try {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('[Redis] Max retries exceeded, AI caching disabled');
        return null; // Stop retrying
      }
      return Math.min(times * 100, 3000);
    },
    lazyConnect: true // Don't connect until first use
  });
  
  redis.on('error', (err) => {
    console.warn('[Redis] Connection error:', err.message);
  });
  
  redis.on('connect', () => {
    console.log('[Redis] Connected successfully');
  });
} catch (error: any) {
  console.warn('[Redis] Failed to initialize:', error.message);
}

// Initialize AI module (if Redis is available and OPENAI_API_KEY is set)
if (redis && process.env.OPENAI_API_KEY) {
  try {
    initializeAI(redis, prisma);
    console.log('[AI] Module initialized successfully');
  } catch (error: any) {
    console.warn('[AI] Failed to initialize:', error.message);
  }
} else {
  if (!process.env.OPENAI_API_KEY) {
    console.log('[AI] OPENAI_API_KEY not set, AI features disabled');
  }
  if (!redis) {
    console.log('[AI] Redis not available, AI features disabled');
  }
}

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Global middleware
// Security headers (mobile-compatible configuration)
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for mobile API
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Configure CORS - allow mobile apps (no origin header) and approved web origins
const ALLOWED_WEB_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8081',
  'https://kidsactivitytracker.com',
  'https://www.kidsactivitytracker.com',
  // Cloud Run URLs (update after deployment)
  'https://website-205843686007.us-central1.run.app',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    // Allow approved web origins
    if (ALLOWED_WEB_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    // Reject unknown origins in production
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined')); // Logging

// Apply rate limiting to all routes
app.use('/api/', apiLimiter);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Kids Activity Tracker API Documentation',
  customfavIcon: '/favicon.ico'
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    documentation: '/api-docs'
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Children management routes
app.use('/api/children', childrenRoutes);

// Child activities routes
app.use('/api/child-activities', childActivitiesRoutes);

// Activity sharing routes
app.use('/api/invitations', invitationsRoutes);
app.use('/api/sharing', sharingRoutes);
app.use('/api/shared-activities', sharedActivitiesRoutes);

// Setup routes (temporary - remove after initial setup)
app.use('/api', setupRoutes);

// Activity routes (v1 API)
app.use('/api/v1/activities', activitiesRoutes);

// Activity types routes (v1 API)
app.use('/api/v1/activity-types', activityTypesRoutes);

// Reference data routes (v1 API)
app.use('/api/v1/reference', referenceRoutes);

// Cities routes (v1 API)
app.use('/api/v1/cities', citiesRoutes);

// Categories routes (v1 API)
app.use('/api/v1/categories', categoriesRoutes);

// Locations routes (v1 API)
app.use('/api/v1/locations', locationsRoutes);

// Featured Partners routes (v1 API) - new naming
app.use('/api/v1/partners', partnersRoutes);
// Backward compatibility - keep old /sponsors endpoint working
app.use('/api/v1/sponsors', partnersRoutes);

// Analytics tracking routes (v1 API)
app.use('/api/v1/analytics', analyticsRoutes);

// AI routes (v1 API)
app.use('/api/v1/ai', aiRoutes);

// Subscription management routes
app.use('/api/subscriptions', subscriptionsRoutes);

// Webhook routes (RevenueCat, Stripe)
app.use('/api/webhooks', webhooksRoutes);

// Admin routes (third-party import management)
app.use('/api/admin', adminRoutes);

// Admin partner management routes - new naming
app.use('/api/admin/partners', adminPartnersRoutes);
// Backward compatibility - keep old /sponsors endpoint working
app.use('/api/admin/sponsors', adminPartnersRoutes);

// Admin activity management routes
app.use('/api/admin/activities', adminActivitiesRoutes);

// Admin monitoring routes (system health, scraper status, AI metrics)
app.use('/api/admin/monitoring', adminMonitoringRoutes);

// Partner self-service portal routes - new naming
app.use('/api/partner', partnerPortalRoutes);
// Backward compatibility - keep old /sponsor endpoint working
app.use('/api/sponsor', partnerPortalRoutes);

// Vendor portal routes
app.use('/api/vendor', vendorRoutes);

// Protected route example
app.get('/api/protected', verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'This is a protected route',
    user: req.user
  });
});

// Optional auth route example
app.get('/api/public', optionalAuth, (req, res) => {
  res.json({
    success: true,
    message: 'This is a public route',
    authenticated: !!req.user,
    user: req.user || null
  });
});

// ====== REMOVED OLD PLACEHOLDER ROUTES ======
// Old /api/activities/* routes have been removed to avoid confusion
// All activity endpoints should use /api/v1/activities/* instead

// Favorites routes (requires authentication)
app.post('/api/favorites', verifyToken, async (req, res) => {
  try {
    const { activityId } = req.body;

    if (!activityId) {
      return res.status(400).json({
        success: false,
        error: 'Activity ID is required'
      });
    }

    // Check subscription limit
    const limitCheck = await subscriptionService.canAddFavorite(req.user!.id);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: 'SUBSCRIPTION_LIMIT_REACHED',
        message: `You have reached your limit of ${limitCheck.limit} favorites. Upgrade to Premium to save more.`,
        limit: limitCheck.limit,
        current: limitCheck.current
      });
    }

    const favorite = await prisma.favorite.create({
      data: {
        userId: req.user!.id,
        activityId,
        createdAt: new Date()
      }
    });

    res.json({
      success: true,
      favorite
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/favorites/:activityId', verifyToken, async (req, res) => {
  try {
    await prisma.favorite.delete({
      where: {
        userId_activityId: {
          userId: req.user!.id,
          activityId: req.params.activityId
        }
      }
    });

    res.json({
      success: true,
      message: 'Favorite removed'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/favorites', verifyToken, async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user!.id },
      include: {
        activity: {
          include: {
            location: true,
            provider: true
          }
        }
      }
    });

    res.json({
      success: true,
      favorites
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});


// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Start server
const server = app.listen(PORT as number, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║     Kids Activity Tracker API                     ║
║     Running on http://localhost:${PORT}             ║
║                                                   ║
╠═══════════════════════════════════════════════════╣
║                                                   ║
║     Authentication Endpoints:                     ║
║     POST   /api/auth/register                     ║
║     POST   /api/auth/login                        ║
║     POST   /api/auth/refresh                      ║
║     POST   /api/auth/logout                       ║
║     GET    /api/auth/verify-email                 ║
║     POST   /api/auth/resend-verification          ║
║     POST   /api/auth/forgot-password              ║
║     POST   /api/auth/reset-password               ║
║     POST   /api/auth/change-password              ║
║     GET    /api/auth/profile                      ║
║     PUT    /api/auth/profile                      ║
║     GET    /api/auth/check                        ║
║                                                   ║
║     Protected Endpoints:                          ║
║     GET    /api/protected                         ║
║     POST   /api/favorites                         ║
║     DELETE /api/favorites/:id                     ║
║     GET    /api/favorites                         ║
║                                                   ║
║     Children Management:                          ║
║     POST   /api/children                          ║
║     GET    /api/children                          ║
║     GET    /api/children/stats                    ║
║     GET    /api/children/shared                   ║
║     GET    /api/children/search                   ║
║     GET    /api/children/:id                      ║
║     PUT    /api/children/:id                      ║
║     PATCH  /api/children/:id/interests            ║
║     DELETE /api/children/:id                      ║
║     POST   /api/children/bulk                     ║
║                                                   ║
║     Child Activities:                             ║
║     POST   /api/child-activities/link             ║
║     POST   /api/child-activities/bulk-link        ║
║     PUT    /api/child-activities/:childId/        ║
║            activities/:activityId                 ║
║     DELETE /api/child-activities/:childId/        ║
║            activities/:activityId                 ║
║     GET    /api/child-activities/history          ║
║     GET    /api/child-activities/:childId/        ║
║            recommendations                        ║
║     GET    /api/child-activities/:childId/        ║
║            favorites                              ║
║     GET    /api/child-activities/calendar         ║
║     GET    /api/child-activities/stats            ║
║     GET    /api/child-activities/upcoming         ║
║     GET    /api/child-activities/:childId/        ║
║            activities                             ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
  await prisma.$disconnect();
});

export default server;