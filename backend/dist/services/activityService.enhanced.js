"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityService = exports.EnhancedActivityService = void 0;
const prisma_1 = require("../../generated/prisma");
const { convertToActivityTypes } = require('../../constants/activityTypes');
class EnhancedActivityService {
    constructor() {
        this.prisma = new prisma_1.PrismaClient();
    }
    async searchActivities(params) {
        const { search, category, categories, ageMin, ageMax, costMin, costMax, startDate, endDate, dayOfWeek, location, providerId, limit = 50, offset = 0, sortBy = 'dateStart', sortOrder = 'asc', includeInactive = false } = params;
        const where = {
            isActive: includeInactive ? undefined : true
        };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { locationName: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
                { subcategory: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (category) {
            const categoryRecord = await this.prisma.category.findUnique({
                where: { code: category }
            });
            if (categoryRecord) {
                where.categories = {
                    some: { categoryId: categoryRecord.id }
                };
            }
            else {
                where.category = category;
            }
        }
        else if (categories) {
            const categoryList = categories.split(',').map(c => c.trim()).filter(c => c);
            if (categoryList.length > 0) {
                const activityTypes = convertToActivityTypes(categoryList);
                where.OR = [
                    { activityType: { in: activityTypes } },
                    { category: { in: categoryList } }
                ];
            }
        }
        if (ageMin !== undefined || ageMax !== undefined) {
            const andConditions = [];
            if (ageMin !== undefined) {
                andConditions.push({
                    OR: [
                        { ageMin: { lte: ageMin } },
                        { ageMin: null }
                    ]
                });
            }
            if (ageMax !== undefined) {
                andConditions.push({
                    OR: [
                        { ageMax: { gte: ageMax } },
                        { ageMax: null }
                    ]
                });
            }
            if (andConditions.length > 0) {
                where.AND = where.AND ? [...(Array.isArray(where.AND) ? where.AND : [where.AND]), ...andConditions] : andConditions;
            }
        }
        if (costMin !== undefined || costMax !== undefined) {
            const costFilter = {};
            if (costMin !== undefined)
                costFilter.gte = costMin;
            if (costMax !== undefined)
                costFilter.lte = costMax;
            where.cost = costFilter;
        }
        if (startDate) {
            where.dateEnd = { gte: startDate };
        }
        if (endDate) {
            where.dateStart = { lte: endDate };
        }
        if (dayOfWeek && dayOfWeek.length > 0) {
            where.dayOfWeek = { hasSome: dayOfWeek };
        }
        if (location) {
            where.locationName = { contains: location, mode: 'insensitive' };
        }
        if (providerId) {
            where.providerId = providerId;
        }
        const [activities, total] = await Promise.all([
            this.prisma.activity.findMany({
                where,
                include: {
                    provider: true,
                    location: true,
                    _count: {
                        select: { favorites: true }
                    }
                },
                orderBy: { [sortBy]: sortOrder },
                take: limit,
                skip: offset
            }),
            this.prisma.activity.count({ where })
        ]);
        return {
            activities,
            pagination: {
                total,
                limit,
                offset,
                pages: Math.ceil(total / limit)
            }
        };
    }
    async getActivity(id, includeInactive = false) {
        const activity = await this.prisma.activity.findUnique({
            where: { id },
            include: {
                provider: true,
                location: true,
                _count: {
                    select: {
                        favorites: true,
                        childActivities: true
                    }
                }
            }
        });
        if (!activity || (!includeInactive && !activity.isActive)) {
            return null;
        }
        return activity;
    }
    async getActivityByProviderAndCourseId(providerId, courseId) {
        return this.prisma.activity.findUnique({
            where: {
                providerId_externalId: {
                    providerId,
                    externalId: courseId
                }
            },
            include: {
                provider: true,
                location: true
            }
        });
    }
    async getUpcomingActivities(params) {
        const { limit = 50, offset = 0, daysAhead = 30 } = params;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);
        return this.searchActivities({
            startDate: new Date(),
            endDate: futureDate,
            limit,
            offset,
            sortBy: 'dateStart',
            sortOrder: 'asc'
        });
    }
    async getActivitiesByCategory() {
        const categories = await this.prisma.activity.groupBy({
            by: ['category'],
            where: { isActive: true },
            _count: { _all: true },
            orderBy: { _count: { category: 'desc' } }
        });
        return categories.map(cat => ({
            category: cat.category,
            count: cat._count._all
        }));
    }
    async getActivityHistory(activityId) {
        return this.prisma.activityHistory.findMany({
            where: { activityId },
            orderBy: { createdAt: 'desc' }
        });
    }
    async getProviderStats(providerId) {
        const [activeCount, inactiveCount, lastRun] = await Promise.all([
            this.prisma.activity.count({
                where: { providerId, isActive: true }
            }),
            this.prisma.activity.count({
                where: { providerId, isActive: false }
            }),
            this.prisma.scraperRun.findFirst({
                where: { providerId },
                orderBy: { startedAt: 'desc' }
            })
        ]);
        return {
            activeActivities: activeCount,
            inactiveActivities: inactiveCount,
            totalActivities: activeCount + inactiveCount,
            lastScraperRun: lastRun
        };
    }
    async cleanup() {
        await this.prisma.$disconnect();
    }
}
exports.EnhancedActivityService = EnhancedActivityService;
exports.activityService = new EnhancedActivityService();
//# sourceMappingURL=activityService.enhanced.js.map