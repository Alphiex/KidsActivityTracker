import axios, { AxiosInstance } from 'axios';
import { API_CONFIG } from '../config/api';
import * as SecureStore from '../utils/secureStorage';
import { devLogin, devRegister } from '../utils/devAuth';

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
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const tokens = await SecureStore.getTokens();
            if (tokens?.refreshToken) {
              const response = await this.refreshToken(tokens.refreshToken);
              await SecureStore.setTokens(response.tokens);
              
              // Retry original request with new token
              originalRequest.headers.Authorization = `Bearer ${response.tokens.accessToken}`;
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, clear auth and redirect to login
            await SecureStore.clearAllAuthData();
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async login(params: LoginParams): Promise<AuthResponse> {
    // Use development auth in dev mode to avoid rate limits
    if (__DEV__ && process.env.SKIP_AUTH !== 'false') {
      console.log('Using development authentication');
      return await devLogin(params.email, params.password) as AuthResponse;
    }
    
    try {
      const response = await this.api.post(API_CONFIG.ENDPOINTS.AUTH.LOGIN, params);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  }

  async register(params: RegisterParams): Promise<AuthResponse> {
    // Use development auth in dev mode to avoid rate limits
    if (__DEV__ && process.env.SKIP_AUTH !== 'false') {
      console.log('Using development authentication for registration');
      return await devRegister(params.email, params.password, params.name, params.phoneNumber) as AuthResponse;
    }
    
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
    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.AUTH.CHECK);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Token verification failed');
    }
  }
}

export const authService = new AuthService();