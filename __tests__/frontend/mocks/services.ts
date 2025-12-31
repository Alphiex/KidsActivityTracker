/**
 * Frontend Service Mocks
 * Mock implementations for all frontend services
 */

// API Client Mock
export const mockApiClient = {
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} }),
  put: jest.fn().mockResolvedValue({ data: {} }),
  delete: jest.fn().mockResolvedValue({ data: {} }),
  patch: jest.fn().mockResolvedValue({ data: {} }),
};

// Auth Service Mock
export const mockAuthService = {
  login: jest.fn().mockResolvedValue({
    user: { id: '1', email: 'test@example.com', name: 'Test User' },
    token: 'mock-token',
  }),
  register: jest.fn().mockResolvedValue({
    user: { id: '1', email: 'test@example.com', name: 'Test User' },
    token: 'mock-token',
  }),
  logout: jest.fn().mockResolvedValue(undefined),
  refreshToken: jest.fn().mockResolvedValue({ token: 'new-mock-token' }),
  forgotPassword: jest.fn().mockResolvedValue({ success: true }),
  resetPassword: jest.fn().mockResolvedValue({ success: true }),
  verifyEmail: jest.fn().mockResolvedValue({ success: true }),
  getCurrentUser: jest.fn().mockResolvedValue({
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
  }),
};

// Activity Service Mock
export const mockActivityService = {
  searchActivities: jest.fn().mockResolvedValue({
    activities: [],
    total: 0,
    page: 1,
    totalPages: 0,
  }),
  getActivityById: jest.fn().mockResolvedValue(null),
  getRecommendedActivities: jest.fn().mockResolvedValue([]),
  getNearbyActivities: jest.fn().mockResolvedValue([]),
};

// Children Service Mock
export const mockChildrenService = {
  getChildren: jest.fn().mockResolvedValue([]),
  getChildById: jest.fn().mockResolvedValue(null),
  createChild: jest.fn().mockResolvedValue({ id: '1', name: 'Test Child' }),
  updateChild: jest.fn().mockResolvedValue({ id: '1', name: 'Updated Child' }),
  deleteChild: jest.fn().mockResolvedValue({ success: true }),
};

// Favorites Service Mock
export const mockFavoritesService = {
  getFavorites: jest.fn().mockResolvedValue([]),
  addFavorite: jest.fn().mockResolvedValue({ success: true }),
  removeFavorite: jest.fn().mockResolvedValue({ success: true }),
  isFavorite: jest.fn().mockResolvedValue(false),
};

// Notification Service Mock
export const mockNotificationService = {
  getPreferences: jest.fn().mockResolvedValue({
    enabled: true,
    newActivities: true,
    dailyDigest: false,
  }),
  updatePreferences: jest.fn().mockResolvedValue({ success: true }),
  getHistory: jest.fn().mockResolvedValue({ notifications: [], hasMore: false }),
  sendTestNotification: jest.fn().mockResolvedValue({ success: true }),
  getWaitlist: jest.fn().mockResolvedValue([]),
  joinWaitlist: jest.fn().mockResolvedValue({ success: true }),
  leaveWaitlist: jest.fn().mockResolvedValue({ success: true }),
};

// Subscription Service Mock
export const mockSubscriptionService = {
  getSubscriptionStatus: jest.fn().mockResolvedValue({
    isSubscribed: false,
    tier: 'free',
  }),
  getProducts: jest.fn().mockResolvedValue([]),
  purchase: jest.fn().mockResolvedValue({ success: true }),
  restore: jest.fn().mockResolvedValue({ success: true }),
};

// Location Service Mock
export const mockLocationService = {
  getCurrentLocation: jest.fn().mockResolvedValue({
    latitude: 49.2827,
    longitude: -123.1207,
  }),
  getCities: jest.fn().mockResolvedValue([]),
  getLocations: jest.fn().mockResolvedValue([]),
};

// Preferences Service Mock
export const mockPreferencesService = {
  getPreferences: jest.fn().mockResolvedValue({
    activityTypes: [],
    ageRange: { min: 0, max: 18 },
    maxDistance: 50,
    maxCost: 100,
  }),
  updatePreferences: jest.fn().mockResolvedValue({ success: true }),
};

// Export all mocks
export const mockServices = {
  apiClient: mockApiClient,
  authService: mockAuthService,
  activityService: mockActivityService,
  childrenService: mockChildrenService,
  favoritesService: mockFavoritesService,
  notificationService: mockNotificationService,
  subscriptionService: mockSubscriptionService,
  locationService: mockLocationService,
  preferencesService: mockPreferencesService,
};

// Jest mock factory functions
export const createMockApiClient = () => ({ ...mockApiClient });
export const createMockAuthService = () => ({ ...mockAuthService });
export const createMockActivityService = () => ({ ...mockActivityService });
