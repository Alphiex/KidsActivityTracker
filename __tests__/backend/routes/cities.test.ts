/**
 * Cities Routes Tests
 * Tests for /api/cities/* endpoints
 */
import request from 'supertest';
import express from 'express';
import { prismaMock, resetPrismaMocks } from '../mocks/prisma';
import { mockCities } from '../mocks/testData';

// Mock modules
jest.mock('../../../server/src/utils/prismaClient', () => ({
  __esModule: true,
  default: prismaMock,
}));

import citiesRouter from '../../../server/src/routes/cities';

const app = express();
app.use(express.json());
app.use('/api/cities', citiesRouter);

describe('Cities Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetPrismaMocks();
  });

  describe('GET /api/cities', () => {
    it('should return list of cities', async () => {
      prismaMock.city.findMany.mockResolvedValue(mockCities);

      const response = await request(app).get('/api/cities');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter by province', async () => {
      const bcCities = mockCities.filter((c) => c.province === 'BC');
      prismaMock.city.findMany.mockResolvedValue(bcCities);

      const response = await request(app)
        .get('/api/cities')
        .query({ province: 'BC' });

      expect(response.status).toBe(200);
      expect(response.body.every((c: any) => c.province === 'BC')).toBe(true);
    });

    it('should include activity counts', async () => {
      prismaMock.city.findMany.mockResolvedValue(mockCities);

      const response = await request(app).get('/api/cities');

      expect(response.status).toBe(200);
      expect(response.body[0]).toHaveProperty('activityCount');
    });
  });

  describe('GET /api/cities/:id', () => {
    it('should return city by id', async () => {
      prismaMock.city.findUnique.mockResolvedValue(mockCities[0]);

      const response = await request(app).get(`/api/cities/${mockCities[0].id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', mockCities[0].name);
    });

    it('should return 404 for non-existent city', async () => {
      prismaMock.city.findUnique.mockResolvedValue(null);

      const response = await request(app).get('/api/cities/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/cities/provinces', () => {
    it('should return list of provinces', async () => {
      const provinces = ['BC', 'ON', 'AB', 'QC'];
      prismaMock.city.findMany.mockResolvedValue(
        provinces.map((p) => ({ province: p }))
      );

      const response = await request(app).get('/api/cities/provinces');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
