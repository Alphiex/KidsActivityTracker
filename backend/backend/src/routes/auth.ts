import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { 
  verifyToken, 
  authLimiter, 
  passwordResetLimiter,
  emailVerificationLimiter,
  logActivity
} from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authLimiter, logActivity('register'), async (req: Request, res: Response) => {
  try {
    const { email, password, name, phoneNumber } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required'
      });
    }

    // Register user
    const result = await authService.register({
      email,
      password,
      name,
      phoneNumber
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      user: result.user,
      tokens: result.tokens
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Registration failed'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', authLimiter, logActivity('login'), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Login user
    const result = await authService.login({ email, password });

    res.json({
      success: true,
      message: 'Login successful',
      user: result.user,
      tokens: result.tokens
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', logActivity('refresh-token'), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    // Refresh tokens
    const tokens = await authService.refreshToken(refreshToken);

    res.json({
      success: true,
      tokens
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Token refresh failed'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout', verifyToken, logActivity('logout'), async (req: Request, res: Response) => {
  // In a stateless JWT system, logout is handled client-side
  // Here we just acknowledge the logout
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.get('/verify-email', emailVerificationLimiter, logActivity('verify-email'), async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required'
      });
    }

    // Verify email
    await authService.verifyEmail(token);

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error: any) {
    console.error('Email verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Email verification failed'
    });
  }
});

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend verification email
 * @access  Public
 */
router.post('/resend-verification', emailVerificationLimiter, logActivity('resend-verification'), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Resend verification email
    await authService.resendVerificationEmail(email);

    res.json({
      success: true,
      message: 'Verification email sent'
    });
  } catch (error: any) {
    console.error('Resend verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to resend verification email'
    });
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', passwordResetLimiter, logActivity('forgot-password'), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Request password reset
    await authService.requestPasswordReset(email);

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent'
    });
  } catch (error: any) {
    console.error('Password reset request error:', error);
    // Still return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent'
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', passwordResetLimiter, logActivity('reset-password'), async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required'
      });
    }

    // Reset password
    await authService.resetPassword({ token, newPassword });

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error: any) {
    console.error('Password reset error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Password reset failed'
    });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private
 */
router.post('/change-password', verifyToken, authLimiter, logActivity('change-password'), async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    // Change password
    await authService.changePassword(req.user!.id, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error: any) {
    console.error('Password change error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Password change failed'
    });
  }
});

/**
 * @route   GET /api/auth/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', verifyToken, logActivity('get-profile'), async (req: Request, res: Response) => {
  try {
    const profile = await authService.getUserProfile(req.user!.id);

    res.json({
      success: true,
      profile
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get profile'
    });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', verifyToken, logActivity('update-profile'), async (req: Request, res: Response) => {
  try {
    const { name, phoneNumber, preferences } = req.body;

    // Update profile
    const profile = await authService.updateUserProfile(req.user!.id, {
      name,
      phoneNumber,
      preferences
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update profile'
    });
  }
});

/**
 * @route   GET /api/auth/check
 * @desc    Check authentication status
 * @access  Private
 */
router.get('/check', verifyToken, async (req: Request, res: Response) => {
  res.json({
    success: true,
    authenticated: true,
    user: req.user
  });
});

export default router;