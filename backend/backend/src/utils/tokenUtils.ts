import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

export class TokenUtils {
  /**
   * Generate a secure random token
   */
  generateRandomToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate JWT token
   */
  generateJWT(payload: TokenPayload, secret: string, expiresIn: string): string {
    return jwt.sign(payload, secret, { expiresIn } as any);
  }

  /**
   * Verify JWT token
   */
  verifyJWT(token: string, secret: string): DecodedToken {
    try {
      return jwt.verify(token, secret) as DecodedToken;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Decode JWT token without verification
   */
  decodeJWT(token: string): DecodedToken | null {
    try {
      return jwt.decode(token) as DecodedToken;
    } catch {
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const decoded = this.decodeJWT(token);
    if (!decoded || !decoded.exp) {
      return true;
    }
    return Date.now() >= decoded.exp * 1000;
  }

  /**
   * Get token expiry date
   */
  getTokenExpiry(token: string): Date | null {
    const decoded = this.decodeJWT(token);
    if (!decoded || !decoded.exp) {
      return null;
    }
    return new Date(decoded.exp * 1000);
  }

  /**
   * Generate secure session ID
   */
  generateSessionId(): string {
    return this.generateRandomToken(32);
  }

  /**
   * Hash token for storage
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(): string {
    return this.generateRandomToken(32);
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(token: string, storedToken: string): boolean {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(storedToken)
    );
  }

  /**
   * Create secure cookie options
   */
  getSecureCookieOptions(maxAge?: number): any {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: maxAge || 7 * 24 * 60 * 60 * 1000, // 7 days default
      path: '/'
    };
  }

  /**
   * Generate API key
   */
  generateAPIKey(): string {
    const prefix = 'kat_'; // Kids Activity Tracker prefix
    const key = this.generateRandomToken(32);
    return `${prefix}${key}`;
  }

  /**
   * Validate API key format
   */
  validateAPIKeyFormat(apiKey: string): boolean {
    return /^kat_[a-f0-9]{64}$/.test(apiKey);
  }
}

export const tokenUtils = new TokenUtils();