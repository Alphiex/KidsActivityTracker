import { Platform } from 'react-native';

// Enable mock mode to bypass network issues
const USE_MOCK_API = false; // Set to false to use real API

// API Configuration
const API_CONFIG = {
  // Use localhost for iOS simulator
  // For real device testing, replace with your computer's IP address
  // On iOS simulator, use 127.0.0.1 instead of localhost
  // For physical device testing, use your laptop's IP address
  BASE_URL: __DEV__ 
    ? Platform.select({
        ios: 'https://kids-activity-api-44042034457.us-central1.run.app',  // Cloud API for development
        android: 'https://kids-activity-api-44042034457.us-central1.run.app',  // Cloud API for development
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