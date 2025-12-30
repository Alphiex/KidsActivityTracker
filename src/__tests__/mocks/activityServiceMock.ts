/**
 * Mock data and utilities for filter testing
 */

// Mock Activity Types with counts
export const mockActivityTypes = [
  { id: '1', code: 'sports', name: 'Sports', iconName: 'basketball', activityCount: 150, subtypes: [
    { id: '1a', code: 'swimming', name: 'Swimming', activityCount: 45 },
    { id: '1b', code: 'soccer', name: 'Soccer', activityCount: 35 },
    { id: '1c', code: 'hockey', name: 'Hockey', activityCount: 25 },
  ]},
  { id: '2', code: 'arts', name: 'Arts & Crafts', iconName: 'palette', activityCount: 80, subtypes: [
    { id: '2a', code: 'painting', name: 'Painting', activityCount: 30 },
    { id: '2b', code: 'pottery', name: 'Pottery', activityCount: 20 },
  ]},
  { id: '3', code: 'music', name: 'Music', iconName: 'music', activityCount: 60, subtypes: [
    { id: '3a', code: 'piano', name: 'Piano', activityCount: 25 },
    { id: '3b', code: 'guitar', name: 'Guitar', activityCount: 15 },
  ]},
  { id: '4', code: 'dance', name: 'Dance', iconName: 'dance-ballroom', activityCount: 55, subtypes: [] },
  { id: '5', code: 'camps', name: 'Camps', iconName: 'tent', activityCount: 100, subtypes: [
    { id: '5a', code: 'summer-camp', name: 'Summer Camp', activityCount: 60 },
    { id: '5b', code: 'day-camp', name: 'Day Camp', activityCount: 40 },
  ]},
  { id: '6', code: 'martial-arts', name: 'Martial Arts', iconName: 'karate', activityCount: 40, subtypes: [] },
  { id: '7', code: 'educational', name: 'Educational', iconName: 'school', activityCount: 75, subtypes: [] },
];

// Mock Age Groups
export const mockAgeGroups = [
  { code: 'infant', label: 'Infant (0-2)', minAge: 0, maxAge: 2 },
  { code: 'toddler', label: 'Toddler (3-5)', minAge: 3, maxAge: 5 },
  { code: 'early-elementary', label: 'Early Elementary (6-8)', minAge: 6, maxAge: 8 },
  { code: 'late-elementary', label: 'Late Elementary (9-11)', minAge: 9, maxAge: 11 },
  { code: 'middle-school', label: 'Middle School (12-14)', minAge: 12, maxAge: 14 },
  { code: 'high-school', label: 'High School (15-18)', minAge: 15, maxAge: 18 },
];

// Mock Cities
export const mockCities = [
  { id: 'c1', name: 'Vancouver', province: 'BC', isActive: true, activityCount: 500 },
  { id: 'c2', name: 'Burnaby', province: 'BC', isActive: true, activityCount: 200 },
  { id: 'c3', name: 'Richmond', province: 'BC', isActive: true, activityCount: 150 },
  { id: 'c4', name: 'Surrey', province: 'BC', isActive: true, activityCount: 180 },
  { id: 'c5', name: 'North Vancouver', province: 'BC', isActive: true, activityCount: 120 },
  { id: 'c6', name: 'Calgary', province: 'AB', isActive: true, activityCount: 300 },
  { id: 'c7', name: 'Edmonton', province: 'AB', isActive: true, activityCount: 250 },
];

// Mock Locations (venues)
export const mockLocations = [
  { id: 'l1', name: 'Vancouver Community Centre', city: 'Vancouver', _count: { activities: 50 } },
  { id: 'l2', name: 'Killarney Pool', city: 'Vancouver', _count: { activities: 30 } },
  { id: 'l3', name: 'Burnaby Sports Complex', city: 'Burnaby', _count: { activities: 45 } },
  { id: 'l4', name: 'Richmond Oval', city: 'Richmond', _count: { activities: 35 } },
  { id: 'l5', name: 'Surrey Arts Centre', city: 'Surrey', _count: { activities: 25 } },
  { id: 'l6', name: 'North Van Rec Centre', city: 'North Vancouver', _count: { activities: 40 } },
];

