/**
 * Vendor Auth Routes Tests
 * Tests for /api/vendor/auth/* endpoints
 */
import request from 'supertest';
import express from 'express';
import { prismaMock, resetPrismaMocks } from '../../mocks/prisma';
import { vendorUser } from '../../mocks/fixtures/users';

// Mock modules
jest.mock('../../../../server/src/utils/prismaClient', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-vendor-token'),
}));

import vendorAuthRouter from '../../../../server/src/routes/vendor/auth';

const app = express();
app.use(express.json());
app.use('/api/vendor/auth', vendorAuthRouter);

describe('Vendor Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetPrismaMocks();
  });

  describe('POST /api/vendor/auth/login', () => {
    it('should login vendor with valid credentials', async () => {
      prismaMock.user.findUnique.mockResolvedValue(vendorUser);
      prismaMock.vendorUser.findUnique.mockResolvedValue({
        id: 'vendor-1',
        userId: vendorUser.id,
        providerId: 'provider-1',
        role: 'ADMIN',
      });

      const response = await request(app)
        .post('/api/vendor/auth/login')
        .send({
          email: vendorUser.email,
          password: 'Password123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('vendor');
    });

    it('should return 401 for non-vendor user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(vendorUser);
      prismaMock.vendorUser.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/vendor/auth/login')
        .send({
          email: vendorUser.email,
          password: 'Password123!',
        });

      expect(response.status).toBe(401);
    });

    it('should return 401 for invalid password', async () => {
      prismaMock.user.findUnique.mockResolvedValue(vendorUser);
      const bcrypt = require('bcrypt');
      bcrypt.compare.mockResolvedValueOnce(false);

      const response = await request(app)
        .post('/api/vendor/auth/login')
        .send({
          email: vendorUser.email,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/vendor/auth/login')
        .send({
          password: 'Password123!',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/vendor/auth/me', () => {
    it('should return current vendor info', async () => {
      // This would need proper auth middleware mock
      prismaMock.vendorUser.findUnique.mockResolvedValue({
        id: 'vendor-1',
        userId: 'user-1',
        providerId: 'provider-1',
        role: 'ADMIN',
        user: { name: 'Vendor User', email: 'vendor@example.com' },
        provider: { name: 'Vancouver Parks' },
      });

      const response = await request(app)
        .get('/api/vendor/auth/me')
        .set('Authorization', 'Bearer mock-vendor-token');

      // Note: This test depends on the actual middleware implementation
      expect(response.status).toBe(200);
    });
  });
});
