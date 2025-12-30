// CommonJS wrapper for shared Prisma client
// This ensures JS files in utils folder can access the shared Prisma instance

const { PrismaClient } = require('../generated/prisma');

// Create singleton instance
const prisma = new PrismaClient();

module.exports = { prisma };
