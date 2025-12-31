# API Reference

Complete REST API documentation for the Kids Activity Tracker backend service.

## Overview

| | |
|---|---|
| **Production URL** | `https://kids-activity-api-205843686007.us-central1.run.app` |
| **Local Development** | `http://localhost:3000` |
| **Interactive Docs** | `/api-docs` (Swagger UI) |
| **Version** | v1 |

## Authentication

The API uses JWT (JSON Web Tokens) with access/refresh token pairs.

### Headers
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Token Lifetimes
| Token | Expiry | Purpose |
|-------|--------|---------|
| Access Token | 15 minutes | API requests |
| Refresh Token | 7 days | Obtain new access tokens |

## Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| General API | 100 requests | 15 minutes |
| Authentication | 5 requests | 15 minutes |
| Password Reset | 3 requests | 1 hour |
| Email Verification | 5 requests | 15 minutes |

**Rate Limit Headers**:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

---

## Health Check

### GET /health

```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-12-07T12:00:00Z",
  "documentation": "/api-docs"
}
```

---

## Authentication Endpoints

### POST /api/auth/register

Register a new user account.

**Request**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "phoneNumber": "+1234567890"
}
```

**Response** `201 Created`
```json
{
  "success": true,
  "message": "Registration successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "tokens": {
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

### POST /api/auth/login

**Request**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "isVerified": true
  },
  "tokens": {
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

### POST /api/auth/refresh

**Request**
```json
{
  "refreshToken": "current_refresh_token"
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "tokens": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token"
  }
}
```

### POST /api/auth/logout

**Headers**: `Authorization: Bearer <access_token>`

**Response** `200 OK`
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST /api/auth/forgot-password

**Request**
```json
{
  "email": "user@example.com"
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

### POST /api/auth/reset-password

**Request**
```json
{
  "token": "reset_token_from_email",
  "password": "newSecurePassword123"
}
```

---

## Activity Endpoints

### GET /api/v1/activities

Search activities with filters.

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (max: 100) |
| `search` | string | Text search in name/description |
| `activityType` | string | Filter by activity type code |
| `activitySubtype` | string | Filter by subtype code |
| `ageMin` | number | Minimum age |
| `ageMax` | number | Maximum age |
| `costMin` | number | Minimum cost |
| `costMax` | number | Maximum cost |
| `dateStart` | string | Activities starting after (ISO date) |
| `dateEnd` | string | Activities ending before (ISO date) |
| `dayOfWeek` | string[] | Days (Monday, Tuesday, etc.) |
| `city` | string | City name |
| `cityId` | string | City UUID |
| `locationId` | string | Location UUID |
| `providerId` | string | Provider UUID |
| `hideNoSpots` | boolean | Hide full activities |
| `hideClosed` | boolean | Hide registration closed |
| `userLat` | number | User latitude for distance filtering |
| `userLon` | number | User longitude for distance filtering |
| `radiusKm` | number | Search radius in kilometers (requires userLat/userLon) |

**Distance Filtering**

When `userLat`, `userLon`, and `radiusKm` are provided, activities are filtered by proximity using the Haversine formula. The filter uses a bounding box for efficient initial filtering, then calculates exact distances.

```
GET /api/v1/activities?userLat=49.2827&userLon=-123.1207&radiusKm=25
```

Activities with geocoded locations will be sorted by distance when distance filtering is enabled.

**Response** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Swimming Lessons - Level 3",
      "category": "Aquatics",
      "subcategory": "Group Lessons",
      "description": "Learn to swim...",
      "dateStart": "2024-01-15T00:00:00Z",
      "dateEnd": "2024-03-15T00:00:00Z",
      "startTime": "09:30",
      "endTime": "10:30",
      "dayOfWeek": ["Monday", "Wednesday"],
      "ageMin": 5,
      "ageMax": 8,
      "cost": 75.00,
      "spotsAvailable": 3,
      "totalSpots": 15,
      "registrationStatus": "open",
      "registrationUrl": "https://...",
      "location": {
        "id": "uuid",
        "name": "Aquatic Centre",
        "address": "123 Main St",
        "city": "Vancouver"
      },
      "provider": {
        "id": "uuid",
        "name": "Vancouver Parks"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### GET /api/v1/activities/:id

Get activity details.

---

## Featured Partners Endpoints

### GET /api/v1/partners

Get featured activities matching user filters. Returns activities ordered by tier (Gold > Silver > Bronze) with randomization within each tier for fair exposure.

**Backward Compatibility**: Also available at `/api/v1/sponsors`

**Access**: Public (optional auth for personalization)

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `ageMin` | number | Minimum age filter |
| `ageMax` | number | Maximum age filter |
| `costMin` | number | Minimum cost filter |
| `costMax` | number | Maximum cost filter |
| `activityType` | string | Activity type code or UUID |
| `activitySubtype` | string | Activity subtype code or UUID |
| `categories` | string | Comma-separated activity types |
| `startDate` | string | Activities starting after (ISO date) |
| `endDate` | string | Activities ending before (ISO date) |
| `dayOfWeek` | string[] | Days (Monday, Tuesday, etc.) |
| `locations` | string[] | City names or location IDs |
| `limit` | number | Max results (default: 3) |

**Response** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Elite Swimming Academy",
      "category": "Aquatics",
      "isFeatured": true,
      "featuredTier": "gold",
      "featuredStartDate": "2024-01-01T00:00:00Z",
      "featuredEndDate": "2024-12-31T23:59:59Z",
      "dateStart": "2024-01-15T00:00:00Z",
      "ageMin": 5,
      "ageMax": 12,
      "cost": 150.00,
      "location": {
        "name": "Aquatic Centre",
        "city": "Vancouver"
      },
      "provider": {
        "name": "Vancouver Parks"
      }
    }
  ],
  "meta": {
    "total": 1,
    "limit": 3
  }
}
```

### Admin Partner Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/partners` | GET | List all partner accounts |
| `/api/admin/partners/:id` | GET | Get partner details |
| `/api/admin/partners/:id` | PUT | Update partner settings |
| `/api/admin/partners` | POST | Create partner account |
| `/api/admin/partners/:id/analytics` | GET | Partner analytics |
| `/api/admin/partners/analytics/overview` | GET | Platform-wide analytics |

### Partner Portal Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/partner/login` | POST | Partner authentication |
| `/api/partner/dashboard` | GET | Partner dashboard |
| `/api/partner/activities` | GET | List activities |
| `/api/partner/analytics` | GET | View performance |

### Analytics Tracking Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/analytics/impressions` | POST | Batch record impressions |
| `/api/v1/analytics/clicks` | POST | Record click events |
| `/api/v1/analytics/ab-tests/active` | GET | Get active A/B tests |
| `/api/v1/analytics/ab-test/:id/assignment` | GET | Get test variant |

---

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Swimming Lessons - Level 3",
    "fullDescription": "Detailed description...",
    "instructor": "Jane Smith",
    "prerequisites": [
      {
        "name": "Level 2",
        "description": "Must complete Level 2",
        "isRequired": true
      }
    ],
    "sessions": [
      {
        "date": "2024-01-15",
        "dayOfWeek": "Monday",
        "startTime": "09:30",
        "endTime": "10:30"
      }
    ],
    "whatToBring": "Swimsuit, towel, goggles",
    "contactInfo": "rec@vancouver.ca"
  }
}
```

---

## Activity Types Endpoints

### GET /api/v1/activity-types

List all activity types.

**Response** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "aquatics",
      "name": "Aquatics",
      "description": "Swimming and water activities",
      "iconName": "swimmer",
      "subtypes": [
        {
          "id": "uuid",
          "code": "swimming-lessons",
          "name": "Swimming Lessons"
        }
      ]
    }
  ]
}
```

