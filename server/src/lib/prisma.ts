import { PrismaClient } from '../../generated/prisma';

/**
 * Shared PrismaClient singleton for the entire application.
 *
 * This module ensures only ONE PrismaClient instance is used across the application,
 * which is critical for:
 * - Proper connection pooling (connection_limit is per-client)
 * - Preventing connection exhaustion in serverless environments
 * - Efficient database resource usage
 *
 * Usage:
 *   import { prisma } from '../lib/prisma';
 *   const users = await prisma.user.findMany();
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// In development, we want to reuse the client across hot reloads
// In production, we create a single instance
// Note: For production, set connection_limit in DATABASE_URL (e.g., ?connection_limit=10)
export const prisma: PrismaClient =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    // Increase connection pool timeout for Cloud Run cold starts
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// Default export for convenience
export default prisma;
