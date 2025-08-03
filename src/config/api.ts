import { Platform } from 'react-native';

// Enable mock mode to bypass network issues
const USE_MOCK_API = false; // Set to false to use real API

// Force proxy URL for debugging
const FORCE_PROXY = true;

// API Configuration
const API_CONFIG = {
  // Use localhost for iOS simulator to bypass network issues
  // The proxy server handles the connection to the real API
  BASE_URL: __DEV__ && FORCE_PROXY
    ? 'http://localhost:3001'  // Force proxy for all platforms in dev
    : __DEV__ 
    ? Platform.select({
        ios: 'http://localhost:3001',  // Use local proxy for iOS simulator
        android: 'http://10.0.2.2:3001',  // Use local proxy for Android emulator
      })
    : 'https://kids-activity-api-44042034457.us-central1.run.app',  // Production URL
  
  // Endpoints
  ENDPOINTS: {
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