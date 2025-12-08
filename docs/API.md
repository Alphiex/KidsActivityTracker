# Kids Activity Tracker - API Documentation

## Overview

Complete REST API documentation for the Kids Activity Tracker backend service.

**Production URL**: `https://kids-activity-api-205843686007.us-central1.run.app`
**Local Development**: `http://localhost:3000`
**Interactive Documentation**: `/api-docs` (Swagger UI)

---

## Authentication

The API uses JWT (JSON Web Tokens) for authentication with access/refresh token pairs.

### Headers
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Token Management
- **Access Token**: 15-minute expiry, used for API requests
- **Refresh Token**: 7-day expiry, used to obtain new access tokens

---

## Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| General API | 100 requests | 15 minutes |
| Authentication | 5 requests | 15 minutes |
| Password Reset | 3 requests | 1 hour |
| Email Verification | 5 requests | 15 minutes |

---

## Endpoints Reference

### Health Check

#### GET /health
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

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "phoneNumber": "+1234567890"  // optional
}
```

**Response**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
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
Login with existing account.

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response**
```json
{
  "success": true,
  "message": "Login successful",
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

### POST /api/auth/refresh
Refresh access token using refresh token.

**Request Body**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response**
```json
{
  "success": true,
  "tokens": {
    "accessToken": "new_jwt_access_token",
    "refreshToken": "new_jwt_refresh_token"
  }
}
```

### POST /api/auth/logout
Logout current session. **Requires authentication.**

### GET /api/auth/verify-email
Verify email address with token.

**Query Parameters**
- `token` (required): Verification token from email

### POST /api/auth/resend-verification
Resend email verification.

**Request Body**
```json
{
  "email": "user@example.com"
}
```

### POST /api/auth/forgot-password
Request password reset email.

**Request Body**
```json
{
  "email": "user@example.com"
}
```

### POST /api/auth/reset-password
Reset password with token.

**Request Body**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "newSecurePassword123"
}
```

### POST /api/auth/change-password
Change password for authenticated user. **Requires authentication.**

**Request Body**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123"
}
```

### GET /api/auth/profile
Get user profile. **Requires authentication.**

