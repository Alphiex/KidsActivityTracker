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

**Document Version**: 4.0
**Last Updated**: December 2024
