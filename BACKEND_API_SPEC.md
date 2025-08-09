# Backend API Specification

## Overview

The Kids Activity Tracker backend provides a RESTful API for managing children's activities, user authentication, favorites, and preferences. The API is built with Node.js, Express, and PostgreSQL, deployed on Google Cloud Run.

**Base URL**: `https://kids-activity-api-44042034457.us-central1.run.app`

## Authentication

The API uses JWT-based authentication with access and refresh tokens.

### Headers
- `Authorization: Bearer <access_token>` - Required for authenticated endpoints
- `Content-Type: application/json` - Required for all POST/PUT requests

## Endpoints

### Health Check

#### GET /health
Check API health status

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-08-09T00:00:00.000Z"
}
```

### Authentication Endpoints

#### POST /api/auth/register
Create a new user account

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "isVerified": false
  },
  "tokens": {
    "accessToken": "jwt_token",
    "refreshToken": "jwt_token",
    "accessTokenExpiry": 1754709921,
    "refreshTokenExpiry": 1755313821
  }
}
```

#### POST /api/auth/login
Login with email and password

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "isVerified": true
  },
  "tokens": {
    "accessToken": "jwt_token",
    "refreshToken": "jwt_token",
    "accessTokenExpiry": 1754709921,
    "refreshTokenExpiry": 1755313821
  }
}
```

#### POST /api/auth/refresh
Refresh access token using refresh token

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "tokens": {
    "accessToken": "new_jwt_token",
    "refreshToken": "new_refresh_token",
    "accessTokenExpiry": 1754709921,
    "refreshTokenExpiry": 1755313821
  }
}
```

#### POST /api/auth/logout
Logout and invalidate tokens

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### GET /api/auth/check
Check if user is authenticated

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

### Activity Endpoints

#### GET /api/v1/activities
Search and filter activities

**Query Parameters:**
- `search` (string): Search term for activity name/description
- `category` (string): Filter by category (e.g., "Swimming", "Camps")
- `ageMin` (number): Minimum age filter
- `ageMax` (number): Maximum age filter
- `costMin` (number): Minimum cost filter
- `costMax` (number): Maximum cost filter
- `location` (string): Filter by location
- `limit` (number): Number of results per page (default: 50)
- `offset` (number): Pagination offset (default: 0)
- `sortBy` (string): Sort field (cost, dateStart, name, createdAt)
- `sortOrder` (string): Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "activities": [
    {
      "id": "uuid",
      "name": "Swimming Lessons - Level 1",
      "description": "Beginner swimming lessons",
      "category": "Swimming",
      "provider": {
        "id": "uuid",
        "name": "NVRC"
      },
      "location": "Ron Andrews Community Recreation Centre",
      "ageMin": 6,
      "ageMax": 12,
      "cost": 150,
      "dateStart": "2025-09-01",
      "dateEnd": "2025-09-30",
      "registrationUrl": "https://...",
      "imageUrl": "https://...",
      "spotsAvailable": 5,
      "totalSpots": 20,
      "isActive": true,
      "createdAt": "2025-08-01T00:00:00.000Z",
      "updatedAt": "2025-08-01T00:00:00.000Z",
      "_count": {
        "favorites": 10
      }
    }
  ],
  "total": 100,
  "hasMore": true,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 100,
    "pages": 2
  }
}
```

#### GET /api/v1/activities/:id
Get activity details by ID

**Response:**
```json
{
  "success": true,
  "activity": {
    "id": "uuid",
    "name": "Swimming Lessons - Level 1",
    "description": "Detailed description...",
    "category": "Swimming",
    "provider": {
      "id": "uuid",
      "name": "NVRC",
      "website": "https://nvrc.ca"
    },
    "location": {
      "id": "uuid",
      "name": "Ron Andrews Community Recreation Centre",
      "address": "931 Lytton St",
      "city": "North Vancouver",
      "province": "BC"
    },
    // ... all activity fields
  }
}
```

#### GET /api/v1/activities/stats/summary
Get activity statistics

**Response:**
```json
{
  "success": true,
  "stats": {
    "categories": [
      {
        "category": "Swimming",
        "count": 882
      },
      {
        "category": "Camps",
        "count": 237
      }
    ],
    "totalCategories": 30,
    "upcomingCount": 46
  }
}
```

### Favorites Endpoints

#### GET /api/favorites
Get user's favorite activities

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "favorites": [
    {
      "id": "uuid",
      "userId": "uuid",
      "activityId": "uuid",
      "notes": "Great for beginners",
      "createdAt": "2025-08-01T00:00:00.000Z",
      "activity": {
        // Full activity object
      }
    }
  ]
}
```

