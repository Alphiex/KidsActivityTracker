"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const sharingService_1 = require("../services/sharingService");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
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
router.get('/children', auth_1.verifyToken, (0, express_validator_1.query)('sharingUserId').optional().isUUID(), handleValidationErrors, (0, auth_1.logActivity)('view_shared_children'), async (req, res) => {
    try {
        const sharedChildren = await sharingService_1.sharingService.getSharedChildren(req.user.id, req.query.sharingUserId);
        const formattedChildren = sharedChildren.map(child => {
            const age = Math.floor((Date.now() - new Date(child.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
            const activitySummary = {
                interested: child.activities.filter(a => a.status === 'interested').length,
                registered: child.activities.filter(a => a.status === 'registered').length,
                completed: child.activities.filter(a => a.status === 'completed').length
            };
            return {
                id: child.id,
                name: child.name,
                age,
                dateOfBirth: child.dateOfBirth,
                avatarUrl: child.avatarUrl,
                interests: child.interests,
                activitySummary,
                permissions: {
                    canViewInterested: child.shareProfile.canViewInterested,
                    canViewRegistered: child.shareProfile.canViewRegistered,
                    canViewCompleted: child.shareProfile.canViewCompleted,
                    canViewNotes: child.shareProfile.canViewNotes
                }
            };
        });
        res.json({
            success: true,
            children: formattedChildren
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch shared children'
        });
    }
});
router.get('/children/:childId/activities', auth_1.verifyToken, (0, express_validator_1.param)('childId').isUUID(), (0, express_validator_1.query)('status').optional().isIn(['interested', 'registered', 'completed', 'cancelled']), (0, express_validator_1.query)('startDate').optional().isISO8601(), (0, express_validator_1.query)('endDate').optional().isISO8601(), handleValidationErrors, (0, auth_1.logActivity)('view_shared_child_activities'), async (req, res) => {
    try {
        const hasAccess = await sharingService_1.sharingService.hasAccessToChild(req.user.id, req.params.childId);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'You do not have access to view this child\'s activities'
            });
        }
        const sharedChildren = await sharingService_1.sharingService.getSharedChildren(req.user.id);
        const sharedChild = sharedChildren.find(c => c.id === req.params.childId);
        if (!sharedChild) {
            return res.status(404).json({
                success: false,
                error: 'Child not found'
            });
        }
        let activities = sharedChild.activities;
        if (req.query.status) {
            activities = activities.filter(a => a.status === req.query.status);
        }
        if (req.query.startDate || req.query.endDate) {
            const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
            const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
            activities = activities.filter(a => {
                const activityDate = a.activity?.dateStart;
                if (!activityDate)
                    return true;
                if (startDate && activityDate < startDate)
                    return false;
                if (endDate && activityDate > endDate)
                    return false;
                return true;
            });
        }
        const formattedActivities = activities.map(childActivity => {
            const ca = childActivity;
            return {
                id: ca.id,
                status: ca.status,
                registeredAt: ca.registeredAt,
                completedAt: ca.completedAt,
                notes: sharedChild.shareProfile.canViewNotes ? ca.notes : null,
                rating: ca.rating,
                activity: {
                    id: ca.activity.id,
                    name: ca.activity.name,
                    category: ca.activity.category,
                    subcategory: ca.activity.subcategory,
                    description: ca.activity.description,
                    schedule: ca.activity.schedule,
                    dateStart: ca.activity.dateStart,
                    dateEnd: ca.activity.dateEnd,
                    ageMin: ca.activity.ageMin,
                    ageMax: ca.activity.ageMax,
                    cost: ca.activity.cost,
                    location: ca.activity.location ? {
                        name: ca.activity.location.name,
                        address: ca.activity.location.address,
                        city: ca.activity.location.city
                    } : null,
                    provider: {
                        name: ca.activity.provider.name,
                        website: ca.activity.provider.website
                    }
                }
            };
        });
        res.json({
            success: true,
            child: {
                id: sharedChild.id,
                name: sharedChild.name,
                age: Math.floor((Date.now() - new Date(sharedChild.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
            },
            activities: formattedActivities,
            permissions: {
                canViewInterested: sharedChild.shareProfile.canViewInterested,
                canViewRegistered: sharedChild.shareProfile.canViewRegistered,
                canViewCompleted: sharedChild.shareProfile.canViewCompleted,
                canViewNotes: sharedChild.shareProfile.canViewNotes
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch child activities'
        });
    }
});
router.get('/calendar', auth_1.verifyToken, (0, express_validator_1.query)('startDate').optional().isISO8601(), (0, express_validator_1.query)('endDate').optional().isISO8601(), (0, express_validator_1.query)('childIds').optional(), handleValidationErrors, (0, auth_1.logActivity)('view_shared_calendar'), async (req, res) => {
    try {
        const sharedChildren = await sharingService_1.sharingService.getSharedChildren(req.user.id);
        let filteredChildren = sharedChildren;
        if (req.query.childIds) {
            const childIds = Array.isArray(req.query.childIds)
                ? req.query.childIds
                : req.query.childIds.split(',');
            filteredChildren = sharedChildren.filter(c => childIds.includes(c.id));
        }
        const allActivities = [];
        const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
        const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
        for (const child of filteredChildren) {
            for (const childActivity of child.activities) {
                const ca = childActivity;
                const activity = ca.activity;
                if (activity.dateStart) {
                    if (startDate && activity.dateStart < startDate)
                        continue;
                    if (endDate && activity.dateStart > endDate)
                        continue;
                }
                allActivities.push({
                    childId: child.id,
                    childName: child.name,
                    childActivity: {
                        id: childActivity.id,
                        status: childActivity.status,
                        notes: child.shareProfile.canViewNotes ? childActivity.notes : null
                    },
                    activity: {
                        id: activity.id,
                        name: activity.name,
                        category: activity.category,
                        dateStart: activity.dateStart,
                        dateEnd: activity.dateEnd,
                        schedule: activity.schedule,
                        location: activity.location?.name,
                        cost: activity.cost
                    }
                });
            }
        }
        const groupedActivities = allActivities.reduce((acc, item) => {
            const dateKey = item.activity.dateStart
                ? new Date(item.activity.dateStart).toISOString().split('T')[0]
                : 'unscheduled';
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(item);
            return acc;
        }, {});
        res.json({
            success: true,
            calendar: groupedActivities,
            children: filteredChildren.map(c => ({
                id: c.id,
                name: c.name,
                avatarUrl: c.avatarUrl
            }))
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch calendar'
        });
    }
});
router.get('/stats', auth_1.verifyToken, (0, auth_1.logActivity)('view_shared_stats'), async (req, res) => {
    try {
        const sharedChildren = await sharingService_1.sharingService.getSharedChildren(req.user.id);
        const stats = {
            totalChildren: sharedChildren.length,
            totalActivities: 0,
            byStatus: {
                interested: 0,
                registered: 0,
                completed: 0,
                cancelled: 0
            },
            byCategory: {},
            upcomingThisWeek: 0,
            totalCost: 0
        };
        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
        for (const child of sharedChildren) {
            for (const childActivity of child.activities) {
                stats.totalActivities++;
                stats.byStatus[childActivity.status]++;
                const ca = childActivity;
                const category = ca.activity.category;
                stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
                if (ca.activity.dateStart &&
                    ca.activity.dateStart > new Date() &&
                    ca.activity.dateStart < oneWeekFromNow &&
                    childActivity.status === 'registered') {
                    stats.upcomingThisWeek++;
                }
                if (childActivity.status === 'registered') {
                    stats.totalCost += ca.activity.cost || 0;
                }
            }
        }
        res.json({
            success: true,
            stats
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});
router.get('/export', auth_1.verifyToken, (0, express_validator_1.query)('format').isIn(['json', 'csv', 'ical']), (0, express_validator_1.query)('childIds').optional(), handleValidationErrors, (0, auth_1.logActivity)('export_shared_activities'), async (req, res) => {
    try {
        const format = req.query.format;
        const sharedChildren = await sharingService_1.sharingService.getSharedChildren(req.user.id);
        let filteredChildren = sharedChildren;
        if (req.query.childIds) {
            const childIds = Array.isArray(req.query.childIds)
                ? req.query.childIds
                : req.query.childIds.split(',');
            filteredChildren = sharedChildren.filter(c => childIds.includes(c.id));
        }
        const exportData = [];
        for (const child of filteredChildren) {
            for (const childActivity of child.activities) {
                const ca = childActivity;
                const activity = ca.activity;
                exportData.push({
                    childName: child.name,
                    activityName: activity.name,
                    category: activity.category,
                    status: childActivity.status,
                    dateStart: activity.dateStart,
                    dateEnd: activity.dateEnd,
                    location: activity.location?.name,
                    cost: activity.cost,
                    notes: child.shareProfile.canViewNotes ? childActivity.notes : null
                });
            }
        }
        if (format === 'json') {
            res.json({
                success: true,
                data: exportData,
                exportedAt: new Date().toISOString()
            });
        }
        else if (format === 'csv') {
            const headers = ['Child Name', 'Activity Name', 'Category', 'Status', 'Start Date', 'End Date', 'Location', 'Cost', 'Notes'];
            const csvRows = [headers.join(',')];
            for (const row of exportData) {
                csvRows.push([
                    `"${row.childName}"`,
                    `"${row.activityName}"`,
                    `"${row.category}"`,
                    row.status,
                    row.dateStart || '',
                    row.dateEnd || '',
                    `"${row.location || ''}"`,
                    row.cost || '0',
                    `"${row.notes || ''}"`
                ].join(','));
            }
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=shared-activities.csv');
            res.send(csvRows.join('\n'));
        }
        else if (format === 'ical') {
            const icalEvents = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Kids Activity Tracker//Shared Activities//EN'
            ];
            for (const row of exportData) {
                if (row.dateStart && row.status === 'registered') {
                    icalEvents.push('BEGIN:VEVENT');
                    icalEvents.push(`UID:${Date.now()}-${Math.random()}@kidsactivitytracker.com`);
                    icalEvents.push(`DTSTART:${new Date(row.dateStart).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`);
                    if (row.dateEnd) {
                        icalEvents.push(`DTEND:${new Date(row.dateEnd).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`);
                    }
                    icalEvents.push(`SUMMARY:${row.activityName} - ${row.childName}`);
                    icalEvents.push(`LOCATION:${row.location || ''}`);
                    icalEvents.push(`DESCRIPTION:Category: ${row.category}\\nCost: $${row.cost || 0}${row.notes ? '\\nNotes: ' + row.notes : ''}`);
                    icalEvents.push('END:VEVENT');
                }
            }
            icalEvents.push('END:VCALENDAR');
            res.setHeader('Content-Type', 'text/calendar');
            res.setHeader('Content-Disposition', 'attachment; filename=shared-activities.ics');
            res.send(icalEvents.join('\r\n'));
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to export activities'
        });
    }
});
exports.default = router;
//# sourceMappingURL=sharedActivities.js.map