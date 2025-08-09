"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const invitationService_1 = require("../services/invitationService");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
const validateInvitation = [
    (0, express_validator_1.body)('recipientEmail').isEmail().normalizeEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('message').optional().trim().isLength({ max: 500 }).withMessage('Message must be less than 500 characters'),
    (0, express_validator_1.body)('expiresInDays').optional().isInt({ min: 1, max: 30 }).withMessage('Expiry must be between 1 and 30 days')
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
router.post('/', auth_1.verifyToken, auth_1.authLimiter, validateInvitation, handleValidationErrors, (0, auth_1.logActivity)('send_invitation'), async (req, res) => {
    try {
        const invitation = await invitationService_1.invitationService.createInvitation({
            senderId: req.user.id,
            recipientEmail: req.body.recipientEmail,
            message: req.body.message,
            expiresInDays: req.body.expiresInDays
        });
        res.status(201).json({
            success: true,
            invitation: {
                id: invitation.id,
                recipientEmail: invitation.recipientEmail,
                status: invitation.status,
                expiresAt: invitation.expiresAt,
                createdAt: invitation.createdAt
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
router.get('/sent', auth_1.verifyToken, (0, auth_1.logActivity)('view_sent_invitations'), async (req, res) => {
    try {
        const invitations = await invitationService_1.invitationService.getSentInvitations(req.user.id);
        res.json({
            success: true,
            invitations: invitations.map(inv => ({
                id: inv.id,
                recipientEmail: inv.recipientEmail,
                recipientUser: inv.recipient ? {
                    id: inv.recipient.id,
                    name: inv.recipient.name,
                    email: inv.recipient.email
                } : null,
                status: inv.status,
                message: inv.message,
                expiresAt: inv.expiresAt,
                acceptedAt: inv.acceptedAt,
                createdAt: inv.createdAt
            }))
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch invitations'
        });
    }
});
router.get('/received', auth_1.verifyToken, (0, auth_1.logActivity)('view_received_invitations'), async (req, res) => {
    try {
        const invitations = await invitationService_1.invitationService.getReceivedInvitations(req.user.email);
        res.json({
            success: true,
            invitations: invitations.map(inv => ({
                id: inv.id,
                token: inv.token,
                sender: {
                    id: inv.sender.id,
                    name: inv.sender.name,
                    email: inv.sender.email,
                    childrenCount: inv.sender.children?.length || 0
                },
                status: inv.status,
                message: inv.message,
                expiresAt: inv.expiresAt,
                createdAt: inv.createdAt
            }))
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch invitations'
        });
    }
});
router.get('/preview/:token', (0, express_validator_1.param)('token').notEmpty(), handleValidationErrors, async (req, res) => {
    try {
        const invitation = await invitationService_1.invitationService.getInvitationByToken(req.params.token);
        if (!invitation) {
            return res.status(404).json({
                success: false,
                error: 'Invitation not found'
            });
        }
        res.json({
            success: true,
            invitation: {
                id: invitation.id,
                sender: {
                    name: invitation.sender.name,
                    email: invitation.sender.email,
                    children: invitation.sender.children?.map((child) => ({
                        name: child.name,
                        age: Math.floor((Date.now() - new Date(child.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
                        interests: child.interests
                    }))
                },
                status: invitation.status,
                message: invitation.message,
                expiresAt: invitation.expiresAt,
                createdAt: invitation.createdAt
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch invitation'
        });
    }
});
router.post('/accept', auth_1.verifyToken, auth_1.authLimiter, (0, express_validator_1.body)('token').notEmpty(), handleValidationErrors, (0, auth_1.logActivity)('accept_invitation'), async (req, res) => {
    try {
        await invitationService_1.invitationService.acceptInvitation({
            token: req.body.token,
            userId: req.user.id
        });
        res.json({
            success: true,
            message: 'Invitation accepted successfully'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/decline', auth_1.verifyToken, auth_1.authLimiter, (0, express_validator_1.body)('token').notEmpty(), handleValidationErrors, (0, auth_1.logActivity)('decline_invitation'), async (req, res) => {
    try {
        await invitationService_1.invitationService.declineInvitation(req.body.token, req.user.id);
        res.json({
            success: true,
            message: 'Invitation declined'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.delete('/:id', auth_1.verifyToken, auth_1.authLimiter, (0, express_validator_1.param)('id').isUUID(), handleValidationErrors, (0, auth_1.logActivity)('cancel_invitation'), async (req, res) => {
    try {
        await invitationService_1.invitationService.cancelInvitation(req.params.id, req.user.id);
        res.json({
            success: true,
            message: 'Invitation cancelled'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/:id/resend', auth_1.verifyToken, auth_1.authLimiter, (0, express_validator_1.param)('id').isUUID(), handleValidationErrors, (0, auth_1.logActivity)('resend_invitation'), async (req, res) => {
    try {
        await invitationService_1.invitationService.resendInvitation(req.params.id, req.user.id);
        res.json({
            success: true,
            message: 'Invitation resent'
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
//# sourceMappingURL=invitations.js.map