#### POST /api/favorites
Add activity to favorites

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "activityId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Activity added to favorites",
  "favorite": {
    "id": "uuid",
    "userId": "uuid",
    "activityId": "uuid",
    "createdAt": "2025-08-01T00:00:00.000Z"
  }
}
```

#### DELETE /api/favorites/:activityId
Remove activity from favorites

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "message": "Activity removed from favorites"
}
```

### User Preferences

#### GET /api/preferences
Get user preferences

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "preferences": {
    "categories": ["Swimming", "Camps"],
    "ageMin": 6,
    "ageMax": 12,
    "maxCost": 500,
    "locations": ["North Vancouver"],
    "notifications": {
      "newActivities": true,
      "priceDrops": true,
      "availability": true
    }
  }
}
```

#### PUT /api/preferences
Update user preferences

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "categories": ["Swimming", "Camps", "Sports"],
  "ageMin": 5,
  "ageMax": 10,
  "maxCost": 300,
  "locations": ["North Vancouver", "West Vancouver"],
  "notifications": {
    "newActivities": true,
    "priceDrops": false,
    "availability": true
  }
}
```

### Reference Data Endpoints

#### GET /api/v1/categories
Get all available categories

**Response:**
```json
{
  "success": true,
  "categories": [
    "Adult",
    "All Ages & Family",
    "Aquatic Leadership",
    "Camps",
    "Certifications and Leadership",
    "Climbing",
    "Cooking",
    "Dance",
    "Early Years Playtime",
    "Early Years: On My Own",
    "Early Years: Parent Participation",
    "Gymnastics",
    "Kids Night Out",
    "Learn and Play",
    "Martial Arts",
    "Movement & Fitness Dance",
    "Multisport",
    "Music",
    "Pottery",
    "Racquet Sports",
    "School Age",
    "School Programs",
    "Skating",
    "Spin",
    "Strength & Cardio",
    "Swimming",
    "Team Sports",
    "Visual Arts",
    "Yoga",
    "Youth"
  ]
}
```

#### GET /api/v1/locations
Get all activity locations

**Response:**
```json
{
  "success": true,
  "locations": [
    {
      "id": "uuid",
      "name": "Ron Andrews Community Recreation Centre",
      "address": "931 Lytton St",
      "city": "North Vancouver",
      "province": "BC",
      "postalCode": "V7H 2A4",
      "facility": "Recreation Centre"
    }
  ]
}
```

#### GET /api/v1/providers
Get all activity providers

**Response:**
```json
{
  "success": true,
  "providers": [
    {
      "id": "uuid",
      "name": "NVRC",
      "website": "https://nvrc.ca",
      "contactEmail": "info@nvrc.ca",
      "contactPhone": "604-123-4567"
    }
  ]
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., email already exists)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Rate Limiting

The API implements rate limiting:
- **Window**: 15 minutes
- **Max requests**: 100 per window
- **Headers returned**:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Timestamp when limit resets

## Pagination

List endpoints support pagination using `limit` and `offset` parameters:
- Default limit: 50
- Maximum limit: 100
- Offset starts at 0

Example: `/api/v1/activities?limit=20&offset=40` returns items 41-60

## Data Formats

- **Dates**: ISO 8601 format (YYYY-MM-DD)
- **Timestamps**: ISO 8601 with timezone (YYYY-MM-DDTHH:mm:ss.sssZ)
- **Money**: Integer representing cents (e.g., 15000 = $150.00)

## Testing

Test credentials are available:
- **Email**: test@kidsactivitytracker.com
- **Password**: Test123!

Use the test script to verify API functionality:
```bash
./TEST_API.sh
```