# KidsActivityTracker Production Improvement Plan

Comprehensive analysis by senior engineering team identifying critical issues across security, performance, architecture, code quality, and maintainability. This document serves as the master roadmap for production hardening.

**Generated:** January 2026
**Total Issues Identified:** 150+
**Estimated Fix Time:** 8-12 weeks (full team)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Phase 1: Critical Security Fixes](#phase-1-critical-security-fixes)
3. [Phase 2: Data Integrity & Bug Fixes](#phase-2-data-integrity--bug-fixes)
4. [Phase 3: Performance Optimization](#phase-3-performance-optimization)
5. [Phase 4: Architecture Improvements](#phase-4-architecture-improvements)
6. [Phase 5: Code Quality & Maintainability](#phase-5-code-quality--maintainability)
7. [Phase 6: Frontend Improvements](#phase-6-frontend-improvements)
8. [Implementation Priority Matrix](#implementation-priority-matrix)

---

## Executive Summary

### Risk Assessment by Category

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security | 8 | 12 | 15 | 10 | 45 |
| Bugs/Edge Cases | 6 | 4 | 4 | 2 | 16 |
| Performance | 4 | 5 | 6 | 5 | 20 |
| Architecture | 2 | 6 | 5 | 2 | 15 |
| Algorithm Efficiency | 2 | 4 | 6 | 3 | 15 |
| Code Duplication | 2 | 4 | 4 | 3 | 13 |
| Frontend Quality | 3 | 5 | 5 | 5 | 18 |
| **TOTAL** | **27** | **40** | **45** | **30** | **142** |

### Top 10 Critical Issues (Must Fix Before Launch)

1. **Exposed Production Secrets** - Database passwords, API keys in `.env` files
2. **SQL Injection** - Raw queries in `adminMonitoring.ts`
3. **IDOR Vulnerabilities** - Missing ownership validation in 5+ routes
4. **Weak JWT Configuration** - Hardcoded fallback secrets
5. **parseInt Without Radix** - Date parsing bugs across 6+ files
6. **Two-Pass Database Query** - O(n) memory for every activity search
7. **O(n²) Deduplication** - Planner node performance bottleneck
8. **2,245-Line Component** - DashboardScreenModern unmaintainable
9. **Direct Prisma in Routes** - 229 calls bypassing service layer
10. **Missing Error States** - Silent failures throughout app

---

## Phase 1: Critical Security Fixes

**Timeline:** Week 1-2 (IMMEDIATE)
**See Also:** `SECURITY_HARDENING_PLAN.md` for detailed security fixes

### 1.1 Secrets Management (CRITICAL)

**Issue:** Production secrets exposed in `.env` files tracked by git

**Files Affected:**
- `server/.env` - Contains DB password, OpenAI key, Stripe keys, Anthropic key
- `config/.env` - Contains Google API keys

**Action Items:**
```bash
# 1. Rotate ALL compromised credentials immediately
# 2. Add to .gitignore if not present
echo "server/.env" >> .gitignore
echo "config/.env" >> .gitignore

# 3. Remove from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch server/.env" \
  --prune-empty --tag-name-filter cat -- --all

# 4. Use Google Cloud Secret Manager for production
gcloud secrets create db-password --data-file=- <<< "$DB_PASSWORD"
```

**Production Config:**
```typescript
// server/src/config/secrets.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export async function getSecret(name: string): Promise<string> {
  if (process.env.NODE_ENV === 'development') {
    return process.env[name] || '';
  }
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${name}/versions/latest`,
  });
  return version.payload?.data?.toString() || '';
}
```

### 1.2 SQL Injection Fix (CRITICAL)

**File:** `server/src/routes/adminMonitoring.ts:682`

**Vulnerable Code:**
```typescript
const dailyData = await prisma.$queryRaw`
  SELECT ... WHERE created_at >= ${startDate}
`;
```

**Fix:**
```typescript
import { Prisma } from '@prisma/client';

const dailyData = await prisma.$queryRaw(
  Prisma.sql`SELECT ... WHERE created_at >= ${Prisma.raw(startDate.toISOString())}`
);

// Or better: Use Prisma's type-safe queries
const dailyData = await prisma.activity.groupBy({
  by: ['createdAt'],
  where: { createdAt: { gte: startDate } },
  _count: true,
});
```

### 1.3 IDOR Vulnerability Fixes (CRITICAL)

**Files Requiring Ownership Validation:**

| File | Route | Fix Required |
|------|-------|--------------|
| `children.ts` | `PUT /:id` | Verify child belongs to user |
| `childActivities.ts` | `PUT /:childId/activities/:activityId` | Verify child ownership |
| `notifications.ts` | `PUT /:id` | Verify notification belongs to user |
| `sharing.ts` | `DELETE /:shareId` | Verify share belongs to user |
| `subscriptions.ts` | `GET /:id` | Verify subscription belongs to user |

**Pattern to Apply:**
```typescript
// server/src/middleware/ownership.ts
export const verifyChildOwnership = async (req: Request, res: Response, next: NextFunction) => {
  const childId = req.params.childId || req.params.id;
  const child = await prisma.child.findFirst({
    where: { id: childId, userId: req.user!.id }
  });

  if (!child) {
    return res.status(404).json({ success: false, error: 'Child not found' });
  }

  req.child = child;
  next();
};

// Usage in routes:
router.put('/:id', verifyToken, verifyChildOwnership, async (req, res) => {
  // req.child is already verified to belong to user
});
```

### 1.4 JWT Security Hardening (HIGH)

**File:** `server/src/routes/vendor/auth.ts:12`

**Vulnerable:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
```

**Fix:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters');
}

// Add token configuration
const TOKEN_CONFIG = {
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  algorithm: 'HS256' as const,
};
```

### 1.5 Rate Limiting for Production (HIGH)

**File:** `server/src/middleware/auth.ts:265`

**Issue:** Rate limiting disabled in development, no production check

**Fix:**
```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const isProduction = process.env.NODE_ENV === 'production';

export const authLimiter = rateLimit({
  store: isProduction ? new RedisStore({ client: redisClient }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 10 : 100, // Strict in production
  message: { success: false, error: 'Too many login attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 100 : 1000,
});
```

---

## Phase 2: Data Integrity & Bug Fixes

**Timeline:** Week 2-3
**Priority:** CRITICAL → HIGH

### 2.1 parseInt Without Radix (CRITICAL)

**Files Affected:**
- `src/components/activities/AssignActivityToChildModal.tsx:42`
- `src/screens/children/AddEditChildScreen.tsx:85-87`
- `src/screens/FriendsAndFamilyScreenModern.tsx:532`
- `src/screens/DashboardScreenModern.tsx:1530-1531`
- `src/screens/activities/ActivityDetailScreenModern.tsx:452,457-458`
- `src/utils/secureStorage.ts:99-100`

**Bug:** `parseInt("08")` can return `0` due to octal interpretation

**Fix Pattern:**
```typescript
// BEFORE (BUG):
const year = parseInt(parts[0]);
const month = parseInt(parts[1]) - 1;
const day = parseInt(parts[2]);

// AFTER (CORRECT):
const year = parseInt(parts[0], 10);
const month = parseInt(parts[1], 10) - 1;
const day = parseInt(parts[2], 10);

// BEST: Create utility function
// src/utils/parseNumber.ts
export function safeParseInt(value: string | undefined, fallback = 0): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}
```

### 2.2 Array Boundary Checks After split() (CRITICAL)

**File:** `src/components/activities/AssignActivityToChildModal.tsx:40-42`

**Vulnerable:**
```typescript
const datePart = dateOfBirth.split('T')[0];
const parts = datePart.split('-');
const birthDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
```

**Fix:**
```typescript
// src/utils/dateParser.ts
export function parseDateString(dateString: string | undefined): Date | null {
  if (!dateString) return null;

  const datePart = dateString.split('T')[0];
  const parts = datePart.split('-');

  if (parts.length !== 3) {
    console.warn(`Invalid date format: ${dateString}`);
    return null;
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }

  // Validate date components
  if (month < 0 || month > 11 || day < 1 || day > 31) {
    return null;
  }

  return new Date(year, month, day);
}
```

### 2.3 JSON.parse Validation (HIGH)

**Files Affected:**
- `src/screens/MapSearchScreen.tsx:417`
- `src/utils/secureStorage.ts:149`
- `src/services/favoritesService.ts:63,87`
- `src/services/waitlistService.ts:61,67`

**Vulnerable:**
```typescript
savedAddress = JSON.parse(savedAddress);
// No validation of parsed result
```

**Fix:**
```typescript
// src/utils/jsonParser.ts
export function safeJsonParse<T>(
  json: string,
  validator: (data: unknown) => data is T
): T | null {
  try {
    const parsed = JSON.parse(json);
    if (validator(parsed)) {
      return parsed;
    }
    console.warn('JSON validation failed:', parsed);
    return null;
  } catch (e) {
    console.warn('JSON parse failed:', e);
    return null;
  }
}

// Type guard for address
function isValidAddress(data: unknown): data is { latitude: number; longitude: number } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'latitude' in data &&
    'longitude' in data &&
    typeof (data as any).latitude === 'number' &&
    typeof (data as any).longitude === 'number'
  );
}

// Usage:
const savedAddress = safeJsonParse(savedAddressString, isValidAddress);
```

### 2.4 Race Condition in State Updates (HIGH)

**File:** `src/screens/children/AddEditChildScreen.tsx:258-299`

**Issue:** State updates after unmount cause memory leaks

**Fix:**
```typescript
// Add mounted ref pattern
const isMountedRef = useRef(true);

useEffect(() => {
  return () => {
    isMountedRef.current = false;
  };
}, []);

// In async handlers:
const handleSave = async () => {
  try {
    await dispatch(updateChild({ id, data })).unwrap();

    if (avatarUri) {
      setUploadingAvatar(true);
      const result = await childrenService.uploadAvatar(id, avatarUri);

      // Check mounted before state update
      if (isMountedRef.current) {
        await dispatch(updateChild({ id, data: { avatar: result.avatarUrl } }));
        setUploadingAvatar(false);
      }
    }
  } finally {
    if (isMountedRef.current) {
      setUploadingAvatar(false);
    }
  }
};
```

---

## Phase 3: Performance Optimization

**Timeline:** Week 3-5
**Impact:** 20-40% API response time improvement

### 3.1 Two-Pass Database Query (CRITICAL)

**File:** `server/src/services/activityService.enhanced.ts:590-649`

**Current Problem:**
```typescript
// First query: Fetches ALL matching activities
const allMatching = await this.prisma.activity.findMany({
  where: finalWhere,
  select: { id: true, registrationStatus: true }
});
total = allMatching.length; // Could be 5,000+

// Sort in memory
const sorted = allMatching.sort((a, b) => { /* custom logic */ });

// Second query: Fetch page
const pageIds = sorted.slice(offset, offset + limit).map(a => a.id);
const activities = await this.prisma.activity.findMany({
  where: { id: { in: pageIds } }
});
```

**Fix with Cursor-Based Pagination:**
```typescript
async searchActivities(params: SearchParams): Promise<PaginatedResult<Activity>> {
  const { cursor, limit = 20 } = params;

  // Single query with cursor pagination
  const activities = await this.prisma.activity.findMany({
    where: this.buildWhereClause(params),
    take: limit + 1, // Fetch one extra to check hasMore
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: this.buildOrderBy(params.sortBy, params.sortOrder),
    include: this.getActivityIncludes(),
  });

  const hasMore = activities.length > limit;
  if (hasMore) activities.pop();

  return {
    activities,
    nextCursor: hasMore ? activities[activities.length - 1].id : null,
    hasMore,
  };
}
```

### 3.2 O(n²) Deduplication Fix (CRITICAL)

**File:** `server/src/ai/graph/nodes/plannerNode.ts:292-294`

**Current O(n²):**
```typescript
const uniqueCandidates = allCandidates.filter(
  (act, idx, arr) => arr.findIndex(a => a.id === act.id) === idx
);
```

**Fix O(n):**
```typescript
const seen = new Set<string>();
const uniqueCandidates = allCandidates.filter(act => {
  if (seen.has(act.id)) return false;
  seen.add(act.id);
  return true;
});
```

### 3.3 O(n²) Diversity Filtering Fix (HIGH)

**File:** `server/src/ai/utils/activityScorer.ts:814-842`

**Fix:**
```typescript
function applyDiversity(scored: ScoredActivity[], limit: number): ScoredActivity[] {
  const result: ScoredActivity[] = [];
  const selectedIds = new Set<string>();
  const categoryCount: Record<string, number> = {};
  const MAX_PER_CATEGORY = 3;

  for (const item of scored) {
    if (result.length >= limit) break;

    const category = item.activity.category || 'other';
    if ((categoryCount[category] || 0) >= MAX_PER_CATEGORY) continue;

    if (!selectedIds.has(item.activity.id)) {
      result.push(item);
      selectedIds.add(item.activity.id);
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    }
  }

  return result;
}
```

### 3.4 Activity Type Caching (HIGH)

**File:** `server/src/services/activityService.enhanced.ts:194-256`

**Issue:** Database lookup for every search with activityType parameter

**Fix:**
```typescript
// server/src/cache/activityTypeCache.ts
class ActivityTypeCache {
  private types: Map<string, { id: string; code: string; name: string }> = new Map();
  private lastRefresh = 0;
  private TTL = 60 * 60 * 1000; // 1 hour

  async get(codeOrName: string): Promise<string | null> {
    if (Date.now() - this.lastRefresh > this.TTL) {
      await this.refresh();
    }

    const normalized = codeOrName.toLowerCase().replace(/\s+/g, '-');
    const type = this.types.get(normalized);
    return type?.id || null;
  }

  async refresh(): Promise<void> {
    const types = await prisma.activityType.findMany();
    this.types.clear();

    for (const type of types) {
      this.types.set(type.code.toLowerCase(), type);
      this.types.set(type.name.toLowerCase().replace(/\s+/g, '-'), type);
    }

    this.lastRefresh = Date.now();
  }
}

export const activityTypeCache = new ActivityTypeCache();
```

### 3.5 Console.log Removal (HIGH)

**Count:** 42+ console.log statements in routes alone

**Automated Fix:**
```bash
# Find all console.log in server routes
grep -rn "console.log" server/src/routes --include="*.ts" | wc -l

# Replace with proper logger
# server/src/utils/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      silent: process.env.NODE_ENV === 'test',
    }),
  ],
});

