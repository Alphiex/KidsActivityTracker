/**
 * AuthService Unit Tests
 * Tests for the authentication service
 */
import { mockApiClient } from '../../mocks/services';

// Mock the API client
jest.mock('../../../../src/services/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

import authService from '../../../../src/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiClient.post.mockResolvedValue({ data: {} });
    mockApiClient.get.mockResolvedValue({ data: {} });
  });

  describe('login', () => {
    it('should call login API with credentials', async () => {
      const mockResponse = {
        data: {
          user: { id: '1', email: 'test@example.com' },
          token: 'mock-token',
        },
      };
      mockApiClient.post.mockResolvedValue(mockResponse);

      await authService.login('test@example.com', 'password123');

      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('login'),
        expect.objectContaining({
          email: 'test@example.com',
          password: 'password123',
        })
      );
    });

    it('should store token on successful login', async () => {
      const mockResponse = {
        data: {
          user: { id: '1', email: 'test@example.com' },
          token: 'mock-token',
        },
      };
      mockApiClient.post.mockResolvedValue(mockResponse);

      await authService.login('test@example.com', 'password123');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('token'),
        'mock-token'
      );
    });

    it('should return user data on successful login', async () => {
      const mockResponse = {
        data: {
          user: { id: '1', email: 'test@example.com', name: 'Test User' },
          token: 'mock-token',
        },
      };
      mockApiClient.post.mockResolvedValue(mockResponse);

      const result = await authService.login('test@example.com', 'password123');

      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBe('mock-token');
    });

    it('should throw on invalid credentials', async () => {
      mockApiClient.post.mockRejectedValue({
        response: { status: 401, data: { message: 'Invalid credentials' } },
      });

      await expect(authService.login('wrong@example.com', 'wrong')).rejects.toThrow();
    });
  });

  describe('register', () => {
    it('should call register API with user data', async () => {
      const mockResponse = {
        data: {
          user: { id: '1', email: 'new@example.com' },
          token: 'mock-token',
        },
      };
      mockApiClient.post.mockResolvedValue(mockResponse);

      await authService.register({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('register'),
        expect.objectContaining({
          email: 'new@example.com',
          name: 'New User',
        })
      );
    });

    it('should throw on duplicate email', async () => {
      mockApiClient.post.mockRejectedValue({
        response: { status: 400, data: { message: 'Email already exists' } },
      });

      await expect(
        authService.register({
          email: 'existing@example.com',
          password: 'password123',
          name: 'Test',
        })
      ).rejects.toThrow();
    });
  });

  describe('logout', () => {
    it('should clear stored token', async () => {
      await authService.logout();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        expect.stringContaining('token')
      );
    });

    it('should call logout API', async () => {
      mockApiClient.post.mockResolvedValue({ data: {} });

      await authService.logout();

      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('logout')
      );
    });
  });

  describe('forgotPassword', () => {
    it('should call forgot password API', async () => {
      mockApiClient.post.mockResolvedValue({ data: { success: true } });

      await authService.forgotPassword('test@example.com');

      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('forgot'),
        expect.objectContaining({ email: 'test@example.com' })
      );
    });
  });

  describe('getToken', () => {
    it('should retrieve stored token', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('stored-token');

      const token = await authService.getToken();

      expect(token).toBe('stored-token');
    });

    it('should return null if no token stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const token = await authService.getToken();

      expect(token).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true if token exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('valid-token');

      const isAuth = await authService.isAuthenticated();

      expect(isAuth).toBe(true);
    });

    it('should return false if no token', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const isAuth = await authService.isAuthenticated();

      expect(isAuth).toBe(false);
    });
  });
});