---

## Children Endpoints

### GET /api/children

List user's children. **Requires authentication**.

**Response** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Emma",
      "dateOfBirth": "2018-05-15",
      "gender": "female",
      "interests": ["swimming", "dance"],
      "avatarUrl": null
    }
  ]
}
```

### POST /api/children

Create a child profile. **Requires authentication**.

**Request**
```json
{
  "name": "Emma",
  "dateOfBirth": "2018-05-15",
  "gender": "female",
  "interests": ["swimming", "dance"],
  "notes": "Allergic to chlorine"
}
```

### PATCH /api/children/:childId

Update a child profile. **Requires authentication**.

### DELETE /api/children/:childId

Soft delete a child profile. **Requires authentication**.

---

## Child Activities Endpoints

### GET /api/child-activities

Get activities for children. **Requires authentication**.

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `childId` | string | Filter by child |
| `status` | string | planned, registered, completed, interested |
| `startDate` | string | Calendar start date |
| `endDate` | string | Calendar end date |

### POST /api/child-activities

Add activity to child's schedule. **Requires authentication**.

**Request**
```json
{
  "childId": "uuid",
  "activityId": "uuid",
  "status": "planned",
  "scheduledDate": "2024-01-15",
  "startTime": "09:30",
  "endTime": "10:30",
  "notes": "Bring extra towel"
}
```

### PATCH /api/child-activities/:id

Update status or details. **Requires authentication**.

**Request**
```json
{
  "status": "registered",
  "registeredAt": "2024-01-10T10:00:00Z"
}
```

### POST /api/child-activities/:id/rate

Rate a completed activity. **Requires authentication**.

**Request**
```json
{
  "rating": 5,
  "notes": "Great instructor!"
}
```

---

## Cities & Locations Endpoints

### GET /api/v1/cities

List all supported cities.

**Response** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Vancouver",
      "province": "BC",
      "country": "Canada",
      "activityCount": 450
    }
  ]
}
```

