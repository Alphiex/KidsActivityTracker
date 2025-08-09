"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authService_1 = require("../services/authService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/register', auth_1.authLimiter, (0, auth_1.logActivity)('register'), async (req, res) => {
    try {
        const { email, password, name, phoneNumber } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'Email, password, and name are required'
            });
        }
        const result = await authService_1.authService.register({
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
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Registration failed'
        });
    }
});
router.post('/login', auth_1.authLimiter, (0, auth_1.logActivity)('login'), async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }
        const result = await authService_1.authService.login({ email, password });
        res.json({
            success: true,
            message: 'Login successful',
            user: result.user,
            tokens: result.tokens
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(401).json({
            success: false,
            error: error.message || 'Login failed'
        });
    }
});
router.post('/refresh', (0, auth_1.logActivity)('refresh-token'), async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token is required'
            });
        }
        const tokens = await authService_1.authService.refreshToken(refreshToken);
        res.json({
            success: true,
            tokens
        });
    }
    catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({
            success: false,
            error: error.message || 'Token refresh failed'
        });
    }
});
router.post('/logout', auth_1.verifyToken, (0, auth_1.logActivity)('logout'), async (req, res) => {
    res.json({
        success: true,
        message: 'Logout successful'
    });
});
router.get('/verify-email', auth_1.emailVerificationLimiter, (0, auth_1.logActivity)('verify-email'), async (req, res) => {
    try {
        const { token } = req.query;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Verification token is required'
            });
        }
        await authService_1.authService.verifyEmail(token);
        res.json({
            success: true,
            message: 'Email verified successfully'
        });
    }
    catch (error) {
        console.error('Email verification error:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Email verification failed'
        });
    }
});
router.post('/resend-verification', auth_1.emailVerificationLimiter, (0, auth_1.logActivity)('resend-verification'), async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }
        await authService_1.authService.resendVerificationEmail(email);
        res.json({
            success: true,
            message: 'Verification email sent'
        });
    }
    catch (error) {
        console.error('Resend verification error:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Failed to resend verification email'
        });
    }
});
router.post('/forgot-password', auth_1.passwordResetLimiter, (0, auth_1.logActivity)('forgot-password'), async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }
        await authService_1.authService.requestPasswordReset(email);
        res.json({
            success: true,
            message: 'If an account exists with this email, a password reset link has been sent'
        });
    }
    catch (error) {
        console.error('Password reset request error:', error);
        res.json({
            success: true,
            message: 'If an account exists with this email, a password reset link has been sent'
        });
    }
});
router.post('/reset-password', auth_1.passwordResetLimiter, (0, auth_1.logActivity)('reset-password'), async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Token and new password are required'
            });
        }
        await authService_1.authService.resetPassword({ token, newPassword });
        res.json({
            success: true,
            message: 'Password reset successful'
        });
    }
    catch (error) {
        console.error('Password reset error:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Password reset failed'
        });
    }
});
router.post('/change-password', auth_1.verifyToken, auth_1.authLimiter, (0, auth_1.logActivity)('change-password'), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required'
            });
        }
        await authService_1.authService.changePassword(req.user.id, currentPassword, newPassword);
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    }
    catch (error) {
        console.error('Password change error:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Password change failed'
        });
    }
});
router.get('/profile', auth_1.verifyToken, (0, auth_1.logActivity)('get-profile'), async (req, res) => {
    try {
        const profile = await authService_1.authService.getUserProfile(req.user.id);
        res.json({
            success: true,
            profile
        });
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Failed to get profile'
        });
    }
});
router.put('/profile', auth_1.verifyToken, (0, auth_1.logActivity)('update-profile'), async (req, res) => {
    try {
        const { name, phoneNumber, preferences } = req.body;
        const profile = await authService_1.authService.updateUserProfile(req.user.id, {
            name,
            phoneNumber,
            preferences
        });
        res.json({
            success: true,
            message: 'Profile updated successfully',
            profile
        });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Failed to update profile'
        });
    }
});
router.get('/check', auth_1.verifyToken, async (req, res) => {
    res.json({
        success: true,
        authenticated: true,
        user: req.user
    });
});
exports.default = router;
//# sourceMappingURL=auth.js.map