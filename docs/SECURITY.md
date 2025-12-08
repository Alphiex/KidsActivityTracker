# Kids Activity Tracker - Security Guide

## Overview

This document outlines the security measures implemented in the Kids Activity Tracker application, covering both the React Native mobile app and the Node.js/Express backend API.

## Implementation Status

**Last security audit**: December 2024

### Completed Security Fixes (December 2024)
- Rate limiting re-enabled on all API endpoints (100 req/15min general, 5 req/15min auth)
- Setup endpoint protected in production (disabled by default)
- Security headers restored (Helmet middleware)
- Session management implemented with database storage (Session/TrustedDevice tables)
- Mock data fallbacks removed from production code
- Debug logging removed from production
- Input validation middleware applied to auth endpoints
- CORS properly configured for production domains

### Pending Security Improvements
- Hardcoded MMKV encryption key (see item #1 below)
- Development mode auth bypass cleanup (see item #2)
- CSRF protection not yet applied to all routes (see item #7)
- Certificate pinning not implemented (see item #9)

---

## 🔴 CRITICAL PRIORITY - Requires Attention

### 1. **Hardcoded Encryption Key**
**Location**: `src/utils/secureStorage.ts:7`

**Issue**: The MMKV encryption key is hardcoded as a plain string literal:
```typescript
encryptionKey: 'kids-activity-tracker-secure-key'
```

**Risk**: 
- Anyone with access to the source code (including decompiled APK/IPA) can decrypt all stored sensitive data
- Tokens, user data, and preferences are vulnerable to extraction
- Violates security best practices and compliance requirements (GDPR, CCPA)

**Solution**:
```typescript
import * as Keychain from 'react-native-keychain';
import { MMKV } from 'react-native-mmkv';

// Generate or retrieve encryption key from secure keychain
const getOrCreateEncryptionKey = async (): Promise<string> => {
  try {
    const credentials = await Keychain.getGenericPassword({ service: 'mmkv-encryption' });
    if (credentials) {
      return credentials.password;
    }
    
    // Generate new key using crypto
    const key = await generateSecureRandomKey(32);
    await Keychain.setGenericPassword('mmkv-key', key, { service: 'mmkv-encryption' });
    return key;
  } catch (error) {
    throw new Error('Failed to initialize secure storage');
  }
};

const generateSecureRandomKey = async (length: number): Promise<string> => {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('base64');
};
```

**Dependencies to Add**:
```bash
npm install react-native-keychain
cd ios && pod install
```

---

### 2. **Development Mode Authentication Bypass**
**Location**: `src/services/authService.ts:146-182`

**Issue**: Mock authentication in development mode accepts hardcoded test credentials without proper validation

**Risk**:
- If `__DEV__` flag is accidentally left enabled in production build
- Creates attack vector for bypassing authentication
- Mock tokens (`dev_access_token_`, `dev_refresh_token_`) could be exploited

**Solution**:
1. **Remove mock auth from production builds**:
```typescript
// Move to separate development config file
// authService.development.ts
if (!__RELEASE__ && __DEV__) {
  // Mock auth code here
}
```

2. **Add build-time checks**:
```javascript
// babel.config.js
module.exports = {
  plugins: [
    ['transform-remove-console', { exclude: ['error', 'warn'] }],
    ['transform-define', {
      __DEV__: process.env.NODE_ENV !== 'production',
      __RELEASE__: process.env.NODE_ENV === 'production'
    }]
  ]
};
```

3. **Add runtime validation**:
```typescript
// At app startup
if (process.env.NODE_ENV === 'production' && __DEV__) {
  throw new Error('CRITICAL: Development mode enabled in production build');
}
```

---

### 3. **Rate Limiting** ✅ IMPLEMENTED
**Location**: `server/src/middleware/auth.ts`

**Status**: Rate limiting has been re-enabled with the following configuration:
- General API: 100 requests per 15 minutes
- Authentication: 5 requests per 15 minutes
- Password reset: 3 requests per hour

**Current Implementation**:
```typescript
import rateLimit from 'express-rate-limit';

// General API rate limit
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoints - strict limits
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
});
```

**Future Enhancement**: Consider Redis-backed rate limiting for multi-instance deployments.

---

## 🟠 HIGH PRIORITY - Implement When Needed

### 4. **Sensitive Data Logging**
**Location**: Multiple files logging tokens and credentials

**Issues Found**:
- `src/services/authService.ts:64-68`: Logs access token prefix
- `src/services/authService.ts:186`: Logs email in plain text
- `src/store/slices/authSlice.ts`: May log sensitive state data

**Risk**:
- Tokens visible in device logs
- PII exposure in crash reports
- Log aggregation services could capture sensitive data

**Solution**:
```typescript
// Create secure logger utility
class SecureLogger {
  static log(message: string, data?: any) {
    if (__DEV__) {
      // In dev, show limited data
      const sanitized = this.sanitize(data);
      console.log(message, sanitized);
    }
    // In production, use proper logging service with PII redaction
  }

  static sanitize(data: any): any {
    if (!data) return data;
    
    const sanitized = { ...data };
    const sensitiveKeys = ['password', 'token', 'accessToken', 'refreshToken', 'secret', 'key'];
    
    for (const key in sanitized) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
}

// Usage
SecureLogger.log('Login attempt:', { email, password }); 
// Output: { email: 'user@example.com', password: '[REDACTED]' }
```

---

### 5. **JWT Secret Keys Using Default Values**
**Location**: `server/.env.example`

**Issue**: Example JWT secrets are weak and may be used in production:
```
JWT_ACCESS_SECRET=your-super-secret-access-token-key-change-this
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key-change-this
```

**Risk**:
- Weak secrets can be brute-forced
- Default secrets may be used in production
- Token forgery possible with compromised secrets

**Solution**:

1. **Generate Strong Secrets**:
```bash
# Generate cryptographically secure secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

2. **Add Secret Validation**:
```typescript
// At server startup
const validateSecrets = () => {
  const minLength = 32;
  const secrets = [
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_REFRESH_SECRET,
    process.env.SESSION_SECRET
  ];

  const weakSecrets = ['change-this', 'your-super-secret', 'secret', 'password'];
  
  for (const secret of secrets) {
    if (!secret || secret.length < minLength) {
      throw new Error('CRITICAL: JWT secrets must be at least 32 characters');
    }
    
    if (weakSecrets.some(weak => secret.toLowerCase().includes(weak))) {
      throw new Error('CRITICAL: Default JWT secrets detected in production');
    }
  }
};

// Call at startup
if (process.env.NODE_ENV === 'production') {
  validateSecrets();
}
```

3. **Use Secret Management**:
```bash
# Google Cloud Secret Manager
gcloud secrets create jwt-access-secret --data-file=-
gcloud secrets create jwt-refresh-secret --data-file=-

# Update Cloud Run to use secrets
gcloud run services update kids-activity-api \
  --update-secrets=JWT_ACCESS_SECRET=jwt-access-secret:latest \
  --update-secrets=JWT_REFRESH_SECRET=jwt-refresh-secret:latest
```

---

### 6. **Missing Input Validation and Sanitization**
**Location**: API endpoints lacking validation

**Issues**:
- No input validation middleware applied consistently
- `validateBody` middleware defined but not used everywhere
- Potential for SQL injection, XSS, and injection attacks

**Solution**:

1. **Implement Comprehensive Validation**:
```typescript
import Joi from 'joi';
import { sanitizeHtml } from './security/sanitize';

// Define validation schemas
const schemas = {
  register: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().min(8).max(128).required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
    name: Joi.string().min(1).max(100).required(),
    phoneNumber: Joi.string().pattern(/^\+?[\d\s-()]+$/).optional(),
  }),
  
  login: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().required().max(128),
  }),
  
  activitySearch: Joi.object({
    query: Joi.string().max(200).optional(),
    activityTypes: Joi.array().items(Joi.string().max(50)).max(20).optional(),
    locations: Joi.array().items(Joi.string().max(100)).max(50).optional(),
    ageMin: Joi.number().min(0).max(18).optional(),
    ageMax: Joi.number().min(0).max(18).optional(),
    costMin: Joi.number().min(0).max(10000).optional(),
    costMax: Joi.number().min(0).max(10000).optional(),
    limit: Joi.number().min(1).max(100).default(20),
    offset: Joi.number().min(0).default(0),
  }),
};

