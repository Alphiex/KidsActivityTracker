const { PrismaClient } = require('../../generated/prisma');

let prisma;

// Check if we have a database URL
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  No DATABASE_URL provided, running without database');
  // Create a mock Prisma client for running without database
  prisma = {
    $connect: async () => Promise.resolve(),
    $disconnect: async () => Promise.resolve(),
    $executeRaw: async () => 0,
    $executeRawUnsafe: async () => 0,
    $queryRaw: async () => [],
    $transaction: async (fn) => fn(prisma),
    activity: {
      findMany: async () => [],
      findUnique: async () => null,
      count: async () => 0,
      create: async (data) => ({ id: 'mock-id', ...data.data }),
      update: async (data) => ({ id: data.where.id, ...data.data }),
      updateMany: async () => ({ count: 0 }),
      upsert: async (data) => ({ id: 'mock-id', ...data.create, _count: { history: 0 } }),
      groupBy: async () => [],
    },
    user: {
      findUnique: async () => null,
      create: async (data) => ({ id: 'mock-user-id', ...data.data }),
      upsert: async (data) => ({ id: 'mock-user-id', ...data.create }),
    },
    provider: {
      findMany: async () => [],
      findUnique: async () => null,
      count: async () => 0,
      create: async (data) => ({ id: 'mock-provider-id', ...data.data }),
      update: async (data) => ({ id: data.where.id, ...data.data }),
      upsert: async (data) => ({ id: 'mock-provider-id', ...data.create }),
    },
    location: {
      findMany: async () => [],
      upsert: async (data) => ({ id: 'mock-location-id', ...data.create }),
    },
    favorite: {
      create: async () => ({ id: 'mock-favorite-id' }),
      delete: async () => ({ id: 'mock-favorite-id' }),
      findMany: async () => [],
    },
    scrapeJob: {
      create: async (data) => ({ id: 'mock-job-id', ...data.data }),
      update: async (data) => ({ id: data.where.id, ...data.data }),
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [],
      groupBy: async () => [],
    },
    activityHistory: {
      createMany: async () => ({ count: 0 }),
    },
    activitySession: {
      count: async () => 0,
      create: async (data) => ({ id: 'mock-session-id', ...data.data }),
      createMany: async () => ({ count: 0 }),
      deleteMany: async () => ({ count: 0 }),
    },
    activityPrerequisite: {
      count: async () => 0,
      create: async (data) => ({ id: 'mock-prereq-id', ...data.data }),
      createMany: async () => ({ count: 0 }),
      deleteMany: async () => ({ count: 0 }),
    },
  };
} else {
  // Singleton pattern for Prisma client
  if (process.env.NODE_ENV === 'production') {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: ['error'],
      errorFormat: 'minimal',
    });
  } else {
    // In development, avoid creating multiple instances
    if (!global.prisma) {
      global.prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
        log: ['query', 'info', 'warn', 'error'],
        errorFormat: 'pretty',
      });
    }
    prisma = global.prisma;
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;