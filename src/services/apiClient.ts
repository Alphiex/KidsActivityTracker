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
          const token = await firebaseAuthService.getIdToken();
          console.log('[API] Request to:', config.url, 'token present:', !!token);
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          } else {
            console.warn('[API] No access token found for request:', config.url);
          }
        } catch (error) {
          console.error('[API] Error getting token:', error);
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
        // If we get a 401, the token is invalid (Firebase should have refreshed it)
        // This likely means the user's session has been revoked
        if (error.response?.status === 401) {
          console.log('[API] 401 received, clearing auth state');
          store.dispatch(clearAuth());
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
      console.error('[API] GET', url, 'error:', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
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
