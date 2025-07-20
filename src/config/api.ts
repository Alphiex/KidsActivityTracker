import { Platform } from 'react-native';

// API Configuration
const API_CONFIG = {
  // Use localhost for iOS simulator
  // For real device testing, replace with your computer's IP address
  // On iOS simulator, use 127.0.0.1 instead of localhost
  // For physical device testing, use your laptop's IP address
  BASE_URL: __DEV__ 
    ? Platform.select({
        ios: 'http://192.168.0.108:3000',  // Your Mac's IP address
        android: 'http://192.168.0.108:3000',
      })
    : 'https://api.kidsactivitytracker.com',  // Production URL
  
  // Endpoints
  ENDPOINTS: {
    SCRAPE_NVRC: '/api/scrape/nvrc',
    SEARCH_ACTIVITIES: '/api/activities/search',
    ACTIVITY_DETAILS: '/api/activities',
    REGISTER: '/api/register',
  },
  
  // Request timeout
  TIMEOUT: 30000,
};

export default API_CONFIG;