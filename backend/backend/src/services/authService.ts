import { PrismaClient } from '../../generated/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { emailService } from '../utils/emailService';
import { tokenUtils } from '../utils/tokenUtils';

const prisma = new PrismaClient();

interface RegisterData {
  email: string;
  password: string;
  name: string;
  phoneNumber?: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
}

interface ResetPasswordData {
  token: string;
  newPassword: string;
}

export class AuthService {
  private readonly SALT_ROUNDS = 12;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly RESET_TOKEN_EXPIRY_HOURS = 2;
  private readonly VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<{ user: any; tokens: AuthTokens }> {
    const { email, password, name, phoneNumber } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate password strength
    this.validatePasswordStrength(password);

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Generate verification token
    const verificationToken = uuidv4();

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phoneNumber,
        verificationToken,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        isVerified: true,
        createdAt: true
      }
    });

    // Send verification email
    await emailService.sendVerificationEmail(email, name, verificationToken);

    // Generate tokens
    const tokens = this.generateTokens(user.id, user.email);

    return { user, tokens };
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<{ user: any; tokens: AuthTokens }> {
    const { email, password } = data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        isVerified: true,
        phoneNumber: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Check if email is verified
    if (!user.isVerified) {
      throw new Error('Please verify your email before logging in');
    }

    // Generate tokens
    const tokens = this.generateTokens(user.id, user.email);

    // Remove passwordHash from user object
    const { passwordHash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, tokens };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || 'refresh-secret'
      ) as TokenPayload;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user || !user.isVerified) {
        throw new Error('User not found or not verified');
      }

      // Generate new tokens
      return this.generateTokens(user.id, user.email);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { verificationToken: token }
    });

    if (!user) {
      throw new Error('Invalid verification token');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null
      }
    });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // Don't reveal whether user exists
      return;
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + this.RESET_TOKEN_EXPIRY_HOURS);

    // Save reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });

    // Send reset email
    await emailService.sendPasswordResetEmail(email, user.name, resetToken);
  }

  /**
   * Reset password
   */
  async resetPassword(data: ResetPasswordData): Promise<void> {
    const { token, newPassword } = data;

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    // Validate password strength
    this.validatePasswordStrength(newPassword);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    // Send confirmation email
    await emailService.sendPasswordChangedEmail(user.email, user.name);
  }

  /**
   * Change password (for authenticated users)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password strength
    this.validatePasswordStrength(newPassword);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    // Send confirmation email
    await emailService.sendPasswordChangedEmail(user.email, user.name);
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.isVerified) {
      throw new Error('Email already verified');
    }

    // Generate new verification token if needed
    let verificationToken = user.verificationToken;
    if (!verificationToken) {
      verificationToken = uuidv4();
      await prisma.user.update({
        where: { id: user.id },
        data: { verificationToken }
      });
    }

    // Send verification email
    await emailService.sendVerificationEmail(email, user.name, verificationToken);
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        isVerified: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
        children: {
          select: {
            id: true,
            name: true,
            dateOfBirth: true,
            gender: true,
            avatarUrl: true,
            interests: true,
            isActive: true
          }
        },
        _count: {
          select: {
            favorites: true,
            sharedWithMe: true,
            myShares: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, data: { name?: string; phoneNumber?: string; preferences?: any }): Promise<any> {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        preferences: true,
        updatedAt: true
      }
    });

    return user;
  }

  /**
   * Generate JWT tokens
   */
  private generateTokens(userId: string, email: string): AuthTokens {
    const now = Math.floor(Date.now() / 1000);
    
    // Calculate expiry times
    const accessTokenExpiry = now + 15 * 60; // 15 minutes
    const refreshTokenExpiry = now + 7 * 24 * 60 * 60; // 7 days
    
    const accessToken = jwt.sign(
      { userId, email, type: 'access' },
      process.env.JWT_ACCESS_SECRET || 'access-secret',
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId, email, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );

    return { 
      accessToken, 
      refreshToken,
      accessTokenExpiry,
      refreshTokenExpiry
    };
  }

  /**
   * Validate password strength
   */
  private validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }
}

export const authService = new AuthService();