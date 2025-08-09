"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../generated/prisma");
const router = (0, express_1.Router)();
const prisma = new prisma_1.PrismaClient();
router.get('/categories', async (req, res) => {
    try {
        const categories = await prisma.activity.findMany({
            where: { isActive: true },
            select: { category: true },
            distinct: ['category']
        });
        const uniqueCategories = categories
            .map(c => c.category)
            .filter(Boolean)
            .sort();
        res.json({
            success: true,
            categories: uniqueCategories
        });
    }
    catch (error) {
        console.error('Categories error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories'
        });
    }
});
router.get('/locations', async (req, res) => {
    try {
        const locations = await prisma.location.findMany({
            orderBy: { name: 'asc' }
        });
        res.json({
            success: true,
            locations
        });
    }
    catch (error) {
        console.error('Locations error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch locations'
        });
    }
});
router.get('/providers', async (req, res) => {
    try {
        const providers = await prisma.provider.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                website: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: { name: 'asc' }
        });
        res.json({
            success: true,
            providers
        });
    }
    catch (error) {
        console.error('Providers error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch providers'
        });
    }
});
exports.default = router;
//# sourceMappingURL=reference.js.map