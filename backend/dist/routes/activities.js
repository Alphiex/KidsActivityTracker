"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const activityService_enhanced_1 = require("../services/activityService.enhanced");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const activityService = new activityService_enhanced_1.EnhancedActivityService();
router.get('/', auth_1.optionalAuth, async (req, res) => {
    try {
        const { search, category, categories, ageMin, ageMax, costMin, costMax, startDate, endDate, dayOfWeek, location, providerId, limit = '50', offset = '0', sortBy = 'dateStart', sortOrder = 'asc' } = req.query;
        const params = {
            search: search,
            category: category,
            categories: categories,
            ageMin: ageMin ? parseInt(ageMin) : undefined,
            ageMax: ageMax ? parseInt(ageMax) : undefined,
            costMin: costMin ? parseFloat(costMin) : undefined,
            costMax: costMax ? parseFloat(costMax) : undefined,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            dayOfWeek: dayOfWeek ? (Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek]) : undefined,
            location: location,
            providerId: providerId,
            limit: parseInt(limit),
            offset: parseInt(offset),
            sortBy: sortBy,
            sortOrder: sortOrder
        };
        const result = await activityService.searchActivities(params);
        res.json({
            success: true,
            activities: result.activities,
            total: result.pagination.total,
            hasMore: result.pagination.offset + result.pagination.limit < result.pagination.total,
            pagination: result.pagination
        });
    }
    catch (error) {
        console.error('Activity search error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search activities'
        });
    }
});
router.get('/stats/summary', async (req, res) => {
    try {
        const categories = await activityService.getActivitiesByCategory();
        const upcomingCount = await activityService.getUpcomingActivities({ daysAhead: 7 });
        res.json({
            success: true,
            stats: {
                categories,
                totalCategories: categories.length,
                upcomingCount: upcomingCount.pagination.total
            }
        });
    }
    catch (error) {
        console.error('Activity stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get activity statistics'
        });
    }
});
router.get('/:id', auth_1.optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const activity = await activityService.getActivity(id);
        if (!activity) {
            return res.status(404).json({
                success: false,
                error: 'Activity not found'
            });
        }
        res.json({
            success: true,
            activity
        });
    }
    catch (error) {
        console.error('Activity detail error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get activity details'
        });
    }
});
exports.default = router;
//# sourceMappingURL=activities.js.map