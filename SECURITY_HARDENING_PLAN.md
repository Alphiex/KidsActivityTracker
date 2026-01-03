# KidsActivityTracker Production Security Hardening Plan

**Generated:** January 3, 2026
**Audit Scope:** Full codebase security review
**Target:** Production launch readiness

---

## Executive Summary

This comprehensive security audit identified **67 issues** across 6 categories. As a **kids app handling sensitive child data**, security is paramount for regulatory compliance (PIPEDA, provincial privacy laws) and user trust.

| Severity | Count | Immediate Action Required |
|----------|-------|---------------------------|
| CRITICAL | 12 | Yes - Within 24 hours |
| HIGH | 23 | Yes - Within 1 week |
| MEDIUM | 22 | Within 2 weeks |
| LOW | 10 | Before launch |

---

## PHASE 1: CRITICAL - Immediate Action (24-48 hours)

### 1.1 Rotate All Exposed Secrets

**ISSUE:** Production secrets exposed in `.env` files committed to repository.

**Affected Credentials:**
- [ ] Database password (PostgreSQL on GCP)
- [ ] OpenAI API key (`sk-proj-...`)
- [ ] Anthropic API key (`sk-ant-...`)
- [ ] Stripe keys (secret, publishable, webhook)
- [ ] Google Geocoding API key
- [ ] Google Places API key
- [ ] RevenueCat API key
- [ ] JWT access/refresh secrets

**Actions:**
```bash
# 1. Immediately rotate in respective dashboards:
# - GCP Console: Cloud SQL → Users → Reset password
# - OpenAI: platform.openai.com → API keys → Revoke & create new
# - Anthropic: console.anthropic.com → API keys
# - Stripe: dashboard.stripe.com → Developers → API keys
# - Google Cloud: console.cloud.google.com → APIs → Credentials
# - RevenueCat: app.revenuecat.com → Project Settings

# 2. Store new secrets in GCP Secret Manager:
gcloud secrets create JWT_ACCESS_SECRET --replication-policy="automatic"
echo -n "$(openssl rand -base64 64)" | gcloud secrets versions add JWT_ACCESS_SECRET --data-file=-

# 3. Update deploy script to use Secret Manager
# 4. Remove .env from git history (use BFG Repo Cleaner or git-filter-repo)
```

### 1.2 Fix Critical Dependency Vulnerabilities

**ISSUE:** 9 known vulnerabilities including OS command injection.

```bash
# Server dependencies
cd server && npm audit fix --force
npm update axios express-validator

# Root dependencies
cd .. && npm audit fix --force
npm update @react-native-community/cli

# Verify fixes
npm audit
```

**Packages requiring immediate update:**
| Package | Vulnerability | Fix |
|---------|---------------|-----|
| @react-native-community/cli | OS command injection | Update to latest |
| axios | DoS attack | `npm update axios` |
| jws | HMAC bypass | Update jsonwebtoken |
| xlsx | Prototype pollution | Remove or use `xlsx-js-style` |

### 1.3 Fix JWT Secret Hardcoded Fallbacks

**Files:** `server/src/routes/vendor/auth.ts:12`, `server/src/middleware/vendorAuth.ts:15`

**Current (VULNERABLE):**
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
```

**Fix:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET environment variable must be set');
}
```

### 1.4 Fix SQL Injection in Admin Monitoring

**File:** `server/src/routes/adminMonitoring.ts:682`

**Current (VULNERABLE):**
```typescript
const dailyData = await prisma.$queryRaw`
  SELECT ... WHERE created_at >= ${startDate}
`;
```

**Fix:** Use Prisma type-safe queries:
```typescript
const dailyData = await prisma.aIUsageLog.groupBy({
  by: ['createdAt'],
  where: { createdAt: { gte: startDate } },
  _count: true,
  _sum: { costUsd: true }
});
```

---

## PHASE 2: HIGH Priority (1 Week)

### 2.1 Authentication & Authorization Fixes

#### 2.1.1 Apply CSRF Protection
**File:** `server/src/server.ts`

```typescript
import { csrfProtection } from './middleware/auth';

// Apply to all state-changing routes (already defined, just not applied)
app.use('/api/v1/children', csrfProtection);
app.use('/api/v1/child-activities', csrfProtection);
app.use('/api/v1/auth', csrfProtection);
```