### GET /api/v1/cities/:cityId/locations

Get locations in a city.

### GET /api/v1/locations/:locationId

Get location details.

---

## Favorites Endpoints

### GET /api/favorites

Get user's favorites. **Requires authentication**.

### POST /api/favorites

Add to favorites. **Requires authentication**.

**Request**
```json
{
  "activityId": "uuid",
  "notifyOnChange": true
}
```

### DELETE /api/favorites/:activityId

Remove from favorites. **Requires authentication**.

---

## Notification Endpoints

Email notification system for activity alerts, digests, and waitlist notifications.

### GET /api/notifications/preferences

Get user's notification preferences. **Requires authentication**.

**Response** `200 OK`
```json
{
  "success": true,
  "preferences": {
    "enabled": true,
    "newActivities": true,
    "dailyDigest": false,
    "weeklyDigest": true,
    "favoriteCapacity": true,
    "capacityThreshold": 3,
    "priceDrops": true,
    "spotsAvailable": true,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "07:00"
  }
}
```

### PUT /api/notifications/preferences

Update notification preferences. **Requires authentication**.

**Request**
```json
{
  "enabled": true,
  "dailyDigest": true,
  "capacityThreshold": 5
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "message": "Notification preferences updated",
  "preferences": { ... }
}
```

### GET /api/notifications/history

Get notification history. **Requires authentication**.

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max results (default: 20, max: 100) |
| `offset` | number | Pagination offset |

