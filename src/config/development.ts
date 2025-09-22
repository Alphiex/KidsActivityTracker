/**
 * Development Configuration
 * Contains test credentials and development settings
 */

export const DEV_CONFIG = {
  // Test User Credentials
  TEST_USER: {
    email: 'test@kidsactivity.com',
    password: 'Test123!',
    name: 'Test User'
  },
  
  // Alternative test accounts
  TEST_ACCOUNTS: [
    {
      email: 'test@kidsactivity.com',
      password: 'Test123!',
      name: 'Test User',
      description: 'Main test account'
    },
    {
      email: 'demo@kidsactivity.com', 
      password: 'Demo123!',
      name: 'Demo User',
      description: 'Demo account for presentations'
    },
    {
      email: 'parent@kidsactivity.com',
      password: 'Parent123!',
      name: 'Parent User',
      description: 'Parent role test account'
    }
  ],
  
  // Auto-login in development
  AUTO_LOGIN: __DEV__ ? true : false,
  
  // Show development tools
  SHOW_DEV_TOOLS: __DEV__ ? true : false,
  
  // Skip onboarding in dev mode
  SKIP_ONBOARDING: __DEV__ ? true : false,
  
  // Use local API in dev mode
  USE_LOCAL_API: false,
  
  // Development API endpoints
  DEV_API_URL: 'http://localhost:3000',
  PROD_API_URL: 'https://kids-activity-api-205843686007.us-central1.run.app',
};

// Export convenience functions
export const getTestCredentials = () => {
  if (!__DEV__) {
    return { email: '', password: '' };
  }
  return {
    email: DEV_CONFIG.TEST_USER.email,
    password: DEV_CONFIG.TEST_USER.password,
  };
};

export const shouldAutoLogin = () => {
  return __DEV__ && DEV_CONFIG.AUTO_LOGIN;
};

export const shouldSkipOnboarding = () => {
  return __DEV__ && DEV_CONFIG.SKIP_ONBOARDING;
};