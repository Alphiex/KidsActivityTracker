# Kids Activity Tracker - Security Guide

## Overview

This document outlines the security measures implemented in the Kids Activity Tracker application, covering both the React Native mobile app and the Node.js/Express backend API.

## Implementation Status

**Last security audit**: December 2024

### Completed Security Improvements (December 2024)

#### Backend Security
- [x] **Helmet Security Headers** - Full HTTP security headers enabled with mobile-compatible configuration
  - Strict-Transport-Security (HSTS)
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: SAMEORIGIN
  - Cross-Origin-Opener-Policy: same-origin
  - Cross-Origin-Resource-Policy: cross-origin
- [x] **CORS Configuration** - Restricted to approved origins (localhost:3000, localhost:3001, localhost:8081)
- [x] **Mobile App Support** - Allows requests without Origin header (required for React Native)
- [x] **Rate Limiting** - Applied to all API endpoints (100 req/15min general, 5 req/15min auth)
- [x] **JWT Secret Validation** - Server refuses to start if JWT_SECRET is missing in production
- [x] **Session Management** - Database-backed sessions with Session and TrustedDevice tables
- [x] **Input Validation** - Middleware applied to auth endpoints
- [x] **Setup Endpoint Protection** - Disabled in production

#### Frontend Security
- [x] **Device-Specific Encryption** - MMKV encryption key derived from device identifiers (DeviceInfo)
- [x] **Secure Logger** - Utility that sanitizes sensitive data before logging
- [x] **Token Security** - No hardcoded fallback tokens
- [x] **Automatic Token Refresh** - Handles expired tokens transparently

#### Database Security
- [x] **Optimized Indexes** - Added indexes on frequently queried columns for performance
- [x] **Batch Operations** - N+1 query prevention with batch child verification
- [x] **Pagination** - Added to prevent unbounded queries (max 100 items/page)

### Pending Security Improvements
- [ ] Certificate pinning for mobile app
- [ ] CSRF protection for web clients
- [ ] Redis-backed rate limiting for multi-instance deployments
- [ ] Google Cloud Secret Manager for JWT secrets

---

## Security Architecture

### Authentication Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Mobile App    │────>│   API Server     │────>│   PostgreSQL    │
│  (React Native) │<────│   (Express)      │<────│   Database      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │
        │                        │
   MMKV Storage             JWT Tokens
   (Encrypted)              Session Table
