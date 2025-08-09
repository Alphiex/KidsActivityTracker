"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const childActivityService_1 = require("../services/childActivityService");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
const validateActivityLink = [
    (0, express_validator_1.body)('childId').isUUID().withMessage('Valid child ID is required'),
    (0, express_validator_1.body)('activityId').isUUID().withMessage('Valid activity ID is required'),
    (0, express_validator_1.body)('status').isIn(['interested', 'registered', 'completed', 'cancelled']).withMessage('Invalid status'),
    (0, express_validator_1.body)('notes').optional().trim()
];
const validateActivityUpdate = [
    (0, express_validator_1.body)('status').isIn(['interested', 'registered', 'completed', 'cancelled']).withMessage('Invalid status'),
    (0, express_validator_1.body)('notes').optional().trim(),
    (0, express_validator_1.body)('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5')
];
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};
router.post('/link', auth_1.verifyToken, validateActivityLink, handleValidationErrors, async (req, res) => {
    try {
        const childActivity = await childActivityService_1.childActivityService.linkActivity(req.user.id, {
            childId: req.body.childId,
            activityId: req.body.activityId,
            status: req.body.status,
            notes: req.body.notes
        });
        res.status(201).json({
            success: true,
            childActivity
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/bulk-link', auth_1.verifyToken, async (req, res) => {
    try {
        const { childId, activityIds, status = 'interested' } = req.body;
        if (!childId || !Array.isArray(activityIds) || activityIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'childId and activityIds array are required'
            });
        }
        const count = await childActivityService_1.childActivityService.bulkLinkActivities(req.user.id, childId, activityIds, status);
        res.json({
            success: true,
            linkedCount: count,
            message: `${count} activities linked successfully`
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.put('/:childId/activities/:activityId', auth_1.verifyToken, validateActivityUpdate, handleValidationErrors, async (req, res) => {
    try {
        const childActivity = await childActivityService_1.childActivityService.updateActivityStatus(req.user.id, req.params.childId, req.params.activityId, {
            status: req.body.status,
            notes: req.body.notes,
            rating: req.body.rating
        });
        res.json({
            success: true,
            childActivity
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.delete('/:childId/activities/:activityId', auth_1.verifyToken, async (req, res) => {
    try {
        const success = await childActivityService_1.childActivityService.unlinkActivity(req.user.id, req.params.childId, req.params.activityId);
        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Activity link not found'
            });
        }
        res.json({
            success: true,
            message: 'Activity unlinked successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/history', auth_1.verifyToken, async (req, res) => {
    try {
        const filters = {
            childId: req.query.childId,
            status: req.query.status,
            startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
            category: req.query.category,
            minRating: req.query.minRating ? parseInt(req.query.minRating) : undefined
        };
        const history = await childActivityService_1.childActivityService.getActivityHistory(req.user.id, filters);
        res.json({
            success: true,
            activities: history
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/:childId/recommendations', auth_1.verifyToken, async (req, res) => {
    try {
        const activities = await childActivityService_1.childActivityService.getAgeAppropriateActivities(req.user.id, req.params.childId);
        res.json({
            success: true,
            activities
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/:childId/favorites', auth_1.verifyToken, async (req, res) => {
    try {
        const favorites = await childActivityService_1.childActivityService.getChildFavorites(req.user.id, req.params.childId);
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
router.get('/calendar', auth_1.verifyToken, async (req, res) => {
    try {
        const view = req.query.view || 'month';
        const date = req.query.date ? new Date(req.query.date) : new Date();
        const childIds = req.query.childIds
            ? req.query.childIds.split(',')
            : undefined;
        const calendarData = await childActivityService_1.childActivityService.getCalendarData(req.user.id, view, date, childIds);
        res.json({
            success: true,
            events: calendarData
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/stats', auth_1.verifyToken, async (req, res) => {
    try {
        const childIds = req.query.childIds
            ? req.query.childIds.split(',')
            : undefined;
        const stats = await childActivityService_1.childActivityService.getActivityStats(req.user.id, childIds);
        res.json({
            success: true,
            stats
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/upcoming', auth_1.verifyToken, async (req, res) => {
    try {
        const days = req.query.days ? parseInt(req.query.days) : 7;
        const activities = await childActivityService_1.childActivityService.getUpcomingActivities(req.user.id, days);
        res.json({
            success: true,
            activities
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/:childId/activities', auth_1.verifyToken, async (req, res) => {
    try {
        const status = req.query.status;
        const history = await childActivityService_1.childActivityService.getActivityHistory(req.user.id, {
            childId: req.params.childId,
            status
        });
        res.json({
            success: true,
            activities: history
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=childActivities.js.map