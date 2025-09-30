import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { API_CONFIG } from '../config/api';
import * as SecureStore from '../utils/secureStorage';
import { store } from '../store';
import { refreshToken, clearAuth } from '../store/slices/authSlice';

class ApiClient {
  private static instance: ApiClient;
  private axiosInstance: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

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
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        const token = await SecureStore.getAccessToken();
        console.log('[API] Request to:', config.url, 'token present:', !!token);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          console.warn('[API] No access token found for request:', config.url);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // Wait for the refresh to complete
            return new Promise((resolve) => {
              this.refreshSubscribers.push((token: string) => {
                originalRequest.headers!.Authorization = `Bearer ${token}`;
                resolve(this.axiosInstance(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            // Attempt to refresh the token
            const result = await store.dispatch(refreshToken());
            
            if (refreshToken.fulfilled.match(result)) {
              const newToken = result.payload.tokens.accessToken;
              
              // Notify all subscribers with the new token
              this.refreshSubscribers.forEach(callback => callback(newToken));
              this.refreshSubscribers = [];
              
              // Retry the original request
              originalRequest.headers!.Authorization = `Bearer ${newToken}`;
              return this.axiosInstance(originalRequest);
            } else {
              throw new Error('Token refresh failed');
            }
          } catch (refreshError) {
            // Refresh failed, clear auth and redirect to login
            store.dispatch(clearAuth());
            throw refreshError;
          } finally {
            this.isRefreshing = false;
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