// Mock Activities for filter testing
export const mockActivities = [
  {
    id: 'a1',
    name: 'Kids Swimming Lessons',
    provider: 'Vancouver Parks',
    activityType: { code: 'sports', name: 'Sports' },
    activitySubtype: { code: 'swimming', name: 'Swimming' },
    ageMin: 6,
    ageMax: 12,
    cost: 0,
    city: 'Vancouver',
    location: { name: 'Killarney Pool' },
    dayOfWeek: ['Saturday', 'Sunday'],
    isActive: true,
  },
  {
    id: 'a2',
    name: 'Youth Soccer League',
    provider: 'Burnaby FC',
    activityType: { code: 'sports', name: 'Sports' },
    activitySubtype: { code: 'soccer', name: 'Soccer' },
    ageMin: 8,
    ageMax: 14,
    cost: 150,
    city: 'Burnaby',
    location: { name: 'Burnaby Sports Complex' },
    dayOfWeek: ['Tuesday', 'Thursday'],
    isActive: true,
  },
  {
    id: 'a3',
    name: 'Toddler Art Class',
    provider: 'Creative Kids',
    activityType: { code: 'arts', name: 'Arts & Crafts' },
    activitySubtype: { code: 'painting', name: 'Painting' },
    ageMin: 3,
    ageMax: 5,
    cost: 75,
    city: 'Vancouver',
    location: { name: 'Vancouver Community Centre' },
    dayOfWeek: ['Wednesday'],
    isActive: true,
  },
  {
    id: 'a4',
    name: 'Piano Lessons',
    provider: 'Music Academy',
    activityType: { code: 'music', name: 'Music' },
    activitySubtype: { code: 'piano', name: 'Piano' },
    ageMin: 5,
    ageMax: 18,
    cost: 200,
    city: 'Richmond',
    location: { name: 'Richmond Oval' },
    dayOfWeek: ['Monday', 'Wednesday', 'Friday'],
    isActive: true,
  },
  {
    id: 'a5',
    name: 'Summer Day Camp',
    provider: 'Camp Adventures',
    activityType: { code: 'camps', name: 'Camps' },
    activitySubtype: { code: 'day-camp', name: 'Day Camp' },
    ageMin: 6,
    ageMax: 12,
    cost: 300,
    city: 'Vancouver',
    location: { name: 'Vancouver Community Centre' },
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    isActive: true,
  },
  {
    id: 'a6',
    name: 'Ballet for Beginners',
    provider: 'Dance Studio',
    activityType: { code: 'dance', name: 'Dance' },
    ageMin: 4,
    ageMax: 8,
    cost: 120,
    city: 'North Vancouver',
    location: { name: 'North Van Rec Centre' },
    dayOfWeek: ['Saturday'],
    isActive: true,
  },
  {
    id: 'a7',
    name: 'Free Soccer Drop-in',
    provider: 'Vancouver Parks',
    activityType: { code: 'sports', name: 'Sports' },
    activitySubtype: { code: 'soccer', name: 'Soccer' },
    ageMin: 8,
    ageMax: 16,
    cost: 0,
    city: 'Vancouver',
    location: { name: 'Vancouver Community Centre' },
    dayOfWeek: ['Sunday'],
    isActive: true,
  },
  {
    id: 'a8',
    name: 'Karate for Kids',
    provider: 'Martial Arts Dojo',
    activityType: { code: 'martial-arts', name: 'Martial Arts' },
    ageMin: 6,
    ageMax: 14,
    cost: 180,
    city: 'Surrey',
    location: { name: 'Surrey Arts Centre' },
    dayOfWeek: ['Tuesday', 'Thursday', 'Saturday'],
    isActive: true,
  },
];

/**
 * Filter activities based on search parameters
 */
