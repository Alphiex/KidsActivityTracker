/**
 * User Fixtures
 * Extended user data for testing various scenarios
 */

export const regularUser = {
  id: 'user-regular-1',
  email: 'regular@example.com',
  name: 'Regular User',
  passwordHash: '$2b$10$hashedpassword',
  isVerified: true,
  verificationToken: null,
  resetToken: null,
  resetTokenExpiry: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

export const premiumUser = {
  id: 'user-premium-1',
  email: 'premium@example.com',
  name: 'Premium User',
  passwordHash: '$2b$10$hashedpassword',
  isVerified: true,
  verificationToken: null,
  resetToken: null,
  resetTokenExpiry: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  subscription: {
    tier: 'premium',
    status: 'active',
    expiresAt: new Date('2025-12-31T23:59:59.000Z'),
  },
};

export const unverifiedUser = {
  id: 'user-unverified-1',
  email: 'unverified@example.com',
  name: 'Unverified User',
  passwordHash: '$2b$10$hashedpassword',
  isVerified: false,
  verificationToken: 'verification-token-abc123',
  resetToken: null,
  resetTokenExpiry: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

export const userWithResetToken = {
  id: 'user-reset-1',
  email: 'reset@example.com',
  name: 'Reset User',
  passwordHash: '$2b$10$hashedpassword',
  isVerified: true,
  verificationToken: null,
  resetToken: 'reset-token-xyz789',
  resetTokenExpiry: new Date(Date.now() + 3600000), // 1 hour from now
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

export const userWithExpiredResetToken = {
  id: 'user-expired-reset-1',
  email: 'expiredreset@example.com',
  name: 'Expired Reset User',
  passwordHash: '$2b$10$hashedpassword',
  isVerified: true,
  verificationToken: null,
  resetToken: 'expired-reset-token',
  resetTokenExpiry: new Date(Date.now() - 3600000), // 1 hour ago
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

export const adminUser = {
  id: 'user-admin-1',
  email: 'admin@example.com',
  name: 'Admin User',
  passwordHash: '$2b$10$hashedpassword',
  isVerified: true,
  verificationToken: null,
  resetToken: null,
  resetTokenExpiry: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  adminUser: {
    id: 'admin-1',
    userId: 'user-admin-1',
    role: 'SUPER_ADMIN',
  },
};

export const vendorUser = {
  id: 'user-vendor-1',
  email: 'vendor@example.com',
  name: 'Vendor User',
  passwordHash: '$2b$10$hashedpassword',
  isVerified: true,
  verificationToken: null,
  resetToken: null,
  resetTokenExpiry: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  vendorUser: {
    id: 'vendor-1',
    userId: 'user-vendor-1',
    providerId: 'provider-1',
    role: 'ADMIN',
  },
};

// User with children
export const userWithChildren = {
  ...regularUser,
  id: 'user-with-children-1',
  email: 'parent@example.com',
  children: [
    {
      id: 'child-1',
      name: 'Child One',
      dateOfBirth: new Date('2018-06-15'),
      interests: ['swimming', 'art'],
    },
    {
      id: 'child-2',
      name: 'Child Two',
      dateOfBirth: new Date('2016-03-22'),
      interests: ['soccer', 'music'],
    },
  ],
};

// All test users
export const allUsers = [
  regularUser,
  premiumUser,
  unverifiedUser,
  userWithResetToken,
  userWithExpiredResetToken,
  adminUser,
  vendorUser,
  userWithChildren,
];