#### 2.1.2 Fix Rate Limiting Always-On
**File:** `server/src/middleware/auth.ts:265`

```typescript
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Always enforce, not just in production
  skip: (req) => {
    // Only skip for health checks
    return req.path === '/health';
  },
  message: { error: 'Too many attempts, try again later' }
});
```

#### 2.1.3 Strengthen Vendor Password Requirements
**File:** `server/src/routes/vendor/auth.ts:158`

```typescript
// Replace simple length check with full validation
import { validatePasswordStrength } from '../services/authService';

if (!validatePasswordStrength(password)) {
  return res.status(400).json({
    success: false,
    error: 'Password must be 8+ chars with uppercase, lowercase, number, and special character'
  });
}
```

#### 2.1.4 Fix IDOR in Partner Portal
**File:** `server/src/routes/partnerPortal.ts:51-139`

Add explicit vendor membership verification:
```typescript
// After finding user, verify they ONLY access their assigned vendor
const vendorMembership = await prisma.vendorUser.findFirst({
  where: {
    userId: user.id,
    vendorId: req.body.vendorId, // Must match requested vendor
    isActive: true
  }
});
if (!vendorMembership) {
  return res.status(403).json({ error: 'Access denied to this vendor' });
}
```

### 2.2 Input Validation Fixes

#### 2.2.1 Add Date Validation
**Files:** All routes using date query params

```typescript
import { query } from 'express-validator';

const dateValidation = [
  query('startDate').optional().isISO8601().toDate(),
  query('endDate').optional().isISO8601().toDate(),
];

router.get('/activities', dateValidation, handleValidationErrors, async (req, res) => {...});
```

#### 2.2.2 Add Array Length Limits
**File:** `server/src/routes/children.ts:937`

```typescript
const childIds = (req.query.childIds as string)?.split(',').filter(Boolean);
if (childIds && childIds.length > 50) {
  return res.status(400).json({ error: 'Maximum 50 children allowed per request' });
}
// Validate each is UUID
if (childIds && !childIds.every(id => /^[0-9a-f-]{36}$/i.test(id))) {
  return res.status(400).json({ error: 'Invalid child ID format' });
}
```

#### 2.2.3 Fix CSV/iCal Injection
**File:** `server/src/routes/sharedActivities.ts:418`

```typescript
function escapeCSV(field: string | null | undefined): string {
  if (!field) return '""';
  // Escape quotes, remove formula injection chars
  const sanitized = String(field)
    .replace(/"/g, '""')
    .replace(/^[=+\-@\t\r]/g, "'$&"); // Prevent formula injection
  return `"${sanitized}"`;
}
```

### 2.3 Error Handling Fixes

#### 2.3.1 Create Error Sanitization Middleware
**New file:** `server/src/middleware/errorHandler.ts`

```typescript
interface SafeError {
  code: string;
  message: string;
  statusCode: number;
}

const ERROR_MAP: Record<string, SafeError> = {
  'unique constraint': { code: 'DUPLICATE', message: 'This entry already exists', statusCode: 409 },
  'foreign key': { code: 'INVALID_REFERENCE', message: 'Referenced item not found', statusCode: 400 },
  'not found': { code: 'NOT_FOUND', message: 'Resource not found', statusCode: 404 },
};

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Log full error internally
  console.error({
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    error: err.message,
    stack: err.stack
  });

  // Return sanitized error to client
  const safeError = Object.entries(ERROR_MAP).find(([key]) =>
    err.message?.toLowerCase().includes(key)
  )?.[1] || { code: 'INTERNAL_ERROR', message: 'An error occurred', statusCode: 500 };

  res.status(safeError.statusCode).json({
    success: false,
    error: safeError.message,
    code: safeError.code
  });
}
```

#### 2.3.2 Remove Stack Trace Exposure
**File:** `server/src/routes/cities.ts:92`

```typescript
// REMOVE these lines:
// console.error('Stack trace:', error.stack);
// details: error.message

// REPLACE with:
console.error('[Cities] Error:', error.message);
res.status(500).json({
  success: false,
  error: 'Failed to fetch cities'
});
```

### 2.4 Security Headers & Configuration

#### 2.4.1 Fix Helmet Configuration
**File:** `server/src/server.ts:104`

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.stripe.com', 'https://api.revenuecat.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

#### 2.4.2 Disable Source Maps in Production
**File:** `server/tsconfig.json`

