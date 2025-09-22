import axios, { AxiosInstance } from 'axios';
import { API_CONFIG } from '../config/api';
import * as SecureStore from '../utils/secureStorage';

interface LoginParams {
  email: string;
  password: string;
}

interface RegisterParams {
  email: string;
  password: string;
  name: string;
  phoneNumber?: string;
}

interface ResetPasswordParams {
  token: string;
  newPassword: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  user: {
    id: string;
    email: string;
    name: string;
    phoneNumber?: string;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiry: number;
    refreshTokenExpiry: number;
  };
}

interface ProfileUpdateParams {
  name?: string;
  phoneNumber?: string;
  preferences?: any;
}

class AuthService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      async (config) => {
        const token = await SecureStore.getAccessToken();
        console.log('Request interceptor:', {
          url: config.url,
          hasToken: !!token,
          tokenPrefix: token?.substring(0, 20) + '...',
        });
        
        // Don't add dev tokens to real API requests
        if (token && !token.startsWith('dev_')) {
          config.headers.Authorization = `Bearer ${token}`;
        } else if (__DEV__ && token && token.startsWith('dev_')) {
          console.log('🔧 Development mode: Skipping dev token for API request');
        }
        
        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Don't retry if:
        // 1. Already retried
        // 2. It's a refresh token request (to prevent loops)
        // 3. It's a login/register request
        // 4. Rate limited (429)
        const isAuthEndpoint = originalRequest.url?.includes('/auth/login') || 
                              originalRequest.url?.includes('/auth/register') ||
                              originalRequest.url?.includes('/auth/refresh');
        const isRateLimited = error.response?.status === 429;

        if (error.response?.status === 401 && 
            !originalRequest._retry && 
            !isAuthEndpoint && 
            !isRateLimited) {
          originalRequest._retry = true;

          try {
            const tokens = await SecureStore.getTokens();
            if (tokens?.refreshToken && !tokens.refreshToken.startsWith('dev_')) {
              console.log('Attempting token refresh...');
              const response = await this.refreshToken(tokens.refreshToken);
              await SecureStore.setTokens(response.tokens);
              
              // Retry original request with new token
              originalRequest.headers.Authorization = `Bearer ${response.tokens.accessToken}`;
              return this.api(originalRequest);
            } else {
              console.log('Invalid or dev refresh token, clearing auth');
              await SecureStore.clearAllAuthData();
            }
          } catch (refreshError: any) {
            console.error('Token refresh failed:', refreshError.message);
            // Refresh failed, clear auth and redirect to login
            await SecureStore.clearAllAuthData();
            throw refreshError;
          }
        }

        // Log rate limit errors clearly (keeping for potential future use)
        if (isRateLimited) {
          console.error('RATE LIMITED: Please wait before making more requests');
          const retryAfter = error.response?.headers?.['retry-after'];
          
          if (retryAfter) {
            console.error(`Retry after: ${retryAfter} seconds`);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async login(params: LoginParams): Promise<AuthResponse> {
    // Development mode: bypass real authentication
    if (__DEV__) {
      const { DEV_CONFIG } = require('../config/development');
      
      // Check if using test credentials
      const testUser = DEV_CONFIG.TEST_ACCOUNTS.find(
        (account: any) => account.email === params.email && account.password === params.password
      );
      
      if (testUser) {
        console.log('🔧 Development mode: Using mock authentication for', params.email);
        
        // Return mock auth response
        const mockResponse: AuthResponse = {
          success: true,
          message: 'Development mode login successful',
          user: {
            id: 'dev_user_001',
            email: testUser.email,
            name: testUser.name,
            phoneNumber: undefined,
            emailVerified: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          tokens: {
            accessToken: 'dev_access_token_' + Date.now(),
            refreshToken: 'dev_refresh_token_' + Date.now(),
            accessTokenExpiry: Date.now() + (60 * 60 * 1000), // 1 hour
            refreshTokenExpiry: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
          },
        };
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return mockResponse;
      }
    }
    
    // Production mode or invalid dev credentials: use real authentication
    try {
      console.log('Login attempt:', { email: params.email, url: API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.AUTH.LOGIN });
      const response = await this.api.post(API_CONFIG.ENDPOINTS.AUTH.LOGIN, params);
      console.log('Login response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Login error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
      });
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  }

  async register(params: RegisterParams): Promise<AuthResponse> {
    try {
      const response = await this.api.post(API_CONFIG.ENDPOINTS.AUTH.REGISTER, params);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  }

  async refreshToken(refreshToken: string): Promise<{ tokens: AuthResponse['tokens'] }> {
    try {
      const response = await this.api.post(API_CONFIG.ENDPOINTS.AUTH.REFRESH, { refreshToken });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Token refresh failed');
    }
  }

  async logout(): Promise<void> {
    try {
      await this.api.post(API_CONFIG.ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      // Even if logout fails on server, clear local data
      console.error('Logout error:', error);
    }
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.api.post(API_CONFIG.ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to send reset email');
    }
  }

  async resetPassword(params: ResetPasswordParams): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.api.post(API_CONFIG.ENDPOINTS.AUTH.RESET_PASSWORD, params);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Password reset failed');
    }
  }

  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.api.get(`${API_CONFIG.ENDPOINTS.AUTH.VERIFY_EMAIL}?token=${token}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Email verification failed');
    }
  }

  async resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.api.post(API_CONFIG.ENDPOINTS.AUTH.RESEND_VERIFICATION, { email });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to resend verification email');
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.api.post(API_CONFIG.ENDPOINTS.AUTH.CHANGE_PASSWORD, {
        currentPassword,
        newPassword,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Password change failed');
    }
  }

  async getProfile(): Promise<{ success: boolean; profile: any }> {
    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.AUTH.PROFILE);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get profile');
    }
  }

  async updateProfile(data: ProfileUpdateParams): Promise<{ success: boolean; message: string; profile: any }> {
    try {
      const response = await this.api.put(API_CONFIG.ENDPOINTS.AUTH.PROFILE, data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update profile');
    }
  }

  async verifyToken(): Promise<{ success: boolean; authenticated: boolean; user: any }> {
    // Development mode: handle dev tokens
    if (__DEV__) {
      const token = await SecureStore.getAccessToken();
      if (token && token.startsWith('dev_access_token_')) {
        console.log('🔧 Development mode: Verifying dev token');
        
        const { DEV_CONFIG } = require('../config/development');
        // Return mock verified response
        return {
          success: true,
          authenticated: true,
          user: {
            id: 'dev_user_001',
            email: DEV_CONFIG.TEST_USER.email,
            name: DEV_CONFIG.TEST_USER.name,
            emailVerified: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };
      }
    }
    
    // Production mode or non-dev token: use real verification
    try {
      console.log('Verifying token at:', API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.AUTH.CHECK);
      const response = await this.api.get(API_CONFIG.ENDPOINTS.AUTH.CHECK);
      console.log('Token verification response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Token verification error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
      });
      throw new Error(error.response?.data?.error || 'Token verification failed');
    }
  }
}

export const authService = new AuthService();