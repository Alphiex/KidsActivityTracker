import { Platform } from 'react-native';

// Enable mock mode to bypass network issues
const USE_MOCK_API = false; // Set to false to use real API

// API URLs - Update these with your deployment URLs
const API_URLS = {
  // Local development
  LOCAL: Platform.select({
    ios: 'http://localhost:3000',
    android: 'http://10.0.2.2:3000',
  }),
  
  // Production - Google Cloud Run deployment
  PRODUCTION: 'https://kids-activity-api-44042034457.us-central1.run.app',
};

// Force local development server
const FORCE_LOCAL = false; // Set to false to use production API

// API Configuration
const API_CONFIG = {
  // Automatically use local in dev mode, production in release
  BASE_URL: __DEV__ && FORCE_LOCAL
    ? API_URLS.LOCAL
    : API_URLS.PRODUCTION,
  
  // Endpoints
  ENDPOINTS: {
    // Auth endpoints
    AUTH: {
      LOGIN: '/api/auth/login',
      REGISTER: '/api/auth/register',
      LOGOUT: '/api/auth/logout',
      REFRESH: '/api/auth/refresh',
      FORGOT_PASSWORD: '/api/auth/forgot-password',
      RESET_PASSWORD: '/api/auth/reset-password',
      VERIFY_EMAIL: '/api/auth/verify-email',
      RESEND_VERIFICATION: '/api/auth/resend-verification',
      CHANGE_PASSWORD: '/api/auth/change-password',
      PROFILE: '/api/auth/profile',
      CHECK: '/api/auth/check',
    },
    
    // Activities
    ACTIVITIES: '/api/v1/activities',
    ACTIVITY_DETAILS: '/api/v1/activities',
    ACTIVITY_STATS: '/api/v1/activities/stats/summary',
    
    // Users & Favorites
    USERS: '/api/v1/users',
    FAVORITES: '/api/v1/favorites',
    USER_FAVORITES: '/api/v1/users/:userId/favorites',
    RECOMMENDATIONS: '/api/v1/users/:userId/recommendations',
    
    // Reference Data
    PROVIDERS: '/api/v1/providers',
    LOCATIONS: '/api/v1/locations',
    CATEGORIES: '/api/v1/categories',
    
    // Legacy endpoints (for backward compatibility)
    SCRAPE_NVRC: '/api/scrape/nvrc',
    SEARCH_ACTIVITIES: '/api/activities/search',
    REGISTER: '/api/register',
    REFRESH: '/api/refresh',
  },
  
  // Request timeout
  TIMEOUT: 30000,
};

export { API_CONFIG };