export default logger;
```

### 3.6 Missing Database Indexes (MEDIUM)

**File:** `server/prisma/schema.prisma`

**Add:**
```prisma
model Activity {
  // ... existing fields

  @@index([isActive, gender, ageMin, ageMax, activityTypeId])
  @@index([isActive, cost, dateStart, dateEnd])
  @@index([isActive, locationId, activityTypeId])
  @@index([isActive, dayOfWeek])
}

model ChildActivity {
  @@index([childId, status])
  @@index([activityId, childId])
}

model ChildFavorite {
  @@index([childId, createdAt])
}
```

---

## Phase 4: Architecture Improvements

**Timeline:** Week 5-8
**Impact:** Maintainability, testability, scalability

### 4.1 Extract Validation Middleware (HIGH)

**Issue:** Identical `handleValidationErrors` in 8 routes

**Fix:**
```typescript
// server/src/middleware/validation.ts
import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
};
```

**Update routes:**
```typescript
// Before: Each file has its own handleValidationErrors
// After:
import { handleValidationErrors } from '../middleware/validation';
```

### 4.2 Extract Query Parameter Parser (HIGH)

**Issue:** 80+ lines of duplicated param parsing in activities.ts and partners.ts

**Fix:**
```typescript
// server/src/utils/queryParamParser.ts
export interface ParsedActivityParams {
  ageMin?: number;
  ageMax?: number;
  costMin?: number;
  costMax?: number;
  dayOfWeek?: string[];
  locations?: string[];
  gender?: string;
  activityType?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export function parseActivityQueryParams(query: Record<string, any>): ParsedActivityParams {
  return {
    ageMin: parseIntWithFallback(query.ageMin, query.age_min),
    ageMax: parseIntWithFallback(query.ageMax, query.age_max),
    costMin: parseFloatWithFallback(query.costMin, query.cost_min),
    costMax: parseFloatWithFallback(query.costMax, query.cost_max),
    dayOfWeek: parseArrayParam(query.dayOfWeek || query.day_of_week || query.days_of_week),
    locations: parseArrayParam(query.locations || query.location),
    gender: query.gender?.toLowerCase(),
    activityType: query.activityType || query.activity_type,
    sortBy: query.sortBy || query.sort_by || 'relevance',
    sortOrder: query.sortOrder === 'desc' ? 'desc' : 'asc',
    limit: parseIntWithFallback(query.limit, query.per_page) || 20,
    offset: parseIntWithFallback(query.offset, query.skip) || 0,
  };
}

function parseIntWithFallback(...values: any[]): number | undefined {
  for (const val of values) {
    if (val !== undefined && val !== null) {
      const parsed = parseInt(val as string, 10);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return undefined;
}

function parseArrayParam(param: any): string[] | undefined {
  if (!param) return undefined;
  if (Array.isArray(param)) return param;
  if (typeof param === 'string') return param.split(',').map(s => s.trim());
  return undefined;
}
```

### 4.3 Response Handler Utilities (MEDIUM)

**Issue:** Inconsistent response formats across 70+ handlers

**Fix:**
```typescript
// server/src/utils/responseHandler.ts
import { Response } from 'express';

export const sendSuccess = <T extends Record<string, any>>(
  res: Response,
  data: T,
  status = 200
) => {
  res.status(status).json({
    success: true,
    ...data,
  });
};

export const sendError = (
  res: Response,
  error: string,
  status = 400,
  details?: any
) => {
  res.status(status).json({
    success: false,
    error,
    ...(details && { details }),
  });
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: { total: number; page: number; limit: number }
) => {
  res.json({
    success: true,
    data,
    pagination: {
      ...pagination,
      hasMore: pagination.page * pagination.limit < pagination.total,
    },
  });
};
```

### 4.4 Async Handler Wrapper (MEDIUM)

**Issue:** 70+ try-catch blocks with identical error handling

**Fix:**
```typescript
// server/src/middleware/asyncHandler.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import logger from '../utils/logger';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error('Request error:', {
        path: req.path,
        method: req.method,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });

      res.status(error.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message,
      });
    });
  };
};

// Usage:
router.get('/', asyncHandler(async (req, res) => {
  const activities = await activityService.search(params);
  sendSuccess(res, { activities });
}));
```

### 4.5 Split God Objects (HIGH)

**File:** `server/src/services/childrenService.ts` (1,217 lines, 30+ methods)

**Split Into:**
```
server/src/services/
├── children/
│   ├── index.ts                    # Re-exports
│   ├── childCrudService.ts         # CRUD operations
│   ├── childPreferencesService.ts  # Preferences management
│   ├── childActivityService.ts     # Activity linking
│   ├── childSkillService.ts        # Skill progression
│   └── childNotificationService.ts # Notification preferences
```

### 4.6 Move Business Logic from Routes (CRITICAL)

**Issue:** 268 async route handlers with embedded business logic

**Example Refactor:**
```typescript
// BEFORE (server/src/routes/children.ts)
router.post('/', verifyToken, validateChild, handleValidationErrors, async (req, res) => {
  const limitCheck = await subscriptionService.canAddChild(req.user!.id);
  if (!limitCheck.allowed) {
    return res.status(403).json({ ... });
  }
  const child = await childrenService.createChild({ ... });
  res.status(201).json({ success: true, child });
});

// AFTER
// server/src/controllers/childrenController.ts
export class ChildrenController {
  constructor(
    private childrenService: ChildrenService,
    private subscriptionService: SubscriptionService
  ) {}

