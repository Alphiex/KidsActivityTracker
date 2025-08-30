"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.childActivityService = exports.ChildActivityService = void 0;
const prisma_1 = require("../../generated/prisma");
const dateUtils_1 = require("../utils/dateUtils");
const childrenService_1 = require("./childrenService");
const prisma = new prisma_1.PrismaClient();
class ChildActivityService {
    async linkActivity(userId, input) {
        const isOwner = await childrenService_1.childrenService.verifyChildOwnership(input.childId, userId);
        if (!isOwner) {
            throw new Error('Unauthorized: You do not own this child profile');
        }
        const activity = await prisma.activity.findUnique({
            where: { id: input.activityId }
        });
        if (!activity) {
            throw new Error('Activity not found');
        }
        const existingLink = await prisma.childActivity.findUnique({
            where: {
                childId_activityId: {
                    childId: input.childId,
                    activityId: input.activityId
                }
            }
        });
        const now = new Date();
        const data = {
            status: input.status,
            notes: input.notes,
            ...(input.status === 'registered' && !existingLink?.registeredAt && { registeredAt: now }),
            ...(input.status === 'completed' && { completedAt: now })
        };
        if (existingLink) {
            return await prisma.childActivity.update({
                where: { id: existingLink.id },
                data
            });
        }
        return await prisma.childActivity.create({
            data: {
                childId: input.childId,
                activityId: input.activityId,
                status: input.status,
                notes: input.notes,
                ...(input.status === 'registered' && { registeredAt: now }),
                ...(input.status === 'completed' && { completedAt: now }),
            }
        });
    }
    async updateActivityStatus(userId, childId, activityId, input) {
        const isOwner = await childrenService_1.childrenService.verifyChildOwnership(childId, userId);
        if (!isOwner) {
            throw new Error('Unauthorized: You do not own this child profile');
        }
        const childActivity = await prisma.childActivity.findUnique({
            where: {
                childId_activityId: { childId, activityId }
            }
        });
        if (!childActivity) {
            throw new Error('Activity link not found');
        }
        const now = new Date();
        const data = {
            status: input.status,
            notes: input.notes,
            rating: input.rating,
            ...(input.status === 'registered' && !childActivity.registeredAt && { registeredAt: now }),
            ...(input.status === 'completed' && { completedAt: now })
        };
        return await prisma.childActivity.update({
            where: { id: childActivity.id },
            data
        });
    }
    async unlinkActivity(userId, childId, activityId) {
        const isOwner = await childrenService_1.childrenService.verifyChildOwnership(childId, userId);
        if (!isOwner) {
            throw new Error('Unauthorized: You do not own this child profile');
        }
        try {
            await prisma.childActivity.delete({
                where: {
                    childId_activityId: { childId, activityId }
                }
            });
            return true;
        }
        catch {
            return false;
        }
    }
    async getActivityHistory(userId, filters = {}) {
        if (filters.childId) {
            const isOwner = await childrenService_1.childrenService.verifyChildOwnership(filters.childId, userId);
            if (!isOwner) {
                throw new Error('Unauthorized: You do not own this child profile');
            }
        }
        const whereClause = {
            child: {
                userId,
                isActive: true
            },
            ...(filters.childId && { childId: filters.childId }),
            ...(filters.status && { status: filters.status }),
            ...(filters.minRating && { rating: { gte: filters.minRating } }),
            ...(filters.category && {
                activity: { category: filters.category }
            })
        };
        if (filters.startDate || filters.endDate) {
            whereClause.OR = [
                {
                    activity: {
                        dateStart: {
                            ...(filters.startDate && { gte: filters.startDate }),
                            ...(filters.endDate && { lte: filters.endDate })
                        }
                    }
                },
                {
                    registeredAt: {
                        ...(filters.startDate && { gte: filters.startDate }),
                        ...(filters.endDate && { lte: filters.endDate })
                    }
                },
                {
                    completedAt: {
                        ...(filters.startDate && { gte: filters.startDate }),
                        ...(filters.endDate && { lte: filters.endDate })
                    }
                }
            ];
        }
        const activities = await prisma.childActivity.findMany({
            where: whereClause,
            include: {
                child: true,
                activity: {
                    include: {
                        location: true,
                        provider: true
                    }
                }
            },
            orderBy: [
                { completedAt: 'desc' },
                { registeredAt: 'desc' },
                { createdAt: 'desc' }
            ]
        });
        return activities.map(item => ({
            ...item,
            childAge: (0, dateUtils_1.calculateAge)(item.child.dateOfBirth)
        }));
    }
    async getAgeAppropriateActivities(userId, childId) {
        const child = await childrenService_1.childrenService.getChildById(childId, userId);
        if (!child) {
            throw new Error('Child not found or unauthorized');
        }
        const { minAge, maxAge } = (0, dateUtils_1.getAgeAppropriateRange)(child.age);
        const linkedActivities = await prisma.childActivity.findMany({
            where: { childId },
            select: { activityId: true }
        });
        const linkedActivityIds = linkedActivities.map(la => la.activityId);
        const activities = await prisma.activity.findMany({
            where: {
                isActive: true,
                id: { notIn: linkedActivityIds },
                OR: [
                    {
                        AND: [
                            { ageMin: { lte: child.age } },
                            { ageMax: { gte: child.age } }
                        ]
                    },
                    {
                        AND: [
                            { ageMin: { lte: maxAge } },
                            { ageMax: { gte: minAge } }
                        ]
                    }
                ],
                ...(child.interests.length > 0 && {
                    OR: [
                        { category: { in: child.interests } },
                        { subcategory: { in: child.interests } }
                    ]
                })
            },
            include: {
                location: true,
                provider: true
            },
            orderBy: [
                { dateStart: 'asc' },
                { cost: 'asc' }
            ],
            take: 50
        });
        return activities;
    }
    async getChildFavorites(userId, childId) {
        const isOwner = await childrenService_1.childrenService.verifyChildOwnership(childId, userId);
        if (!isOwner) {
            throw new Error('Unauthorized: You do not own this child profile');
        }
        const activities = await prisma.childActivity.findMany({
            where: {
                childId,
                OR: [
                    { status: 'registered' },
                    { status: 'completed', rating: { gte: 4 } }
                ]
            },
            include: {
                activity: {
                    include: {
                        location: true,
                        provider: true
                    }
                }
            },
            orderBy: [
                { rating: 'desc' },
                { completedAt: 'desc' }
            ]
        });
        return activities;
    }
    async getCalendarData(userId, view, date, childIds) {
        if (childIds && childIds.length > 0) {
            for (const childId of childIds) {
                const isOwner = await childrenService_1.childrenService.verifyChildOwnership(childId, userId);
                if (!isOwner) {
                    throw new Error(`Unauthorized: You do not own child profile ${childId}`);
                }
            }
        }
        const { start, end } = (0, dateUtils_1.getCalendarDateRange)(view, date);
        const activities = await prisma.childActivity.findMany({
            where: {
                child: {
                    userId,
                    isActive: true,
                    ...(childIds && childIds.length > 0 && { id: { in: childIds } })
                },
                status: { in: ['registered', 'completed'] },
                activity: {
                    OR: [
                        {
                            dateStart: {
                                gte: start,
                                lte: end
                            }
                        },
                        {
                            dateEnd: {
                                gte: start,
                                lte: end
                            }
                        },
                        {
                            AND: [
                                { dateStart: { lte: start } },
                                { dateEnd: { gte: end } }
                            ]
                        }
                    ]
                }
            },
            include: {
                child: true,
                activity: {
                    include: {
                        location: true
                    }
                }
            }
        });
        return activities.map(item => ({
            id: item.id,
            childId: item.child.id,
            childName: item.child.name,
            activityId: item.activity.id,
            activityName: item.activity.name,
            status: item.status,
            startDate: item.activity.dateStart,
            endDate: item.activity.dateEnd,
            location: item.activity.location?.name || item.activity.locationName,
            category: item.activity.category
        }));
    }
    async getActivityStats(userId, childIds) {
        const children = childIds && childIds.length > 0
            ? childIds
            : (await childrenService_1.childrenService.getChildrenByUserId(userId)).map(c => c.id);
        for (const childId of children) {
            const isOwner = await childrenService_1.childrenService.verifyChildOwnership(childId, userId);
            if (!isOwner) {
                throw new Error(`Unauthorized: You do not own child profile ${childId}`);
            }
        }
        const stats = await prisma.childActivity.groupBy({
            by: ['childId', 'status'],
            where: {
                childId: { in: children }
            },
            _count: true
        });
        const categoryStats = await prisma.childActivity.groupBy({
            by: ['childId'],
            where: {
                childId: { in: children }
            },
            _count: true
        });
        const ratingStats = await prisma.childActivity.aggregate({
            where: {
                childId: { in: children },
                status: 'completed',
                rating: { not: null }
            },
            _avg: { rating: true },
            _count: { rating: true }
        });
        return {
            byStatus: stats,
            totalActivities: categoryStats,
            averageRating: ratingStats._avg.rating || 0,
            totalRated: ratingStats._count.rating
        };
    }
    async bulkLinkActivities(userId, childId, activityIds, status = 'interested') {
        const isOwner = await childrenService_1.childrenService.verifyChildOwnership(childId, userId);
        if (!isOwner) {
            throw new Error('Unauthorized: You do not own this child profile');
        }
        const existingLinks = await prisma.childActivity.findMany({
            where: {
                childId,
                activityId: { in: activityIds }
            },
            select: { activityId: true }
        });
        const existingActivityIds = new Set(existingLinks.map(link => link.activityId));
        const newActivityIds = activityIds.filter(id => !existingActivityIds.has(id));
        if (newActivityIds.length === 0) {
            return 0;
        }
        const now = new Date();
        const data = newActivityIds.map(activityId => ({
            childId,
            activityId,
            status,
            ...(status === 'registered' && { registeredAt: now }),
        }));
        const result = await prisma.childActivity.createMany({
            data,
            skipDuplicates: true
        });
        return result.count;
    }
    async getUpcomingActivities(userId, days = 7) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);
        const activities = await prisma.childActivity.findMany({
            where: {
                child: {
                    userId,
                    isActive: true
                },
                status: 'registered',
                activity: {
                    dateStart: {
                        gte: new Date(),
                        lte: endDate
                    },
                    isActive: true
                }
            },
            include: {
                child: true,
                activity: {
                    include: {
                        location: true,
                        provider: true
                    }
                }
            },
            orderBy: {
                activity: {
                    dateStart: 'asc'
                }
            }
        });
        return activities;
    }
}
exports.ChildActivityService = ChildActivityService;
exports.childActivityService = new ChildActivityService();
//# sourceMappingURL=childActivityService.js.map