/**
 * Favorites Routes Tests
 * Tests for /api/favorites/* endpoints
 */
import request from 'supertest';
import express from 'express';
import { prismaMock, resetPrismaMocks } from '../mocks/prisma';
import { mockFavorites } from '../mocks/testData';
import { swimActivity, artActivity } from '../mocks/fixtures/activities';

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

import favoritesRouter from '../../../server/src/routes/favorites';

const app = express();
app.use(express.json());
app.use('/api/favorites', favoritesRouter);

describe('Favorites Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetPrismaMocks();
  });

  describe('GET /api/favorites', () => {
    it('should return user favorites', async () => {
      prismaMock.favorite.findMany.mockResolvedValue([
        { id: 'fav-1', userId: 'user-1', activityId: swimActivity.id, activity: swimActivity },
        { id: 'fav-2', userId: 'user-1', activityId: artActivity.id, activity: artActivity },
      ]);

      const response = await request(app)
        .get('/api/favorites')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    it('should return empty array if no favorites', async () => {
      prismaMock.favorite.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/favorites')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/favorites/:activityId', () => {
    it('should add activity to favorites', async () => {
      prismaMock.activity.findUnique.mockResolvedValue(swimActivity);
      prismaMock.favorite.findFirst.mockResolvedValue(null);
      prismaMock.favorite.create.mockResolvedValue({
        id: 'new-fav',
        userId: 'user-1',
        activityId: swimActivity.id,
        createdAt: new Date(),
      });

      const response = await request(app)
        .post(`/api/favorites/${swimActivity.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });

    it('should return 404 for non-existent activity', async () => {
      prismaMock.activity.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/favorites/non-existent-id')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should return 400 if already favorited', async () => {
      prismaMock.activity.findUnique.mockResolvedValue(swimActivity);
      prismaMock.favorite.findFirst.mockResolvedValue({
        id: 'existing-fav',
        userId: 'user-1',
        activityId: swimActivity.id,
      });

      const response = await request(app)
        .post(`/api/favorites/${swimActivity.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/favorites/:activityId', () => {
    it('should remove activity from favorites', async () => {
      prismaMock.favorite.findFirst.mockResolvedValue({
        id: 'fav-1',
        userId: 'user-1',
        activityId: swimActivity.id,
      });
      prismaMock.favorite.delete.mockResolvedValue({
        id: 'fav-1',
        userId: 'user-1',
        activityId: swimActivity.id,
      });

      const response = await request(app)
        .delete(`/api/favorites/${swimActivity.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });

    it('should return 404 if not in favorites', async () => {
      prismaMock.favorite.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/favorites/${swimActivity.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/favorites/check/:activityId', () => {
    it('should return true if activity is favorited', async () => {
      prismaMock.favorite.findFirst.mockResolvedValue({
        id: 'fav-1',
        userId: 'user-1',
        activityId: swimActivity.id,
      });

      const response = await request(app)
        .get(`/api/favorites/check/${swimActivity.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isFavorite', true);
    });

    it('should return false if activity is not favorited', async () => {
      prismaMock.favorite.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/favorites/check/${swimActivity.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isFavorite', false);
    });
  });
});
