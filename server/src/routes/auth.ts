/**
 * Auth Routes - Firebase Authentication
 *
 * Most authentication is now handled by Firebase on the client side:
 * - Login/Register: Firebase Auth SDK
 * - Password Reset: Firebase sendPasswordResetEmail()
 * - Email Verification: Firebase sendEmailVerification()
 * - Token Refresh: Firebase handles automatically
 *
 * These routes handle PostgreSQL user management and profile operations.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { deleteFirebaseUser } from '../config/firebase';
import {
  verifyToken,
  authLimiter,
  logActivity
} from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/auth/sync
 * @desc    Sync Firebase user with PostgreSQL (called after Firebase login)
 * @access  Private (requires Firebase token)
 *
 * This endpoint is called after a user logs in via Firebase.
 * The verifyToken middleware automatically creates/links the PostgreSQL user.
 * This endpoint returns the full user profile.
 */
router.post('/sync', verifyToken, logActivity('sync'), async (req: Request, res: Response) => {
  try {
    // The user is already created/linked by verifyToken middleware
    // Just fetch and return the full profile
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        preferences: true,
        authProvider: true,
        createdAt: true,
        updatedAt: true,
        children: {
          select: {
            id: true,
            name: true,
            dateOfBirth: true,
          }
        },
        _count: {
          select: {
            favorites: true,
            children: true,
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Include Firebase user info if available
    const firebaseUser = req.firebaseUser;

    res.json({
      success: true,
      user: {
        ...user,
        // Add Firebase profile data if available
        profilePicture: firebaseUser?.picture || null,
      }
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync user'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (acknowledgment only - Firebase handles token invalidation)
 * @access  Private
 */
router.post('/logout', verifyToken, logActivity('logout'), async (req: Request, res: Response) => {
  // Firebase handles token invalidation on the client side
  // This is just an acknowledgment endpoint
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * @route   GET /api/auth/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', verifyToken, logActivity('get-profile'), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        preferences: true,
        authProvider: true,
        createdAt: true,
        updatedAt: true,
        children: {
          select: {
            id: true,
            name: true,
            dateOfBirth: true,
          }
        },
        _count: {
          select: {
            favorites: true,
            children: true,
            myShares: true,
            sharedWithMe: true,
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Include Firebase profile data if available
    const firebaseUser = req.firebaseUser;

    res.json({
      success: true,
      profile: {
        ...user,
        profilePicture: firebaseUser?.picture || null,
      }
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', verifyToken, logActivity('update-profile'), async (req: Request, res: Response) => {
  try {
    const { name, phoneNumber, preferences } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (preferences !== undefined) updateData.preferences = preferences;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        preferences: true,
        authProvider: true,
        updatedAt: true,
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: user
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * @route   GET /api/auth/check
 * @desc    Check authentication status
 * @access  Private
 */
router.get('/check', verifyToken, async (req: Request, res: Response) => {
  res.json({
    success: true,
    authenticated: true,
    user: {
      id: req.user!.id,
      email: req.user!.email,
      authProvider: req.user!.authProvider,
    }
  });
});

/**
 * @route   DELETE /api/auth/delete-account
 * @desc    Delete user account and all associated data
 * @access  Private
 * @note    Apple App Store requirement - users must be able to delete their accounts
 */
router.delete('/delete-account', verifyToken, authLimiter, logActivity('delete-account'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const firebaseUid = req.user!.firebaseUid;

    // Delete user from PostgreSQL (cascades to related data)
    await prisma.$transaction(async (tx) => {
      // Delete related data first (for tables without cascade)
      await tx.activityShareProfile.deleteMany({
        where: {
          activityShare: {
            OR: [
              { sharingUserId: userId },
              { sharedWithUserId: userId }
            ]
          }
        }
      });

      await tx.activityShare.deleteMany({
        where: {
          OR: [
            { sharingUserId: userId },
            { sharedWithUserId: userId }
          ]
        }
      });

      // Delete the user (other relations have onDelete: Cascade)
      await tx.user.delete({
        where: { id: userId }
      });
    });

    // Delete from Firebase Auth
    if (firebaseUid) {
      const deleted = await deleteFirebaseUser(firebaseUid);
      if (!deleted) {
        console.warn(`[Auth] Failed to delete Firebase user ${firebaseUid}, but PostgreSQL user was deleted`);
      }
    }

    console.log(`[Auth] Account deleted: ${userId}`);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error: any) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account'
    });
  }
});

export default router;
