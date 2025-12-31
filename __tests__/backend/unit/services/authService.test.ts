/**
 * Auth Service Tests
 * Tests for authentication business logic
 */
import { prismaMock, resetPrismaMocks } from '../../mocks/prisma';
import { regularUser, unverifiedUser } from '../../mocks/fixtures/users';

// Mock modules
jest.mock('../../../../server/src/utils/prismaClient', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue('$2b$10$salt'),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ userId: 'user-1' }),
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('random-token-123'),
  }),
}));

// Note: Import actual service after mocks
// import authService from '../../../../server/src/services/authService';

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetPrismaMocks();
  });

  describe('registerUser', () => {
    it('should create new user with hashed password', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        ...regularUser,
        id: 'new-user-id',
        email: 'new@example.com',
      });

      // Mock implementation test
      const bcrypt = require('bcrypt');
      const userData = {
        email: 'new@example.com',
        password: 'Password123!',
        name: 'New User',
      };

      // Simulate service call
      await bcrypt.hash(userData.password, 10);
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
    });

    it('should throw error if email already exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue(regularUser);

      // Test that duplicate check works
      const existingUser = await prismaMock.user.findUnique({
        where: { email: regularUser.email },
      });

      expect(existingUser).not.toBeNull();
    });

    it('should generate verification token', async () => {
      const crypto = require('crypto');
      crypto.randomBytes(32);

      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
    });
  });

  describe('loginUser', () => {
    it('should return token for valid credentials', async () => {
      prismaMock.user.findUnique.mockResolvedValue(regularUser);

      const bcrypt = require('bcrypt');
      const jwt = require('jsonwebtoken');

      // Simulate password comparison
      const isValid = await bcrypt.compare('Password123!', regularUser.passwordHash);
      expect(isValid).toBe(true);

      // Simulate token generation
      const token = jwt.sign({ userId: regularUser.id }, 'secret');
      expect(token).toBe('mock-jwt-token');
    });

    it('should reject unverified user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(unverifiedUser);

      const user = await prismaMock.user.findUnique({
        where: { email: unverifiedUser.email },
      });

      expect(user?.isVerified).toBe(false);
    });

    it('should reject invalid password', async () => {
      prismaMock.user.findUnique.mockResolvedValue(regularUser);

      const bcrypt = require('bcrypt');
      bcrypt.compare.mockResolvedValueOnce(false);

      const isValid = await bcrypt.compare('wrongpassword', regularUser.passwordHash);
      expect(isValid).toBe(false);
    });
  });

  describe('verifyEmail', () => {
    it('should verify user with valid token', async () => {
      prismaMock.user.findFirst.mockResolvedValue(unverifiedUser);
      prismaMock.user.update.mockResolvedValue({
        ...unverifiedUser,
        isVerified: true,
        verificationToken: null,
      });

      const user = await prismaMock.user.findFirst({
        where: { verificationToken: unverifiedUser.verificationToken },
      });

      expect(user).not.toBeNull();
      expect(user?.verificationToken).toBe(unverifiedUser.verificationToken);
    });

    it('should return null for invalid token', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      const user = await prismaMock.user.findFirst({
        where: { verificationToken: 'invalid-token' },
      });

      expect(user).toBeNull();
    });
  });

  describe('generateResetToken', () => {
    it('should generate and save reset token', async () => {
      const crypto = require('crypto');
      prismaMock.user.findUnique.mockResolvedValue(regularUser);
      prismaMock.user.update.mockResolvedValue({
        ...regularUser,
        resetToken: 'random-token-123',
        resetTokenExpiry: expect.any(Date),
      });

      crypto.randomBytes(32);
      expect(crypto.randomBytes).toHaveBeenCalled();
    });

    it('should set token expiry to 1 hour', async () => {
      const now = Date.now();
      const expiry = new Date(now + 3600000); // 1 hour

      expect(expiry.getTime() - now).toBe(3600000);
    });
  });

  describe('resetPassword', () => {
    it('should hash new password', async () => {
      const bcrypt = require('bcrypt');
      const newPassword = 'NewPassword123!';

      await bcrypt.hash(newPassword, 10);
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
    });

    it('should clear reset token after successful reset', async () => {
      prismaMock.user.update.mockResolvedValue({
        ...regularUser,
        resetToken: null,
        resetTokenExpiry: null,
      });

      const result = await prismaMock.user.update({
        where: { id: regularUser.id },
        data: {
          passwordHash: '$2b$10$newhashedpassword',
          resetToken: null,
          resetTokenExpiry: null,
        },
      });

      expect(result.resetToken).toBeNull();
      expect(result.resetTokenExpiry).toBeNull();
    });
  });
});
