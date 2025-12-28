# Security Guide

Security practices and implementation for Kids Activity Tracker.

## Overview

This document covers security measures for the React Native mobile app and Node.js/Express backend API.

**Last Security Audit**: December 2025

## Security Architecture

### Authentication Flow

```
User Login
    │
    ▼
┌─────────────────┐
│ POST /api/auth  │
│    /login       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Verify Password │
│ (bcrypt)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐       ┌──────────────────┐
│ Generate Tokens │──────>│ Store Session    │
│ - Access (15m)  │       │ (hashed refresh) │
│ - Refresh (7d)  │       └──────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Return to App   │
│ Store in MMKV   │
│ (encrypted)     │
└─────────────────┘
```

## Implementation Status

### Completed

**Backend Security**
- [x] Helmet security headers (HSTS, X-Frame-Options, etc.)
- [x] CORS restricted to approved origins
- [x] Rate limiting on all endpoints
- [x] JWT secret validation (required in production)
- [x] Session management (database-backed)
- [x] Input validation on all endpoints
- [x] Setup endpoints disabled in production

**Frontend Security**
- [x] Device-specific encryption (MMKV with DeviceInfo)
- [x] Secure logger (sanitizes sensitive data)
- [x] No hardcoded fallback tokens
- [x] Automatic token refresh

**Database Security**
- [x] Parameterized queries (Prisma ORM)
- [x] Optimized indexes for performance
- [x] Batch operations to prevent N+1
- [x] Pagination limits (max 100 items)

### Pending

- [ ] Certificate pinning for mobile app
- [ ] CSRF protection for web clients
- [ ] Redis-backed rate limiting (multi-instance)
- [ ] Google Cloud Secret Manager integration

## Backend Security

### Helmet Security Headers

```javascript
app.use(helmet({
  contentSecurityPolicy: false,  // Mobile compatibility
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));
```

**Headers Applied**:
- `Strict-Transport-Security`: HTTPS enforcement
- `X-Content-Type-Options`: nosniff
- `X-Frame-Options`: SAMEORIGIN
- `Cross-Origin-Opener-Policy`: same-origin
- `Cross-Origin-Resource-Policy`: cross-origin

### CORS Configuration

```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8081'
  ],
  credentials: true,
  // Allow React Native requests (no Origin header)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}));
```

### Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| General API | 100 requests | 15 minutes |
| Authentication | 5 requests | 15 minutes |
| Password Reset | 3 requests | 1 hour |
| Email Verification | 5 requests | 15 minutes |

```javascript
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});
```

### JWT Token Security

**Token Configuration**:
- Access token: 15-minute expiry
- Refresh token: 7-day expiry
- Refresh tokens hashed before database storage
- Session table tracks all active sessions

**Validation**:
```javascript
// Server refuses to start without JWT_SECRET in production
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET required in production');
}
```

### Input Validation

Using `express-validator` on all endpoints:

```javascript
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().isLength({ min: 1, max: 100 })
];
```

### Password Security

- Bcrypt hashing with salt rounds = 12
- Minimum 8 character passwords
- Password reset tokens expire in 1 hour
- Old tokens invalidated on password change

## Frontend Security

### MMKV Encrypted Storage

```typescript
import { MMKV } from 'react-native-mmkv';
import DeviceInfo from 'react-native-device-info';

// Device-specific encryption key
const deviceId = await DeviceInfo.getUniqueId();
const storage = new MMKV({
  id: 'kidsactivity-storage',
  encryptionKey: deviceId
});
```

**What's stored**:
- Access tokens
- Refresh tokens
- User preferences
- Cached data

### Secure Logger

Sanitizes sensitive data before logging:

```typescript
const secureLog = (message: string, data: any) => {
  const sanitized = { ...data };
  const sensitive = ['password', 'token', 'secret', 'authorization'];

  sensitive.forEach(key => {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  });

  console.log(message, sanitized);
};
```

### Token Management

```typescript
// Automatic refresh on 401
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const newTokens = await refreshTokens();
      if (newTokens) {
        error.config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        return api.request(error.config);
      }
    }
    throw error;
  }
);
```

## Database Security

### Prisma ORM (SQL Injection Prevention)

All queries use parameterized statements:

```typescript
// Safe - Prisma handles parameterization
const user = await prisma.user.findUnique({
  where: { email: userInput }
});

// Never do this
// const user = await prisma.$queryRaw`SELECT * FROM User WHERE email = ${userInput}`;
```

### Data Access Control

```typescript
// Verify ownership before access
const child = await prisma.child.findFirst({
  where: {
    id: childId,
    userId: authenticatedUserId  // Ownership check
  }
});
```

### Sensitive Data Handling

- Passwords: Hashed with bcrypt, never stored plain
- Tokens: Hashed in database, transmitted only once
- Personal data: Encrypted at rest (Cloud SQL)
- Logs: Sensitive fields redacted

## API Security Best Practices

### Endpoint Protection

```javascript
// Protected route example
router.get('/children',
  authMiddleware,           // Verify JWT
  rateLimiter,              // Apply rate limit
  validateQuery,            // Validate input
  childAuthMiddleware,      // Verify child ownership
  async (req, res) => {
    // Handler
  }
);
```

### Error Handling

Never expose internal details:

```javascript
// Good - generic message
res.status(500).json({ error: 'Internal server error' });

// Bad - exposes internals
res.status(500).json({ error: err.stack });
```

### Request Validation

All endpoints validate:
- Required fields present
- Field types correct
- Field lengths within limits
- Values within allowed ranges

## Security Monitoring

### Logging

- All authentication attempts logged
- Failed login attempts tracked
- Rate limit violations logged
- Error patterns monitored

### Alerts

Set up alerts for:
- Unusual login patterns
- Rate limit spikes
- Authentication failures
- Server errors

## Security Checklist for Developers

### Before Committing

- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs
- [ ] Input validation on new endpoints
- [ ] Ownership checks on data access
- [ ] Rate limiting applied
- [ ] Error messages don't leak internals

### Code Review

- [ ] SQL injection prevention verified
- [ ] XSS prevention for any HTML output
- [ ] CSRF tokens for form submissions (web)
- [ ] Proper auth middleware applied
- [ ] Sensitive operations logged

## Incident Response

### If Credentials Compromised

1. Rotate JWT secrets immediately
2. Invalidate all sessions (delete Session table rows)
3. Force password reset for affected users
4. Audit access logs
5. Notify affected users

### If Data Breach Suspected

1. Isolate affected systems
2. Preserve logs for analysis
3. Assess scope of exposure
4. Notify users per privacy policy
5. Report to authorities if required

---

**Document Version**: 4.0
**Last Updated**: December 2025
