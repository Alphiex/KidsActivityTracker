/**
 * Children Routes Tests
 * Tests for /api/children/* endpoints
 */
import request from 'supertest';
import express from 'express';
import { prismaMock, resetPrismaMocks } from '../mocks/prisma';
import { mockChildren } from '../mocks/testData';
import { regularUser } from '../mocks/fixtures/users';
import { elementaryChild, preschoolChild, childWithActivities, otherUserChild } from '../mocks/fixtures/children';

// Mock modules
jest.mock('../../../server/src/utils/prismaClient', () => ({
  __esModule: true,
  default: prismaMock,
}));

// Mock auth middleware
jest.mock('../../../server/src/middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'user-1', email: 'test@example.com' };
    next();
  }),
}));

// Import routes after mocking
import childrenRouter from '../../../server/src/routes/children';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/children', childrenRouter);

describe('Children Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetPrismaMocks();
  });

  describe('GET /api/children', () => {
    it('should return all children for authenticated user', async () => {
      prismaMock.child.findMany.mockResolvedValue([elementaryChild, preschoolChild]);

      const response = await request(app)
        .get('/api/children')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    it('should return empty array if no children', async () => {
      prismaMock.child.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/children')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/children/:id', () => {
    it('should return child by id', async () => {
      prismaMock.child.findUnique.mockResolvedValue(elementaryChild);

      const response = await request(app)
        .get(`/api/children/${elementaryChild.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', elementaryChild.id);
      expect(response.body).toHaveProperty('name', elementaryChild.name);
    });

    it('should return 404 for non-existent child', async () => {
      prismaMock.child.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/children/non-existent-id')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should return 403 when accessing other user\'s child', async () => {
      prismaMock.child.findUnique.mockResolvedValue(otherUserChild);

      const response = await request(app)
        .get(`/api/children/${otherUserChild.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/children', () => {
    const validChildData = {
      name: 'New Child',
      dateOfBirth: '2018-06-15',
      interests: ['swimming', 'art'],
    };

    it('should create a new child', async () => {
      prismaMock.child.create.mockResolvedValue({
        id: 'new-child-id',
        userId: 'user-1',
        ...validChildData,
        dateOfBirth: new Date(validChildData.dateOfBirth),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/children')
        .set('Authorization', 'Bearer valid-token')
        .send(validChildData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', validChildData.name);
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/children')
        .set('Authorization', 'Bearer valid-token')
        .send({
          dateOfBirth: '2018-06-15',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 if dateOfBirth is missing', async () => {
      const response = await request(app)
        .post('/api/children')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Test Child',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .post('/api/children')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Test Child',
          dateOfBirth: 'invalid-date',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for future birth date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const response = await request(app)
        .post('/api/children')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Future Child',
          dateOfBirth: futureDate.toISOString().split('T')[0],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/children/:id', () => {
    it('should update child', async () => {
      prismaMock.child.findUnique.mockResolvedValue(elementaryChild);
      prismaMock.child.update.mockResolvedValue({
        ...elementaryChild,
        name: 'Updated Name',
      });

      const response = await request(app)
        .put(`/api/children/${elementaryChild.id}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
    });

    it('should return 404 for non-existent child', async () => {
      prismaMock.child.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/children/non-existent-id')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(404);
    });

    it('should return 403 when updating other user\'s child', async () => {
      prismaMock.child.findUnique.mockResolvedValue(otherUserChild);

      const response = await request(app)
        .put(`/api/children/${otherUserChild.id}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(403);
    });

    it('should update interests', async () => {
      prismaMock.child.findUnique.mockResolvedValue(elementaryChild);
      prismaMock.child.update.mockResolvedValue({
        ...elementaryChild,
        interests: ['basketball', 'reading'],
      });

      const response = await request(app)
        .put(`/api/children/${elementaryChild.id}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ interests: ['basketball', 'reading'] });

      expect(response.status).toBe(200);
      expect(response.body.interests).toEqual(['basketball', 'reading']);
    });
  });

  describe('DELETE /api/children/:id', () => {
    it('should delete child', async () => {
      prismaMock.child.findUnique.mockResolvedValue(elementaryChild);
      prismaMock.child.delete.mockResolvedValue(elementaryChild);

      const response = await request(app)
        .delete(`/api/children/${elementaryChild.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent child', async () => {
      prismaMock.child.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/children/non-existent-id')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should return 403 when deleting other user\'s child', async () => {
      prismaMock.child.findUnique.mockResolvedValue(otherUserChild);

      const response = await request(app)
        .delete(`/api/children/${otherUserChild.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/children/:id/activities', () => {
    it('should return child\'s enrolled activities', async () => {
      prismaMock.child.findUnique.mockResolvedValue(childWithActivities);
      prismaMock.childActivity.findMany.mockResolvedValue(childWithActivities.activities);

      const response = await request(app)
        .get(`/api/children/${childWithActivities.id}/activities`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 404 for non-existent child', async () => {
      prismaMock.child.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/children/non-existent-id/activities')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });
});