```json
{
  "compilerOptions": {
    "sourceMap": false,
    "declarationMap": false
  }
}
```

Or use environment-based build:
```bash
# In package.json build script
"build:prod": "NODE_ENV=production tsc --sourceMap false"
```

#### 2.4.3 Enable Strict TypeScript
**File:** `server/tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noEmitOnError": true
  }
}
```

### 2.5 Webhook Security

#### 2.5.1 Fix RevenueCat Webhook Validation
**File:** `server/src/routes/webhooks.ts:14`

```typescript
function validateRevenueCatSignature(req: Request): boolean {
  const signature = req.headers['x-revenuecat-signature'];

  if (!REVENUECAT_WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL: RevenueCat webhook secret not configured');
      return false; // MUST reject in production
    }
    console.warn('[Dev] RevenueCat signature skipped');
    return true;
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', REVENUECAT_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature as string),
    Buffer.from(expectedSignature)
  );
}
```

---

## PHASE 3: MEDIUM Priority (2 Weeks)

### 3.1 Business Logic Fixes

#### 3.1.1 Fix Subscription Limit Race Condition
**File:** `server/src/services/subscriptionService.ts`

```typescript
async addChildWithLimitCheck(userId: string, childData: CreateChildInput): Promise<Child> {
  return await prisma.$transaction(async (tx) => {
    // Lock user row for update
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { subscription: true }
    });

    const currentCount = await tx.child.count({
      where: { userId, isActive: true }
    });

    const limit = user?.subscription?.maxChildren ?? 1;

    if (currentCount >= limit) {
      throw new Error('Child limit reached for your subscription');
    }

    return await tx.child.create({
      data: { ...childData, userId }
    });
  }, {
    isolationLevel: 'Serializable' // Prevent race conditions
  });
}
```

#### 3.1.2 Add Bulk Operation Subscription Check
**File:** `server/src/routes/children.ts:364`

```typescript
router.post('/bulk', verifyToken, async (req: Request, res: Response) => {
  const { children } = req.body;

  // CHECK SUBSCRIPTION LIMITS FIRST
  const limitCheck = await subscriptionService.canAddChildren(
    req.user!.id,
    children.length
  );

  if (!limitCheck.allowed) {
    return res.status(403).json({
      success: false,
      error: `Cannot add ${children.length} children. Limit: ${limitCheck.limit}, Current: ${limitCheck.current}`,
      upgradeRequired: true
    });
  }

  // Proceed with bulk creation
});
```

#### 3.1.3 Fix API Key Hashing (SHA256 → bcrypt)
**File:** `server/src/middleware/vendorAuth.ts:55`

```typescript
import bcrypt from 'bcrypt';

// In requireVendorApiKey middleware:
const isValid = await bcrypt.compare(apiKey, vendor.apiKeyHash);
if (!isValid) {
  return res.status(401).json({ error: 'Invalid API key' });
}
```

### 3.2 Child Safety Enhancements

#### 3.2.1 Add Audit Logging for Child Data Access
**New file:** `server/src/services/auditService.ts`

```typescript
interface AuditLog {
  action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'SHARE';
  entityType: 'CHILD' | 'ACTIVITY' | 'FAVORITE';
  entityId: string;
  userId: string;
  details?: Record<string, any>;
}

export async function logChildDataAccess(log: AuditLog): Promise<void> {
  await prisma.auditLog.create({
    data: {
      ...log,
      timestamp: new Date(),
      ip: log.ip,
      userAgent: log.userAgent
    }
  });
}

// Usage in routes:
await logChildDataAccess({
  action: 'VIEW',
  entityType: 'CHILD',
  entityId: childId,
  userId: req.user.id
});
```

#### 3.2.2 Filter Shared Activities by Permissions
**File:** `server/src/services/childrenService.ts:581`

```typescript
async getChildActivities(childId: string, userId: string, shareProfile?: ActivityShareProfile) {
  const activities = await prisma.childActivity.findMany({
    where: { childId }
  });

  // If accessing via share, filter by permissions
  if (shareProfile) {
    return activities.filter(activity => {
      switch (activity.status) {
        case 'interested': return shareProfile.canViewInterested;
        case 'enrolled': return shareProfile.canViewEnrolled;
        case 'completed': return shareProfile.canViewCompleted;
        default: return false;
      }
    });
  }

  return activities;
}
```