**Response**
```json
{
  "success": true,
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "phoneNumber": "+1234567890",
    "preferences": {},
    "isVerified": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### PUT /api/auth/profile
Update user profile. **Requires authentication.**

**Request Body**
```json
{
  "name": "John Doe Updated",
  "phoneNumber": "+1234567890",
  "preferences": {
    "notifications": true,
    "newsletter": false
  }
}
```

### GET /api/auth/check
Check authentication status. **Requires authentication.**

### DELETE /api/auth/delete-account
Delete user account permanently. **Requires authentication.**

**Request Body**
```json
{
  "password": "currentPassword123"
}
```

---

## Activities Endpoints

### GET /api/v1/activities
Search activities with comprehensive filtering.

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| search | string | Search in name/description |
| category | string | Filter by category |
| categories | string | Comma-separated category codes |
| activityType | string | Activity type code or ID |
| activitySubtype | string | Subtype code or ID |
| ageMin / age_min | number | Minimum age |
| ageMax / age_max | number | Maximum age |
| costMin / cost_min | number | Minimum cost |
| costMax / cost_max | number | Maximum cost |
| startDate / start_date | date | Activities starting after |
| endDate / end_date | date | Activities ending before |
| dayOfWeek / days_of_week | string[] | Days of week filter |
| location | string | Location ID |
| locations | string[] | Multiple location IDs |
| providerId | string | Provider ID |
| hideClosedActivities | boolean | Hide closed registration |
| hideFullActivities | boolean | Hide full activities |
| hideClosedOrFull | boolean | Hide both closed and full |
| limit | number | Results per page (default: 50) |
| offset | number | Skip records (default: 0) |
| sortBy | string | name/dateStart/cost/createdAt |
| sortOrder | string | asc/desc |

**Response**
```json
{
  "success": true,
  "activities": [
    {
      "id": "uuid",
      "name": "Swimming Lessons",
      "category": "Aquatics",
      "subcategory": "Learn to Swim",
      "description": "Beginner swimming lessons",
      "fullDescription": "Complete swimming program...",
      "dateStart": "2024-09-01T09:00:00Z",
      "dateEnd": "2024-10-01T10:00:00Z",
      "startTime": "9:30 am",
      "endTime": "12:00 pm",
      "ageMin": 5,
      "ageMax": 8,
      "cost": 120.00,
      "costIncludesTax": true,
      "spotsAvailable": 5,
      "totalSpots": 12,
      "registrationStatus": "open",
      "registrationUrl": "https://...",
      "instructor": "Jane Smith",
      "location": {
        "id": "uuid",
        "name": "Ron Andrews Recreation Centre",
        "address": "931 Lytton St",
        "city": { "name": "North Vancouver", "province": "BC" }
      },
      "provider": {
        "id": "uuid",
        "name": "NVRC"
      },
      "activityType": {
        "id": "uuid",
        "code": "aquatics",
        "name": "Aquatics"
      },
      "activitySubtype": {
        "id": "uuid",
        "code": "learn-to-swim",
        "name": "Learn to Swim"
      }
    }
  ],
  "total": 2940,
  "hasMore": true,
  "pagination": {
    "total": 2940,
    "limit": 50,
    "offset": 0,
    "pages": 59
  }
}
```

### GET /api/v1/activities/:id
Get single activity details.

**Response**
```json
{
  "success": true,
  "activity": {
    "id": "uuid",
    "name": "Swimming Lessons",
    "fullDescription": "Complete swimming program...",
    "prerequisites": "Must be comfortable in water",
    "whatToBring": "Swimsuit, towel, goggles",
    "sessions": [
      {
        "sessionNumber": 1,
        "date": "2024-09-01",
        "dayOfWeek": "Tuesday",
        "startTime": "09:00",
        "endTime": "10:00",
        "location": "Pool A",
        "instructor": "Jane Smith"
      }
    ],
    // ... all activity fields
  }
}
```

### GET /api/v1/activities/stats/summary
Get activity statistics.

---

## Activity Types Endpoints

### GET /api/v1/activity-types
Get all activity types with subtypes and counts.

**Query Parameters**
- `hideClosedActivities` (boolean): Filter counts
- `hideFullActivities` (boolean): Filter counts

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "aquatics",
      "name": "Aquatics",
      "displayOrder": 1,
      "activityCount": 450,
      "subtypes": [
        {
          "id": "uuid",
          "code": "learn-to-swim",
          "name": "Learn to Swim",
          "activityCount": 200
        }
      ]
    }
  ]
}
```

### GET /api/v1/activity-types/:typeCode
Get specific activity type with subtypes.

### GET /api/v1/activity-types/:typeCode/subtypes/:subtypeCode/activities
Get activities for a specific subtype.

---

## Children Endpoints

All children endpoints **require authentication**.

### POST /api/children
Create child profile.

**Request Body**
```json
{
  "name": "Emma",
  "dateOfBirth": "2018-05-15",
  "gender": "female",
  "interests": ["swimming", "arts"],
  "avatarUrl": "https://...",
  "notes": "Prefers morning activities"
}
```

### GET /api/children
Get all children for authenticated user.

**Query Parameters**
- `includeInactive` (boolean): Include soft-deleted children

**Response**
```json
{
  "success": true,
  "children": [
    {
      "id": "uuid",
      "name": "Emma",
      "dateOfBirth": "2018-05-15",
      "age": 6,
      "gender": "female",
      "interests": ["swimming", "arts"],
      "avatarUrl": "https://...",
      "isActive": true
    }
  ]
}
```

### GET /api/children/stats
Get children with activity statistics.

### GET /api/children/shared
Get children shared with the user by other parents.