  async create(req: Request, res: Response) {
    const limitCheck = await this.subscriptionService.canAddChild(req.user!.id);
    if (!limitCheck.allowed) {
      throw new ForbiddenError(limitCheck.reason);
    }

    const child = await this.childrenService.create(req.user!.id, req.body);
    sendSuccess(res, { child }, 201);
  }
}

// server/src/routes/children.ts
const controller = new ChildrenController(childrenService, subscriptionService);
router.post('/', verifyToken, validateChild, handleValidationErrors,
  asyncHandler((req, res) => controller.create(req, res))
);
```

---

## Phase 5: Code Quality & Maintainability

**Timeline:** Week 6-9
**Impact:** Developer productivity, bug reduction

### 5.1 MMKV Storage Singleton (HIGH)

**Issue:** Identical lazy initialization pattern in 3 files

**Fix:**
```typescript
// src/utils/mmkvStorage.ts
import { MMKV } from 'react-native-mmkv';

class MMKVStorageManager {
  private static instance: MMKV | null = null;
  private static initAttempted = false;

  static getInstance(): MMKV | null {
    if (this.instance) return this.instance;
    if (this.initAttempted) return null;

    try {
      this.instance = new MMKV();
      return this.instance;
    } catch (error) {
      this.initAttempted = true;
      console.warn('[MMKVStorage] Initialization failed:', error);
      return null;
    }
  }