// Validation middleware
export const validate = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }
    
    // Sanitize string inputs
    req.body = sanitizeInputs(value);
    next();
  };
};

// Apply to routes
router.post('/api/auth/register', 
  validate(schemas.register),
  authController.register
);

router.get('/api/v1/activities',
  validate(schemas.activitySearch),
  activitiesController.search
);
```

2. **Add HTML Sanitization**:
```typescript
import DOMPurify from 'isomorphic-dompurify';

export const sanitizeInputs = (data: any): any => {
  if (typeof data === 'string') {
    return DOMPurify.sanitize(data, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInputs);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const key in data) {
      sanitized[key] = sanitizeInputs(data[key]);
    }
    return sanitized;
  }
  
  return data;
};
```

---

### 7. **CSRF Protection Not Implemented**
**Location**: `server/src/middleware/auth.ts`

**Issue**: CSRF middleware defined but not applied to routes

**Risk**:
- Cross-Site Request Forgery attacks
- Unauthorized actions on behalf of authenticated users
- Account takeover scenarios

**Solution**:

1. **Implement CSRF Protection**:
```typescript
import csrf from 'csurf';

// Create CSRF middleware
const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  }
});

// Add CSRF token endpoint
router.get('/api/auth/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Apply to state-changing routes
router.post('/api/auth/login', csrfProtection, authController.login);
router.post('/api/auth/register', csrfProtection, authController.register);
router.post('/api/v1/favorites', csrfProtection, favoritesController.add);
```

2. **Update Client**:
```typescript
// Fetch CSRF token on app startup
const fetchCsrfToken = async (): Promise<string> => {
  const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/csrf-token`);
  const data = await response.json();
  return data.csrfToken;
};

// Include in requests
const csrfToken = await fetchCsrfToken();
axios.post('/api/auth/login', credentials, {
  headers: {
    'X-CSRF-Token': csrfToken,
  },
});
```

---

## 🟡 MEDIUM PRIORITY - Implement Within 1 Month

### 8. **Weak Password Requirements**
**Current**: No client-side password validation

**Recommendation**:
```typescript
export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain lowercase letters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letters');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain numbers');
  }
  if (!/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain special characters');
  }
  
  // Check against common passwords
  if (isCommonPassword(password)) {
    errors.push('Password is too common');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};
```

---

### 9. **No Certificate Pinning**
**Risk**: Man-in-the-middle attacks

**Solution**:
```typescript
import { fetch } from 'react-native-ssl-pinning';

const API_CERTIFICATES = {
  'kids-activity-api-205843686007.us-central1.run.app': {
    'sha256': ['CERTIFICATE_SHA256_HASH_HERE'],
  },
};

// Use pinned fetch
const response = await fetch(url, {
  method: 'POST',
  sslPinning: {
    certs: ['certificate'],
  },
});
```

---

### 10. **Missing Security Headers**
**Location**: Backend middleware

**Add**:
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'same-origin' },
  noSniff: true,
  xssFilter: true,
}));
```

---

### 11. **Token Expiry Handling**
**Issue**: Client doesn't validate token expiry before using

**Solution**:
```typescript
export const isAccessTokenValid = async (): Promise<boolean> => {
  const tokens = await getTokens();
  if (!tokens) return false;
  
  const expiryTime = getTokenExpiryTime(tokens.accessTokenExpiry);
  const buffer = 5 * 60 * 1000; // 5 minute buffer
  
  return expiryTime > buffer;
};