### GET /api/children/shared-with-me
Alias for `/api/children/shared` (mobile app compatibility).

### GET /api/children/search
Search children by name.

**Query Parameters**
- `q` (required): Search query

### GET /api/children/:childId
Get single child profile.

### PUT /api/children/:childId
Update child profile.

### PATCH /api/children/:childId
Update child profile (PATCH method).

### PATCH /api/children/:childId/interests
Update child interests.

**Request Body**
```json
{
  "interests": ["swimming", "music", "dance"]
}
```

### DELETE /api/children/:childId
Delete child profile.

**Query Parameters**
- `permanent` (boolean): Permanently delete instead of soft delete

### POST /api/children/bulk
Bulk create children.

**Request Body**
```json
{
  "children": [
    { "name": "Emma", "dateOfBirth": "2018-05-15" },
    { "name": "Jack", "dateOfBirth": "2020-03-20" }
  ]
}
```

---

## Child Activities Endpoints

All endpoints **require authentication**.

### POST /api/children/:childId/activities
Add activity to child's calendar.

**Request Body**
```json
{
  "activityId": "uuid",
  "status": "planned",
  "scheduledDate": "2024-09-01",
  "startTime": "09:00",
  "endTime": "10:00",
  "notes": "Pack swim gear"
}
```

### GET /api/children/:childId/activities
Get activities for a specific child.

**Query Parameters**
- `status`: planned/in_progress/completed

### GET /api/children/activities/all
Get all activities for all user's children (for calendar).

**Query Parameters**
- `startDate`: Filter start date
- `endDate`: Filter end date

### PATCH /api/children/:childId/activities/:activityId
Update child activity status.

**Request Body**
```json
{
  "status": "completed",
  "notes": "Emma loved it!"
}
```

### DELETE /api/children/:childId/activities/:activityId
Remove activity from child's calendar.

### GET /api/children/activities/:activityId/assigned
Check if activity is assigned to any of the user's children.

---

## Child Activities Service Endpoints

Alternative routes for managing child-activity relationships.

### POST /api/child-activities/link
Link activity to child.

**Request Body**
```json
{
  "childId": "uuid",
  "activityId": "uuid",
  "status": "planned",
  "notes": "Optional notes"
}
```

### POST /api/child-activities/bulk-link
Bulk link activities to child.

**Request Body**
```json
{
  "childId": "uuid",
  "activityIds": ["uuid1", "uuid2", "uuid3"],
  "status": "planned"
}
```

### PUT /api/child-activities/:childId/activities/:activityId
Update activity status.

**Request Body**
```json
{
  "status": "completed",
  "notes": "Great experience",
  "rating": 5
}
```

### DELETE /api/child-activities/:childId/activities/:activityId
Unlink activity from child.

### GET /api/child-activities/history
Get activity history with filtering.

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| childId | string | Filter by child |
| status | string | planned/in_progress/completed |
| startDate | date | Filter start date |
| endDate | date | Filter end date |
| category | string | Filter by category |
| minRating | number | Minimum rating (1-5) |
| page | number | Page number |
| limit | number | Items per page (max 100) |

### GET /api/child-activities/:childId/recommendations
Get age-appropriate activity recommendations for child.

### GET /api/child-activities/:childId/favorites
Get child's favorite activities (highly rated or in progress).

### GET /api/child-activities/calendar
Get calendar data for activities.

**Query Parameters**
- `view`: week/month/year
- `date`: Center date for view
- `childIds`: Comma-separated child IDs

**Response**
```json
{
  "success": true,
  "events": [
    {
      "id": "uuid",
      "childId": "uuid",
      "childName": "Emma",
      "activityId": "uuid",
      "activityName": "Swimming Lessons",
      "status": "in_progress",
      "startDate": "2024-09-01T09:00:00Z",
      "endDate": "2024-09-01T10:00:00Z",
      "location": "Ron Andrews Recreation Centre",
      "category": "Aquatics"
    }
  ]
}
```

