/**
 * Push Token Routes
 * Handles device push token registration and management
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../middleware/auth';

const router = Router();

/**
 * POST /api/push-tokens
 * Register or update a push token for the authenticated user
 */
router.post('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { token, platform, deviceId } = req.body;

    if (!token || !platform) {
      return res.status(400).json({ error: 'Token and platform are required' });
    }

    if (!['ios', 'android'].includes(platform)) {
      return res.status(400).json({ error: 'Platform must be ios or android' });
    }

    // Upsert the token - if token exists, update userId (handle device switching users)
    // If same user with same deviceId, update token
    const existingToken = await prisma.devicePushToken.findUnique({
      where: { token }
    });

    if (existingToken) {
      // Token exists - update userId and ensure active
      if (existingToken.userId !== userId) {
        // Device switched users - update the user
        await prisma.devicePushToken.update({
          where: { id: existingToken.id },
          data: {
            userId,
            platform,
            deviceId: deviceId || null,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      } else if (!existingToken.isActive) {
        // Same user, reactivate token
        await prisma.devicePushToken.update({
          where: { id: existingToken.id },
          data: {
            isActive: true,
            updatedAt: new Date(),
          },
        });
      }
      // Otherwise token is already registered for this user
    } else {
      // New token - check if this deviceId already has a token
      if (deviceId) {
        const existingDeviceToken = await prisma.devicePushToken.findFirst({
          where: { userId, deviceId },
        });

        if (existingDeviceToken) {
          // Same device, new token - update the token
          await prisma.devicePushToken.update({
            where: { id: existingDeviceToken.id },
            data: {
              token,
              platform,
              isActive: true,
              updatedAt: new Date(),
            },
          });
        } else {
          // New device - create new entry
          await prisma.devicePushToken.create({
            data: {
              userId,
              token,
              platform,
              deviceId,
              isActive: true,
            },
          });
        }
      } else {
        // No deviceId - just create new entry
        await prisma.devicePushToken.create({
          data: {
            userId,
            token,
            platform,
            isActive: true,
          },
        });
      }
    }

    console.log(`[Push] Token registered for user ${userId} on ${platform}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Push] Error registering token:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

/**
 * DELETE /api/push-tokens/:token
 * Unregister a push token (logout)
 */
router.delete('/:token', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { token } = req.params;

    // Soft delete - mark as inactive
    await prisma.devicePushToken.updateMany({
      where: {
        userId,
        token: decodeURIComponent(token),
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    console.log(`[Push] Token unregistered for user ${userId}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Push] Error unregistering token:', error);
    res.status(500).json({ error: 'Failed to unregister push token' });
  }
});

/**
 * GET /api/push-tokens
 * Get all active push tokens for the authenticated user (for debugging)
 */
router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const tokens = await prisma.devicePushToken.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        platform: true,
        deviceId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ tokens });
  } catch (error) {
    console.error('[Push] Error fetching tokens:', error);
    res.status(500).json({ error: 'Failed to fetch push tokens' });
  }
});

export default router;
