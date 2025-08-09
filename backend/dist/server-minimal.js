"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
}));
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});
app.post('/api/auth/register', (req, res) => {
    res.json({
        success: true,
        message: 'Auth endpoint is working',
        data: {
            email: req.body.email,
            timestamp: new Date().toISOString()
        }
    });
});
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Minimal auth server running on port ${PORT}`);
});
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});
exports.default = server;
//# sourceMappingURL=server-minimal.js.map