  static reset(): void {
    this.initAttempted = false;
    this.instance = null;
  }
}

export const getStorage = () => MMKVStorageManager.getInstance();
```

### 5.2 Centralize Storage Keys (MEDIUM)

**Fix:**
```typescript
// src/constants/storageKeys.ts
export const STORAGE_KEYS = {
  // User preferences
  PREFERENCES: 'user_preferences',
  FILTER_PRESETS: 'filter_presets',

  // Favorites and waitlist
  FAVORITES: 'user_favorites',
  CAPACITY_ALERTS: 'capacity_alerts',

  // Child data
  CHILD_ACTIVITIES: '@kids_tracker/child_activities',
  SHARED_CHILDREN: '@kids_tracker/shared_children',

  // Auth
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
```

### 5.3 Centralize App Defaults (MEDIUM)

**Fix:**
```typescript
// src/constants/appDefaults.ts
export const DEFAULTS = {
  search: {
    limit: 20,
    maxResults: 100,
    radiusKm: 25,
  },

  pricing: {
    min: 0,
    max: 999999,
    freeThreshold: 0,
  },

  age: {
    min: 0,
    max: 18,
  },

  timeSlots: {
    morning: true,
    afternoon: true,
    evening: true,
  },

  childColors: [
    { id: 1, hex: '#FF6B6B', name: 'Coral' },
    { id: 2, hex: '#4ECDC4', name: 'Teal' },
    { id: 3, hex: '#45B7D1', name: 'Sky' },
    { id: 4, hex: '#96CEB4', name: 'Mint' },
    { id: 5, hex: '#FFEAA7', name: 'Yellow' },
  ],
} as const;
```

### 5.4 Extract Date Utilities (MEDIUM)

**Fix:**
```typescript
// src/utils/dateHelpers.ts
export function parseDate(date: string | Date | undefined | null): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;

  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateRange(start: Date | null, end: Date | null): string {
  if (!start) return 'Date TBD';
  if (!end || start.getTime() === end.getTime()) {
    return start.toLocaleDateString();
  }
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
}

export function isDateInRange(date: Date, start: Date | null, end: Date | null): boolean {
  const time = date.getTime();
  if (start && time < start.getTime()) return false;
  if (end && time > end.getTime()) return false;
  return true;
}
```

### 5.5 Module-Level Regex Constants (LOW)

**Issue:** Regex patterns recreated on every function call

**Fix:**
```typescript
// src/constants/patterns.ts
export const PATTERNS = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s-()]{10,}$/,
  POSTAL_CODE_CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
} as const;

