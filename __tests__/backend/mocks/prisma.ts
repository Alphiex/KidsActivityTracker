/**
 * Prisma Mock
 * Complete mock implementation of Prisma Client for testing
 */

import { mockUsers, mockActivities, mockChildren, mockProviders, mockCities } from './testData';

// Create a deep mock factory for Prisma models
const createModelMock = () => ({
  findUnique: jest.fn(),
  findUniqueOrThrow: jest.fn(),
  findFirst: jest.fn(),
  findFirstOrThrow: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  groupBy: jest.fn(),
});

// Mock Prisma Client
export const prismaMock = {
  user: createModelMock(),
  activity: createModelMock(),
  child: createModelMock(),
  childActivity: createModelMock(),
  favorite: createModelMock(),
  provider: createModelMock(),
  location: createModelMock(),
  city: createModelMock(),
  notification: createModelMock(),
  notificationHistory: createModelMock(),
  userPreference: createModelMock(),
  refreshToken: createModelMock(),
  waitlistEntry: createModelMock(),
  activitySnapshot: createModelMock(),
  subscription: createModelMock(),
  familyShare: createModelMock(),
  adminUser: createModelMock(),
  vendorUser: createModelMock(),
  vendorActivity: createModelMock(),
  importJob: createModelMock(),
  featuredPartner: createModelMock(),
  partnerAnalytics: createModelMock(),

  // Transaction support
  $transaction: jest.fn((callback) => {
    if (typeof callback === 'function') {
      return callback(prismaMock);
    }
    return Promise.all(callback);
  }),

  // Connection methods
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),

  // Raw query support
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),

  // Metrics
  $metrics: {
    json: jest.fn(),
    prometheus: jest.fn(),
  },
};

// Helper to setup common mock responses
export const setupPrismaMocks = () => {
  // User mocks
  prismaMock.user.findUnique.mockResolvedValue(mockUsers[0]);
  prismaMock.user.findMany.mockResolvedValue(mockUsers);
  prismaMock.user.create.mockImplementation((args) =>
    Promise.resolve({ ...mockUsers[0], ...args.data })
  );
  prismaMock.user.update.mockImplementation((args) =>
    Promise.resolve({ ...mockUsers[0], ...args.data })
  );

  // Activity mocks
  prismaMock.activity.findUnique.mockResolvedValue(mockActivities[0]);
  prismaMock.activity.findMany.mockResolvedValue(mockActivities);
  prismaMock.activity.count.mockResolvedValue(mockActivities.length);

  // Child mocks
  prismaMock.child.findUnique.mockResolvedValue(mockChildren[0]);
  prismaMock.child.findMany.mockResolvedValue(mockChildren);

  // Provider mocks
  prismaMock.provider.findUnique.mockResolvedValue(mockProviders[0]);
  prismaMock.provider.findMany.mockResolvedValue(mockProviders);

  // City mocks
  prismaMock.city.findMany.mockResolvedValue(mockCities);

  return prismaMock;
};

// Reset all mocks
export const resetPrismaMocks = () => {
  Object.values(prismaMock).forEach((model) => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach((method) => {
        if (typeof method === 'function' && 'mockClear' in method) {
          (method as jest.Mock).mockClear();
        }
      });
    }
  });
};

// Export as default for module mocking
export default prismaMock;
