"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../generated/prisma");
const activityFilters_1 = require("../utils/activityFilters");
const router = (0, express_1.Router)();
const prisma = new prisma_1.PrismaClient();
router.get('/activity-types', async (req, res) => {
    try {
        const globalFilters = (0, activityFilters_1.extractGlobalFilters)(req.query);
        const activityTypes = await prisma.activityType.findMany({
            orderBy: { displayOrder: 'asc' }
        });
        const typesWithCounts = await Promise.all(activityTypes.map(async (type) => {
            const count = await prisma.activity.count({
                where: (0, activityFilters_1.buildActivityWhereClause)({ activityTypeId: type.id }, globalFilters)
            });
            return {
                code: type.code,
                name: type.name,
                displayName: type.name,
                activityCount: count,
                displayOrder: type.displayOrder
            };
        }));
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
        const globalFilters = (0, activityFilters_1.extractGlobalFilters)(req.query);
        const activityType = await prisma.activityType.findUnique({
            where: { code: typeCode },
            include: {
                subtypes: {
                    orderBy: { displayOrder: 'asc' }
                }
            }
        });
        if (!activityType) {
            return res.status(404).json({
                success: false,
                error: 'Activity type not found'
            });
        }
        const subtypesWithCounts = await Promise.all(activityType.subtypes.map(async (subtype) => {
            const count = await prisma.activity.count({
                where: (0, activityFilters_1.buildActivityWhereClause)({ activitySubtypeId: subtype.id }, globalFilters)
            });
            return {
                code: subtype.code,
                name: subtype.name,
                activityCount: count
            };
        }));
        const totalActivities = await prisma.activity.count({
            where: (0, activityFilters_1.buildActivityWhereClause)({ activityTypeId: activityType.id }, globalFilters)
        });
        res.json({
            success: true,
            data: {
                code: activityType.code,
                name: activityType.name,
                totalActivities,
                subtypes: subtypesWithCounts.sort((a, b) => b.activityCount - a.activityCount)
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
exports.default = router;
//# sourceMappingURL=reference.js.map