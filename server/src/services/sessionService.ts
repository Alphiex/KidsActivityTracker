import { prisma } from '../lib/prisma';
import { tokenUtils } from '../utils/tokenUtils';
import crypto from 'crypto';

interface SessionData {
  userId: string;
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
}

interface SessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date | null;
  lastAccessedAt: Date | null;
}

export class SessionService {
  private readonly SESSION_EXPIRY_DAYS = 7;
  private readonly MAX_SESSIONS_PER_USER = 5;
  private readonly TRUSTED_DEVICE_EXPIRY_DAYS = 30;

  /**
   * Create a new session
   */
  async createSession(data: SessionData): Promise<string> {
    const { userId, refreshToken, userAgent, ipAddress } = data;

    // Hash the refresh token for storage
    const hashedToken = tokenUtils.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.SESSION_EXPIRY_DAYS);

    // Store session in database
    const session = await prisma.session.create({
      data: {
        userId,
        refreshTokenHash: hashedToken,
        userAgent,
        ipAddress,
        expiresAt,
        lastAccessedAt: new Date()
      }
    });

    // Clean up old sessions for this user
    await this.cleanupUserSessions(userId);

    return session.id;
  }

  /**
   * Validate a refresh token
   */
  async validateRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const hashedToken = tokenUtils.hashToken(refreshToken);

    const session = await prisma.session.findFirst({
      where: {
        userId,
        refreshTokenHash: hashedToken,
        expiresAt: { gt: new Date() }
      }
    });

    if (session) {
      // Update last accessed time
      await this.updateSessionActivity(session.id);
      return true;
    }

    return false;
  }

  /**
   * Revoke a refresh token
   */
  async revokeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hashedToken = tokenUtils.hashToken(refreshToken);

    await prisma.session.deleteMany({
      where: {
        userId,
        refreshTokenHash: hashedToken
      }
    });
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { userId }
    });
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() }
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastAccessedAt: true
      },
      orderBy: { lastAccessedAt: 'desc' }
    });

    return sessions;
  }

  /**
   * Update session last accessed time
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastAccessedAt: new Date() }
    }).catch(() => {
      // Session might have been deleted, ignore error
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });

    return result.count;
  }

  /**
   * Clean up old sessions for a user (keep only the most recent ones)
   */
  private async cleanupUserSessions(userId: string): Promise<void> {
    // Get all sessions for user, ordered by creation date
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true }
    });

    // If more than max allowed, delete the oldest ones
    if (sessions.length > this.MAX_SESSIONS_PER_USER) {
      const sessionsToDelete = sessions.slice(this.MAX_SESSIONS_PER_USER);
      const sessionIds = sessionsToDelete.map(s => s.id);

      await prisma.session.deleteMany({
        where: {
          id: { in: sessionIds }
        }
      });
    }
  }

  /**
   * Generate device fingerprint
   */
  generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
    const data = `${userAgent}:${ipAddress}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(userId: string, deviceFingerprint: string): Promise<boolean> {
    const trustedDevice = await prisma.trustedDevice.findFirst({
      where: {
        userId,
        fingerprint: deviceFingerprint,
        expiresAt: { gt: new Date() }
      }
    });

    return !!trustedDevice;
  }

  /**
   * Add trusted device
   */
  async addTrustedDevice(userId: string, deviceFingerprint: string, name?: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.TRUSTED_DEVICE_EXPIRY_DAYS);

    await prisma.trustedDevice.upsert({
      where: {
        userId_fingerprint: {
          userId,
          fingerprint: deviceFingerprint
        }
      },
      update: {
        name: name || 'Unknown Device',
        expiresAt
      },
      create: {
        userId,
        fingerprint: deviceFingerprint,
        name: name || 'Unknown Device',
        expiresAt
      }
    });
  }

  /**
   * Remove trusted device
   */
  async removeTrustedDevice(userId: string, deviceFingerprint: string): Promise<void> {
    await prisma.trustedDevice.deleteMany({
      where: {
        userId,
        fingerprint: deviceFingerprint
      }
    });
  }

  /**
   * Get all trusted devices for a user
   */
  async getTrustedDevices(userId: string): Promise<Array<{
    id: string;
    name: string | null;
    createdAt: Date | null;
    expiresAt: Date;
  }>> {
    return prisma.trustedDevice.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() }
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        expiresAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Clean up expired trusted devices
   */
  async cleanupExpiredTrustedDevices(): Promise<number> {
    const result = await prisma.trustedDevice.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });

    return result.count;
  }
}

export const sessionService = new SessionService();
