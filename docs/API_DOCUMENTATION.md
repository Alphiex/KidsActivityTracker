# API Documentation

## Base URL

**Production**: `https://kids-activity-api-205843686007.us-central1.run.app`  
**Local Development**: `http://localhost:3000`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### Headers
```http
Authorization: Bearer <token>
Content-Type: application/json
```

## Endpoints

### Health Check

#### GET /health
Check API health status.

**Response**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-08-30T12:00:00Z"
}
```

---

### Authentication

#### POST /api/auth/register
Register a new user account.

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### POST /api/auth/login
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
  "token": "jwt_token_here",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

#### POST /api/auth/refresh
Refresh authentication token.

**Headers**
```http
Authorization: Bearer <expired_token>
```

**Response**
```json
{
  "success": true,
  "token": "new_jwt_token_here"
}
```

---

### Activities

#### GET /api/v1/activities
Get list of activities with filtering and pagination.

**Query Parameters**
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| limit | number | Results per page | 20 |
| offset | number | Skip records | 0 |
| category | string | Filter by category | - |
| subcategory | string | Filter by subcategory | - |
| ageMin | number | Minimum age | - |
| ageMax | number | Maximum age | - |
| costMin | number | Minimum cost | - |
| costMax | number | Maximum cost | - |
| dateStart | string | Activities after date | - |
| dateEnd | string | Activities before date | - |
| locationId | string | Filter by location | - |
| city | string | Filter by city | - |
| registrationStatus | string | open/closed/waitlist | - |
| searchTerm | string | Search in name/description | - |
| sortBy | string | name/date/cost | date |
| sortOrder | string | asc/desc | asc |

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
      "dateStart": "2024-09-01T09:00:00Z",
      "dateEnd": "2024-10-01T10:00:00Z",
      "ageMin": 5,
      "ageMax": 8,
      "cost": 120.00,
      "spotsAvailable": 5,
      "totalSpots": 12,
      "location": {
        "id": "uuid",
        "name": "Ron Andrews Recreation Centre",
        "address": "931 Lytton St",
        "city": "North Vancouver"
      },
      "provider": {
        "id": "uuid",
        "name": "NVRC"
      },
      "registrationUrl": "https://...",
      "registrationStatus": "open",
      "instructor": "Jane Smith"
    }
  ],
  "pagination": {
    "total": 2940,
    "limit": 20,
    "offset": 0,
    "pages": 147
  }
}
```

