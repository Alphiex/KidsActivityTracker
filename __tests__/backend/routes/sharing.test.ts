/**
 * Sharing Routes Tests
 * Tests for /api/sharing/* endpoints
 */
import request from 'supertest';
import express from 'express';
import { prismaMock, resetPrismaMocks } from '../mocks/prisma';
import { regularUser } from '../mocks/fixtures/users';

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
    sendFamilyShareInvite: jest.fn().mockResolvedValue({ success: true }),
  },
}));

import sharingRouter from '../../../server/src/routes/sharing';

const app = express();
app.use(express.json());
app.use('/api/sharing', sharingRouter);

describe('Sharing Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetPrismaMocks();
  });

  describe('GET /api/sharing/members', () => {
    it('should return family share members', async () => {
      prismaMock.familyShare.findMany.mockResolvedValue([
        { id: 'share-1', ownerId: 'user-1', memberId: 'user-2', member: { name: 'Jane', email: 'jane@example.com' } },
      ]);

      const response = await request(app)
        .get('/api/sharing/members')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return empty array if no members', async () => {
      prismaMock.familyShare.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/sharing/members')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/sharing/invite', () => {
    it('should send invite to email', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null); // Email not registered
      prismaMock.familyShare.create.mockResolvedValue({
        id: 'invite-1',
        ownerId: 'user-1',
        inviteEmail: 'newmember@example.com',
        inviteToken: 'invite-token',
        status: 'pending',
      });

      const response = await request(app)
        .post('/api/sharing/invite')
        .set('Authorization', 'Bearer valid-token')
        .send({ email: 'newmember@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/sharing/invite')
        .set('Authorization', 'Bearer valid-token')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
    });

    it('should return 400 if inviting self', async () => {
      const response = await request(app)
        .post('/api/sharing/invite')
        .set('Authorization', 'Bearer valid-token')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/sharing/accept/:token', () => {
    it('should accept invite with valid token', async () => {
      prismaMock.familyShare.findFirst.mockResolvedValue({
        id: 'invite-1',
        ownerId: 'user-2',
        inviteEmail: 'test@example.com',
        inviteToken: 'valid-token',
        status: 'pending',
      });
      prismaMock.familyShare.update.mockResolvedValue({
        id: 'invite-1',
        ownerId: 'user-2',
        memberId: 'user-1',
        status: 'accepted',
      });

      const response = await request(app)
        .post('/api/sharing/accept/valid-token')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should return 404 for invalid token', async () => {
      prismaMock.familyShare.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/sharing/accept/invalid-token')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/sharing/members/:id', () => {
    it('should remove family member', async () => {
      prismaMock.familyShare.findUnique.mockResolvedValue({
        id: 'share-1',
        ownerId: 'user-1',
        memberId: 'user-2',
      });
      prismaMock.familyShare.delete.mockResolvedValue({
        id: 'share-1',
      });

      const response = await request(app)
        .delete('/api/sharing/members/share-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });

    it('should return 403 if not owner', async () => {
      prismaMock.familyShare.findUnique.mockResolvedValue({
        id: 'share-1',
        ownerId: 'user-2', // Different owner
        memberId: 'user-3',
      });

      const response = await request(app)
        .delete('/api/sharing/members/share-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });
  });
});
