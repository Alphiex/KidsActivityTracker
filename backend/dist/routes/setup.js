"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = require("../../generated/prisma");
const router = (0, express_1.Router)();
const prisma = new prisma_1.PrismaClient();
router.post('/setup/test-user', async (req, res) => {
    try {
        const setupKey = req.headers['x-setup-key'];
        if (setupKey !== process.env.SETUP_KEY) {
            return res.status(403).json({
                success: false,
                error: 'Invalid setup key'
            });
        }
        const email = 'test@kidsactivitytracker.com';
        const password = 'Test123!';
        const existing = await prisma.user.findUnique({
            where: { email }
        });
        if (existing) {
            return res.json({
                success: true,
                message: 'Test user already exists',
                userId: existing.id
            });
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                name: 'Test User',
                isVerified: true,
                preferences: {
                    theme: 'light',
                    notifications: { email: true, push: true },
                    viewType: 'card',
                    hasCompletedOnboarding: true
                }
            }
        });
        res.json({
            success: true,
            message: 'Test user created',
            userId: user.id
        });
    }
    catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=setup.js.map