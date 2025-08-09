# Kids Activity Tracker v2 - Implementation Plan

## Overview
This document outlines the implementation plan for adding user accounts, children profiles, and activity sharing features to the Kids Activity Tracker app.

## Phase 1: Activity Management Improvements

### 1.1 Update Scraper for Unique Activity Identification
**Priority: High**

- **Current Issue**: Activities may be duplicated on subsequent scraper runs
- **Solution**: Use `providerId + externalId (courseId)` as unique identifier

```javascript
// In scraper code
const uniqueKey = `${providerId}-${courseId}`;

// Check if activity exists
const existingActivity = await prisma.activity.findUnique({
  where: {
    providerId_externalId: {
      providerId: providerId,
      externalId: courseId
    }
  }
});

if (existingActivity) {
  // Update existing activity
  await prisma.activity.update({
    where: { id: existingActivity.id },
    data: {
      ...activityData,
      isActive: true,
      lastSeenAt: new Date()
    }
  });
} else {
  // Create new activity
  await prisma.activity.create({
    data: {
      ...activityData,
      providerId: providerId,
      externalId: courseId,
      isActive: true
    }
  });
}
```

### 1.2 Activity Lifecycle Management
**Priority: High**

```javascript
// Before scraping
await prisma.activity.updateMany({
  where: { providerId: providerId },
  data: { isActive: false }
});

// During scraping
// Mark found activities as active (shown above)

// After scraping - purge old inactive activities
const twelveMonthsAgo = new Date();
twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

await prisma.activity.deleteMany({
  where: {
    isActive: false,
    lastSeenAt: { lt: twelveMonthsAgo }
  }
});
```

### 1.3 Update API to Filter Inactive Activities
```typescript
// In activity service
async searchActivities(params: SearchParams) {
  const where = {
    isActive: true,  // Always filter inactive
    ...otherFilters
  };
  
  return prisma.activity.findMany({ where });
}
```

## Phase 2: User Account System

### 2.1 Database Migration Strategy
1. Keep existing local preferences for backward compatibility
2. Create cloud user accounts with email/password authentication
3. Migrate local preferences to cloud on first login

### 2.2 Authentication Implementation
```typescript
// API endpoints needed
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
GET    /api/v1/auth/verify-email/:token
```

### 2.3 User Account Features
- JWT-based authentication
- Email verification
- Password reset functionality
- Profile management

## Phase 3: Children Profile Management

### 3.1 API Endpoints
```typescript
// Children management
GET    /api/v1/children          // List user's children
POST   /api/v1/children          // Add a child
GET    /api/v1/children/:id      // Get child details
PUT    /api/v1/children/:id      // Update child
DELETE /api/v1/children/:id      // Remove child (soft delete)

// Child-activity relationships
POST   /api/v1/children/:childId/activities/:activityId   // Link activity to child
PUT    /api/v1/children/:childId/activities/:activityId   // Update status
DELETE /api/v1/children/:childId/activities/:activityId   // Remove link
GET    /api/v1/children/:childId/activities               // Get child's activities
```

### 3.2 Activity Status Workflow
```
interested → registered → completed
                ↓
             cancelled
```

## Phase 4: Activity Sharing System

### 4.1 Sharing Flow
1. Parent A sends invitation to Parent B's email
2. Parent B receives email with invitation link
3. Parent B accepts invitation (creates account if needed)
4. Parent A configures what to share (which children, what info)
5. Parent B can view shared activities

### 4.2 Permission Levels
```typescript
enum PermissionLevel {
  VIEW_ALL = 'view_all',              // See all activities (interested, registered, completed)
  VIEW_REGISTERED = 'view_registered', // Only see registered activities
  VIEW_FUTURE = 'view_future'         // Only see future registered activities
}

enum ChildActivityVisibility {
  canViewInterested: boolean
  canViewRegistered: boolean
  canViewCompleted: boolean
  canViewNotes: boolean
}
```

