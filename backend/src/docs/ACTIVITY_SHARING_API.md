# Activity Sharing System API Documentation

## Overview

The Activity Sharing System allows parents to share their children's activity schedules with other parents. This enables families to coordinate activities, carpools, and playdates more effectively.

## Key Features

- **Invitation System**: Send email invitations to share activities
- **Granular Permissions**: Control what information is shared per child
- **Privacy Controls**: Choose what activity details to share
- **Time-Limited Sharing**: Set expiration dates for shares
- **Audit Trail**: Track all sharing activities

## Authentication

All endpoints require authentication using JWT tokens unless specified otherwise.

```
Authorization: Bearer <access_token>
```

## API Endpoints

### Invitations

#### Send Invitation
```http
POST /api/invitations
```

**Request Body:**
```json
{
  "recipientEmail": "friend@example.com",
  "message": "Would love to coordinate swimming lessons together!",
  "expiresInDays": 7
}
```

**Response:**
```json
{
  "success": true,
  "invitation": {
    "id": "uuid",
    "recipientEmail": "friend@example.com",
    "status": "pending",
    "expiresAt": "2024-01-07T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Get Sent Invitations
```http
GET /api/invitations/sent
```

**Response:**
```json
{
  "success": true,
  "invitations": [
    {
      "id": "uuid",
      "recipientEmail": "friend@example.com",
      "recipientUser": {
        "id": "uuid",
        "name": "Jane Doe",
        "email": "friend@example.com"
      },
      "status": "pending",
      "message": "Would love to coordinate swimming lessons together!",
      "expiresAt": "2024-01-07T00:00:00Z",
      "acceptedAt": null,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Get Received Invitations
```http
GET /api/invitations/received
```

**Response:**
```json
{
  "success": true,
  "invitations": [
    {
      "id": "uuid",
      "token": "secure-token",
      "sender": {
        "id": "uuid",
        "name": "John Smith",
        "email": "john@example.com",
        "childrenCount": 2
      },
      "status": "pending",
      "message": "Let's coordinate activities!",
      "expiresAt": "2024-01-07T00:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Preview Invitation (No Auth Required)
```http
GET /api/invitations/preview/:token
```

**Response:**
```json
{
  "success": true,
  "invitation": {
    "id": "uuid",
    "sender": {
      "name": "John Smith",
      "email": "john@example.com",
      "children": [
        {
          "name": "Emma",
          "age": 7,
          "interests": ["swimming", "art", "dance"]
        },
        {
          "name": "Liam",
          "age": 5,
          "interests": ["soccer", "music"]
        }
      ]
    },
    "status": "pending",
    "message": "Let's coordinate activities!",
    "expiresAt": "2024-01-07T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Accept Invitation
```http
POST /api/invitations/accept
```

**Request Body:**
```json
{
  "token": "invitation-token"
}
```

#### Decline Invitation
```http
POST /api/invitations/decline
```

**Request Body:**
```json
{
  "token": "invitation-token"
}
```

#### Cancel Sent Invitation
```http
DELETE /api/invitations/:id
```

#### Resend Invitation
```http
POST /api/invitations/:id/resend
```

### Sharing Management

#### Configure Sharing
```http
POST /api/sharing
```

**Request Body:**
```json
{
  "sharedWithUserId": "user-uuid",
  "permissionLevel": "view_registered",
  "expiresAt": "2024-12-31T23:59:59Z",
  "childPermissions": [
    {
      "childId": "child-uuid",
      "canViewInterested": true,
      "canViewRegistered": true,
      "canViewCompleted": false,
      "canViewNotes": false
    }
  ]
}
```

**Permission Levels:**
- `view_all`: View all activities
- `view_registered`: View only registered activities
- `view_future`: View only future activities

#### Get All Shares
```http
GET /api/sharing
```

**Response:**
```json
{
  "success": true,
  "myShares": [
    {
      "id": "uuid",
      "sharedWithUser": {
        "id": "uuid",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "permissionLevel": "view_registered",
      "expiresAt": null,
      "isActive": true,
      "children": [
        {
          "id": "child-uuid",
          "name": "Emma",
          "permissions": {
            "canViewInterested": true,
            "canViewRegistered": true,
            "canViewCompleted": false,
            "canViewNotes": false
          }
        }
      ],
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "sharedWithMe": [
    {
      "id": "uuid",
      "sharingUser": {
        "id": "uuid",
        "name": "John Smith",
        "email": "john@example.com"
      },
      "permissionLevel": "view_registered",
      "expiresAt": null,
      "children": [
        {
          "id": "child-uuid",
          "name": "Liam",
          "dateOfBirth": "2018-05-15",
          "interests": ["soccer", "music"],
          "permissions": {
            "canViewInterested": true,
            "canViewRegistered": true,
            "canViewCompleted": false,
            "canViewNotes": false
          }
        }
      ],
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Update Share Settings
```http
PATCH /api/sharing/:id
```

**Request Body:**
```json
{
  "permissionLevel": "view_all",
  "expiresAt": "2024-06-30T23:59:59Z",
  "isActive": true
}
```

#### Update Child Permissions
```http
PATCH /api/sharing/:shareId/children/:childId
```

**Request Body:**
```json
{
  "canViewInterested": true,
  "canViewRegistered": true,
  "canViewCompleted": true,
  "canViewNotes": true
}
```

#### Add Child to Share
```http
POST /api/sharing/:shareId/children
```

**Request Body:**
```json
{
  "childId": "child-uuid",
  "canViewInterested": true,
  "canViewRegistered": true,
  "canViewCompleted": false,
  "canViewNotes": false
}
```

#### Remove Child from Share
```http
DELETE /api/sharing/:shareId/children/:childId
```

#### Revoke Share
```http
DELETE /api/sharing/:id
```

#### Get Sharing Statistics
```http
GET /api/sharing/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "sharingWith": 3,
    "sharedWithMe": 2,
    "childrenShared": 4
  }
}
```

### Shared Activities

#### Get Shared Children
```http
GET /api/shared-activities/children
```

**Query Parameters:**
- `sharingUserId` (optional): Filter by specific sharing user

**Response:**
```json
{
  "success": true,
  "children": [
    {
      "id": "child-uuid",
      "name": "Liam",
      "age": 5,
      "dateOfBirth": "2018-05-15",
      "avatarUrl": null,
      "interests": ["soccer", "music"],
      "activitySummary": {
        "interested": 3,
        "registered": 2,
        "completed": 0
      },
      "permissions": {
        "canViewInterested": true,
        "canViewRegistered": true,
        "canViewCompleted": false,
        "canViewNotes": false
      }
    }
  ]
}
```

#### Get Child's Activities
```http
GET /api/shared-activities/children/:childId/activities
```

**Query Parameters:**
- `status`: Filter by status (interested, registered, completed, cancelled)
- `startDate`: Filter activities starting after this date
- `endDate`: Filter activities starting before this date

**Response:**
```json
{
  "success": true,
  "child": {
    "id": "child-uuid",
    "name": "Liam",
    "age": 5
  },
  "activities": [
    {
      "id": "activity-uuid",
      "status": "registered",
      "registeredAt": "2024-01-01T00:00:00Z",
      "completedAt": null,
      "notes": null,
      "rating": null,
      "activity": {
        "id": "activity-uuid",
        "name": "Soccer Skills Camp",
        "category": "Sports",
        "subcategory": "Soccer",
        "description": "Introduction to soccer fundamentals",
        "schedule": "Tuesdays 4-5pm",
        "dateStart": "2024-02-01T16:00:00Z",
        "dateEnd": "2024-02-01T17:00:00Z",
        "ageMin": 5,
        "ageMax": 7,
        "cost": 150,
        "location": {
          "name": "Community Center",
          "address": "123 Main St",
          "city": "Vancouver"
        },
        "provider": {
          "name": "City Recreation",
          "website": "https://cityrec.example.com"
        }
      }
    }
  ],
  "permissions": {
    "canViewInterested": true,
    "canViewRegistered": true,
    "canViewCompleted": false,
    "canViewNotes": false
  }
}
```

#### Get Calendar View
```http
GET /api/shared-activities/calendar
```

**Query Parameters:**
- `startDate`: Start date for calendar range
- `endDate`: End date for calendar range
- `childIds`: Comma-separated list of child IDs to filter

**Response:**
```json
{
  "success": true,
  "calendar": {
    "2024-02-01": [
      {
        "childId": "child-uuid",
        "childName": "Liam",
        "childActivity": {
          "id": "activity-uuid",
          "status": "registered",
          "notes": null
        },
        "activity": {
          "id": "activity-uuid",
          "name": "Soccer Skills Camp",
          "category": "Sports",
          "dateStart": "2024-02-01T16:00:00Z",
          "dateEnd": "2024-02-01T17:00:00Z",
          "schedule": "Tuesdays 4-5pm",
          "location": "Community Center",
          "cost": 150
        }
      }
    ]
  },
  "children": [
    {
      "id": "child-uuid",
      "name": "Liam",
      "avatarUrl": null
    }
  ]
}
```

#### Get Statistics
```http
GET /api/shared-activities/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalChildren": 3,
    "totalActivities": 15,
    "byStatus": {
      "interested": 7,
      "registered": 6,
      "completed": 2,
      "cancelled": 0
    },
    "byCategory": {
      "Sports": 8,
      "Arts": 4,
      "Education": 3
    },
    "upcomingThisWeek": 4,
    "totalCost": 1250
  }
}
```

#### Export Activities
```http
GET /api/shared-activities/export
```

**Query Parameters:**
- `format`: Export format (json, csv, ical)
- `childIds`: Comma-separated list of child IDs to include

**Response varies by format:**
- JSON: Returns structured data
- CSV: Returns CSV file download
- iCal: Returns .ics file for calendar import

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400`: Bad Request - Invalid input data
- `401`: Unauthorized - Missing or invalid authentication
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource not found
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error

## Security Considerations

1. **Authentication**: All endpoints require valid JWT tokens except invitation preview
2. **Authorization**: Users can only manage their own shares and invitations
3. **Rate Limiting**: Invitation endpoints are rate-limited to prevent spam
4. **Data Privacy**: Sensitive information (notes, completed activities) requires explicit permissions
5. **Token Security**: Invitation tokens are single-use and time-limited
6. **Audit Trail**: All sharing activities are logged for security monitoring

## Best Practices

1. **Minimal Permissions**: Start with minimal permissions and increase as needed
2. **Regular Review**: Periodically review and update sharing permissions
3. **Expiration Dates**: Use expiration dates for temporary sharing arrangements
4. **Clear Communication**: Use invitation messages to explain sharing intent
5. **Privacy First**: Only share necessary information to protect children's privacy