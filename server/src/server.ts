import express from 'express';
import cors from 'cors';
// import helmet from 'helmet'; // DISABLED: Breaking iOS app
import morgan from 'morgan';
import dotenv from 'dotenv';
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

// Import middleware
import { apiLimiter, verifyToken, optionalAuth } from './middleware/auth';

// Load environment variables
dotenv.config();

// Initialize Prisma
const prisma = new PrismaClient();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Global middleware
// Remove problematic security headers that break iOS app
app.use((req, res, next) => {
  res.removeHeader('X-Content-Type-Options');
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Strict-Transport-Security');
  res.removeHeader('Cross-Origin-Opener-Policy');
  res.removeHeader('Cross-Origin-Resource-Policy');
  next();
});

app.use(cors({
  origin: true, // Allow all origins for mobile app compatibility
  credentials: true
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