import { Router, Request, Response } from 'express';
import { verifyToken, authLimiter, logActivity } from '../middleware/auth';
import { invitationService } from '../services/invitationService';
import { body, param, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validateInvitation = [
  body('recipientEmail').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('message').optional().trim().isLength({ max: 500 }).withMessage('Message must be less than 500 characters'),
  body('expiresInDays').optional().isInt({ min: 1, max: 30 }).withMessage('Expiry must be between 1 and 30 days')
];

const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

/**
 * Send an invitation
 * POST /api/invitations
 */
router.post(
  '/',
  verifyToken,
  authLimiter,
  validateInvitation,
  handleValidationErrors,
  logActivity('send_invitation'),
  async (req: Request, res: Response) => {
    try {
      const invitation = await invitationService.createInvitation({
        senderId: req.user!.id,
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
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Get sent invitations
 * GET /api/invitations/sent
 */
router.get(
  '/sent',
  verifyToken,
  logActivity('view_sent_invitations'),
  async (req: Request, res: Response) => {
    try {
      const invitations = await invitationService.getSentInvitations(req.user!.id);

      res.json({
        success: true,
        invitations: invitations.map(inv => ({
          id: inv.id,
          recipientEmail: inv.recipientEmail,
          recipientUser: (inv as any).recipient ? {
            id: (inv as any).recipient.id,
            name: (inv as any).recipient.name,
            email: (inv as any).recipient.email
          } : null,
          status: inv.status,
          message: inv.message,
          expiresAt: inv.expiresAt,
          acceptedAt: inv.acceptedAt,
          createdAt: inv.createdAt
        }))
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch invitations'
      });
    }
  }
);

/**
 * Get received invitations
 * GET /api/invitations/received
 */
router.get(
  '/received',
  verifyToken,
  logActivity('view_received_invitations'),
  async (req: Request, res: Response) => {
    try {
      const invitations = await invitationService.getReceivedInvitations(req.user!.email);

      res.json({
        success: true,
        invitations: invitations.map(inv => ({
          id: inv.id,
          token: inv.token,
          sender: {
            id: inv.sender.id,
            name: inv.sender.name,
            email: inv.sender.email,
            childrenCount: (inv.sender as any).children?.length || 0
          },
          status: inv.status,
          message: inv.message,
          expiresAt: inv.expiresAt,
          createdAt: inv.createdAt
        }))
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch invitations'
      });
    }
  }
);

/**
 * Get invitation details by token (for preview before accepting)
 * GET /api/invitations/preview/:token
 */
router.get(
  '/preview/:token',
  param('token').notEmpty(),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const invitation = await invitationService.getInvitationByToken(req.params.token);

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
            children: (invitation.sender as any).children?.map((child: any) => ({
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
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch invitation'
      });
    }
  }
);

/**
 * Accept an invitation
 * POST /api/invitations/accept
 */
router.post(
  '/accept',
  verifyToken,
  authLimiter,
  body('token').notEmpty(),
  handleValidationErrors,
  logActivity('accept_invitation'),
  async (req: Request, res: Response) => {
    try {
      await invitationService.acceptInvitation({
        token: req.body.token,
        userId: req.user!.id
      });

      res.json({
        success: true,
        message: 'Invitation accepted successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Decline an invitation
 * POST /api/invitations/decline
 */
router.post(
  '/decline',
  verifyToken,
  authLimiter,
  body('token').notEmpty(),
  handleValidationErrors,
  logActivity('decline_invitation'),
  async (req: Request, res: Response) => {
    try {
      await invitationService.declineInvitation(req.body.token, req.user!.id);

      res.json({
        success: true,
        message: 'Invitation declined'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Cancel a sent invitation
 * DELETE /api/invitations/:id
 */
router.delete(
  '/:id',
  verifyToken,
  authLimiter,
  param('id').isUUID(),
  handleValidationErrors,
  logActivity('cancel_invitation'),
  async (req: Request, res: Response) => {
    try {
      await invitationService.cancelInvitation(req.params.id, req.user!.id);

      res.json({
        success: true,
        message: 'Invitation cancelled'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Resend an invitation
 * POST /api/invitations/:id/resend
 */
router.post(
  '/:id/resend',
  verifyToken,
  authLimiter,
  param('id').isUUID(),
  handleValidationErrors,
  logActivity('resend_invitation'),
  async (req: Request, res: Response) => {
    try {
      await invitationService.resendInvitation(req.params.id, req.user!.id);

      res.json({
        success: true,
        message: 'Invitation resent'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;