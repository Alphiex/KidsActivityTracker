/**
 * Admin Vendors Routes Tests
 * Tests for /api/admin/vendors/* endpoints
 */
import request from 'supertest';
import express from 'express';
import { prismaMock, resetPrismaMocks } from '../../mocks/prisma';
import { vancouverParks, vendorProvider } from '../../mocks/fixtures/providers';

// Mock modules
jest.mock('../../../../server/src/utils/prismaClient', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('../../../../server/src/middleware/adminAuth', () => ({
  authenticateAdmin: jest.fn((req, res, next) => {
    req.user = { id: 'admin-1', email: 'admin@example.com' };
    req.admin = { role: 'SUPER_ADMIN' };
    next();
  }),
}));

import adminVendorsRouter from '../../../../server/src/routes/admin/vendors';

const app = express();
app.use(express.json());
app.use('/api/admin/vendors', adminVendorsRouter);

describe('Admin Vendors Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetPrismaMocks();
  });

  describe('GET /api/admin/vendors', () => {
    it('should return list of vendors', async () => {
      prismaMock.vendorUser.findMany.mockResolvedValue([
        { id: 'v1', userId: 'user-1', providerId: 'provider-1', provider: vancouverParks, user: { name: 'Vendor User' } },
      ]);

      const response = await request(app)
        .get('/api/admin/vendors')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/admin/vendors', () => {
    it('should create new vendor user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.provider.findUnique.mockResolvedValue(vancouverParks);
      prismaMock.user.create.mockResolvedValue({
        id: 'new-user',
        email: 'newvendor@example.com',
        name: 'New Vendor',
      });
      prismaMock.vendorUser.create.mockResolvedValue({
        id: 'new-vendor',
        userId: 'new-user',
        providerId: vancouverParks.id,
        role: 'ADMIN',
      });

      const response = await request(app)
        .post('/api/admin/vendors')
        .set('Authorization', 'Bearer admin-token')
        .send({
          email: 'newvendor@example.com',
          name: 'New Vendor',
          providerId: vancouverParks.id,
          role: 'ADMIN',
        });

      expect(response.status).toBe(201);
    });

    it('should return 400 if email already exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'existing' });

      const response = await request(app)
        .post('/api/admin/vendors')
        .set('Authorization', 'Bearer admin-token')
        .send({
          email: 'existing@example.com',
          name: 'Vendor',
          providerId: 'provider-1',
        });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent provider', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.provider.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/vendors')
        .set('Authorization', 'Bearer admin-token')
        .send({
          email: 'vendor@example.com',
          name: 'Vendor',
          providerId: 'non-existent',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/vendors/:id', () => {
    it('should delete vendor user', async () => {
      prismaMock.vendorUser.findUnique.mockResolvedValue({
        id: 'vendor-1',
        userId: 'user-1',
      });
      prismaMock.vendorUser.delete.mockResolvedValue({ id: 'vendor-1' });

      const response = await request(app)
        .delete('/api/admin/vendors/vendor-1')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent vendor', async () => {
      prismaMock.vendorUser.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/admin/vendors/non-existent')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(404);
    });
  });
});
