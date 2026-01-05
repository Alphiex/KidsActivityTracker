import { API_CONFIG } from '../config/api';
import { store } from '../store';
import { clearAuth } from '../store/slices/authSlice';
import { firebaseAuthService } from './firebaseAuthService';

/**
 * API Client using native fetch (more reliable in React Native than axios)
 */
class ApiClient {
  private static instance: ApiClient;

  private constructor() {
    // No setup needed for fetch
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * Get Firebase auth token
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      const tokenPromise = firebaseAuthService.getIdToken();
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
      return await Promise.race([tokenPromise, timeoutPromise]);
    } catch (error) {
      console.warn('[API] Token fetch failed, continuing without auth:', error);
      return null;
    }
  }

  /**
   * Handle 401 response
   */
  private handle401(url: string): void {
    // Don't log out for endpoints that handle auth errors gracefully
    const gracefulAuthEndpoints = [
      '/api/v1/ai/chat/quota',
      '/api/v1/ai/chat',
      '/api/v1/ai/recommendations',
      '/api/v1/ai/plan-week',
    ];

    const shouldSkipLogout = gracefulAuthEndpoints.some(endpoint => url.includes(endpoint));

    if (shouldSkipLogout) {
      console.log('[API] 401 received for graceful endpoint, not logging out:', url);
    } else {
      console.log('[API] 401 received, clearing auth state:', url);
      store.dispatch(clearAuth());
    }
  }

  /**
   * Core fetch method
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    data?: any,
    config?: { params?: Record<string, any> }
  ): Promise<T> {
    // Build full URL
    let fullUrl = url.startsWith('http') ? url : `${API_CONFIG.BASE_URL}${url}`;

    // Add query params for GET requests
    if (config?.params && Object.keys(config.params).length > 0) {
      const filteredParams: Record<string, string> = {};
      for (const [key, value] of Object.entries(config.params)) {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            filteredParams[key] = value.join(',');
          } else {
            filteredParams[key] = String(value);
          }
        }
      }
      const queryString = new URLSearchParams(filteredParams).toString();
      if (queryString) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
      }
    }

    // Get auth token
    const token = await this.getAuthToken();

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Build fetch options
    const fetchOptions: RequestInit = { method, headers };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(data);
    }

    console.log(`[API] ${method}`, url);

    try {
      const response = await fetch(fullUrl, fetchOptions);
      console.log(`[API] ${method}`, url, 'response:', response.status);

      // Handle 401
      if (response.status === 401) {
        this.handle401(url);
      }

      // Parse response
      const responseData = await response.json();

      // Throw error for non-success status codes
      if (!response.ok) {
        const status = response.status;
        if (status === 404) {
          console.log(`[API] ${method}`, url, '- endpoint not found (404)');
        } else {
          console.error(`[API] ${method}`, url, 'error:', {
            status,
            data: responseData,
          });
        }
        const error: any = new Error(responseData?.error || responseData?.message || `HTTP ${status}`);
        error.response = { status, data: responseData };
        throw error;
      }

      return responseData as T;
    } catch (error: any) {
      // Re-throw if already handled
      if (error.response) {
        throw error;
      }
      // Network or other error
      console.error(`[API] ${method}`, url, 'error:', error.message);
      throw error;
    }
  }

  // HTTP methods
  async get<T>(url: string, config?: { params?: Record<string, any> }): Promise<T> {
    return this.request<T>('GET', url, undefined, config);
  }

  async post<T>(url: string, data?: any, config?: { params?: Record<string, any> }): Promise<T> {
    if (__DEV__) {
      console.log('[API] POST', url, 'data:', JSON.stringify(data, null, 2));
    }
    return this.request<T>('POST', url, data, config);
  }

  async put<T>(url: string, data?: any, config?: { params?: Record<string, any> }): Promise<T> {
    return this.request<T>('PUT', url, data, config);
  }

  async patch<T>(url: string, data?: any, config?: { params?: Record<string, any> }): Promise<T> {
    return this.request<T>('PATCH', url, data, config);
  }

  async delete<T>(url: string, config?: { params?: Record<string, any> }): Promise<T> {
    return this.request<T>('DELETE', url, undefined, config);
  }
}

export default ApiClient.getInstance();