### 4.3 API Endpoints
```typescript
// Invitations
POST   /api/v1/invitations                    // Send invitation
GET    /api/v1/invitations/sent              // List sent invitations
GET    /api/v1/invitations/received          // List received invitations
POST   /api/v1/invitations/:token/accept     // Accept invitation
POST   /api/v1/invitations/:token/decline    // Decline invitation

// Sharing management
GET    /api/v1/shares                        // List all shares (sent and received)
POST   /api/v1/shares                        // Create new share
PUT    /api/v1/shares/:id                   // Update share permissions
DELETE /api/v1/shares/:id                   // Revoke share

// Viewing shared activities
GET    /api/v1/shared-activities             // List all shared activities
GET    /api/v1/shared-activities/children    // List shared children
GET    /api/v1/shared-activities/children/:childId/activities
```

## Phase 5: Mobile App Updates

### 5.1 New Screens Needed
1. **Login/Register Screen**
   - Email/password authentication
   - "Remember me" option
   - Forgot password link

2. **Children Management Screen**
   - List of children
   - Add/edit child form
   - Child avatar selection

3. **Activity Detail Enhancement**
   - "Register Child" button
   - Show which children are registered
   - Activity status per child

4. **Child Activity View**
   - Tabbed view: Interested | Registered | Completed
   - Calendar view of upcoming activities
   - Activity history

5. **Sharing Management Screen**
   - Send invitations
   - Manage shares
   - View shared activities from others

### 5.2 State Management Updates
```typescript
// New Redux slices needed
- authSlice (user authentication state)
- childrenSlice (children profiles)
- sharingSlice (shares and invitations)
- childActivitiesSlice (child-activity relationships)
```

## Security Considerations

### Privacy Controls
1. **Default Privacy**: All children profiles are private by default
2. **Granular Permissions**: Parents control exactly what is shared
3. **Revocable Access**: Shares can be revoked at any time
4. **Audit Trail**: Track all sharing activities
5. **Data Isolation**: Users can only see what's explicitly shared

### Authentication Security
1. **Password Requirements**: Minimum 8 chars, complexity rules
2. **JWT Tokens**: Short-lived access tokens (15 min), longer refresh tokens (7 days)
3. **Email Verification**: Required for new accounts
4. **Rate Limiting**: Prevent brute force attacks
5. **HTTPS Only**: All API calls must be over HTTPS

## Implementation Timeline

### Week 1-2: Activity Management
- Update scraper with unique identification
- Implement activity lifecycle management
- Update API to filter inactive activities

### Week 3-4: User Authentication
- Implement auth endpoints
- Add JWT middleware
- Email verification system

### Week 5-6: Children Profiles
- Children CRUD operations
- Child-activity relationships
- Activity status management

### Week 7-8: Sharing System (Backend)
- Invitation system
- Share management
- Shared activity queries

### Week 9-10: Mobile App - Auth & Children
- Login/register screens
- Children management
- Update activity screens

### Week 11-12: Mobile App - Sharing
- Sharing screens
- Shared activity views
- Testing and refinement

## Database Migration Steps

1. **Backup existing data**
2. **Create new tables** (users, children, etc.)
3. **Run migration scripts**
4. **Update API to use new schema**
5. **Deploy incrementally** with feature flags

## Testing Strategy

### Unit Tests
- Auth service methods
- Children management
- Sharing permissions

### Integration Tests
- Full auth flow
- Activity registration flow
- Sharing workflows

### E2E Tests
- Complete user journeys
- Cross-user sharing scenarios

## Rollout Strategy

1. **Beta Testing**: Limited users test new features
2. **Gradual Rollout**: Feature flags to control access
3. **Migration Support**: Help existing users create accounts
4. **Documentation**: User guides for new features

## Success Metrics

- User account creation rate
- Children profiles per user
- Activities registered per child
- Active sharing relationships
- User engagement increase