// Usage:
import { PATTERNS } from '../constants/patterns';
const isUuid = PATTERNS.UUID.test(activityType);
```

---

## Phase 6: Frontend Improvements

**Timeline:** Week 8-12
**Impact:** User experience, accessibility, maintainability

### 6.1 Split DashboardScreenModern (CRITICAL)

**Current:** 2,245 lines, 70+ state variables

**Target Structure:**
```
src/screens/dashboard/
├── DashboardScreen.tsx           # Main container (~200 lines)
├── components/
│   ├── ActivityCardsSection.tsx  # Recommended/New/Budget sections
│   ├── ActivityTypeSection.tsx   # Activity type filters
│   ├── AgeGroupSection.tsx       # Age group filters
│   ├── SkeletonLoader.tsx        # Loading states
│   └── DashboardHeader.tsx       # Search bar, child selector
├── hooks/
│   ├── useDashboardData.ts       # Data fetching logic
│   ├── useActivityFilters.ts     # Filter state management
│   └── useFavorites.ts           # Favorite/waitlist state
└── types.ts                      # Dashboard-specific types
```

### 6.2 Extract Reusable Activity Card (HIGH)

**Current Issue:** Card rendering duplicated in 3+ screens

**Fix:**
```typescript
// src/components/ActivityCard/ActivityCard.tsx
interface ActivityCardProps {
  activity: Activity;
  variant?: 'default' | 'compact' | 'map';
  onPress?: () => void;