// Use before making requests
if (!await isAccessTokenValid()) {
  await refreshTokens();
}
```

---

### 12. **No Request/Response Encryption**
**Recommendation**: Implement E2EE for sensitive endpoints

```typescript
import crypto from 'crypto';

// Client-side encryption for sensitive data
const encryptSensitiveData = (data: any, publicKey: string): string => {
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(JSON.stringify(data))
  );
  return encrypted.toString('base64');
};

// Use for sensitive operations
const encryptedData = encryptSensitiveData({ password }, serverPublicKey);
await api.post('/auth/change-password', { data: encryptedData });
```

---

## 🟢 LOW PRIORITY - Best Practices

### 13. **Add Security Monitoring**
- Implement Sentry for error tracking
- Add logging for failed auth attempts
- Monitor rate limit violations
- Alert on suspicious activity patterns

### 14. **Implement Biometric Authentication**
```typescript
import TouchID from 'react-native-touch-id';

const authenticateWithBiometrics = async (): Promise<boolean> => {
  try {
    await TouchID.authenticate('Log in to Kids Activity Tracker');
    return true;
  } catch {
    return false;
  }
};
```

### 15. **Add Data Encryption at Rest**
- Encrypt database backups
- Use Google Cloud KMS for key management
- Implement field-level encryption for PII

---

## Implementation Roadmap

### Completed (December 2024)
- [x] Re-enable rate limiting (in-memory)
- [x] Add security headers with Helmet
- [x] Implement session management with database storage
- [x] Remove mock data from production
- [x] Protect setup endpoint in production
- [x] Remove debug logging from production

### Next Priority
- [ ] Replace hardcoded MMKV encryption key
- [ ] Remove development auth bypass from builds
- [ ] Implement proper JWT secret management with Cloud Secret Manager
- [ ] Add comprehensive input validation to all endpoints
- [ ] Implement CSRF protection

### Future Enhancements
- [ ] Redis-backed rate limiting for multi-instance
- [ ] Certificate pinning for mobile app
- [ ] Biometric authentication
- [ ] Security monitoring and alerting
- [ ] Data encryption at rest

---

## Security Testing Checklist

- [ ] Penetration testing for authentication
- [ ] API security scanning (OWASP ZAP)
- [ ] Static code analysis (ESLint security rules)
- [ ] Dependency vulnerability scanning (npm audit, Snyk)
- [ ] Mobile app security review (APK/IPA analysis)
- [ ] Rate limiting effectiveness testing
- [ ] Token forgery attempt testing
- [ ] SQL injection testing
- [ ] XSS vulnerability testing
- [ ] CSRF attack simulation

---

## Compliance Considerations

### GDPR/CCPA
- [ ] Implement data encryption at rest and in transit
- [ ] Add user data export functionality
- [ ] Implement right to deletion
- [ ] Add consent management
- [ ] Document data processing activities

### COPPA (Children's Privacy)
- [ ] Verify parental consent mechanisms
- [ ] Limit data collection to necessary only
- [ ] Implement strict access controls
- [ ] Regular privacy audits

---

## Security Resources

- **OWASP Mobile Top 10**: https://owasp.org/www-project-mobile-top-10/
- **React Native Security Best Practices**: https://reactnative.dev/docs/security
- **Node.js Security Checklist**: https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices
- **Google Cloud Security**: https://cloud.google.com/security/best-practices

---

**Document Version**: 2.0
**Last Updated**: December 2024
**Next Review**: March 2025