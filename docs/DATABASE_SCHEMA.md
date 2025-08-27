# Kids Activity Tracker - Database Schema Documentation

## Overview
The Kids Activity Tracker uses PostgreSQL as its database with Prisma as the ORM. The schema is designed to support:
- Activity management and tracking from multiple providers
- User accounts and authentication
- Children profiles and activity registration
- Social features (sharing, favorites, invitations)
- Audit trails and scraper job tracking

## Database Tables

### 1. Provider
**Purpose**: Stores information about activity providers (e.g., NVRC, community centers)

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| name | String | Unique | Provider name |
| website | String | Required | Provider's website URL |
| scraperConfig | JSON | Required | Configuration for web scraper |
| isActive | Boolean | Default: true | Whether provider is active |
| createdAt | DateTime | Auto | Record creation timestamp |
| updatedAt | DateTime | Auto | Last update timestamp |

**Relationships**:
- One-to-Many with `Activity`
- One-to-Many with `ScrapeJob`

---

### 2. Location
**Purpose**: Stores physical locations where activities take place

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| name | String | Unique, Required | Location name |
| address | String | Default: "" | Street address |
| city | String | Required | City name |
| province | String | Required | Province/State |
| postalCode | String | Optional | Postal/ZIP code |
| country | String | Default: "Canada" | Country |
| latitude | Float | Optional | GPS latitude |
| longitude | Float | Optional | GPS longitude |
| facility | String | Optional | Specific facility name |
| createdAt | DateTime | Auto | Record creation timestamp |
| updatedAt | DateTime | Auto | Last update timestamp |

**Indexes**: 
- city (for location-based queries)

**Relationships**:
- One-to-Many with `Activity`

---

### 3. Activity
**Purpose**: Core table storing all activity/program information

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| providerId | String | Foreign Key, Required | Link to Provider |
| externalId | String | Required | Provider's course ID |
| name | String | Required | Activity name |
| category | String | Required | Main category (e.g., Sports, Arts) |
| subcategory | String | Optional | Subcategory (e.g., Swimming, Basketball) |
| description | String | Optional | Brief description |
| schedule | String | Optional | Human-readable schedule |
| dates | String | Optional | Date range text |
| dateStart | DateTime | Optional | Activity start date |
| dateEnd | DateTime | Optional | Activity end date |
| registrationDate | DateTime | Optional | Registration opens |
| registrationEndDate | DateTime | Optional | Registration closes |
| registrationEndTime | String | Optional | Registration close time |
| ageMin | Int | Optional | Minimum age |
| ageMax | Int | Optional | Maximum age |
| cost | Float | Default: 0 | Activity cost |
| costIncludesTax | Boolean | Default: true | Tax inclusion flag |
| taxAmount | Float | Optional | Tax amount if separate |
| spotsAvailable | Int | Optional | Available spots |
| totalSpots | Int | Optional | Total capacity |
| locationId | String | Foreign Key, Optional | Link to Location |
| locationName | String | Optional | Location name (denormalized) |
| registrationUrl | String | Optional | Registration URL |
| courseId | String | Optional | Provider's course ID |
| isActive | Boolean | Default: true | Activity status |
| lastSeenAt | DateTime | Default: now() | Last scraper observation |
| rawData | JSON | Optional | Original scraped data |
| dayOfWeek | String[] | Array | Days of week |
| startTime | String | Optional | Start time |
| endTime | String | Optional | End time |
| registrationStatus | String | Default: "Unknown" | Registration status |
| registrationButtonText | String | Optional | CTA button text |
| detailUrl | String | Optional | Detail page URL |
| fullDescription | String (Text) | Optional | Complete description |
| instructor | String | Optional | Instructor name |
| prerequisites | String (Text) | Optional | Prerequisites text |
| whatToBring | String (Text) | Optional | Items to bring |
| fullAddress | String | Optional | Complete address |
| latitude | Float | Optional | GPS latitude |
| longitude | Float | Optional | GPS longitude |
| directRegistrationUrl | String | Optional | Direct registration link |
| contactInfo | String | Optional | Contact information |
| courseDetails | String (Text) | Optional | Additional details |
| hasMultipleSessions | Boolean | Default: false | Multiple sessions flag |
| sessionCount | Int | Default: 0 | Number of sessions |
| hasPrerequisites | Boolean | Default: false | Prerequisites flag |
| createdAt | DateTime | Auto | Record creation timestamp |
| updatedAt | DateTime | Auto | Last update timestamp |

