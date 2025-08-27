"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../generated/prisma");
const router = (0, express_1.Router)();
const prisma = new prisma_1.PrismaClient();
router.get('/activity-types', async (req, res) => {
    try {
        const activityTypeCounts = await prisma.activity.groupBy({
            by: ['activityType'],
            where: {
                isActive: true,
                activityType: { not: null }
            },
            _count: { id: true }
        });
        const activityTypes = await prisma.activityType.findMany({
            orderBy: { displayOrder: 'asc' }
        });
        const typeMap = new Map(activityTypes.map(t => [t.name, t]));
        const typesWithCounts = activityTypeCounts
            .map(item => {
            const typeInfo = typeMap.get(item.activityType || '');
            return {
                code: typeInfo?.code || item.activityType?.toLowerCase().replace(/\s+/g, '-'),
                name: item.activityType,
                displayName: typeInfo?.name || item.activityType,
                activityCount: item._count.id,
                displayOrder: typeInfo?.displayOrder || 999
            };
        })
            .filter(item => item.name)
            .sort((a, b) => a.displayOrder - b.displayOrder);
        res.json({
            success: true,
            data: typesWithCounts,
            total: typesWithCounts.length
        });
    }
    catch (error) {
        console.error('Error fetching activity types:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch activity types'
        });
    }
});
router.get('/activity-types/:typeCode', async (req, res) => {
    try {
        const { typeCode } = req.params;
        const typeName = typeCode.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        const activities = await prisma.activity.findMany({
            where: {
                activityType: typeName,
                isActive: true
            },
            select: {
                activitySubtype: true
            }
        });
        const subtypeCounts = activities.reduce((acc, activity) => {
            const subtype = activity.activitySubtype || 'General';
            acc[subtype] = (acc[subtype] || 0) + 1;
            return acc;
        }, {});
        const subtypes = Object.entries(subtypeCounts)
            .map(([name, count]) => ({
            code: name.toLowerCase().replace(/\s+/g, '-'),
            name,
            activityCount: count
        }))
            .sort((a, b) => b.activityCount - a.activityCount);
        res.json({
            success: true,
            data: {
                code: typeCode,
                name: typeName,
                totalActivities: activities.length,
                subtypes
            }
        });
    }
    catch (error) {
        console.error('Error fetching activity type details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch activity type details'
        });
    }
});
router.get('/categories', async (req, res) => {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { displayOrder: 'asc' },
            include: {
                _count: {
                    select: { activities: true }
                }
            }
        });
        const categoriesWithCounts = categories.map(cat => ({
            code: cat.code,
            name: cat.name,
            description: cat.description,
            ageMin: cat.ageMin,
            ageMax: cat.ageMax,
            activityCount: cat._count.activities,
            displayOrder: cat.displayOrder
        }));
        res.json({
            success: true,
            data: categoriesWithCounts,
            total: categoriesWithCounts.length
        });
    }
    catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories'
        });
    }
});
exports.default = router;
//# sourceMappingURL=reference.js.map