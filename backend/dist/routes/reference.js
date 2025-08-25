"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../generated/prisma");
const router = (0, express_1.Router)();
const prisma = new prisma_1.PrismaClient();
router.get('/categories', async (req, res) => {
    try {
        const categories = await prisma.activity.groupBy({
            by: ['category'],
            where: {
                isActive: true,
                category: {
                    not: null
                }
            },
            _count: {
                _all: true
            },
            orderBy: {
                _count: {
                    _all: 'desc'
                }
            }
        });
        const categoriesWithCounts = categories.map(cat => ({
            name: cat.category,
            count: cat._count._all
        }));
        res.json({
            success: true,
            categories: categoriesWithCounts
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
            where: {
                activities: {
                    some: {
                        isActive: true
                    }
                },
            },
            include: {
                _count: {
                    select: {
                        activities: {
                            where: { isActive: true }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
        const cleanedLocations = locations.filter(loc => {
            const name = loc.name;
            if (name.length > 100)
                return false;
            if (name.includes('\n') || name.includes('\r'))
                return false;
            if (name.match(/lesson|class|program|registration|#\d{6}/i))
                return false;
            return true;
        });
        res.json({
            success: true,
            locations: cleanedLocations.map(loc => ({
                id: loc.id,
                name: loc.name.trim(),
                address: loc.address,
                city: loc.city,
                province: loc.province,
                postalCode: loc.postalCode,
                facility: loc.facility,
                activityCount: loc._count.activities
            }))
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
router.get('/age-groups', async (req, res) => {
    try {
        const ageGroups = [
            { id: '0-2', name: '0-2 years', min: 0, max: 2 },
            { id: '3-5', name: '3-5 years', min: 3, max: 5 },
            { id: '6-8', name: '6-8 years', min: 6, max: 8 },
            { id: '9-12', name: '9-12 years', min: 9, max: 12 },
            { id: '13+', name: '13+ years', min: 13, max: 99 }
        ];
        const groupsWithCounts = await Promise.all(ageGroups.map(async (group) => {
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
        }));
        res.json({
            success: true,
            ageGroups: groupsWithCounts
        });
    }
    catch (error) {
        console.error('Age groups error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch age groups'
        });
    }
});
router.get('/activity-types', async (req, res) => {
    try {
        const activityTypes = await prisma.activity.groupBy({
            by: ['subcategory'],
            where: {
                isActive: true,
                subcategory: {
                    not: null
                }
            },
            _count: {
                _all: true
            },
            orderBy: {
                _count: {
                    _all: 'desc'
                }
            }
        });
        const typesWithCounts = activityTypes.map(type => ({
            name: type.subcategory,
            count: type._count._all
        }));
        res.json({
            success: true,
            activityTypes: typesWithCounts
        });
    }
    catch (error) {
        console.error('Activity types error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch activity types'
        });
    }
});
exports.default = router;
//# sourceMappingURL=reference.js.map