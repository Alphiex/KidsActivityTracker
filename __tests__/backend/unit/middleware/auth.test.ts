/**
 * Auth Middleware Tests
 * Tests for authentication middleware
 */
import { createMockRequest, createMockResponse, createMockNext } from '../../setup';
import { prismaMock, resetPrismaMocks } from '../../mocks/prisma';
import { regularUser } from '../../mocks/fixtures/users';
import { mockTokens } from '../../mocks/testData';

// Mock modules
jest.mock('../../../../server/src/utils/prismaClient', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockImplementation((token) => {
    if (token === 'valid-token') {
      return { userId: 'user-1', email: 'test@example.com' };
    }
    throw new Error('Invalid token');
  }),
}));

import { authenticateToken } from '../../../../server/src/middleware/auth';

describe('Auth Middleware', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetPrismaMocks();
  });

  describe('authenticateToken', () => {
    it('should pass with valid Bearer token', async () => {
      req.headers.authorization = 'Bearer valid-token';
      prismaMock.user.findUnique.mockResolvedValue(regularUser);

      await authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-1');
    });

    it('should return 401 without authorization header', async () => {
      req.headers.authorization = undefined;

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 with invalid Bearer format', async () => {
      req.headers.authorization = 'InvalidFormat token';

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 with invalid token', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if user not found', async () => {
      req.headers.authorization = 'Bearer valid-token';
      prismaMock.user.findUnique.mockResolvedValue(null);

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle empty Bearer token', async () => {
      req.headers.authorization = 'Bearer ';

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
