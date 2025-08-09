# Children Profile Management API Documentation

## Overview

The Children Profile Management system allows parents to create and manage profiles for their children, track their activities, and get age-appropriate activity recommendations. All endpoints require authentication, and users can only access their own children's data.

## Children Management Endpoints

### Create Child Profile
**POST** `/api/children`

Creates a new child profile for the authenticated user.

**Request Body:**
```json
{
  "name": "Emma Johnson",
  "dateOfBirth": "2018-05-15",
  "gender": "female",
  "interests": ["swimming", "art", "music"],
  "notes": "Allergic to peanuts",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "child": {
    "id": "uuid",
    "name": "Emma Johnson",
    "dateOfBirth": "2018-05-15T00:00:00.000Z",
    "gender": "female",
    "interests": ["swimming", "art", "music"],
    "notes": "Allergic to peanuts",
    "avatarUrl": "https://example.com/avatar.jpg",
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### Get All Children
**GET** `/api/children`

Retrieves all children profiles for the authenticated user.

**Query Parameters:**
- `includeInactive` (boolean): Include deactivated children profiles

**Response:**
```json
{
  "success": true,
  "children": [
    {
      "id": "uuid",
      "name": "Emma Johnson",
      "dateOfBirth": "2018-05-15T00:00:00.000Z",
      "age": 6,
      "ageInMonths": 79,
      "gender": "female",
      "interests": ["swimming", "art", "music"],
      "isActive": true
    }
  ]
}
```

### Get Children with Statistics
**GET** `/api/children/stats`

Retrieves children profiles with activity statistics.

**Response:**
```json
{
  "success": true,
  "children": [
    {
      "id": "uuid",
      "name": "Emma Johnson",
      "age": 6,
      "ageInMonths": 79,
      "activityStats": {
        "interested": 5,
        "registered": 3,
        "completed": 2,
        "cancelled": 0
      }
    }
  ]
}
```

### Get Child by ID
**GET** `/api/children/:childId`

Retrieves a specific child profile.

**Response:**
```json
{
  "success": true,
  "child": {
    "id": "uuid",
    "name": "Emma Johnson",
    "dateOfBirth": "2018-05-15T00:00:00.000Z",
    "age": 6,
    "ageInMonths": 79,
    "gender": "female",
    "interests": ["swimming", "art", "music"],
    "notes": "Allergic to peanuts",
    "isActive": true
  }
}
```

### Update Child Profile
**PUT** `/api/children/:childId`

Updates a child profile.

**Request Body:** (all fields optional)
```json
{
  "name": "Emma M. Johnson",
  "interests": ["swimming", "art", "music", "dance"],
  "notes": "Updated notes"
}
```

### Update Child Interests
**PATCH** `/api/children/:childId/interests`

Updates only the interests array for a child.

**Request Body:**
```json
{
  "interests": ["swimming", "dance", "gymnastics"]
}
```

### Delete Child Profile
**DELETE** `/api/children/:childId`

Soft deletes (deactivates) a child profile.

**Query Parameters:**
- `permanent` (boolean): If true, permanently deletes the profile and all associated data

### Search Children
**GET** `/api/children/search`

Search children by name, interests, or notes.

**Query Parameters:**
- `q` (string, required): Search query

### Bulk Create Children
**POST** `/api/children/bulk`

Create multiple child profiles at once.

**Request Body:**
```json
{
  "children": [
    {
      "name": "Emma Johnson",
      "dateOfBirth": "2018-05-15",
      "gender": "female",
      "interests": ["swimming", "art"]
    },
    {
      "name": "Liam Johnson",
      "dateOfBirth": "2020-08-22",
      "gender": "male",
      "interests": ["music", "sports"]
    }
  ]
}
```

## Child Activities Endpoints

### Link Activity to Child
**POST** `/api/child-activities/link`

Links an activity to a child with a specific status.

**Request Body:**
```json
{
  "childId": "child-uuid",
  "activityId": "activity-uuid",
  "status": "interested",
  "notes": "Looking forward to this!"
}
```

**Status Values:**
- `interested`: Child is interested in the activity
- `registered`: Child is registered for the activity
- `completed`: Child has completed the activity
- `cancelled`: Registration was cancelled

### Bulk Link Activities
**POST** `/api/child-activities/bulk-link`

Link multiple activities to a child at once.

**Request Body:**
```json
{
  "childId": "child-uuid",
  "activityIds": ["activity-uuid-1", "activity-uuid-2"],
  "status": "interested"
}
```

### Update Activity Status
**PUT** `/api/child-activities/:childId/activities/:activityId`

Updates the status of a linked activity.

**Request Body:**
```json
{
  "status": "completed",
  "rating": 5,
  "notes": "Emma loved this class!"
}
```

### Remove Activity Link
**DELETE** `/api/child-activities/:childId/activities/:activityId`

Removes the link between a child and an activity.

### Get Activity History
**GET** `/api/child-activities/history`

Retrieves activity history with filtering options.

**Query Parameters:**
- `childId` (string): Filter by specific child
- `status` (string): Filter by status
- `startDate` (ISO date): Filter by start date
- `endDate` (ISO date): Filter by end date
- `category` (string): Filter by activity category
- `minRating` (number): Filter by minimum rating

### Get Age-Appropriate Recommendations
**GET** `/api/child-activities/:childId/recommendations`

Gets activity recommendations based on child's age and interests.

**Response:**
```json
{
  "success": true,
  "activities": [
    {
      "id": "activity-uuid",
      "name": "Beginner Swimming",
      "category": "swimming",
      "ageMin": 5,
      "ageMax": 8,
      "cost": 150,
      "dateStart": "2025-02-01T00:00:00.000Z",
      "location": {
        "name": "Community Center Pool",
        "city": "Richmond"
      }
    }
  ]
}
```

### Get Child's Favorite Activities
**GET** `/api/child-activities/:childId/favorites`

Retrieves activities the child has registered for or completed with high ratings.

### Get Calendar Data
**GET** `/api/child-activities/calendar`

Retrieves activity data formatted for calendar display.

**Query Parameters:**
- `view` (string): 'week', 'month', or 'year' (default: 'month')
- `date` (ISO date): Reference date for the calendar view
- `childIds` (comma-separated string): Filter by specific children

**Response:**
```json
{
  "success": true,
  "events": [
    {
      "id": "event-uuid",
      "childId": "child-uuid",
      "childName": "Emma Johnson",
      "activityId": "activity-uuid",
      "activityName": "Swimming Lessons",
      "status": "registered",
      "startDate": "2025-02-01T10:00:00.000Z",
      "endDate": "2025-02-01T11:00:00.000Z",
      "location": "Community Pool",
      "category": "swimming"
    }
  ]
}
```

### Get Activity Statistics
**GET** `/api/child-activities/stats`

Retrieves aggregate statistics for children's activities.

**Query Parameters:**
- `childIds` (comma-separated string): Filter by specific children

**Response:**
```json
{
  "success": true,
  "stats": {
    "byStatus": [
      {
        "childId": "child-uuid",
        "status": "completed",
        "_count": 5
      }
    ],
    "totalActivities": [...],
    "averageRating": 4.5,
    "totalRated": 10
  }
}
```

### Get Upcoming Activities
**GET** `/api/child-activities/upcoming`

Retrieves upcoming registered activities for notification purposes.

**Query Parameters:**
- `days` (number): Number of days to look ahead (default: 7)

### Get Activities for Specific Child
**GET** `/api/child-activities/:childId/activities`

Retrieves all activities for a specific child.

**Query Parameters:**
- `status` (string): Filter by activity status

## Authorization & Security

1. **Authentication Required**: All endpoints require a valid JWT token in the Authorization header
2. **Ownership Verification**: Users can only access and modify their own children's data
3. **Cascade Deletion**: When a child profile is permanently deleted, all associated activity links are also removed
4. **Soft Delete**: By default, child profiles are soft-deleted (marked as inactive) to preserve history

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (attempting to access another user's data)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

## Best Practices

1. **Age Calculations**: Ages are automatically calculated from date of birth
2. **Activity Status Flow**: 
   - Start with "interested"
   - Move to "registered" when enrolled
   - Update to "completed" or "cancelled" as appropriate
3. **Ratings**: Only applicable for completed activities (1-5 scale)
4. **Bulk Operations**: Use bulk endpoints when linking multiple activities to improve performance
5. **Calendar Integration**: Use the calendar endpoint to display activities in a calendar view
6. **Notifications**: Use the upcoming activities endpoint to send reminders