**Response** `200 OK`
```json
{
  "success": true,
  "notifications": [
    {
      "id": "uuid",
      "type": "daily_digest",
      "activityCount": 5,
      "sentAt": "2025-01-15T07:00:00Z",
      "status": "sent"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### POST /api/notifications/test

Send a test notification email. Rate limited to 1 per hour. **Requires authentication**.

**Response** `200 OK`
```json
{
  "success": true,
  "message": "Test notification sent! Check your email."
}
```

### Waitlist Endpoints

### GET /api/notifications/waitlist

Get user's waitlist entries. **Requires authentication**.

**Response** `200 OK`
```json
{
  "success": true,
  "waitlist": [
    {
      "id": "uuid",
      "activityId": "uuid",
      "activity": {
        "id": "uuid",
        "name": "Swimming Lessons",
        "provider": "Vancouver Parks",
        "spotsAvailable": 0,
        "cost": 75.00
      },
      "joinedAt": "2025-01-10T10:00:00Z",
      "notifiedAt": null
    }
  ]
}
```

### POST /api/notifications/waitlist/:activityId

Join waitlist for a full activity. **Requires authentication**.

**Response** `200 OK`
```json
{
  "success": true,
  "message": "Added to waitlist",
  "waitlistEntry": {
    "id": "uuid",
    "activityId": "uuid",
    "activityName": "Swimming Lessons",
    "joinedAt": "2025-01-15T10:00:00Z"
  }
}
```

### DELETE /api/notifications/waitlist/:activityId

Leave waitlist for an activity. **Requires authentication**.

**Response** `200 OK`
```json
{
  "success": true,
  "message": "Removed from waitlist"
}
```

### Unsubscribe Endpoints

### GET /api/notifications/unsubscribe/:token

Validate unsubscribe token (from email links). **Public**.

**Response** `200 OK`
```json
{
  "success": true,
  "type": "daily_digest",
  "typeDescription": "daily activity digest emails",
  "userEmail": "user@example.com"
}
```

### POST /api/notifications/unsubscribe/:token

Process unsubscribe request. **Public**.

**Response** `200 OK`
```json
{
  "success": true,
  "message": "Successfully unsubscribed from daily digest"
}
```

### POST /api/notifications/unsubscribe-all

Quick unsubscribe from all notifications. **Requires authentication**.

**Response** `200 OK`
```json
{
  "success": true,
  "message": "Successfully unsubscribed from all email notifications"
}
```

---

## Push Notification Endpoints

Push notification system using Firebase Cloud Messaging (FCM) for real-time alerts on iOS and Android.

### POST /api/push-tokens

Register or update a device push token. **Requires authentication**.

**Request**
```json
{
  "token": "fcm_device_token_string",
  "platform": "ios",
  "deviceId": "unique_device_identifier"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | FCM device token |
| `platform` | string | Yes | `ios` or `android` |
| `deviceId` | string | No | Unique device ID for multi-device support |

**Response** `200 OK`
```json
{
  "success": true
}
```

**Notes**:
- Tokens are automatically handled when devices switch users
- Same device with new token updates the existing entry
- Supports multiple devices per user

### DELETE /api/push-tokens/:token

Unregister a push token (call on logout). **Requires authentication**.

**Response** `200 OK`
```json
{
  "success": true
}
```

### GET /api/push-tokens

Get all active push tokens for the authenticated user (debugging). **Requires authentication**.

**Response** `200 OK`
```json
{
  "tokens": [
    {
      "id": "uuid",
      "platform": "ios",
      "deviceId": "device-uuid",
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### Push Notification Types

| Type | Description | Data Fields |
|------|-------------|-------------|
| `spots_available` | Waitlist activity has spots | `activityId`, `activityName` |
| `capacity_alert` | Favorite activity getting full | `activityId`, `activityName` |
| `price_drop` | Activity price decreased | `activityId`, `activityName` |
| `general` | General notifications | `screen` (optional) |

---

## Sharing Endpoints

### POST /api/invitations

Create sharing invitation. **Requires authentication**.

**Request**
```json
{
  "recipientEmail": "coparent@example.com",
  "childIds": ["uuid1", "uuid2"],
  "message": "Join me in tracking activities"
}
```

### GET /api/invitations

List pending invitations. **Requires authentication**.

### PATCH /api/invitations/:id/accept

Accept sharing invitation. **Requires authentication**.

### GET /api/shared-activities

View shared children's activities. **Requires authentication**.

---

## Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address"
      }
    ]
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Pagination

All list endpoints support pagination:

```
GET /api/v1/activities?page=2&limit=20
```

**Response includes**:
```json
{
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  }
}
```

---

**Document Version**: 5.2
**Last Updated**: December 2025
