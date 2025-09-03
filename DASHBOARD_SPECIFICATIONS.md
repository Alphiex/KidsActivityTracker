# Kids Activity Tracker - Dashboard Specifications

This document defines the exact functionality for each dashboard button/feature. **Always refer to this document when making changes to ensure consistency.**

## Important Distinctions

### Categories vs Activity Types
- **Categories**: Age-based groupings (5 total) - Early Years: Parent Participation, Early Years: On My Own, School Age, Youth, All Ages & Family
- **Activity Types**: Subject-based groupings (22 total) - Swimming & Aquatics, Team Sports, Individual Sports, etc.
- **NEVER confuse these two concepts in code or documentation**

### Global Filters
- Apply to ALL dashboard features EXCEPT Favourites
- Include: Activity Types, Age Groups, Locations, Budget, Schedule
- Must filter both counts and results consistently

## Dashboard Features

### 1. Recommended For You
**Purpose**: Show activities matching user preferences

**Count Display**:
- Count activities matching ALL user preferences:
  - Activity Types (from user preferences)
  - Age Groups (from user preferences) 
  - Locations (from user preferences)
  - Budget (from user preferences)
  - Schedule (from user preferences)
- Apply global filters to the count

**Click Behavior**:
- Open new page with matching activities
- Use same filters as count calculation
- Show 50 results per page with pagination
- Header: "X activities shown, Y filtered out by global filters"

### 2. Browse by Location
**Purpose**: Navigate locations to find activities

**Count Display**: Not applicable (navigation feature)

**Click Behavior**:
1. **First Screen**: List of cities
   - Show all cities from database
   - Display venue count and activity count per city
   - Apply global filters to activity counts

2. **Second Screen**: Venues in selected city
   - Show all venues in the selected city
   - Display activity count per venue
   - Apply global filters to activity counts

3. **Third Screen**: Activities at selected venue
   - Show all activities at the venue
   - 50 results per page with pagination
   - Count must match the count shown on previous screen
   - Apply global filters
   - Header: "X activities shown, Y filtered out by global filters"

### 3. Favourites
**Purpose**: Show user's favorited activities

**Count Display**:
- Count of activities marked as favorite by user
- Update count immediately when favorites are added/removed
- **DO NOT apply global filters** to favorites

**Click Behavior**:
- Open new page with all favorited activities
- 50 results per page with pagination
- **DO NOT apply global filters** to results
- Count must match dashboard count
- Header: "X favorite activities"

### 4. New This Week
**Purpose**: Show recently added activities

**Count Display**:
- Count activities added in last 7 days (based on createdAt)
- Apply global filters to count

**Click Behavior**:
- Open new page with activities from last 7 days
- 50 results per page with pagination
- Apply global filters to results
- Count must match dashboard count
- Header: "X activities shown, Y filtered out by global filters"

### 5. Budget Friendly
**Purpose**: Show activities within user's budget

**Count Display**:
- Count activities with cost ≤ user's budget setting (default: $20)
- Apply global filters to count

**Click Behavior**:
- Open new page with activities within budget
- 50 results per page with pagination
- Apply global filters to results
- Count must match dashboard count
- Header: "X activities shown, Y filtered out by global filters"

### 6. Browse by Activity Type
**Purpose**: Navigate activity types to find activities

**Dashboard Display**:
- Show 6 activity types with priority:
  1. **Highest Priority**: Activity types selected in user preferences
  2. **Medium Priority**: Activity types with highest activity counts (fill remaining spots)
- Include "See All" button

**Click Behavior**:
1. **Activity Type Card/See All**: 
   - Show all activity types with activity counts
   - Apply global filters to counts

2. **Specific Activity Type**:
   - Show subtypes for selected activity type
   - Display count for each subtype
   - Include button to show all activities for the main type
   - Subtype counts must sum to main type count
   - Apply global filters to all counts

3. **Subtype or "All Activities" Button**:
   - Show activities for selected subtype or main type
   - 50 results per page with pagination
   - Count must match the button that was clicked
   - Apply global filters
   - Header: "X activities shown, Y filtered out by global filters"

**Important**: Activity types have nothing to do with "category" - keep these separate!

### 7. Browse by Category  
**Purpose**: Navigate age-based categories to find activities

**Dashboard Display**:
- Show all 5 categories with activity counts:
  1. **Early Years: Parent Participation** (0-5 years, requires parent)
  2. **Early Years: On My Own** (0-5 years, independent)
  3. **School Age** (5-13 years)
  4. **Youth** (10-18 years) 
  5. **All Ages & Family** (all ages, family-friendly)
- Apply global filters to counts

**Click Behavior**:
- Open new page with activities for selected category
- 50 results per page with pagination
- Count must match dashboard count
- Apply global filters to results
- Header: "X activities shown, Y filtered out by global filters"

**Database Requirements**:
- Categories table with these 5 categories
- Activities can belong to multiple categories
- Categories are NOT related to activity types
- **DO NOT filter by activity type when querying by category**

## Technical Requirements

### Database Schema
```sql
-- Categories table (if doesn't exist)
CREATE TABLE Category (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  description VARCHAR,
  ageMin INT,
  ageMax INT,
  requiresParent BOOLEAN DEFAULT false,
  displayOrder INT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Activity-Category junction table
CREATE TABLE ActivityCategory (
  id VARCHAR PRIMARY KEY,
  activityId VARCHAR REFERENCES Activity(id),
  categoryId VARCHAR REFERENCES Category(id),
  createdAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(activityId, categoryId)
);
```

### API Endpoints Required
- `GET /api/v1/activities/recommended` - User preference-based activities
- `GET /api/v1/locations/cities` - Cities with counts
- `GET /api/v1/locations/:cityId/venues` - Venues in city with counts  
- `GET /api/v1/activities/favorites` - User's favorited activities
- `GET /api/v1/activities/new` - Activities from last 7 days
- `GET /api/v1/activities/budget-friendly` - Activities within budget
- `GET /api/v1/activity-types` - Activity types with counts
- `GET /api/v1/activity-types/:id/subtypes` - Subtypes with counts
- `GET /api/v1/categories` - Categories with counts
- `GET /api/v1/categories/:id/activities` - Activities in category

### Global Filters Implementation
- Must be applied consistently across all features (except Favourites)
- Include in both count queries and result queries
- Filters: Activity Types, Age Groups, Locations, Budget, Schedule
- Always show "X activities shown, Y filtered out by global filters" in headers

### Pagination Requirements
- 50 results per page for all activity lists
- Implement infinite scroll or "Load More" functionality
- Ensure counts always match between dashboard and result pages

## Validation Checklist
Before deploying any dashboard changes, verify:
- [ ] Categories vs Activity Types are not confused
- [ ] Global filters applied correctly (except Favourites)
- [ ] Counts match between dashboard and result pages
- [ ] Pagination works with 50 results per page
- [ ] Headers show correct activity counts
- [ ] Database schema supports all requirements
- [ ] API endpoints return consistent data

## Future Considerations
- Categories table designed to support additional categories
- Activity-Category relationship supports multiple categories per activity
- Clear separation between Categories and Activity Types maintained