### 3.3 Database Security

#### 3.3.1 Enable SSL for PostgreSQL
**File:** `server/.env` and Prisma config

```
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require&sslcert=/path/to/client-cert.pem"
```

Or use Cloud SQL Proxy:
```bash
# In deployment script
cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5432 &
```

#### 3.3.2 Add Soft Delete Grace Period
```typescript
// Instead of immediate hard delete
async scheduleHardDelete(childId: string): Promise<void> {
  await prisma.child.update({
    where: { id: childId },
    data: {
      isActive: false,
      scheduledDeletionAt: addDays(new Date(), 30) // 30-day grace period
    }
  });
}

// Scheduled job to permanently delete after grace period
async cleanupScheduledDeletions(): Promise<void> {
  await prisma.child.deleteMany({
    where: {
      isActive: false,
      scheduledDeletionAt: { lte: new Date() }
    }
  });
}
```

### 3.4 Logging & Monitoring

#### 3.4.1 Implement Structured Logging
**New file:** `server/src/utils/logger.ts`

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: ['password', 'token', 'apiKey', 'secret', 'authorization'],
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty'
  } : undefined
});

// Usage:
logger.info({ userId, action: 'login' }, 'User logged in');
logger.error({ err, path: req.path }, 'Request failed');
```

#### 3.4.2 Add Unhandled Rejection Handler
**File:** `server/src/server.ts`

```typescript
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Promise Rejection');
  // In production, consider graceful shutdown
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught Exception');
  process.exit(1);
});
```

---

## PHASE 4: LOW Priority (Before Launch)

### 4.1 Client-Side Security

#### 4.1.1 Move Auth Tokens to Secure Storage
**File:** `src/store/index.ts`

```typescript
import * as SecureStore from 'expo-secure-store';

// Don't persist auth in AsyncStorage
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['children', 'preferences'], // Remove 'auth'
  blacklist: ['auth', 'subscription'] // Don't persist sensitive data
};

// Store tokens separately in secure storage
export async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync('authToken', token);
}
```

### 4.2 Docker Hardening

**File:** `server/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app

# Security: non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

### 4.3 Deployment Script Fixes

**File:** `server/deploy-backend.sh`

```bash
# Force production environment
gcloud run deploy kids-activity-api \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,..." \
  --min-instances=1 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --no-allow-unauthenticated # Require authentication
```

---

## Testing & Verification Checklist

### Pre-Launch Security Tests

- [ ] Run `npm audit` with zero high/critical vulnerabilities
- [ ] Verify all secrets rotated and not in git history
- [ ] Test rate limiting works in production
- [ ] Verify CSRF protection active on state-changing endpoints
- [ ] Test subscription limits cannot be bypassed
- [ ] Verify child sharing permissions enforced
- [ ] Check error messages don't leak sensitive info
- [ ] Confirm SSL/TLS for all external connections
- [ ] Test webhook signature validation
- [ ] Verify audit logs capturing child data access
- [ ] Run OWASP ZAP or similar scanner
- [ ] Perform manual penetration testing on auth flows

### Monitoring Setup

- [ ] Error alerting configured (Sentry, etc.)
- [ ] Uptime monitoring (Cloud Monitoring)
- [ ] Rate limit breach alerts
- [ ] Unusual access pattern detection
- [ ] Failed authentication attempt logging
- [ ] Database connection monitoring

---

## Compliance Considerations

### PIPEDA (Canada)
- [ ] Consent obtained before collecting child data
- [ ] Data minimization practiced
- [ ] Secure data storage and transmission
- [ ] Data retention policy documented
- [ ] Breach notification procedure in place

### Child Data Protection
- [ ] Parent consent verification
- [ ] Age-appropriate data collection
- [ ] No behavioral advertising to children
- [ ] Secure deletion of child data on request
- [ ] Third-party data sharing documented

---

## Summary

This security hardening plan addresses critical vulnerabilities that must be fixed before production launch. The issues are prioritized by severity and business impact.

**Total Estimated Effort:**
- Phase 1 (Critical): 1-2 days
- Phase 2 (High): 3-5 days
- Phase 3 (Medium): 5-7 days
- Phase 4 (Low): 2-3 days

**Recommended Timeline:** Complete all phases within 2-3 weeks before launch.
