"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const prisma_1 = require("../generated/prisma");
const auth_1 = __importDefault(require("./routes/auth"));
const children_1 = __importDefault(require("./routes/children"));
const childActivities_1 = __importDefault(require("./routes/childActivities"));
const invitations_1 = __importDefault(require("./routes/invitations"));
const sharing_1 = __importDefault(require("./routes/sharing"));
const sharedActivities_1 = __importDefault(require("./routes/sharedActivities"));
const setup_1 = __importDefault(require("./routes/setup"));
const activities_1 = __importDefault(require("./routes/activities"));
const reference_1 = __importDefault(require("./routes/reference"));
const cities_1 = __importDefault(require("./routes/cities"));
const auth_2 = require("./middleware/auth");
dotenv_1.default.config();
const prisma = new prisma_1.PrismaClient();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, morgan_1.default)('combined'));
app.use('/api/', auth_2.apiLimiter);
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/children', children_1.default);
app.use('/api/child-activities', childActivities_1.default);
app.use('/api/invitations', invitations_1.default);
app.use('/api/sharing', sharing_1.default);
app.use('/api/shared-activities', sharedActivities_1.default);
app.use('/api', setup_1.default);
app.use('/api/v1/activities', activities_1.default);
app.use('/api/v1/reference', reference_1.default);
app.use('/api/v1/cities', cities_1.default);
app.get('/api/protected', auth_2.verifyToken, (req, res) => {
    res.json({
        success: true,
        message: 'This is a protected route',
        user: req.user
    });
});
app.get('/api/public', auth_2.optionalAuth, (req, res) => {
    res.json({
        success: true,
        message: 'This is a public route',
        authenticated: !!req.user,
        user: req.user || null
    });
});
app.post('/api/activities/search', auth_2.optionalAuth, async (req, res) => {
    res.json({
        success: true,
        message: 'Activity search endpoint (to be integrated)',
        authenticated: !!req.user
    });
});
app.get('/api/activities/:id', auth_2.optionalAuth, async (req, res) => {
    res.json({
        success: true,
        message: 'Activity details endpoint (to be integrated)',
        activityId: req.params.id,
        authenticated: !!req.user
    });
});
app.post('/api/favorites', auth_2.verifyToken, async (req, res) => {
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
                userId: req.user.id,
                activityId
            }
        });
        res.json({
            success: true,
            favorite
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
app.delete('/api/favorites/:activityId', auth_2.verifyToken, async (req, res) => {
    try {
        await prisma.favorite.delete({
            where: {
                userId_activityId: {
                    userId: req.user.id,
                    activityId: req.params.activityId
                }
            }
        });
        res.json({
            success: true,
            message: 'Favorite removed'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
app.get('/api/favorites', auth_2.verifyToken, async (req, res) => {
    try {
        const favorites = await prisma.favorite.findMany({
            where: { userId: req.user.id },
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
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});
const server = app.listen(PORT, '0.0.0.0', () => {
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
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
    await prisma.$disconnect();
});
exports.default = server;
//# sourceMappingURL=server.js.map