  // Favorite handling
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  canAddFavorite?: boolean;

  // Waitlist handling
  isOnWaitlist?: boolean;
  onToggleWaitlist?: () => void;

  // Child info
  matchingChildren?: Child[];

  // Style overrides
  containerStyle?: ViewStyle;
}

export const ActivityCard = memo(function ActivityCard({
  activity,
  variant = 'default',
  onPress,
  isFavorite,
  onToggleFavorite,
  ...props
}: ActivityCardProps) {
  // Memoize handlers
  const handleFavoritePress = useCallback(() => {
    onToggleFavorite?.();
  }, [onToggleFavorite]);

  // Render based on variant
  if (variant === 'compact') {
    return <CompactActivityCard {...props} />;
  }

  return (
    <TouchableOpacity
      testID={`activity-card-${activity.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${activity.name}, ${formatPrice(activity.cost)}`}
      onPress={onPress}
    >
      {/* Card content */}
    </TouchableOpacity>
  );
});
```

### 6.3 Add Accessibility Props (CRITICAL)

**Issue:** Missing accessibility throughout app

**Fix Pattern:**
```typescript
// Every interactive element needs:
<TouchableOpacity
  testID="dashboard-search-button"
  accessibilityRole="button"
  accessibilityLabel="Search for activities"
  accessibilityHint="Opens the activity search screen"
  onPress={handleSearch}
>
  <Icon name="search" />
</TouchableOpacity>

// Icons need labels
<Icon
  name={isFavorite ? 'heart' : 'heart-outline'}
  accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
/>

// Lists need accessibility hints
<FlatList
  accessibilityRole="list"
  accessibilityLabel="Activity results"
  data={activities}
  renderItem={renderItem}
/>
```

### 6.4 Add Error States (HIGH)

**Issue:** Silent failures with no user feedback

**Fix:**
```typescript
// src/components/ErrorState.tsx
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  icon?: string;
}

export const ErrorState = ({ message, onRetry, icon = 'alert-circle' }: ErrorStateProps) => (
  <View style={styles.container} accessibilityRole="alert">
    <Icon name={icon} size={48} color="#E8638B" />
    <Text style={styles.message}>{message}</Text>
    {onRetry && (
      <TouchableOpacity
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading"
      >
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>
    )}
  </View>
);

// Usage in screens:
const [error, setError] = useState<string | null>(null);

const loadData = async () => {
  try {
    setError(null);
    setLoading(true);
    const data = await api.getData();
    setData(data);
  } catch (e) {
    setError('Failed to load activities. Please check your connection.');
  } finally {
    setLoading(false);
  }
};

// In render:
{error && <ErrorState message={error} onRetry={loadData} />}
```

### 6.5 Add testID Props (MEDIUM)

**Pattern for all interactive elements:**
```typescript
// Naming convention: {screen}-{component}-{action/identifier}
testID="dashboard-search-button"
testID="activity-card-abc123"
testID="child-selector-dropdown"
testID="filter-modal-apply-button"
```

### 6.6 FlatList Optimization (MEDIUM)

**File:** `src/screens/MapSearchScreen.tsx`

**Fix:**
```typescript
const renderItem = useCallback(({ item }: { item: Activity }) => (
  <ActivityCard
    activity={item}
    onPress={() => handleActivityPress(item)}
    isFavorite={favoriteIds.has(item.id)}
    onToggleFavorite={() => handleToggleFavorite(item.id)}
  />
), [favoriteIds, handleActivityPress, handleToggleFavorite]);

