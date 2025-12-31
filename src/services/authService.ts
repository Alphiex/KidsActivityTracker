/**
 * Auth Service - API calls using Firebase Authentication
 *
 * This service handles API calls that require authentication.
 * Firebase handles all authentication (login, register, password reset, etc.)
 * This service just makes authenticated API calls using Firebase ID tokens.
 */

import axios, { AxiosInstance } from 'axios';
import { API_CONFIG } from '../config/api';
import { firebaseAuthService } from './firebaseAuthService';
import { secureLog, secureError } from '../utils/secureLogger';

export interface PostgresUser {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
  location?: string;
  preferences?: any;
  authProvider: string;
  createdAt: string;
  updatedAt: string;
  profilePicture?: string | null;
  children?: Array<{
    id: string;
    name: string;
    birthDate: string | null;
  }>;
  _count?: {
    favorites: number;
    children: number;
    myShares?: number;
    sharedWithMe?: number;
  };
}

export interface ProfileUpdateParams {
  name?: string;
  phoneNumber?: string;
  location?: string;
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

    // Request interceptor to add Firebase ID token
    this.api.interceptors.request.use(
      async (config) => {
        const token = await firebaseAuthService.getIdToken();

        secureLog('Request interceptor:', {
          url: config.url,
          hasToken: !!token,
        });

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => {
        secureError('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 errors - token might need refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Force refresh the Firebase token
            const newToken = await firebaseAuthService.getIdToken(true);

            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            secureError('Token refresh failed:', refreshError);
          }
        }

        // Handle rate limiting
        if (error.response?.status === 429) {
          secureError('RATE LIMITED: Please wait before making more requests');
          const retryAfter = error.response?.headers?.['retry-after'];
          if (retryAfter) {
            secureError(`Retry after: ${retryAfter} seconds`);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Sync Firebase user with PostgreSQL database
   * Called after Firebase login to ensure user exists in our database
   */
  async syncUser(): Promise<{ success: boolean; user: PostgresUser }> {
    try {
      secureLog('[AuthService] Syncing user with database...');
      const response = await this.api.post(API_CONFIG.ENDPOINTS.AUTH.SYNC);
      secureLog('[AuthService] User sync successful');
      return response.data;
    } catch (error: any) {
      secureError('[AuthService] User sync failed:', {
        status: error.response?.status,
        message: error.message,
      });
      throw new Error(error.response?.data?.error || 'Failed to sync user');
    }
  }

  /**
   * Logout - notify server (Firebase handles actual token invalidation)
   */
  async logout(): Promise<void> {
    try {
      await this.api.post(API_CONFIG.ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      // Even if server logout fails, Firebase will sign out
      secureError('Logout API error:', error);
    }
  }

  /**
   * Get user profile from PostgreSQL
   */
  async getProfile(): Promise<{ success: boolean; profile: PostgresUser }> {
    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.AUTH.PROFILE);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get profile');
    }
  }

  /**
   * Update user profile in PostgreSQL
   */
  async updateProfile(
    data: ProfileUpdateParams
  ): Promise<{ success: boolean; message: string; profile: PostgresUser }> {
    try {
      const response = await this.api.put(API_CONFIG.ENDPOINTS.AUTH.PROFILE, data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update profile');
    }
  }

  /**
   * Verify authentication status
   */
  async verifyToken(): Promise<{ success: boolean; authenticated: boolean; user: any }> {
    try {
      secureLog('Verifying token at:', API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.AUTH.CHECK);
      const response = await this.api.get(API_CONFIG.ENDPOINTS.AUTH.CHECK);
      secureLog('Token verification response:', {
        success: response.data?.success,
        authenticated: response.data?.authenticated,
      });
      return response.data;
    } catch (error: any) {
      secureError('Token verification error:', {
        status: error.response?.status,
        message: error.message,
      });
      throw new Error(error.response?.data?.error || 'Token verification failed');
    }
  }

  /**
   * Delete user account from both PostgreSQL and Firebase
   * Apple App Store requirement - users must be able to delete their accounts
   */
  async deleteAccount(): Promise<{ success: boolean; message: string }> {
    try {
      // Delete from PostgreSQL (backend also deletes from Firebase)
      const response = await this.api.delete(API_CONFIG.ENDPOINTS.AUTH.DELETE_ACCOUNT);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete account');
    }
  }
}

export const authService = new AuthService();