**Unique Constraints**:
- [providerId, externalId] - Prevents duplicate activities

**Indexes**:
- providerId, locationId, category
- Composite: [isActive, category], [isActive, dateStart], [isActive, lastSeenAt]
- registrationStatus, [latitude, longitude]

**Relationships**:
- Many-to-One with `Provider`
- Many-to-One with `Location` (optional)
- One-to-Many with `Favorite`
- One-to-Many with `ChildActivity`
- One-to-Many with `ActivitySession`
- One-to-Many with `ActivityPrerequisite`

---

### 4. ActivitySession
**Purpose**: Stores individual session details for multi-session activities

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| activityId | String | Foreign Key, Required | Link to Activity |
| sessionNumber | Int | Optional | Session number |
| date | String | Optional | Session date |
| dayOfWeek | String | Optional | Day of week |
| startTime | String | Optional | Start time |
| endTime | String | Optional | End time |
| location | String | Optional | Main location |
| subLocation | String | Optional | Sub-location (Court 1, Pool B) |
| instructor | String | Optional | Session instructor |
| notes | String | Optional | Session notes |
| createdAt | DateTime | Auto | Record creation timestamp |
| updatedAt | DateTime | Auto | Last update timestamp |

**Relationships**:
- Many-to-One with `Activity` (cascade delete)

---

### 5. ActivityPrerequisite
**Purpose**: Stores prerequisite requirements for activities

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| activityId | String | Foreign Key, Required | Link to Activity |
| name | String | Required | Prerequisite name |
| description | String | Optional | Prerequisite description |
| url | String | Optional | Link to prerequisite |
| courseId | String | Optional | Prerequisite course ID |
| isRequired | Boolean | Default: true | Required flag |
| createdAt | DateTime | Auto | Record creation timestamp |
| updatedAt | DateTime | Auto | Last update timestamp |

**Relationships**:
- Many-to-One with `Activity` (cascade delete)

---

### 6. User
**Purpose**: User accounts for parents/guardians

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| email | String | Unique, Required | User email |
| passwordHash | String | Required | Hashed password |
| name | String | Required | User's name |
| phoneNumber | String | Optional | Phone number |
| isVerified | Boolean | Default: false | Email verification status |
| verificationToken | String | Optional | Email verification token |
| resetToken | String | Optional | Password reset token |
| resetTokenExpiry | DateTime | Optional | Reset token expiration |
| preferences | JSON | Default: {} | User preferences |
| createdAt | DateTime | Auto | Record creation timestamp |
| updatedAt | DateTime | Auto | Last update timestamp |

**Indexes**: 
- email

**Relationships**:
- One-to-Many with `Child`
- One-to-Many with `Favorite`
- One-to-Many with `ActivityShare` (both as sharer and recipient)
- One-to-Many with `Invitation` (both as sender and recipient)

---

### 7. Child
**Purpose**: Children profiles linked to user accounts

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| userId | String | Foreign Key, Required | Parent user ID |
| name | String | Required | Child's name |
| dateOfBirth | DateTime | Required | Birth date |
| gender | String | Optional | Gender |
| avatarUrl | String | Optional | Avatar image URL |
| interests | String[] | Array | List of interests |
| notes | String | Optional | Parent notes |
| isActive | Boolean | Default: true | Profile active status |
| createdAt | DateTime | Auto | Record creation timestamp |
| updatedAt | DateTime | Auto | Last update timestamp |

**Relationships**:
- Many-to-One with `User` (cascade delete)
- One-to-Many with `ChildActivity`
- One-to-Many with `ActivityShareProfile`

---

### 8. ChildActivity
**Purpose**: Links children to activities with status tracking

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| childId | String | Foreign Key, Required | Child ID |
| activityId | String | Foreign Key, Required | Activity ID |
| status | String | Required | Status: interested/registered/completed/cancelled |
| registeredAt | DateTime | Optional | Registration date |
| completedAt | DateTime | Optional | Completion date |
| notes | String | Optional | Parent notes |
| rating | Int | Optional | 1-5 star rating |
| createdAt | DateTime | Auto | Record creation timestamp |
| updatedAt | DateTime | Auto | Last update timestamp |

**Unique Constraints**:
- [childId, activityId] - One registration per child per activity

**Indexes**:
- [childId, status], activityId

**Relationships**:
- Many-to-One with `Child` (cascade delete)
- Many-to-One with `Activity`

---

