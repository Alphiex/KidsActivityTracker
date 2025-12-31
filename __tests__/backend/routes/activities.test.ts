/**
 * Activities Routes Tests
 * Tests for /api/v1/activities/* endpoints
 */
import request from 'supertest';
import express from 'express';
import { prismaMock, setupPrismaMocks, resetPrismaMocks } from '../mocks/prisma';
import { mockActivities } from '../mocks/testData';
import { swimActivity, artActivity, soccerActivity, freeActivity, activeActivities } from '../mocks/fixtures/activities';

// Mock modules
jest.mock('../../../server/src/utils/prismaClient', () => ({
  __esModule: true,
  default: prismaMock,
}));

// Import routes after mocking
import activitiesRouter from '../../../server/src/routes/activities';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/activities', activitiesRouter);

describe('Activities Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupPrismaMocks();
  });

  afterEach(() => {
    resetPrismaMocks();
  });

  describe('GET /api/v1/activities', () => {
    it('should return paginated activities', async () => {
      prismaMock.activity.findMany.mockResolvedValue(activeActivities);
      prismaMock.activity.count.mockResolvedValue(activeActivities.length);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('activities');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.activities)).toBe(true);
    });

    it('should filter by age range', async () => {
      const filteredActivities = activeActivities.filter(
        (a) => a.minAge <= 7 && a.maxAge >= 5
      );
      prismaMock.activity.findMany.mockResolvedValue(filteredActivities);
      prismaMock.activity.count.mockResolvedValue(filteredActivities.length);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ minAge: 5, maxAge: 7 });

      expect(response.status).toBe(200);
      expect(response.body.activities.every((a: any) =>
        a.minAge <= 7 && a.maxAge >= 5
      )).toBe(true);
    });

    it('should filter by category', async () => {
      const sportsActivities = activeActivities.filter((a) => a.category === 'Sports');
      prismaMock.activity.findMany.mockResolvedValue(sportsActivities);
      prismaMock.activity.count.mockResolvedValue(sportsActivities.length);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ categories: 'Sports' });

      expect(response.status).toBe(200);
      expect(response.body.activities.every((a: any) => a.category === 'Sports')).toBe(true);
    });

    it('should filter by multiple categories', async () => {
      const filtered = activeActivities.filter(
        (a) => a.category === 'Sports' || a.category === 'Arts'
      );
      prismaMock.activity.findMany.mockResolvedValue(filtered);
      prismaMock.activity.count.mockResolvedValue(filtered.length);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ categories: 'Sports,Arts' });

      expect(response.status).toBe(200);
    });

    it('should filter by city', async () => {
      const vancouverActivities = activeActivities.filter(
        (a) => a.location?.city === 'Vancouver'
      );
      prismaMock.activity.findMany.mockResolvedValue(vancouverActivities);
      prismaMock.activity.count.mockResolvedValue(vancouverActivities.length);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ cities: 'Vancouver' });

      expect(response.status).toBe(200);
    });

    it('should filter by max cost', async () => {
      const affordableActivities = activeActivities.filter((a) => a.cost <= 100);
      prismaMock.activity.findMany.mockResolvedValue(affordableActivities);
      prismaMock.activity.count.mockResolvedValue(affordableActivities.length);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ maxCost: 100 });

      expect(response.status).toBe(200);
      expect(response.body.activities.every((a: any) => a.cost <= 100)).toBe(true);
    });

    it('should filter by free activities only', async () => {
      prismaMock.activity.findMany.mockResolvedValue([freeActivity]);
      prismaMock.activity.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ maxCost: 0 });

      expect(response.status).toBe(200);
      expect(response.body.activities.every((a: any) => a.cost === 0)).toBe(true);
    });

    it('should filter by date range', async () => {
      prismaMock.activity.findMany.mockResolvedValue([swimActivity]);
      prismaMock.activity.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({
          startDate: '2024-02-01',
          endDate: '2024-03-31',
        });

      expect(response.status).toBe(200);
    });

    it('should filter by days of week', async () => {
      const mondayActivities = activeActivities.filter(
        (a) => a.daysOfWeek.includes('Monday')
      );
      prismaMock.activity.findMany.mockResolvedValue(mondayActivities);
      prismaMock.activity.count.mockResolvedValue(mondayActivities.length);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ daysOfWeek: 'Monday' });

      expect(response.status).toBe(200);
    });

    it('should filter by available spots', async () => {
      const available = activeActivities.filter((a) => a.spotsAvailable > 0);
      prismaMock.activity.findMany.mockResolvedValue(available);
      prismaMock.activity.count.mockResolvedValue(available.length);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ hasAvailableSpots: true });

      expect(response.status).toBe(200);
      expect(response.body.activities.every((a: any) => a.spotsAvailable > 0)).toBe(true);
    });

    it('should search by query text', async () => {
      prismaMock.activity.findMany.mockResolvedValue([swimActivity]);
      prismaMock.activity.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ query: 'swimming' });

      expect(response.status).toBe(200);
    });

    it('should combine multiple filters', async () => {
      prismaMock.activity.findMany.mockResolvedValue([swimActivity]);
      prismaMock.activity.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({
          minAge: 4,
          maxAge: 8,
          categories: 'Sports',
          cities: 'Vancouver',
          maxCost: 150,
          hasAvailableSpots: true,
        });

      expect(response.status).toBe(200);
    });

    it('should sort by cost ascending', async () => {
      const sorted = [...activeActivities].sort((a, b) => a.cost - b.cost);
      prismaMock.activity.findMany.mockResolvedValue(sorted);
      prismaMock.activity.count.mockResolvedValue(sorted.length);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ sortBy: 'cost', sortOrder: 'asc' });

      expect(response.status).toBe(200);
    });

    it('should sort by date ascending', async () => {
      prismaMock.activity.findMany.mockResolvedValue(activeActivities);
      prismaMock.activity.count.mockResolvedValue(activeActivities.length);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ sortBy: 'dateStart', sortOrder: 'asc' });

      expect(response.status).toBe(200);
    });

    it('should return empty array when no activities match', async () => {
      prismaMock.activity.findMany.mockResolvedValue([]);
      prismaMock.activity.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ query: 'nonexistent-activity-xyz123' });

      expect(response.status).toBe(200);
      expect(response.body.activities).toHaveLength(0);
    });

    it('should handle pagination correctly', async () => {
      prismaMock.activity.findMany.mockResolvedValue(activeActivities.slice(0, 2));
      prismaMock.activity.count.mockResolvedValue(activeActivities.length);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ page: 1, limit: 2 });

      expect(response.status).toBe(200);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 2);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
    });

    it('should return correct page 2 results', async () => {
      prismaMock.activity.findMany.mockResolvedValue(activeActivities.slice(2, 4));
      prismaMock.activity.count.mockResolvedValue(activeActivities.length);

      const response = await request(app)
        .get('/api/v1/activities')
        .query({ page: 2, limit: 2 });

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(2);
    });
  });

  describe('GET /api/v1/activities/:id', () => {
    it('should return activity by id', async () => {
      prismaMock.activity.findUnique.mockResolvedValue(swimActivity);

      const response = await request(app)
        .get(`/api/v1/activities/${swimActivity.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', swimActivity.id);
      expect(response.body).toHaveProperty('name', swimActivity.name);
    });

    it('should return 404 for non-existent activity', async () => {
      prismaMock.activity.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/activities/non-existent-id');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/activities/nearby', () => {
    it('should return nearby activities with coordinates', async () => {
      prismaMock.activity.findMany.mockResolvedValue(activeActivities);

      const response = await request(app)
        .get('/api/v1/activities/nearby')
        .query({
          latitude: 49.2827,
          longitude: -123.1207,
          radius: 10,
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 400 if latitude is missing', async () => {
      const response = await request(app)
        .get('/api/v1/activities/nearby')
        .query({ longitude: -123.1207, radius: 10 });

      expect(response.status).toBe(400);
    });

    it('should return 400 if longitude is missing', async () => {
      const response = await request(app)
        .get('/api/v1/activities/nearby')
        .query({ latitude: 49.2827, radius: 10 });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/activities/categories', () => {
    it('should return list of categories', async () => {
      const categories = ['Sports', 'Arts', 'Music', 'Technology'];
      prismaMock.activity.findMany.mockResolvedValue(
        categories.map((c) => ({ category: c }))
      );

      const response = await request(app)
        .get('/api/v1/activities/categories');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/v1/activities/providers', () => {
    it('should return list of providers', async () => {
      prismaMock.provider.findMany.mockResolvedValue([
        { id: 'p1', name: 'Vancouver Parks' },
        { id: 'p2', name: 'Burnaby Recreation' },
      ]);

      const response = await request(app)
        .get('/api/v1/activities/providers');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
