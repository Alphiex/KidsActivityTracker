/**
 * Test Data
 * Sample data fixtures for frontend tests
 */

// User fixtures
export const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  isVerified: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const mockUsers = [
  mockUser,
  {
    id: 'user-2',
    email: 'jane@example.com',
    name: 'Jane Doe',
    isVerified: true,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
];

// Child fixtures
export const mockChild = {
  id: 'child-1',
  userId: 'user-1',
  name: 'Emma',
  dateOfBirth: '2018-06-15',
  interests: ['swimming', 'art'],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const mockChildren = [
  mockChild,
  {
    id: 'child-2',
    userId: 'user-1',
    name: 'Liam',
    dateOfBirth: '2016-03-22',
    interests: ['soccer', 'music'],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

// Activity fixtures
export const mockActivity = {
  id: 'activity-1',
  name: 'Swimming Lessons',
  description: 'Learn to swim with certified instructors',
  provider: 'Vancouver Parks',
  location: 'Aquatic Centre',
  address: '123 Pool St, Vancouver, BC',
  city: 'Vancouver',
  category: 'Sports',
  subcategory: 'Swimming',
  minAge: 4,
  maxAge: 8,
  cost: 120,
  dateStart: '2024-02-01',
  dateEnd: '2024-03-31',
  startTime: '09:00',
  endTime: '10:00',
  daysOfWeek: ['Monday', 'Wednesday', 'Friday'],
  spotsAvailable: 5,
  totalSpots: 15,
  registrationUrl: 'https://example.com/register',
  latitude: 49.2827,
  longitude: -123.1207,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const mockActivities = [
  mockActivity,
  {
    id: 'activity-2',
    name: 'Art Classes',
    description: 'Creative art for kids',
    provider: 'Community Centre',
    location: 'Art Studio',
    address: '456 Art Ave, Vancouver, BC',
    city: 'Vancouver',
    category: 'Arts',
    subcategory: 'Visual Arts',
    minAge: 5,
    maxAge: 12,
    cost: 85,
    dateStart: '2024-02-15',
    dateEnd: '2024-04-15',
    startTime: '14:00',
    endTime: '15:30',
    daysOfWeek: ['Tuesday', 'Thursday'],
    spotsAvailable: 8,
    totalSpots: 12,
    registrationUrl: 'https://example.com/register/art',
    latitude: 49.2850,
    longitude: -123.1150,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 'activity-3',
    name: 'Soccer Camp',
    description: 'Summer soccer training',
    provider: 'Sports Academy',
    location: 'Soccer Field',
    address: '789 Field Rd, Burnaby, BC',
    city: 'Burnaby',
    category: 'Sports',
    subcategory: 'Soccer',
    minAge: 6,
    maxAge: 14,
    cost: 200,
    dateStart: '2024-07-01',
    dateEnd: '2024-08-15',
    startTime: '10:00',
    endTime: '12:00',
    daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    spotsAvailable: 0, // Full
    totalSpots: 20,
    registrationUrl: 'https://example.com/register/soccer',
    latitude: 49.2500,
    longitude: -122.9800,
    createdAt: '2024-01-03T00:00:00.000Z',
    updatedAt: '2024-01-03T00:00:00.000Z',
  },
];

// Favorite fixtures
export const mockFavorite = {
  id: 'fav-1',
  userId: 'user-1',
  activityId: 'activity-1',
  activity: mockActivity,
  createdAt: '2024-01-05T00:00:00.000Z',
};

export const mockFavorites = [
  mockFavorite,
  {
    id: 'fav-2',
    userId: 'user-1',
    activityId: 'activity-2',
    activity: mockActivities[1],
    createdAt: '2024-01-06T00:00:00.000Z',
  },
];

// City fixtures
export const mockCity = {
  id: 'city-1',
  name: 'Vancouver',
  province: 'BC',
  activityCount: 10500,
};

export const mockCities = [
  mockCity,
  { id: 'city-2', name: 'Burnaby', province: 'BC', activityCount: 6600 },
  { id: 'city-3', name: 'Surrey', province: 'BC', activityCount: 4200 },
  { id: 'city-4', name: 'Richmond', province: 'BC', activityCount: 3800 },
];

// Provider fixtures
export const mockProvider = {
  id: 'provider-1',
  name: 'Vancouver Parks',
  website: 'https://vancouver.ca/parks',
  platform: 'PerfectMind',
  isActive: true,
};

export const mockProviders = [
  mockProvider,
  {
    id: 'provider-2',
    name: 'Burnaby Recreation',
    website: 'https://burnaby.ca/recreation',
    platform: 'ActiveNet',
    isActive: true,
  },
];

// Search filters
export const mockFilters = {
  query: '',
  minAge: 4,
  maxAge: 10,
  categories: ['Sports', 'Arts'],
  cities: ['Vancouver'],
  maxCost: 150,
  maxDistance: 25,
  startDate: '2024-02-01',
  endDate: '2024-04-30',
  daysOfWeek: ['Saturday', 'Sunday'],
  hasAvailableSpots: true,
};

// Notification preferences
export const mockNotificationPreferences = {
  enabled: true,
  newActivities: true,
  dailyDigest: false,
  weeklyDigest: true,
  favoriteCapacity: true,
  capacityThreshold: 3,
  priceDrops: false,
  spotsAvailable: true,
};

// Subscription
export const mockSubscription = {
  isSubscribed: true,
  tier: 'premium',
  expiresAt: '2025-12-31T23:59:59.000Z',
  features: ['unlimited_favorites', 'no_ads', 'priority_notifications'],
};

// API Response wrappers
export const createActivitySearchResponse = (activities = mockActivities) => ({
  activities,
  total: activities.length,
  page: 1,
  totalPages: 1,
  hasMore: false,
});

export const createPaginatedResponse = <T>(items: T[], page = 1, limit = 20) => ({
  items,
  total: items.length,
  page,
  limit,
  totalPages: Math.ceil(items.length / limit),
  hasMore: items.length > page * limit,
});
