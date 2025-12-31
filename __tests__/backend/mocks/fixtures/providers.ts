/**
 * Provider Fixtures
 * Extended provider data for testing various scenarios
 */

export const vancouverParks = {
  id: 'provider-vancouver-parks',
  name: 'Vancouver Parks',
  slug: 'vancouver-parks',
  website: 'https://vancouver.ca/parks',
  platform: 'PerfectMind',
  isActive: true,
  isFeatured: true,
  lastScrapedAt: new Date('2024-01-15T10:00:00.000Z'),
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-15T10:00:00.000Z'),
  activityCount: 2500,
  city: 'Vancouver',
  province: 'BC',
};

export const burnabyRecreation = {
  id: 'provider-burnaby-rec',
  name: 'Burnaby Recreation',
  slug: 'burnaby-recreation',
  website: 'https://burnaby.ca/recreation',
  platform: 'ActiveNet',
  isActive: true,
  isFeatured: false,
  lastScrapedAt: new Date('2024-01-15T11:00:00.000Z'),
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-15T11:00:00.000Z'),
  activityCount: 1800,
  city: 'Burnaby',
  province: 'BC',
};

export const surreyParks = {
  id: 'provider-surrey-parks',
  name: 'Surrey Parks & Recreation',
  slug: 'surrey-parks',
  website: 'https://surrey.ca/recreation',
  platform: 'PerfectMind',
  isActive: true,
  isFeatured: false,
  lastScrapedAt: new Date('2024-01-15T12:00:00.000Z'),
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-15T12:00:00.000Z'),
  activityCount: 2100,
  city: 'Surrey',
  province: 'BC',
};

export const richmondCommunity = {
  id: 'provider-richmond-community',
  name: 'Richmond Community Services',
  slug: 'richmond-community',
  website: 'https://richmond.ca/recreation',
  platform: 'PerfectMind',
  isActive: true,
  isFeatured: true,
  lastScrapedAt: new Date('2024-01-15T09:00:00.000Z'),
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-15T09:00:00.000Z'),
  activityCount: 1500,
  city: 'Richmond',
  province: 'BC',
};

export const inactiveProvider = {
  id: 'provider-inactive',
  name: 'Old Recreation Centre',
  slug: 'old-recreation',
  website: 'https://old-rec.example.com',
  platform: 'Legacy',
  isActive: false,
  isFeatured: false,
  lastScrapedAt: new Date('2023-06-01T00:00:00.000Z'),
  createdAt: new Date('2020-01-01T00:00:00.000Z'),
  updatedAt: new Date('2023-06-01T00:00:00.000Z'),
  activityCount: 0,
  city: 'Vancouver',
  province: 'BC',
};

export const vendorProvider = {
  id: 'provider-vendor',
  name: 'Private Sports Academy',
  slug: 'sports-academy',
  website: 'https://sportsacademy.example.com',
  platform: 'Vendor',
  isActive: true,
  isFeatured: false,
  isVendorManaged: true,
  vendorId: 'vendor-1',
  lastScrapedAt: null, // Vendor-managed, no scraping
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-15T00:00:00.000Z'),
  activityCount: 50,
  city: 'Vancouver',
  province: 'BC',
};

// Featured partner
export const featuredPartner = {
  id: 'partner-1',
  providerId: 'provider-vancouver-parks',
  name: 'Vancouver Parks',
  description: 'Premier recreation provider in Vancouver',
  logoUrl: 'https://example.com/logo-vancouver-parks.png',
  tier: 'gold',
  isActive: true,
  priority: 1,
  clickCount: 1250,
  impressionCount: 50000,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-15T00:00:00.000Z'),
};

// All test providers
export const allProviders = [
  vancouverParks,
  burnabyRecreation,
  surreyParks,
  richmondCommunity,
  inactiveProvider,
  vendorProvider,
];

// Active providers only
export const activeProviders = allProviders.filter((p) => p.isActive);

// Featured providers
export const featuredProviders = allProviders.filter(
  (p) => p.isActive && p.isFeatured
);

// Providers by platform
export const perfectMindProviders = allProviders.filter(
  (p) => p.platform === 'PerfectMind'
);
export const activeNetProviders = allProviders.filter(
  (p) => p.platform === 'ActiveNet'
);

// Provider with locations
export const providerWithLocations = {
  ...vancouverParks,
  locations: [
    {
      id: 'location-1',
      name: 'Aquatic Centre',
      address: '123 Pool St',
      city: 'Vancouver',
      province: 'BC',
      latitude: 49.2827,
      longitude: -123.1207,
    },
    {
      id: 'location-2',
      name: 'Community Centre',
      address: '456 Main St',
      city: 'Vancouver',
      province: 'BC',
      latitude: 49.285,
      longitude: -123.115,
    },
  ],
};
