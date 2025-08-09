"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const prisma_1 = require("../../generated/prisma");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const emailService_1 = require("../utils/emailService");
const prisma = new prisma_1.PrismaClient();
class AuthService {
    constructor() {
        this.SALT_ROUNDS = 12;
        this.ACCESS_TOKEN_EXPIRY = '15m';
        this.REFRESH_TOKEN_EXPIRY = '7d';
        this.RESET_TOKEN_EXPIRY_HOURS = 2;
        this.VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
    }
    async register(data) {
        const { email, password, name, phoneNumber } = data;
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            throw new Error('User with this email already exists');
        }
        this.validatePasswordStrength(password);
        const passwordHash = await bcrypt_1.default.hash(password, this.SALT_ROUNDS);
        const verificationToken = (0, uuid_1.v4)();
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                name,
                phoneNumber,
                verificationToken
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
        await emailService_1.emailService.sendVerificationEmail(email, name, verificationToken);
        const tokens = this.generateTokens(user.id, user.email);
        return { user, tokens };
    }
    async login(data) {
        const { email, password } = data;
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
        const isPasswordValid = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new Error('Invalid email or password');
        }
        if (!user.isVerified) {
            throw new Error('Please verify your email before logging in');
        }
        const tokens = this.generateTokens(user.id, user.email);
        const { passwordHash, ...userWithoutPassword } = user;
        return { user: userWithoutPassword, tokens };
    }
    async refreshToken(refreshToken) {
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret');
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId }
            });
            if (!user || !user.isVerified) {
                throw new Error('User not found or not verified');
            }
            return this.generateTokens(user.id, user.email);
        }
        catch (error) {
            throw new Error('Invalid refresh token');
        }
    }
    async verifyEmail(token) {
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
    async requestPasswordReset(email) {
        const user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            return;
        }
        const resetToken = (0, uuid_1.v4)();
        const resetTokenExpiry = new Date();
        resetTokenExpiry.setHours(resetTokenExpiry.getHours() + this.RESET_TOKEN_EXPIRY_HOURS);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken,
                resetTokenExpiry
            }
        });
        await emailService_1.emailService.sendPasswordResetEmail(email, user.name, resetToken);
    }
    async resetPassword(data) {
        const { token, newPassword } = data;
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
        this.validatePasswordStrength(newPassword);
        const passwordHash = await bcrypt_1.default.hash(newPassword, this.SALT_ROUNDS);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                resetToken: null,
                resetTokenExpiry: null
            }
        });
        await emailService_1.emailService.sendPasswordChangedEmail(user.email, user.name);
    }
    async changePassword(userId, currentPassword, newPassword) {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            throw new Error('User not found');
        }
        const isPasswordValid = await bcrypt_1.default.compare(currentPassword, user.passwordHash);
        if (!isPasswordValid) {
            throw new Error('Current password is incorrect');
        }
        this.validatePasswordStrength(newPassword);
        const passwordHash = await bcrypt_1.default.hash(newPassword, this.SALT_ROUNDS);
        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash }
        });
        await emailService_1.emailService.sendPasswordChangedEmail(user.email, user.name);
    }
    async resendVerificationEmail(email) {
        const user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            throw new Error('User not found');
        }
        if (user.isVerified) {
            throw new Error('Email already verified');
        }
        let verificationToken = user.verificationToken;
        if (!verificationToken) {
            verificationToken = (0, uuid_1.v4)();
            await prisma.user.update({
                where: { id: user.id },
                data: { verificationToken }
            });
        }
        await emailService_1.emailService.sendVerificationEmail(email, user.name, verificationToken);
    }
    async getUserProfile(userId) {
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
    async updateUserProfile(userId, data) {
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
    generateTokens(userId, email) {
        const now = Math.floor(Date.now() / 1000);
        const accessTokenExpiry = now + 15 * 60;
        const refreshTokenExpiry = now + 7 * 24 * 60 * 60;
        const accessToken = jsonwebtoken_1.default.sign({ userId, email, type: 'access' }, process.env.JWT_ACCESS_SECRET || 'access-secret', { expiresIn: this.ACCESS_TOKEN_EXPIRY });
        const refreshToken = jsonwebtoken_1.default.sign({ userId, email, type: 'refresh' }, process.env.JWT_REFRESH_SECRET || 'refresh-secret', { expiresIn: this.REFRESH_TOKEN_EXPIRY });
        return {
            accessToken,
            refreshToken,
            accessTokenExpiry,
            refreshTokenExpiry
        };
    }
    validatePasswordStrength(password) {
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
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=authService.js.map