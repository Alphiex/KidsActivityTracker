import { Platform } from 'react-native';

// API Configuration
const API_CONFIG = {
  // Use localhost for iOS simulator
  // For real device testing, replace with your computer's IP address
  // On iOS simulator, use 127.0.0.1 instead of localhost
  // For physical device testing, use your laptop's IP address
  BASE_URL: __DEV__ 
    ? Platform.select({
        ios: 'http://127.0.0.1:3000',  // For iOS simulator (use 127.0.0.1 instead of localhost)
        android: 'http://10.0.2.2:3000',  // For Android emulator
      })
    : 'https://api.kidsactivitytracker.com',  // Production URL
  
  // Endpoints
  ENDPOINTS: {
    SCRAPE_NVRC: '/api/scrape/nvrc',
    SEARCH_ACTIVITIES: '/api/activities/search',
    ACTIVITY_DETAILS: '/api/activities',
    REGISTER: '/api/register',
    REFRESH: '/api/refresh',
  },
  
  // Request timeout
  TIMEOUT: 30000,
};

export { API_CONFIG };