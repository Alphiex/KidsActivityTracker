/**
 * Backend Test Data
 * Sample data fixtures for backend tests
 */

// User fixtures
export const mockUsers = [
  {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: '$2b$10$hashedpassword123',
    isVerified: true,
    verificationToken: null,
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  },
  {
    id: 'user-2',
    email: 'jane@example.com',
    name: 'Jane Doe',
    passwordHash: '$2b$10$hashedpassword456',
    isVerified: true,
    verificationToken: null,
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: new Date('2024-01-02T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  },
  {
    id: 'user-3',
    email: 'unverified@example.com',
    name: 'Unverified User',
    passwordHash: '$2b$10$hashedpassword789',
    isVerified: false,
    verificationToken: 'verification-token-123',
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: new Date('2024-01-03T00:00:00.000Z'),
    updatedAt: new Date('2024-01-03T00:00:00.000Z'),
  },
];

// Child fixtures
export const mockChildren = [
  {
    id: 'child-1',
    userId: 'user-1',
    name: 'Emma',
    dateOfBirth: new Date('2018-06-15'),
    interests: ['swimming', 'art'],
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  },
  {
    id: 'child-2',
    userId: 'user-1',
    name: 'Liam',
    dateOfBirth: new Date('2016-03-22'),
    interests: ['soccer', 'music'],
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  },
];

// Activity fixtures
export const mockActivities = [
  {
    id: 'activity-1',
    providerId: 'provider-1',
    locationId: 'location-1',
    name: 'Swimming Lessons',
    description: 'Learn to swim with certified instructors',
    category: 'Sports',
    subcategory: 'Swimming',
    minAge: 4,
    maxAge: 8,
    cost: 120,
    dateStart: new Date('2024-02-01'),
    dateEnd: new Date('2024-03-31'),
    startTime: '09:00',
    endTime: '10:00',
    daysOfWeek: ['Monday', 'Wednesday', 'Friday'],
    spotsAvailable: 5,
    totalSpots: 15,
    registrationUrl: 'https://example.com/register',
    directRegistrationUrl: 'https://example.com/register/direct',
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  },
  {
    id: 'activity-2',
    providerId: 'provider-1',
    locationId: 'location-2',
    name: 'Art Classes',
    description: 'Creative art for kids',
    category: 'Arts',
    subcategory: 'Visual Arts',
    minAge: 5,
    maxAge: 12,
    cost: 85,
    dateStart: new Date('2024-02-15'),
    dateEnd: new Date('2024-04-15'),
    startTime: '14:00',
    endTime: '15:30',
    daysOfWeek: ['Tuesday', 'Thursday'],
    spotsAvailable: 8,
    totalSpots: 12,
    registrationUrl: 'https://example.com/register/art',
    directRegistrationUrl: null,
    isActive: true,
    createdAt: new Date('2024-01-02T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  },
];

// Provider fixtures
export const mockProviders = [
  {
    id: 'provider-1',
    name: 'Vancouver Parks',
    website: 'https://vancouver.ca/parks',
    platform: 'PerfectMind',
    isActive: true,
    lastScrapedAt: new Date('2024-01-15T10:00:00.000Z'),
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-15T10:00:00.000Z'),
  },
  {
    id: 'provider-2',
    name: 'Burnaby Recreation',
    website: 'https://burnaby.ca/recreation',
    platform: 'ActiveNet',
    isActive: true,
    lastScrapedAt: new Date('2024-01-15T11:00:00.000Z'),
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-15T11:00:00.000Z'),
  },
];

// City fixtures
export const mockCities = [
  {
    id: 'city-1',
    name: 'Vancouver',
    province: 'BC',
    country: 'Canada',
    latitude: 49.2827,
    longitude: -123.1207,
    isActive: true,
  },
  {
    id: 'city-2',
    name: 'Burnaby',
    province: 'BC',
    country: 'Canada',
    latitude: 49.2488,
    longitude: -122.9805,
    isActive: true,
  },
];

// Location fixtures
export const mockLocations = [
  {
    id: 'location-1',
    providerId: 'provider-1',
    name: 'Aquatic Centre',
    address: '123 Pool St',
    city: 'Vancouver',
    province: 'BC',
    postalCode: 'V6B 1A1',
    latitude: 49.2827,
    longitude: -123.1207,
  },
  {
    id: 'location-2',
    providerId: 'provider-1',
    name: 'Community Centre',
    address: '456 Main St',
    city: 'Vancouver',
    province: 'BC',
    postalCode: 'V6B 2B2',
    latitude: 49.2850,
    longitude: -123.1150,
  },
];

// Favorite fixtures
export const mockFavorites = [
  {
    id: 'fav-1',
    userId: 'user-1',
    activityId: 'activity-1',
    createdAt: new Date('2024-01-05T00:00:00.000Z'),
  },
];

// Notification preferences
export const mockNotificationPreferences = {
  id: 'pref-1',
  userId: 'user-1',
  enabled: true,
  newActivities: true,
  dailyDigest: false,
  weeklyDigest: true,
  favoriteCapacity: true,
  capacityThreshold: 3,
  priceDrops: false,
  spotsAvailable: true,
  reminders: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

// Subscription fixtures
export const mockSubscriptions = [
  {
    id: 'sub-1',
    userId: 'user-1',
    tier: 'premium',
    status: 'active',
    expiresAt: new Date('2025-12-31T23:59:59.000Z'),
    provider: 'apple',
    providerSubscriptionId: 'apple-sub-123',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  },
];

// JWT tokens for testing
export const mockTokens = {
  validAccessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6MTcwNDY3MjAwMH0.mock',
  validRefreshToken: 'refresh-token-valid-123',
  expiredAccessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEiLCJleHAiOjE2MDAwMDAwMDB9.expired',
  invalidToken: 'invalid-token',
};

// Request body fixtures
export const mockRequestBodies = {
  validLogin: {
    email: 'test@example.com',
    password: 'Password123!',
  },
  validRegister: {
    email: 'newuser@example.com',
    password: 'Password123!',
    name: 'New User',
  },
  validChild: {
    name: 'New Child',
    dateOfBirth: '2019-05-20',
    interests: ['art', 'music'],
  },
  validActivitySearch: {
    query: 'swimming',
    minAge: 5,
    maxAge: 10,
    cities: ['Vancouver'],
    maxCost: 150,
  },
};

// Helper functions
export const createMockUser = (overrides = {}) => ({
  ...mockUsers[0],
  id: `user-${Date.now()}`,
  ...overrides,
});

export const createMockActivity = (overrides = {}) => ({
  ...mockActivities[0],
  id: `activity-${Date.now()}`,
  ...overrides,
});

export const createMockChild = (overrides = {}) => ({
  ...mockChildren[0],
  id: `child-${Date.now()}`,
  ...overrides,
});