export function filterMockActivities(params: {
  activityTypes?: string[];
  ageMin?: number;
  ageMax?: number;
  costMax?: number;
  costMin?: number;
  location?: string;
  locations?: string[];
  daysOfWeek?: string[];
  search?: string;
}) {
  return mockActivities.filter(activity => {
    // Filter by activity type
    if (params.activityTypes && params.activityTypes.length > 0) {
      const typeCode = typeof activity.activityType === 'object' 
        ? activity.activityType.code 
        : activity.activityType;
      if (!params.activityTypes.includes(typeCode)) {
        return false;
      }
    }

    // Filter by age range (activity must overlap with requested range)
    if (params.ageMin !== undefined || params.ageMax !== undefined) {
      const minAge = params.ageMin ?? 0;
      const maxAge = params.ageMax ?? 18;
      // Activity is valid if it overlaps with the requested range
      if (activity.ageMax < minAge || activity.ageMin > maxAge) {
        return false;
      }
    }

    // Filter by cost
    if (params.costMax !== undefined && activity.cost > params.costMax) {
      return false;
    }
    if (params.costMin !== undefined && activity.cost < params.costMin) {
      return false;
    }

    // Filter by location
    if (params.location) {
      if (activity.city !== params.location) {
        return false;
      }
    }

    // Filter by multiple locations
    if (params.locations && params.locations.length > 0) {
      if (!params.locations.includes(activity.city)) {
        return false;
      }
    }

    // Filter by days of week
    if (params.daysOfWeek && params.daysOfWeek.length > 0) {
      const hasMatchingDay = activity.dayOfWeek?.some(day => 
        params.daysOfWeek!.includes(day)
      );
      if (!hasMatchingDay) {
        return false;
      }
    }

    // Filter by search text
    if (params.search) {
      const searchLower = params.search.toLowerCase();
      const nameMatch = activity.name.toLowerCase().includes(searchLower);
      const providerMatch = activity.provider.toLowerCase().includes(searchLower);
      if (!nameMatch && !providerMatch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Mock ActivityService for testing
 */
export const createMockActivityService = () => ({
  getActivityTypesWithCounts: jest.fn().mockResolvedValue(mockActivityTypes),
  getAgeGroups: jest.fn().mockResolvedValue(mockAgeGroups),
  getCities: jest.fn().mockResolvedValue(mockCities),
  getLocations: jest.fn().mockResolvedValue(mockLocations),
  getCategories: jest.fn().mockResolvedValue(mockActivityTypes.map(t => t.name)),
  searchActivities: jest.fn().mockImplementation((params) => 
    Promise.resolve(filterMockActivities(params))
  ),
  searchActivitiesPaginated: jest.fn().mockImplementation((params) => {
    const filtered = filterMockActivities(params);
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    return Promise.resolve({
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
      hasMore: filtered.length > offset + limit,
    });
  }),
});

/**
 * Mock PreferencesService for testing
 */
export const createMockPreferencesService = () => {
  let preferences = {
    preferredActivityTypes: [] as string[],
    preferredSubtypes: [] as string[],
    ageRanges: [{ min: 0, max: 18 }],
    locations: [] as string[],
    locationIds: [] as string[],
    daysOfWeek: [] as string[],
    timePreferences: { morning: false, afternoon: false, evening: false },
    priceRange: { min: 0, max: 1000 },
    distanceFilterEnabled: false,
    distanceRadiusKm: 25,
    hideClosedOrFull: false,
    dateFilter: 'any' as const,
    dateRange: undefined as { start: string; end?: string } | undefined,
    dateMatchMode: 'partial' as const,
  };

  return {
    getPreferences: jest.fn(() => preferences),
    updatePreferences: jest.fn((updates) => {
      preferences = { ...preferences, ...updates };
      return preferences;
    }),
    resetPreferences: jest.fn(() => {
      preferences = {
        preferredActivityTypes: [],
        preferredSubtypes: [],
        ageRanges: [{ min: 0, max: 18 }],
        locations: [],
        locationIds: [],
        daysOfWeek: [],
        timePreferences: { morning: false, afternoon: false, evening: false },
        priceRange: { min: 0, max: 1000 },
        distanceFilterEnabled: false,
        distanceRadiusKm: 25,
        hideClosedOrFull: false,
        dateFilter: 'any',
        dateRange: undefined,
        dateMatchMode: 'partial',
      };
      return preferences;
    }),
  };
};