#### GET /api/v1/activities/:id
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
        "date": "2024-09-01",
        "startTime": "09:00",
        "endTime": "10:00"
      }
    ],
    // ... all activity fields
  }
}
```

#### GET /api/v1/activities/categories
Get available categories and subcategories.

**Response**
```json
{
  "success": true,
  "categories": [
    {
      "name": "Aquatics",
      "count": 450,
      "subcategories": [
        {
          "name": "Learn to Swim",
          "count": 200
        },
        {
          "name": "Competitive Swimming",
          "count": 100
        }
      ]
    },
    {
      "name": "Arts",
      "count": 320,
      "subcategories": [
        {
          "name": "Visual Arts",
          "count": 150
        }
      ]
    }
  ]
}
```

#### GET /api/v1/activities/locations
Get available locations.

**Response**
```json
{
  "success": true,
  "locations": [
    {
      "id": "uuid",
      "name": "Ron Andrews Recreation Centre",
      "address": "931 Lytton St",
      "city": "North Vancouver",
      "latitude": 49.3215,
      "longitude": -123.0725,
      "activityCount": 245
    }
  ]
}
```

---

### Children Profiles

#### GET /api/children
Get user's children profiles.

**Headers Required**: Authorization

**Response**
```json
{
  "success": true,
  "children": [
    {
      "id": "uuid",
      "name": "Emma",
      "birthDate": "2018-05-15",
      "age": 6,
      "interests": ["swimming", "arts", "dance"],
      "avatarUrl": "https://..."
    }
  ]
}
```

#### POST /api/children
Create child profile.

**Request Body**
```json
{
  "name": "Emma",
  "birthDate": "2018-05-15",
  "interests": ["swimming", "arts"]
}
```

**Response**
```json
{
  "success": true,
  "child": {
    "id": "uuid",
    "name": "Emma",
    "birthDate": "2018-05-15",
    "interests": ["swimming", "arts"]
  }
}
```

#### PUT /api/children/:id
Update child profile.

**Request Body**
```json
{
  "name": "Emma",
  "interests": ["swimming", "arts", "music"]
}
```

#### DELETE /api/children/:id
Delete child profile.

---

### Child Activities

#### POST /api/child-activities
Register child for activity.

**Request Body**
```json
{
  "childId": "uuid",
  "activityId": "uuid",
  "status": "registered",
  "notes": "Needs early pickup on Thursdays"
}
```

#### GET /api/child-activities
Get child's registered activities.

**Query Parameters**
- `childId` - Filter by child
- `status` - registered/interested/completed

**Response**
```json
{
  "success": true,
  "activities": [
    {
      "id": "uuid",
      "child": {
        "id": "uuid",
        "name": "Emma"
      },
      "activity": {
        "id": "uuid",
        "name": "Swimming Lessons"
      },
      "status": "registered",
      "registeredAt": "2024-08-15T10:00:00Z"
    }
  ]
}
```

---

### Favorites

#### POST /api/favorites
Add activity to favorites.

**Request Body**
```json
{
  "activityId": "uuid"
}
```

#### GET /api/favorites
Get user's favorite activities.

#### DELETE /api/favorites/:activityId
Remove from favorites.

---

### Activity Sharing

#### POST /api/invitations
Create sharing invitation.

**Request Body**
```json
{
  "email": "friend@example.com",
  "childId": "uuid",
  "message": "Check out Emma's activities!"
}
```

#### GET /api/invitations
Get pending invitations.

#### POST /api/invitations/:id/accept
Accept invitation.

#### GET /api/shared-activities
Get activities shared with user.

---

## Data Models

### Activity Model
```typescript
interface Activity {
  id: string;
  providerId: string;
  externalId: string;
  courseId?: string;
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  fullDescription?: string;
  dateStart?: Date;
  dateEnd?: Date;
  registrationDate?: Date;
  registrationEndDate?: Date;
  ageMin?: number;
  ageMax?: number;
  cost: number;
  spotsAvailable?: number;
  totalSpots?: number;
  locationId?: string;
  locationName?: string;
  registrationUrl?: string;
  registrationStatus?: string;
  instructor?: string;
  prerequisites?: string;
  whatToBring?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### User Model
```typescript
interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
  children: Child[];
  favorites: Favorite[];
}
```

### Child Model
```typescript
interface Child {
  id: string;
  userId: string;
  name: string;
  birthDate: Date;
  interests: string[];
  avatarUrl?: string;
  activities: ChildActivity[];
}
```

## Error Responses

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes
- `UNAUTHORIZED` - Missing or invalid token
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request data
- `RATE_LIMIT` - Too many requests
- `SERVER_ERROR` - Internal server error

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **Authenticated**: 200 requests per minute per user
- **Search endpoints**: 30 requests per minute

## Pagination

All list endpoints support pagination:

```json
{
  "pagination": {
    "total": 2940,      // Total records
    "limit": 20,        // Page size
    "offset": 0,        // Records skipped
    "pages": 147,       // Total pages
    "hasMore": true     // More pages available
  }
}
```

## Search & Filtering

### Text Search
Use `searchTerm` parameter to search across:
- Activity name
- Description
- Instructor name
- Location name

### Date Filtering
- `dateStart` - Activities starting after this date
- `dateEnd` - Activities ending before this date
- Dates in ISO 8601 format: `2024-08-30T00:00:00Z`

### Cost Filtering
- `costMin` - Minimum cost (inclusive)
- `costMax` - Maximum cost (inclusive)
- `costFree=true` - Only free activities

### Age Filtering
- `ageMin` - Minimum age requirement
- `ageMax` - Maximum age requirement
- System finds activities matching child's age

## Webhooks (Future)

Planned webhook events:
- `activity.created` - New activity added
- `activity.updated` - Activity details changed
- `activity.spots_low` - Few spots remaining
- `registration.opening` - Registration about to open

## SDK Examples

### JavaScript/TypeScript
```typescript
import axios from 'axios';

const API_BASE = 'https://kids-activity-api-205843686007.us-central1.run.app';

class KidsActivityAPI {
  constructor(private token?: string) {}

  async getActivities(params = {}) {
    const response = await axios.get(`${API_BASE}/api/v1/activities`, {
      params,
      headers: this.token ? {
        'Authorization': `Bearer ${this.token}`
      } : {}
    });
    return response.data;
  }

  async searchActivities(searchTerm: string, filters = {}) {
    return this.getActivities({
      searchTerm,
      ...filters
    });
  }
}
```

### cURL Examples
```bash
# Get activities
curl https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activities

# Search with filters
curl "https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activities?\
category=Aquatics&ageMin=5&ageMax=10&limit=10"

# Authenticated request
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://kids-activity-api-205843686007.us-central1.run.app/api/children
```

## API Versioning

- Current version: `v1`
- Version in URL: `/api/v1/...`
- Deprecation notice: 6 months minimum
- Sunset period: 3 months after deprecation

## Support

For API issues or questions:
- Check error messages and codes
- Review rate limits
- Verify authentication tokens
- Contact: api-support@kidsactivitytracker.com