### GET /api/child-activities/stats
Get activity statistics for children.

**Query Parameters**
- `childIds`: Comma-separated child IDs (optional)

### GET /api/child-activities/upcoming
Get upcoming activities for notification.

**Query Parameters**
- `days`: Number of days ahead (default: 7)

### GET /api/child-activities/:childId/activities
Get activities for specific child with optional status filter.

---

## Cities & Locations Endpoints

### GET /api/v1/cities
Get all cities with venue and activity counts.

**Query Parameters**
- `includeEmpty`: Include cities without activities
- `hideClosedActivities`: Filter counts
- `hideFullActivities`: Filter counts

**Response**
```json
{
  "success": true,
  "data": [
    {
      "city": "North Vancouver",
      "province": "BC",
      "venueCount": 12,
      "activityCount": 450
    }
  ],
  "total": 8
}
```

### GET /api/v1/cities/:city/locations
Get all venues in a specific city.

### GET /api/v1/cities/:city/activities
Get all activities in a specific city.

**Query Parameters**
- `page`: Page number
- `limit`: Items per page
- `activityType`: Filter by type code

### GET /api/v1/locations/cities
Get all cities (alternative endpoint).

### GET /api/v1/locations/:cityId/venues
Get all venues in a city by city ID.

**Response**
```json
{
  "success": true,
  "city": {
    "id": "uuid",
    "name": "North Vancouver",
    "province": "BC"
  },
  "venues": [
    {
      "id": "uuid",
      "name": "Ron Andrews Recreation Centre",
      "address": "931 Lytton St",
      "postalCode": "V7H 2A7",
      "latitude": 49.3215,
      "longitude": -123.0725,
      "activityCount": 125,
      "fullAddress": "931 Lytton St, North Vancouver, BC V7H 2A7",
      "mapUrl": "https://maps.apple.com/..."
    }
  ]
}
```

### GET /api/v1/locations/:venueId/activities
Get activities at a specific venue with extensive filtering.

**Query Parameters**
All standard activity filters plus venue-specific context.

---

## Favorites Endpoints

All endpoints **require authentication**.

### POST /api/favorites
Add activity to favorites.

**Request Body**
```json
{
  "activityId": "uuid"
}
```

### GET /api/favorites
Get user's favorite activities.

**Response**
```json
{
  "success": true,
  "favorites": [
    {
      "id": "uuid",
      "activityId": "uuid",
      "createdAt": "2024-01-01T00:00:00Z",
      "notifyOnChange": true,
      "activity": {
        "id": "uuid",
        "name": "Swimming Lessons",
        // ... activity details
      }
    }
  ]
}
```

### DELETE /api/favorites/:activityId
Remove activity from favorites.

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request data |
| RATE_LIMIT | 429 | Too many requests |
| SERVER_ERROR | 500 | Internal server error |

---

## Pagination

All list endpoints support pagination:

```json
{
  "pagination": {
    "total": 2940,
    "limit": 50,
    "offset": 0,
    "pages": 59,
    "hasMore": true
  }
}
```

**Maximum items per page**: 100

---

## cURL Examples

```bash
# Health check
curl https://kids-activity-api-205843686007.us-central1.run.app/health

# Search activities
curl "https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activities?\
activityType=aquatics&ageMin=5&ageMax=10&limit=10"

# Login
curl -X POST https://kids-activity-api-205843686007.us-central1.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Authenticated request
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://kids-activity-api-205843686007.us-central1.run.app/api/children

# Create child profile
curl -X POST https://kids-activity-api-205843686007.us-central1.run.app/api/children \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Emma","dateOfBirth":"2018-05-15","interests":["swimming"]}'
```

---

## API Versioning

- Current version: `v1`
- Version in URL: `/api/v1/...`
- Non-versioned endpoints: `/api/...` (authentication, children, favorites)

---

**Document Version**: 4.0
**Last Updated**: December 2024
**Next Review**: March 2025
