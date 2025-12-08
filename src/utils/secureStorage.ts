import AsyncStorage from '@react-native-async-storage/async-storage';
import { MMKV } from 'react-native-mmkv';
import DeviceInfo from 'react-native-device-info';
import { secureError } from './secureLogger';

/**
 * Generate a device-specific encryption key
 * This is more secure than a hardcoded key as it varies per device
 * Note: For highest security, use react-native-keychain to store a random key
 */
const generateEncryptionKey = (): string => {
  // Combine multiple device identifiers to create a unique key
  const deviceId = DeviceInfo.getDeviceId(); // e.g., "iPhone14,2"
  const bundleId = DeviceInfo.getBundleId(); // e.g., "com.kidsactivitytracker"
  const buildNumber = DeviceInfo.getBuildNumber();

  // Create a composite key (not perfect but better than hardcoded)
  const compositeKey = `${bundleId}-${deviceId}-${buildNumber}-v1`;
  return compositeKey;
};

// Use MMKV for secure storage with device-specific encryption key
const storage = new MMKV({
  id: 'secure-storage',
  encryptionKey: generateEncryptionKey(),
});

const STORAGE_KEYS = {
  ACCESS_TOKEN: '@auth_access_token',
  REFRESH_TOKEN: '@auth_refresh_token',
  ACCESS_TOKEN_EXPIRY: '@auth_access_token_expiry',
  REFRESH_TOKEN_EXPIRY: '@auth_refresh_token_expiry',
  USER_DATA: '@auth_user_data',
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
}

// Token management
export const setTokens = async (tokens: AuthTokens): Promise<void> => {
  try {
    storage.set(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
    storage.set(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);

    // Handle missing expiry fields (temporary fix)
    const accessExpiry = tokens.accessTokenExpiry || (Date.now() / 1000 + 15 * 60); // 15 minutes
    const refreshExpiry = tokens.refreshTokenExpiry || (Date.now() / 1000 + 7 * 24 * 60 * 60); // 7 days

    storage.set(STORAGE_KEYS.ACCESS_TOKEN_EXPIRY, accessExpiry.toString());
    storage.set(STORAGE_KEYS.REFRESH_TOKEN_EXPIRY, refreshExpiry.toString());
  } catch (error) {
    secureError('Error storing tokens:', error);
    throw error;
  }
};

export const getTokens = async (): Promise<AuthTokens | null> => {
  try {
    const accessToken = storage.getString(STORAGE_KEYS.ACCESS_TOKEN);
    const refreshToken = storage.getString(STORAGE_KEYS.REFRESH_TOKEN);
    const accessTokenExpiry = storage.getString(STORAGE_KEYS.ACCESS_TOKEN_EXPIRY);
    const refreshTokenExpiry = storage.getString(STORAGE_KEYS.REFRESH_TOKEN_EXPIRY);

    if (!accessToken || !refreshToken || !accessTokenExpiry || !refreshTokenExpiry) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      accessTokenExpiry: parseInt(accessTokenExpiry, 10),
      refreshTokenExpiry: parseInt(refreshTokenExpiry, 10),
    };
  } catch (error) {
    secureError('Error retrieving tokens:', error);
    return null;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  try {
    return storage.getString(STORAGE_KEYS.ACCESS_TOKEN) || null;
  } catch (error) {
    secureError('Error retrieving access token:', error);
    return null;
  }
};

export const clearTokens = async (): Promise<void> => {
  try {
    storage.delete(STORAGE_KEYS.ACCESS_TOKEN);
    storage.delete(STORAGE_KEYS.REFRESH_TOKEN);
    storage.delete(STORAGE_KEYS.ACCESS_TOKEN_EXPIRY);
    storage.delete(STORAGE_KEYS.REFRESH_TOKEN_EXPIRY);
  } catch (error) {
    secureError('Error clearing tokens:', error);
    throw error;
  }
};

// User data management
export const setUserData = async (userData: any): Promise<void> => {
  try {
    storage.set(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
  } catch (error) {
    secureError('Error storing user data:', error);
    throw error;
  }
};

export const getUserData = async (): Promise<any | null> => {
  try {
    const userDataString = storage.getString(STORAGE_KEYS.USER_DATA);
    return userDataString ? JSON.parse(userDataString) : null;
  } catch (error) {
    secureError('Error retrieving user data:', error);
    return null;
  }
};

export const clearUserData = async (): Promise<void> => {
  try {
    storage.delete(STORAGE_KEYS.USER_DATA);
  } catch (error) {
    secureError('Error clearing user data:', error);
    throw error;
  }
};

// Clear all auth data
export const clearAllAuthData = async (): Promise<void> => {
  try {
    await clearTokens();
    await clearUserData();
  } catch (error) {
    secureError('Error clearing all auth data:', error);
    throw error;
  }
};

// Check if token is expired
export const isTokenExpired = (expiry: number): boolean => {
  return Date.now() >= expiry * 1000; // Convert to milliseconds
};

// Get remaining time until token expiry (in milliseconds)
export const getTokenExpiryTime = (expiry: number): number => {
  return (expiry * 1000) - Date.now();
};