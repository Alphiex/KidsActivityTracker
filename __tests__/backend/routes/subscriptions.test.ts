/**
 * Subscriptions Routes Tests
 * Tests for /api/subscriptions/* endpoints
 */
import request from 'supertest';
import express from 'express';
import { prismaMock, resetPrismaMocks } from '../mocks/prisma';
import { mockSubscriptions } from '../mocks/testData';
import { regularUser, premiumUser } from '../mocks/fixtures/users';

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

import subscriptionsRouter from '../../../server/src/routes/subscriptions';

const app = express();
app.use(express.json());
app.use('/api/subscriptions', subscriptionsRouter);

describe('Subscriptions Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetPrismaMocks();
  });

  describe('GET /api/subscriptions/status', () => {
    it('should return subscription status for subscribed user', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(mockSubscriptions[0]);

      const response = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isSubscribed', true);
      expect(response.body).toHaveProperty('tier', 'premium');
    });

    it('should return free tier for non-subscribed user', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isSubscribed', false);
      expect(response.body).toHaveProperty('tier', 'free');
    });

    it('should return expired for expired subscription', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue({
        ...mockSubscriptions[0],
        status: 'expired',
        expiresAt: new Date('2023-01-01'),
      });

      const response = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isSubscribed', false);
    });
  });

  describe('POST /api/subscriptions/validate', () => {
    it('should validate Apple receipt', async () => {
      prismaMock.subscription.upsert.mockResolvedValue(mockSubscriptions[0]);

      const response = await request(app)
        .post('/api/subscriptions/validate')
        .set('Authorization', 'Bearer valid-token')
        .send({
          platform: 'apple',
          receipt: 'valid-apple-receipt',
          productId: 'premium_monthly',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should validate Google Play receipt', async () => {
      prismaMock.subscription.upsert.mockResolvedValue(mockSubscriptions[0]);

      const response = await request(app)
        .post('/api/subscriptions/validate')
        .set('Authorization', 'Bearer valid-token')
        .send({
          platform: 'google',
          purchaseToken: 'valid-google-token',
          productId: 'premium_monthly',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should return 400 for missing platform', async () => {
      const response = await request(app)
        .post('/api/subscriptions/validate')
        .set('Authorization', 'Bearer valid-token')
        .send({
          receipt: 'some-receipt',
          productId: 'premium_monthly',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/subscriptions/restore', () => {
    it('should restore purchases', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(mockSubscriptions[0]);

      const response = await request(app)
        .post('/api/subscriptions/restore')
        .set('Authorization', 'Bearer valid-token')
        .send({ platform: 'apple' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('restored', true);
    });

    it('should return no subscriptions to restore', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/subscriptions/restore')
        .set('Authorization', 'Bearer valid-token')
        .send({ platform: 'apple' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('restored', false);
    });
  });

  describe('GET /api/subscriptions/limits', () => {
    it('should return free tier limits for non-subscribed user', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/subscriptions/limits')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tier', 'free');
      expect(response.body).toHaveProperty('limits');
      expect(response.body.limits).toHaveProperty('maxFavorites');
      expect(response.body.limits).toHaveProperty('maxChildren');
    });

    it('should return unlimited for premium user', async () => {
      prismaMock.subscription.findFirst.mockResolvedValue(mockSubscriptions[0]);

      const response = await request(app)
        .get('/api/subscriptions/limits')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tier', 'premium');
    });
  });
});