const keyExtractor = useCallback((item: Activity) => item.id, []);

const getItemLayout = useCallback((data: any, index: number) => ({
  length: CARD_HEIGHT,
  offset: CARD_HEIGHT * index,
  index,
}), []);

<FlatList
  data={activities}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  getItemLayout={getItemLayout}
  windowSize={5}
  maxToRenderPerBatch={10}
  removeClippedSubviews={true}
  initialNumToRender={10}
/>
```

### 6.7 Spacing Constants (LOW)

**Fix:**
```typescript
// src/theme/spacing.ts
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Usage:
const styles = StyleSheet.create({
  container: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
});
```

---

## Implementation Priority Matrix

### Week 1-2: Critical Security & Bugs
| Task | Files | Effort | Impact |
|------|-------|--------|--------|
| Rotate exposed secrets | `.env` files | 2h | CRITICAL |
| Fix SQL injection | `adminMonitoring.ts` | 1h | CRITICAL |
| Add IDOR validation | 5 route files | 4h | CRITICAL |
| Fix parseInt radix | 6 files | 1h | CRITICAL |
| Add JSON.parse validation | 5 files | 2h | HIGH |

### Week 3-4: Performance & Data Integrity
| Task | Files | Effort | Impact |
|------|-------|--------|--------|
| Fix two-pass query | `activityService.enhanced.ts` | 4h | CRITICAL |
| Fix O(n²) deduplication | `plannerNode.ts` | 1h | CRITICAL |
| Add database indexes | `schema.prisma` | 1h | HIGH |
| Remove console.log | All routes | 2h | HIGH |
| Add activity type cache | New file | 3h | HIGH |

### Week 5-6: Architecture
| Task | Files | Effort | Impact |
|------|-------|--------|--------|
| Extract validation middleware | New file + 8 routes | 2h | HIGH |
| Extract query parser | New file + 2 routes | 3h | HIGH |
| Create response handlers | New file | 2h | MEDIUM |
| Create async handler | New file | 1h | MEDIUM |

### Week 7-8: Code Quality
| Task | Files | Effort | Impact |
|------|-------|--------|--------|
| MMKV singleton | 3 files | 1h | HIGH |
| Storage keys | New file + 3 files | 1h | MEDIUM |
| Date utilities | New file | 2h | MEDIUM |
| App defaults | New file | 1h | LOW |

### Week 9-12: Frontend
| Task | Files | Effort | Impact |
|------|-------|--------|--------|
| Split DashboardScreenModern | 1 file → 8 files | 16h | CRITICAL |
| Extract ActivityCard | 3 files | 8h | HIGH |
| Add accessibility | All screens | 8h | HIGH |
| Add error states | All screens | 4h | HIGH |
| FlatList optimization | 3 files | 3h | MEDIUM |

---

## Testing Checklist

### Pre-Launch Verification
- [ ] All security fixes deployed and verified
- [ ] Penetration testing completed
- [ ] Load testing for 10x expected traffic
- [ ] All critical bugs fixed
- [ ] Error monitoring configured (Sentry)
- [ ] Database indexes verified
- [ ] Rate limiting tested
- [ ] JWT rotation working
- [ ] Secret management in place
- [ ] HTTPS enforced
- [ ] CORS configured correctly
- [ ] Input validation comprehensive

### Performance Benchmarks
- [ ] API response time < 200ms (p95)
- [ ] Activity search < 500ms
- [ ] AI recommendations < 3s
- [ ] App cold start < 3s
- [ ] Screen navigation < 100ms
- [ ] Memory usage < 200MB
- [ ] No memory leaks after 1hr use

---

## Appendix A: Related Documentation

- `SECURITY_HARDENING_PLAN.md` - Detailed security fixes
- `CLAUDE.md` - Development guidelines
- `docs/API.md` - API documentation
- `docs/ARCHITECTURE.md` - System architecture

---

## Appendix B: Commands Reference

```bash
# Run security audit
npm audit

# Fix vulnerabilities
npm audit fix

# Check TypeScript errors
npm run typecheck

# Run linting
npm run lint

# Generate Prisma client after schema changes
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Deploy schema changes
node scripts/deployment/deploy-schema.js
```