```

### Token Management

**Access Token**:
- Short-lived (15 minutes)
- Used for API authentication
- Stored in encrypted MMKV storage

**Refresh Token**:
- Long-lived (7 days)
- Used to obtain new access tokens
- Stored in encrypted MMKV storage
- Hash stored in database Session table

### MMKV Encryption

The mobile app uses device-specific encryption keys:

```typescript
const generateEncryptionKey = (): string => {
  const deviceId = DeviceInfo.getDeviceId();     // e.g., "iPhone14,2"
  const bundleId = DeviceInfo.getBundleId();     // e.g., "com.kidsactivitytracker"
  const buildNumber = DeviceInfo.getBuildNumber();
  return `${bundleId}-${deviceId}-${buildNumber}-v1`;
};
```

This provides:
- Unique key per device
- Key changes with app version
- No hardcoded secrets in source code

---

## API Security Configuration

### Helmet Configuration

```typescript
app.use(helmet({
  contentSecurityPolicy: false,                    // Disabled for mobile API
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
```

**Headers Applied**:
| Header | Value | Purpose |
|--------|-------|---------|
| Strict-Transport-Security | max-age=15552000; includeSubDomains | Force HTTPS |
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-Frame-Options | SAMEORIGIN | Prevent clickjacking |
| Cross-Origin-Opener-Policy | same-origin | Isolate browsing context |

### CORS Configuration

```typescript
const ALLOWED_WEB_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8081',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow mobile apps (no origin header)
    if (!origin) return callback(null, true);
    // Allow approved web origins
    if (ALLOWED_WEB_ORIGINS.includes(origin)) return callback(null, true);
    // Allow all in development
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    // Reject in production
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
```

### Rate Limiting

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| General API | 100 requests | 15 minutes |
| Authentication | 5 requests | 15 minutes |
| Password Reset | 3 requests | 1 hour |

---

## Secure Logging

The `secureLogger` utility sanitizes sensitive data before logging:

```typescript
// src/utils/secureLogger.ts
const SENSITIVE_KEYS = [
  'password', 'token', 'accessToken', 'refreshToken',
  'secret', 'key', 'authorization', 'cookie', 'session'
];

const sanitize = (data: any): any => {
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };
    for (const key of Object.keys(sanitized)) {
      if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  }
  return data;
};
```

**Usage**:
```typescript
import { secureLog, secureError } from '../utils/secureLogger';

// Safe - password will be redacted
secureLog('Login attempt:', { email, password });
// Output: Login attempt: { email: "user@example.com", password: "[REDACTED]" }
```

---

## JWT Secret Requirements

The server validates JWT secrets at startup:

```typescript
// Server startup validation
if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT secrets must be configured');
}
```

**Production Requirements**:
- JWT_ACCESS_SECRET: Required, minimum 32 characters
- JWT_REFRESH_SECRET: Required, minimum 32 characters
- No hardcoded fallback values

**Generate Strong Secrets**:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Database Security

### New Indexes (December 2024)

```prisma
// ChildActivity indexes
@@index([status])
@@index([completedAt])
@@index([registeredAt])
@@index([rating])
@@index([childId, scheduledDate])

// User indexes
@@index([verificationToken])
@@index([resetToken])
@@index([isVerified])

// Invitation indexes
@@index([recipientUserId])
```

### Batch Child Verification

Prevents N+1 queries when verifying ownership of multiple children:

```typescript
// server/src/services/childrenService.ts
async verifyMultipleChildOwnership(
  childIds: string[],
  userId: string
): Promise<Record<string, boolean>> {
  // Single query instead of N queries
  const ownedChildren = await prisma.child.findMany({
    where: { id: { in: childIds }, userId },
    select: { id: true }
  });
  // Build ownership map
  const ownedSet = new Set(ownedChildren.map(c => c.id));
  const result: Record<string, boolean> = {};
  for (const childId of childIds) {
    result[childId] = ownedSet.has(childId);
  }
  return result;
}
```

### Pagination Limits

```typescript
// Maximum 100 items per page
const limit = Math.min(100, Math.max(1, filters.limit || 20));
```

---

## Security Testing Checklist

- [x] Security headers verification (curl test)
- [x] CORS configuration (allowed/blocked origins)
- [x] Rate limiting effectiveness
- [x] Token validation (invalid token rejection)
- [x] Mobile app authentication flow
- [ ] Penetration testing
- [ ] SQL injection testing
- [ ] XSS vulnerability testing

---

## Remaining Security Improvements

### High Priority
1. **Certificate Pinning** - Prevent MITM attacks on mobile
2. **Google Cloud Secret Manager** - Store JWT secrets securely

### Medium Priority
3. **Redis Rate Limiting** - For multi-instance deployments
4. **CSRF Protection** - For web client support
5. **Biometric Authentication** - TouchID/FaceID support

### Low Priority
6. **Security Monitoring** - Sentry integration
7. **Data Encryption at Rest** - Field-level encryption for PII

---

## Compliance Considerations

### Data Protection (GDPR/CCPA)
- User data stored with encryption at rest (PostgreSQL)
- Secure token storage on mobile devices
- Account deletion support (Apple App Store requirement)

### Children's Privacy (COPPA)
- Child profiles linked to parent accounts
- Parental consent through registration
- Minimal data collection

---

## Security Resources

- **OWASP Mobile Top 10**: https://owasp.org/www-project-mobile-top-10/
- **React Native Security**: https://reactnative.dev/docs/security
- **Node.js Security**: https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices
- **Helmet.js**: https://helmetjs.github.io/

---

**Document Version**: 3.0
**Last Updated**: December 2024
**Next Review**: March 2025