### 9. Favorite
**Purpose**: User's favorite activities

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| userId | String | Foreign Key, Required | User ID |
| activityId | String | Foreign Key, Required | Activity ID |
| notifyOnChange | Boolean | Default: true | Change notification flag |
| createdAt | DateTime | Auto | Record creation timestamp |

**Unique Constraints**:
- [userId, activityId] - One favorite per user per activity

**Relationships**:
- Many-to-One with `User` (cascade delete)
- Many-to-One with `Activity`

---

### 10. ActivityShare
**Purpose**: Manages activity sharing between users

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| sharingUserId | String | Foreign Key, Required | Sharing user ID |
| sharedWithUserId | String | Foreign Key, Required | Recipient user ID |
| permissionLevel | String | Required | Permission: view_all/view_registered/view_future |
| expiresAt | DateTime | Optional | Share expiration |
| isActive | Boolean | Default: true | Share active status |
| createdAt | DateTime | Auto | Record creation timestamp |
| updatedAt | DateTime | Auto | Last update timestamp |

**Unique Constraints**:
- [sharingUserId, sharedWithUserId] - One share per user pair

**Relationships**:
- Many-to-One with `User` (both sharer and recipient)
- One-to-Many with `ActivityShareProfile`

---

### 11. ActivityShareProfile
**Purpose**: Granular permissions for shared child profiles

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| activityShareId | String | Foreign Key, Required | Share ID |
| childId | String | Foreign Key, Required | Child ID |
| canViewInterested | Boolean | Default: true | View interested activities |
| canViewRegistered | Boolean | Default: true | View registered activities |
| canViewCompleted | Boolean | Default: false | View completed activities |
| canViewNotes | Boolean | Default: false | View notes |
| createdAt | DateTime | Auto | Record creation timestamp |

**Unique Constraints**:
- [activityShareId, childId] - One permission set per share per child

**Relationships**:
- Many-to-One with `ActivityShare` (cascade delete)
- Many-to-One with `Child` (cascade delete)

---

### 12. Invitation
**Purpose**: Manages sharing invitations

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| senderId | String | Foreign Key, Required | Sender user ID |
| recipientEmail | String | Required | Recipient email |
| recipientUserId | String | Foreign Key, Optional | Recipient user ID |
| status | String | Required | Status: pending/accepted/declined/expired |
| message | String | Optional | Invitation message |
| token | String | Unique, Required | Invitation token |
| expiresAt | DateTime | Required | Expiration date |
| acceptedAt | DateTime | Optional | Acceptance date |
| createdAt | DateTime | Auto | Record creation timestamp |

**Indexes**:
- senderId, recipientEmail, token
- [status, expiresAt]

**Relationships**:
- Many-to-One with `User` (sender)
- Many-to-One with `User` (recipient, optional)

---

### 13. ActivityHistory
**Purpose**: Audit trail for activity changes

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| activityId | String | Required | Activity ID |
| changeType | String | Required | Type: created/updated/deactivated/reactivated |
| previousData | JSON | Optional | Previous state |
| newData | JSON | Optional | New state |
| changedFields | String[] | Array | Changed field names |
| createdAt | DateTime | Auto | Change timestamp |

**Indexes**:
- [activityId, createdAt]

---

### 14. ScraperRun
**Purpose**: Tracks web scraper execution history

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| providerId | String | Required | Provider ID |
| status | String | Required | Status: running/completed/failed |
| startedAt | DateTime | Default: now() | Start time |
| completedAt | DateTime | Optional | Completion time |
| activitiesFound | Int | Default: 0 | Activities discovered |
| activitiesCreated | Int | Default: 0 | New activities created |
| activitiesUpdated | Int | Default: 0 | Activities updated |
| activitiesDeactivated | Int | Default: 0 | Activities deactivated |
| activitiesPurged | Int | Default: 0 | Activities removed |
| errorMessage | String | Optional | Error message |
| logs | JSON | Optional | Execution logs |

**Indexes**:
- [providerId, startedAt]

---

### 15. ScrapeJob
**Purpose**: Job queue for scraping tasks

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | String (UUID) | Primary Key | Unique identifier |
| providerId | String | Foreign Key, Required | Provider ID |
| status | Enum | Default: PENDING | JobStatus enum |
| startedAt | DateTime | Optional | Job start time |
| completedAt | DateTime | Optional | Job completion time |
| activitiesFound | Int | Default: 0 | Activities found |
| activitiesCreated | Int | Default: 0 | Activities created |
| activitiesUpdated | Int | Default: 0 | Activities updated |
| activitiesRemoved | Int | Default: 0 | Activities removed |
| errorMessage | String | Optional | Error message |
| errorDetails | JSON | Optional | Error details |
| createdAt | DateTime | Auto | Job creation time |

