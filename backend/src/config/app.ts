/**
 * App configuration constants
 */

export const APP_CONFIG = {
  name: 'Kids Activity Tracker',
  version: '1.1.0',
  buildNumber: '1',
  
  // API Configuration
  api: {
    timeout: 30000,
    retryAttempts: 3,
  },
  
  // Cache Configuration
  cache: {
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxSize: 100, // Maximum number of cached items
  },
  
  // Feature Flags
  features: {
    darkMode: true,
    notifications: true,
    analytics: false,
  },
  
  // Support
  support: {
    email: 'support@kidsactivitytracker.com',
    website: 'https://kidsactivitytracker.com',
  }
};

export default APP_CONFIG;