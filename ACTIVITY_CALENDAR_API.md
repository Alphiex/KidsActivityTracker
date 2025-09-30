# Activity Calendar API Endpoints

## API Base URL
**Production:** `https://kids-activity-api-205843686007.us-central1.run.app`

All endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Child Activity Management Endpoints

### 1. Add Activity to Child's Calendar
**POST** `/api/children/:childId/activities`

Assigns an activity to a child's calendar.

**Path Parameters:**
- `childId` (string, required) - The UUID of the child

**Request Body:**
```json
{
  "activityId": "string (UUID, required)",
  "status": "string (optional, default: 'planned') - 'planned' | 'in_progress' | 'completed'",
  "scheduledDate": "string (ISO 8601, optional) - When the activity is scheduled",
  "startTime": "string (optional) - Start time (e.g., '9:00 am')",
  "endTime": "string (optional) - End time (e.g., '12:00 pm')",
  "notes": "string (optional) - Additional notes"
}
```

**Response:**
```json
{
  "success": true,
  "childActivity": {
    "id": "uuid",
    "childId": "uuid",
    "activityId": "uuid",
    "status": "planned",
    "scheduledDate": "2025-09-30T10:00:00Z",
    "startTime": "9:00 am",
    "endTime": "12:00 pm",
    "notes": "...",
    "createdAt": "2025-09-29T...",
    "activity": { /* full activity object */ },
    "child": { /* full child object */ }
  }
}
```

---

### 2. Get Activities for a Child
**GET** `/api/children/:childId/activities`

Retrieves all activities assigned to a specific child.

**Path Parameters:**
- `childId` (string, required) - The UUID of the child

**Query Parameters:**
- `status` (string, optional) - Filter by status: 'planned' | 'in_progress' | 'completed'

**Response:**
```json
{
  "success": true,
  "activities": [
    {
      "id": "uuid",
      "childId": "uuid",
      "activityId": "uuid",
      "status": "planned",
      "scheduledDate": "2025-09-30T10:00:00Z",
      "activity": { /* activity details with location */ }
    }
  ]
}
```

---

### 3. Get All Activities for User's Children
**GET** `/api/children/activities/all`

Retrieves all activities across all children for the authenticated user. Useful for calendar views.

**Query Parameters:**
- `startDate` (string, ISO 8601, optional) - Filter activities from this date
- `endDate` (string, ISO 8601, optional) - Filter activities until this date

**Response:**
```json
{
  "success": true,
  "activities": [
    {
      "id": "uuid",
      "childId": "uuid",
      "activityId": "uuid",
      "status": "planned",
      "scheduledDate": "2025-09-30T10:00:00Z",
      "activity": { /* activity details */ },
      "child": { /* child details */ }
    }
  ]
}
```

---

### 4. Update Activity Status
**PATCH** `/api/children/:childId/activities/:activityId`

Updates the status of an assigned activity.

**Path Parameters:**
- `childId` (string, required) - The UUID of the child
- `activityId` (string, required) - The UUID of the child activity record

**Request Body:**
```json
{
  "status": "string (required) - 'planned' | 'in_progress' | 'completed'",
  "notes": "string (optional) - Updated notes"
}
```

**Response:**
```json
{
  "success": true,
  "childActivity": {
    "id": "uuid",
    "status": "completed",
    "completedAt": "2025-09-30T15:00:00Z",
    /* ... other fields */
  }
}
```

---

### 5. Remove Activity from Calendar
**DELETE** `/api/children/:childId/activities/:activityId`

Removes an activity from a child's calendar.

**Path Parameters:**
- `childId` (string, required) - The UUID of the child
- `activityId` (string, required) - The UUID of the child activity record

**Response:**
```json
{
  "success": true,
  "message": "Activity removed from child calendar"
}
```

---

### 6. Check if Activity is Assigned
**GET** `/api/children/activities/:activityId/assigned`

Checks if an activity is assigned to any of the user's children. Used to display the calendar icon.

**Path Parameters:**
- `activityId` (string, required) - The UUID of the activity

**Response:**
```json
{
  "success": true,
  "isAssigned": true
}
```

---

## Frontend Integration

The mobile app is already configured to use these endpoints via:

**Location:** `src/config/api.ts`
```typescript
API_CONFIG.BASE_URL = 'https://kids-activity-api-205843686007.us-central1.run.app'
```

**Service:** `src/services/childrenService.ts`
- `addActivityToChild()` - Calls POST endpoint
- `getChildActivitiesList()` - Calls GET endpoint
- `updateActivityStatus()` - Calls PATCH endpoint
- `removeActivityFromChild()` - Calls DELETE endpoint
- `isActivityAssignedToAnyChild()` - Calls assigned check endpoint

## Features

✅ Activities are persisted to PostgreSQL database
✅ Supports shared child access (family members can see assigned activities)
✅ Calendar icons automatically appear on activity cards when assigned
✅ Real-time sync across devices
✅ Local cache with fallback for offline support
✅ Ownership verification and access control

## Testing

To test the endpoints, you can use the deployed API:

```bash
# Get auth token first
curl -X POST https://kids-activity-api-205843686007.us-central1.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'

# Then use the token in subsequent requests
curl -X POST https://kids-activity-api-205843686007.us-central1.run.app/api/children/{childId}/activities \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"activityId":"activity-uuid","status":"planned"}'
```

## Database Schema

Activities are stored in the `ChildActivity` table:
- `id` - UUID primary key
- `childId` - Foreign key to Child
- `activityId` - Foreign key to Activity
- `status` - planned | in_progress | completed
- `scheduledDate` - When activity occurs
- `startTime` / `endTime` - Time range
- `notes` - Optional notes
- Unique constraint on (childId, activityId) - prevents duplicates