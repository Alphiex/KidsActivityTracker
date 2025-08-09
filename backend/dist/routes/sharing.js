"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const sharingService_1 = require("../services/sharingService");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
const validateShareConfig = [
    (0, express_validator_1.body)('sharedWithUserId').isUUID().withMessage('Valid user ID is required'),
    (0, express_validator_1.body)('permissionLevel').isIn(['view_all', 'view_registered', 'view_future']).withMessage('Invalid permission level'),
    (0, express_validator_1.body)('expiresAt').optional().isISO8601().withMessage('Valid expiry date is required'),
    (0, express_validator_1.body)('childPermissions').isArray({ min: 1 }).withMessage('At least one child must be shared'),
    (0, express_validator_1.body)('childPermissions.*.childId').isUUID().withMessage('Valid child ID is required'),
    (0, express_validator_1.body)('childPermissions.*.canViewInterested').isBoolean(),
    (0, express_validator_1.body)('childPermissions.*.canViewRegistered').isBoolean(),
    (0, express_validator_1.body)('childPermissions.*.canViewCompleted').isBoolean(),
    (0, express_validator_1.body)('childPermissions.*.canViewNotes').isBoolean()
];
const validateShareUpdate = [
    (0, express_validator_1.body)('permissionLevel').optional().isIn(['view_all', 'view_registered', 'view_future']),
    (0, express_validator_1.body)('expiresAt').optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)('isActive').optional().isBoolean()
];
const validateChildPermissionUpdate = [
    (0, express_validator_1.body)('canViewInterested').optional().isBoolean(),
    (0, express_validator_1.body)('canViewRegistered').optional().isBoolean(),
    (0, express_validator_1.body)('canViewCompleted').optional().isBoolean(),
    (0, express_validator_1.body)('canViewNotes').optional().isBoolean()
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
router.post('/', auth_1.verifyToken, validateShareConfig, handleValidationErrors, (0, auth_1.logActivity)('configure_sharing'), async (req, res) => {
    try {
        const share = await sharingService_1.sharingService.configureSharing(req.user.id, {
            sharedWithUserId: req.body.sharedWithUserId,
            permissionLevel: req.body.permissionLevel,
            expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
            childPermissions: req.body.childPermissions
        });
        res.status(201).json({
            success: true,
            share: {
                id: share.id,
                sharedWithUserId: share.sharedWithUserId,
                permissionLevel: share.permissionLevel,
                expiresAt: share.expiresAt,
                isActive: share.isActive,
                createdAt: share.createdAt
            }
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/', auth_1.verifyToken, (0, auth_1.logActivity)('view_shares'), async (req, res) => {
    try {
        const shares = await sharingService_1.sharingService.getUserShares(req.user.id);
        res.json({
            success: true,
            myShares: shares.myShares.map(share => ({
                id: share.id,
                sharedWithUser: {
                    id: share.sharedWithUser.id,
                    name: share.sharedWithUser.name,
                    email: share.sharedWithUser.email
                },
                permissionLevel: share.permissionLevel,
                expiresAt: share.expiresAt,
                isActive: share.isActive,
                children: share.profiles.map(profile => ({
                    id: profile.child.id,
                    name: profile.child.name,
                    permissions: {
                        canViewInterested: profile.canViewInterested,
                        canViewRegistered: profile.canViewRegistered,
                        canViewCompleted: profile.canViewCompleted,
                        canViewNotes: profile.canViewNotes
                    }
                })),
                createdAt: share.createdAt,
                updatedAt: share.updatedAt
            })),
            sharedWithMe: shares.sharedWithMe.map(share => ({
                id: share.id,
                sharingUser: {
                    id: share.sharingUser.id,
                    name: share.sharingUser.name,
                    email: share.sharingUser.email
                },
                permissionLevel: share.permissionLevel,
                expiresAt: share.expiresAt,
                children: share.profiles.map(profile => ({
                    id: profile.child.id,
                    name: profile.child.name,
                    dateOfBirth: profile.child.dateOfBirth,
                    interests: profile.child.interests,
                    permissions: {
                        canViewInterested: profile.canViewInterested,
                        canViewRegistered: profile.canViewRegistered,
                        canViewCompleted: profile.canViewCompleted,
                        canViewNotes: profile.canViewNotes
                    }
                })),
                createdAt: share.createdAt
            }))
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch shares'
        });
    }
});
router.patch('/:id', auth_1.verifyToken, (0, express_validator_1.param)('id').isUUID(), validateShareUpdate, handleValidationErrors, (0, auth_1.logActivity)('update_share'), async (req, res) => {
    try {
        const updateData = {};
        if (req.body.permissionLevel !== undefined)
            updateData.permissionLevel = req.body.permissionLevel;
        if (req.body.expiresAt !== undefined)
            updateData.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
        if (req.body.isActive !== undefined)
            updateData.isActive = req.body.isActive;
        const share = await sharingService_1.sharingService.updateShare(req.params.id, req.user.id, updateData);
        res.json({
            success: true,
            share: {
                id: share.id,
                sharedWithUserId: share.sharedWithUserId,
                permissionLevel: share.permissionLevel,
                expiresAt: share.expiresAt,
                isActive: share.isActive,
                updatedAt: share.updatedAt
            }
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.patch('/:shareId/children/:childId', auth_1.verifyToken, (0, express_validator_1.param)('shareId').isUUID(), (0, express_validator_1.param)('childId').isUUID(), validateChildPermissionUpdate, handleValidationErrors, (0, auth_1.logActivity)('update_child_permissions'), async (req, res) => {
    try {
        const profile = await sharingService_1.sharingService.updateChildPermissions(req.params.shareId, req.params.childId, req.user.id, req.body);
        res.json({
            success: true,
            profile: {
                childId: profile.childId,
                canViewInterested: profile.canViewInterested,
                canViewRegistered: profile.canViewRegistered,
                canViewCompleted: profile.canViewCompleted,
                canViewNotes: profile.canViewNotes
            }
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.delete('/:shareId/children/:childId', auth_1.verifyToken, (0, express_validator_1.param)('shareId').isUUID(), (0, express_validator_1.param)('childId').isUUID(), handleValidationErrors, (0, auth_1.logActivity)('remove_child_from_share'), async (req, res) => {
    try {
        await sharingService_1.sharingService.removeChildFromShare(req.params.shareId, req.params.childId, req.user.id);
        res.json({
            success: true,
            message: 'Child removed from share'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/:shareId/children', auth_1.verifyToken, (0, express_validator_1.param)('shareId').isUUID(), (0, express_validator_1.body)('childId').isUUID(), validateChildPermissionUpdate, handleValidationErrors, (0, auth_1.logActivity)('add_child_to_share'), async (req, res) => {
    try {
        const profile = await sharingService_1.sharingService.addChildToShare(req.params.shareId, req.body.childId, req.user.id, {
            canViewInterested: req.body.canViewInterested,
            canViewRegistered: req.body.canViewRegistered,
            canViewCompleted: req.body.canViewCompleted,
            canViewNotes: req.body.canViewNotes
        });
        res.status(201).json({
            success: true,
            profile: {
                childId: profile.childId,
                canViewInterested: profile.canViewInterested,
                canViewRegistered: profile.canViewRegistered,
                canViewCompleted: profile.canViewCompleted,
                canViewNotes: profile.canViewNotes
            }
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/stats', auth_1.verifyToken, (0, auth_1.logActivity)('view_sharing_stats'), async (req, res) => {
    try {
        const stats = await sharingService_1.sharingService.getSharingStats(req.user.id);
        res.json({
            success: true,
            stats
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sharing statistics'
        });
    }
});
router.delete('/:id', auth_1.verifyToken, (0, express_validator_1.param)('id').isUUID(), handleValidationErrors, (0, auth_1.logActivity)('revoke_share'), async (req, res) => {
    try {
        await sharingService_1.sharingService.updateShare(req.params.id, req.user.id, { isActive: false });
        res.json({
            success: true,
            message: 'Share revoked successfully'
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
//# sourceMappingURL=sharing.js.map