**Relationships**:
- Many-to-One with `Provider`

---

## Relationships Diagram

```
Provider (1) ──┬──< (N) Activity
               └──< (N) ScrapeJob

Location (1) ────< (N) Activity

Activity (1) ──┬──< (N) Favorite
               ├──< (N) ChildActivity
               ├──< (N) ActivitySession
               └──< (N) ActivityPrerequisite

User (1) ──┬──< (N) Child
           ├──< (N) Favorite
           ├──< (N) ActivityShare (as sharer)
           ├──< (N) ActivityShare (as recipient)
           ├──< (N) Invitation (as sender)
           └──< (N) Invitation (as recipient)

Child (1) ──┬──< (N) ChildActivity
            └──< (N) ActivityShareProfile

ActivityShare (1) ────< (N) ActivityShareProfile
```

## Key Design Decisions

### 1. UUID Primary Keys
All tables use UUID strings as primary keys for:
- Global uniqueness across distributed systems
- Security (non-sequential IDs)
- Compatibility with various services

### 2. Soft Deletes
Most entities use `isActive` flags rather than hard deletes to:
- Preserve historical data
- Allow recovery of accidentally deleted items
- Maintain referential integrity

### 3. JSON Fields
Strategic use of JSON columns for:
- `scraperConfig`: Flexible provider configurations
- `rawData`: Preserving original scraped data
- `preferences`: User settings without schema changes
- `logs`: Structured logging data

### 4. Denormalization
Some intentional denormalization for performance:
- `locationName` in Activity (avoids joins)
- `registrationStatus` as computed field
- Activity counts in scraper tables

### 5. Cascade Deletes
Careful use of cascade deletes:
- Child profiles cascade when user deleted
- Sessions/prerequisites cascade when activity deleted
- Share profiles cascade when share deleted

## Indexes Strategy

### Primary Indexes
- All foreign key columns are indexed
- Unique constraints automatically create indexes

### Composite Indexes
Strategic composite indexes for common queries:
- `[isActive, category]`: Browse active activities by category
- `[isActive, dateStart]`: Find upcoming activities
- `[childId, status]`: Get child's activities by status
- `[latitude, longitude]`: Geographic searches

### Performance Considerations
- Index on `email` for fast user lookups
- Index on `token` fields for verification flows
- Temporal indexes like `[providerId, startedAt]` for time-series queries

## Data Integrity

### Unique Constraints
- Prevent duplicate activities: `[providerId, externalId]`
- One favorite per user per activity: `[userId, activityId]`
- One registration per child: `[childId, activityId]`
- Single share between users: `[sharingUserId, sharedWithUserId]`

### Foreign Key Constraints
- All relationships enforced at database level
- Strategic use of cascade deletes
- Optional relationships where appropriate

### Data Validation
- Enums for fixed values (JobStatus)
- Default values for boolean flags
- Required fields enforced at schema level

## Migration Strategy

The schema uses Prisma migrations for version control:
1. Schema changes in `schema.prisma`
2. Generate migration: `npx prisma migrate dev`
3. Apply to production: `npx prisma migrate deploy`
4. Rollback capability maintained

## Security Considerations

1. **Password Storage**: Only hashed passwords stored
2. **Token Management**: Separate tokens for verification/reset
3. **Permission Levels**: Granular sharing permissions
4. **Audit Trail**: ActivityHistory tracks all changes
5. **Data Privacy**: Child data protected by user authentication

## Future Considerations

### Potential Enhancements
1. **Notifications Table**: For push/email notification tracking
2. **Reviews Table**: Detailed activity reviews beyond ratings
3. **WaitList Table**: For full activities
4. **PaymentHistory**: Track registration payments
5. **ActivityTags**: More flexible categorization system

### Scalability
- Partitioning strategy for ActivityHistory (by date)
- Archiving old ScraperRun records
- Read replicas for heavy query loads
- Caching layer for frequently accessed data

## Maintenance

### Regular Tasks
1. **Cleanup expired tokens**: Invitation, reset tokens
2. **Archive old scraper logs**: Move to cold storage
3. **Update activity status**: Mark expired activities
4. **Vacuum operations**: PostgreSQL maintenance
5. **Index analysis**: Monitor and optimize indexes

### Monitoring
- Query performance on composite indexes
- Table sizes and growth rates
- Foreign key violation attempts
- Unique constraint violations