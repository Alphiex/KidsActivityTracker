import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { API_CONFIG } from '../config/api';
import { store } from '../store';
import { clearAuth } from '../store/slices/authSlice';
import { firebaseAuthService } from './firebaseAuthService';

class ApiClient {
  private static instance: ApiClient;
  private axiosInstance: AxiosInstance;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private setupInterceptors() {
    // Request interceptor - get Firebase ID token
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        try {
          // Get Firebase ID token (automatically refreshes if needed)
          // Use a timeout to prevent blocking on token fetch
          const tokenPromise = firebaseAuthService.getIdToken();
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));

          const token = await Promise.race([tokenPromise, timeoutPromise]);

          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          // Don't warn for missing token - many endpoints are public
        } catch (error) {
          // Don't block request if token fetch fails
          console.warn('[API] Token fetch failed, continuing without auth:', error);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle 401 errors
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // If we get a 401, check if we should log out
        if (error.response?.status === 401) {
          const url = error.config?.url || '';

          // Don't log out for endpoints that handle auth errors gracefully
          // These endpoints catch 401s and show appropriate UI instead
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

        return Promise.reject(error);
      }
    );
  }

  // HTTP methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    console.log('[API] GET', url);
    try {
      const response = await this.axiosInstance.get<T>(url, config);
      console.log('[API] GET', url, 'response:', response.status);
      return response.data;
    } catch (error: any) {
      // Don't log 404s as errors - they're often expected (missing endpoints)
      const status = error?.response?.status;
      if (status === 404) {
        console.log('[API] GET', url, '- endpoint not found (404)');
      } else {
        console.error('[API] GET', url, 'error:', {
          status,
          data: error?.response?.data,
          message: error?.message,
        });
      }
      throw error;
    }
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    console.log('[API] POST', url, 'data:', JSON.stringify(data, null, 2));
    try {
      const response = await this.axiosInstance.post<T>(url, data, config);
      console.log('[API] POST', url, 'response:', response.status, JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error: any) {
      console.error('[API] POST', url, 'error:', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
      throw error;
    }
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.delete<T>(url, config);
    return response.data;
  }

  // Get the axios instance for special cases
  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }
}

export default ApiClient.getInstance();
