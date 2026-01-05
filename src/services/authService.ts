/**
 * Auth Service - API calls using Firebase Authentication
 *
 * This service handles API calls that require authentication.
 * Firebase handles all authentication (login, register, password reset, etc.)
 * This service just makes authenticated API calls using Firebase ID tokens.
 */

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
  /**
   * Native fetch helper with authentication
   */
  private async authFetch<T = any>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
    } = {}
  ): Promise<{ data: T; status: number }> {
    const { method = 'GET', body } = options;
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;

    // Get Firebase ID token
    const token = await firebaseAuthService.getIdToken();
    secureLog('AuthService fetch:', { url, hasToken: !!token });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions: RequestInit = { method, headers };

    if (body && (method === 'POST' || method === 'PUT')) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    // Handle 401 - try token refresh
    if (response.status === 401) {
      const newToken = await firebaseAuthService.getIdToken(true);
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(url, { method, headers, body: fetchOptions.body });
        const retryData = await retryResponse.json();
        return { data: retryData, status: retryResponse.status };
      }
    }

    const data = await response.json();
    return { data, status: response.status };
  }

  /**
   * Sync Firebase user with PostgreSQL database
   * Called after Firebase login to ensure user exists in our database
   */
  async syncUser(): Promise<{ success: boolean; user: PostgresUser }> {
    try {
      secureLog('[AuthService] Syncing user with database...');
      const response = await this.authFetch(API_CONFIG.ENDPOINTS.AUTH.SYNC, { method: 'POST' });
      secureLog('[AuthService] User sync successful');
      return response.data;
    } catch (error: any) {
      secureError('[AuthService] User sync failed:', { message: error.message });
      throw new Error(error.message || 'Failed to sync user');
    }
  }

  /**
   * Logout - notify server (Firebase handles actual token invalidation)
   */
  async logout(): Promise<void> {
    try {
      await this.authFetch(API_CONFIG.ENDPOINTS.AUTH.LOGOUT, { method: 'POST' });
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
      const response = await this.authFetch(API_CONFIG.ENDPOINTS.AUTH.PROFILE);
      return response.data;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get profile');
    }
  }

  /**
   * Update user profile in PostgreSQL
   */
  async updateProfile(
    data: ProfileUpdateParams
  ): Promise<{ success: boolean; message: string; profile: PostgresUser }> {
    try {
      const response = await this.authFetch(API_CONFIG.ENDPOINTS.AUTH.PROFILE, {
        method: 'PUT',
        body: data
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update profile');
    }
  }

  /**
   * Verify authentication status
   */
  async verifyToken(): Promise<{ success: boolean; authenticated: boolean; user: any }> {
    try {
      secureLog('Verifying token at:', API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.AUTH.CHECK);
      const response = await this.authFetch(API_CONFIG.ENDPOINTS.AUTH.CHECK);
      secureLog('Token verification response:', {
        success: response.data?.success,
        authenticated: response.data?.authenticated,
      });
      return response.data;
    } catch (error: any) {
      secureError('Token verification error:', { message: error.message });
      throw new Error(error.message || 'Token verification failed');
    }
  }

  /**
   * Delete user account from both PostgreSQL and Firebase
   * Apple App Store requirement - users must be able to delete their accounts
   */
  async deleteAccount(): Promise<{ success: boolean; message: string }> {
    try {
      // Delete from PostgreSQL (backend also deletes from Firebase)
      const response = await this.authFetch(API_CONFIG.ENDPOINTS.AUTH.DELETE_ACCOUNT, { method: 'DELETE' });
      return response.data;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete account');
    }
  }
}

export const authService = new AuthService();
