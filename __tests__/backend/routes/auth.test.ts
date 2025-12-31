/**
 * Auth Routes Tests
 * Tests for /api/auth/* endpoints
 */
import request from 'supertest';
import express from 'express';
import { prismaMock, setupPrismaMocks, resetPrismaMocks } from '../mocks/prisma';
import { mockUsers, mockTokens, mockRequestBodies } from '../mocks/testData';
import { regularUser, unverifiedUser, userWithResetToken, userWithExpiredResetToken } from '../mocks/fixtures/users';

// Mock the modules
jest.mock('../../../server/src/utils/prismaClient', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
  compare: jest.fn().mockImplementation((password, hash) => {
    return Promise.resolve(password === 'Password123!' || password === 'correctpassword');
  }),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockImplementation((token) => {
    if (token === 'valid-token' || token === mockTokens.validAccessToken) {
      return { userId: 'user-1', email: 'test@example.com' };
    }
    throw new Error('Invalid token');
  }),
}));

// Import routes after mocking
import authRouter from '../../../server/src/routes/auth';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupPrismaMocks();
  });

  afterEach(() => {
    resetPrismaMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        ...regularUser,
        id: 'new-user-id',
        email: mockRequestBodies.validRegister.email,
        name: mockRequestBodies.validRegister.name,
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(mockRequestBodies.validRegister);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(mockRequestBodies.validRegister.email);
    });

    it('should return 400 if email already exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue(regularUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(mockRequestBodies.validRegister);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Password123!',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '123',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      prismaMock.user.findUnique.mockResolvedValue(regularUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send(mockRequestBodies.validLogin);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });

    it('should return 401 for invalid password', async () => {
      prismaMock.user.findUnique.mockResolvedValue(regularUser);
      const bcrypt = require('bcrypt');
      bcrypt.compare.mockResolvedValueOnce(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
    });

    it('should return 401 for non-existent user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(401);
    });

    it('should return 403 for unverified user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(unverifiedUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: unverifiedUser.email,
          password: 'Password123!',
        });

      expect(response.status).toBe(403);
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'Password123!' });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send reset email for existing user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(regularUser);
      prismaMock.user.update.mockResolvedValue({
        ...regularUser,
        resetToken: 'new-reset-token',
        resetTokenExpiry: new Date(Date.now() + 3600000),
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: regularUser.email });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 200 even for non-existent email (security)', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      // Should not reveal if email exists
      expect(response.status).toBe(200);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      prismaMock.user.findFirst.mockResolvedValue(userWithResetToken);
      prismaMock.user.update.mockResolvedValue({
        ...userWithResetToken,
        resetToken: null,
        resetTokenExpiry: null,
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: userWithResetToken.resetToken,
          password: 'NewPassword123!',
        });

      expect(response.status).toBe(200);
    });

    it('should return 400 for invalid token', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewPassword123!',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for expired token', async () => {
      prismaMock.user.findFirst.mockResolvedValue(userWithExpiredResetToken);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: userWithExpiredResetToken.resetToken,
          password: 'NewPassword123!',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for weak new password', async () => {
      prismaMock.user.findFirst.mockResolvedValue(userWithResetToken);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: userWithResetToken.resetToken,
          password: '123',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue({
        id: 'refresh-1',
        token: mockTokens.validRefreshToken,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
      });
      prismaMock.user.findUnique.mockResolvedValue(regularUser);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: mockTokens.validRefreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });

    it('should return 401 for invalid refresh token', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      prismaMock.user.findFirst.mockResolvedValue(unverifiedUser);
      prismaMock.user.update.mockResolvedValue({
        ...unverifiedUser,
        isVerified: true,
        verificationToken: null,
      });

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: unverifiedUser.verificationToken });

      expect(response.status).toBe(200);
    });

    it('should return 400 for invalid verification token', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid-verification-token' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${mockTokens.validAccessToken}`)
        .send({ refreshToken: mockTokens.validRefreshToken });

      expect(response.status).toBe(200);
    });
  });
});
