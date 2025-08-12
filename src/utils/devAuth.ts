// Development authentication utilities
import * as SecureStore from './secureStorage';

interface DevUser {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DevTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
}

// Generate mock tokens for development
const generateDevTokens = (): DevTokens => {
  const now = Date.now() / 1000;
  return {
    accessToken: 'dev_access_token_' + Math.random().toString(36).substr(2, 9),
    refreshToken: 'dev_refresh_token_' + Math.random().toString(36).substr(2, 9),
    accessTokenExpiry: now + 3600, // 1 hour
    refreshTokenExpiry: now + 604800, // 7 days
  };
};

// Create a development user
export const createDevUser = (email: string, name: string): DevUser => {
  return {
    id: 'dev_' + Math.random().toString(36).substr(2, 9),
    email,
    name,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

// Mock login for development
export const devLogin = async (email: string, password: string) => {
  console.log('Development mode: Mock login');
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Create mock user and tokens
  const user = createDevUser(email, email.split('@')[0]);
  const tokens = generateDevTokens();
  
  // Store in secure storage
  await SecureStore.setTokens(tokens);
  await SecureStore.setUserData(user);
  
  return {
    success: true,
    message: 'Development login successful',
    user,
    tokens,
  };
};

// Mock register for development
export const devRegister = async (email: string, password: string, name: string, phoneNumber?: string) => {
  console.log('Development mode: Mock register');
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Create mock user and tokens
  const user = createDevUser(email, name);
  if (phoneNumber) {
    user.phoneNumber = phoneNumber;
  }
  const tokens = generateDevTokens();
  
  // Store in secure storage
  await SecureStore.setTokens(tokens);
  await SecureStore.setUserData(user);
  
  return {
    success: true,
    message: 'Development registration successful',
    user,
    tokens,
  };
};

// Check if we should use dev auth
export const shouldUseDevAuth = (): boolean => {
  return __DEV__ && process.env.SKIP_AUTH === 'true';
};