/**
 * Notifications Routes Tests
 * Tests for /api/notifications/* endpoints
 */
import request from 'supertest';
import express from 'express';
import { prismaMock, resetPrismaMocks } from '../mocks/prisma';
import { mockNotificationPreferences } from '../mocks/testData';
import { swimActivity } from '../mocks/fixtures/activities';

// Mock modules
jest.mock('../../../server/src/utils/prismaClient', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('../../../server/src/middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'user-1', email: 'test@example.com' };
    next();
  }),
}));

jest.mock('../../../server/src/utils/emailService', () => ({
  __esModule: true,
  default: {
    sendTestEmail: jest.fn().mockResolvedValue({ success: true }),
  },
}));

import notificationsRouter from '../../../server/src/routes/notifications';

const app = express();
app.use(express.json());
app.use('/api/notifications', notificationsRouter);

describe('Notifications Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetPrismaMocks();
  });

  describe('GET /api/notifications/preferences', () => {
    it('should return user notification preferences', async () => {
      prismaMock.userPreference.findUnique.mockResolvedValue(mockNotificationPreferences);

      const response = await request(app)
        .get('/api/notifications/preferences')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('preferences');
      expect(response.body.preferences).toHaveProperty('enabled');
    });

    it('should return default preferences if none exist', async () => {
      prismaMock.userPreference.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/notifications/preferences')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('preferences');
    });
  });

  describe('PUT /api/notifications/preferences', () => {
    it('should update notification preferences', async () => {
      const updatedPrefs = { ...mockNotificationPreferences, dailyDigest: true };
      prismaMock.userPreference.upsert.mockResolvedValue(updatedPrefs);

      const response = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', 'Bearer valid-token')
        .send({ dailyDigest: true });

      expect(response.status).toBe(200);
      expect(response.body.preferences.dailyDigest).toBe(true);
    });

    it('should toggle all notifications off', async () => {
      const disabledPrefs = { ...mockNotificationPreferences, enabled: false };
      prismaMock.userPreference.upsert.mockResolvedValue(disabledPrefs);

      const response = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', 'Bearer valid-token')
        .send({ enabled: false });

      expect(response.status).toBe(200);
      expect(response.body.preferences.enabled).toBe(false);
    });
  });

  describe('GET /api/notifications/history', () => {
    it('should return notification history', async () => {
      prismaMock.notificationHistory.findMany.mockResolvedValue([
        { id: 'n1', type: 'daily_digest', activityCount: 5, sentAt: new Date(), status: 'sent' },
        { id: 'n2', type: 'capacity_alert', activityCount: 1, sentAt: new Date(), status: 'sent' },
      ]);

      const response = await request(app)
        .get('/api/notifications/history')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('notifications');
      expect(Array.isArray(response.body.notifications)).toBe(true);
    });

    it('should support pagination', async () => {
      prismaMock.notificationHistory.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/notifications/history')
        .query({ limit: 10, offset: 0 })
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('POST /api/notifications/test', () => {
    it('should send test notification email', async () => {
      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/notifications/waitlist', () => {
    it('should return user waitlist entries', async () => {
      prismaMock.waitlistEntry.findMany.mockResolvedValue([
        { id: 'w1', userId: 'user-1', activityId: swimActivity.id, activity: swimActivity, joinedAt: new Date() },
      ]);

      const response = await request(app)
        .get('/api/notifications/waitlist')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('waitlist');
      expect(Array.isArray(response.body.waitlist)).toBe(true);
    });
  });

  describe('POST /api/notifications/waitlist/:activityId', () => {
    it('should join waitlist for activity', async () => {
      prismaMock.activity.findUnique.mockResolvedValue(swimActivity);
      prismaMock.waitlistEntry.findFirst.mockResolvedValue(null);
      prismaMock.waitlistEntry.create.mockResolvedValue({
        id: 'new-waitlist',
        userId: 'user-1',
        activityId: swimActivity.id,
        joinedAt: new Date(),
      });

      const response = await request(app)
        .post(`/api/notifications/waitlist/${swimActivity.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should return 404 for non-existent activity', async () => {
      prismaMock.activity.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/notifications/waitlist/non-existent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should return 400 if already on waitlist', async () => {
      prismaMock.activity.findUnique.mockResolvedValue(swimActivity);
      prismaMock.waitlistEntry.findFirst.mockResolvedValue({
        id: 'existing',
        userId: 'user-1',
        activityId: swimActivity.id,
      });

      const response = await request(app)
        .post(`/api/notifications/waitlist/${swimActivity.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/notifications/waitlist/:activityId', () => {
    it('should leave waitlist for activity', async () => {
      prismaMock.waitlistEntry.findFirst.mockResolvedValue({
        id: 'w1',
        userId: 'user-1',
        activityId: swimActivity.id,
      });
      prismaMock.waitlistEntry.delete.mockResolvedValue({
        id: 'w1',
        userId: 'user-1',
        activityId: swimActivity.id,
      });

      const response = await request(app)
        .delete(`/api/notifications/waitlist/${swimActivity.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should return 404 if not on waitlist', async () => {
      prismaMock.waitlistEntry.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/notifications/waitlist/${swimActivity.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/notifications/unsubscribe-all', () => {
    it('should unsubscribe from all notifications', async () => {
      prismaMock.userPreference.update.mockResolvedValue({
        ...mockNotificationPreferences,
        enabled: false,
        newActivities: false,
        dailyDigest: false,
        weeklyDigest: false,
      });

      const response = await request(app)
        .post('/api/notifications/unsubscribe-all')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });
});
