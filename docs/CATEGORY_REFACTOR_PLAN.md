# Category and Activity Type Refactor Implementation Plan

## Executive Summary
This plan outlines the restructuring of the activity categorization system to properly separate age-based categories from activity types, allowing for more intuitive browsing and better data organization.

## Current Issues
1. **Confused Taxonomy**: Current "category" field mixes age groups (School Age, Youth) with activity types (Swimming, Dance)
2. **Poor Search Experience**: Users can't effectively filter by age group OR activity type
3. **Data Inconsistency**: Same activity type appears under multiple "categories"
4. **Limited Multi-Category Support**: Activities can't belong to multiple age categories

## Proposed Solution

### New Data Model

#### Categories (Age-Based)
Fixed set of age-based categories that activities can belong to:

1. **Baby & Parent (0-1)** - Activities for babies with parent participation
2. **Early Years Solo (2-6)** - Young children activities without parents
3. **Early Years with Parent (2-6)** - Young children activities with parents
4. **School Age (5-13)** - Elementary and middle school children
5. **Youth (10-18)** - Teenagers and young adults

**Note**: Activities can belong to MULTIPLE categories (e.g., a swimming class for ages 8-14 would be in both "School Age" and "Youth")

#### Activity Types & Subtypes
Hierarchical classification of activity types:

- **activityType**: High-level grouping (e.g., "Swimming & Aquatics", "Team Sports")
- **activitySubtype**: Specific activity (e.g., "Learn to Swim", "Basketball")

## Database Schema Changes

### 1. Modify Activity Table

```prisma
model Activity {
  // ... existing fields ...
  
  // REMOVE or DEPRECATE:
  // category String  // Will be replaced
  // subcategory String?  // Will be replaced
  
  // ADD NEW FIELDS:
  activityType      String      // Required: "Swimming & Aquatics", "Team Sports", etc.
  activitySubtype   String?     // Optional: "Basketball", "Learn to Swim", etc.
  
  // ADD RELATIONSHIP:
  categories        ActivityCategory[]  // Many-to-many with categories
  
  // INDEXES:
  @@index([activityType])
  @@index([activityType, activitySubtype])
}
```

### 2. Create New Tables

```prisma
// Fixed category definitions
model Category {
  id            String    @id @default(uuid())
  code          String    @unique  // "baby-parent", "school-age", etc.
  name          String    // "Baby & Parent", "School Age", etc.
  ageMin        Int       // Minimum age
  ageMax        Int       // Maximum age
  requiresParent Boolean  // Whether parent participation is required
  description   String?
  displayOrder  Int       // For UI ordering
  
  activities    ActivityCategory[]
  
  @@index([code])
}

// Junction table for many-to-many relationship
model ActivityCategory {
  id          String    @id @default(uuid())
  activityId  String
  categoryId  String
  isPrimary   Boolean   @default(false)  // Mark primary category
  
  activity    Activity  @relation(fields: [activityId], references: [id], onDelete: Cascade)
  category    Category  @relation(fields: [categoryId], references: [id])
  
  @@unique([activityId, categoryId])
  @@index([activityId])
  @@index([categoryId])
}

// Activity type definitions (could be table or config)
model ActivityType {
  id          String    @id @default(uuid())
  code        String    @unique  // "swimming-aquatics", "team-sports"
  name        String    // "Swimming & Aquatics", "Team Sports"
  description String?
  iconName    String?   // For UI icons
  displayOrder Int
  
  subtypes    ActivitySubtype[]
  
  @@index([code])
}

model ActivitySubtype {
  id              String    @id @default(uuid())
  activityTypeId  String
  code            String    // "basketball", "learn-to-swim"
  name            String    // "Basketball", "Learn to Swim"
  description     String?
  
  activityType    ActivityType @relation(fields: [activityTypeId], references: [id])
  
  @@unique([activityTypeId, code])
  @@index([activityTypeId])
}
```

## Migration Strategy

### Phase 1: Database Preparation (Week 1)

1. **Create new tables**
   - Categories table with 5 fixed categories
   - ActivityType and ActivitySubtype tables
   - ActivityCategory junction table

2. **Populate reference data**
   - Insert 5 categories
   - Insert all activity types and subtypes from master list

3. **Add new columns to Activity**
   - activityType (nullable initially)
   - activitySubtype (nullable initially)

### Phase 2: Data Migration (Week 1-2)

1. **Map existing data**
   ```javascript
   // Mapping logic examples:
   - "School Age" category → activityType based on subcategory
   - "Swimming" category → activityType: "Swimming & Aquatics"
   - Age ranges → Multiple category associations
   ```

2. **Migration script tasks**
   - Analyze current category/subcategory combinations
   - Map to new activityType/activitySubtype
   - Create ActivityCategory associations based on age ranges
   - Handle special cases and unknowns

3. **Data validation**
   - Ensure all activities have activityType
   - Verify category associations are correct
   - Check for data consistency

### Phase 3: Backend Updates (Week 2)

1. **Update Scraper Logic**
   - Modify scrapers to detect activity types
   - Implement age-based category detection
   - Update data insertion logic

2. **API Endpoints**
   ```javascript
   // New endpoints:
   GET /api/v1/categories - Get all categories
   GET /api/v1/activity-types - Get all activity types
   GET /api/v1/activity-types/:type/subtypes - Get subtypes
   
   // Modified endpoints:
   GET /api/v1/activities?category=school-age&activityType=swimming-aquatics
   POST /api/v1/activities/search - Support new filters
   ```

3. **Service Layer Updates**
   - Update ActivityService search methods
   - Add category filtering logic
   - Implement activity type filtering

### Phase 4: Frontend Updates (Week 2-3)

#### Home Screen Changes
```
Before:
┌─────────────────────────┐
│ Browse by Category      │
├─────────────────────────┤
│ • School Age            │
│ • Swimming              │
│ • Camps                 │
└─────────────────────────┘

After:
┌─────────────────────────┐
│ Browse by Age Group     │
├─────────────────────────┤
│ • Baby & Parent (0-1)   │
│ • Early Years (2-6)     │
│ • School Age (5-13)     │
│ • Youth (10-18)         │
└─────────────────────────┘

┌─────────────────────────┐
│ Browse by Activity Type │
├─────────────────────────┤
│ • Swimming & Aquatics   │
│ • Team Sports           │
│ • Arts & Crafts         │
│ • Dance                 │
└─────────────────────────┘
```

#### User Onboarding Changes
1. **Child Profile Setup**
   - Auto-select categories based on child's age
   - Allow manual override if needed

2. **Interest Selection**
   - Present activity types as interests
   - Allow drilling down to subtypes

#### Search & Filter Updates
```typescript
interface SearchFilters {
  categories: string[];      // Age-based categories
  activityTypes: string[];    // Activity types
  activitySubtypes: string[]; // Specific activities
  // ... other filters
}
```

#### Component Updates Required
1. **ActivityCard.tsx**
   - Display both category badges and activity type
   - Update styling for new information

2. **FilterScreen.tsx**
   - Separate sections for categories and activity types
   - Hierarchical activity type selection

3. **SearchScreen.tsx**
   - Update search logic
   - Add quick filters for categories

4. **BrowseScreen.tsx** (New)
   - Grid layout for activity type browsing
   - Category pills for filtering

## Implementation Checklist

### Database Tasks
- [ ] Create Prisma migration for new tables
- [ ] Create Prisma migration for Activity table changes
- [ ] Seed Categories table with 5 categories
- [ ] Seed ActivityType table from master list
- [ ] Seed ActivitySubtype table from master list
- [ ] Write data migration script
- [ ] Test migration on development database
- [ ] Create rollback plan

### Backend Tasks
- [ ] Update Activity model in Prisma schema
- [ ] Create Category, ActivityType models
- [ ] Update ActivityService
- [ ] Create CategoryService
- [ ] Create ActivityTypeService
- [ ] Update search/filter logic
- [ ] Update scraper to use new fields
- [ ] Create new API endpoints
- [ ] Update existing API endpoints
- [ ] Write backend tests

### Frontend Tasks
- [ ] Create CategorySelector component
- [ ] Create ActivityTypeSelector component
- [ ] Update HomePage with dual browse sections
- [ ] Update FilterScreen
- [ ] Update SearchScreen
- [ ] Update ActivityCard display
- [ ] Update user onboarding flow
- [ ] Update child profile management
- [ ] Create migration for existing user preferences
- [ ] Update Redux store/state management
- [ ] Write frontend tests

### Data Quality Tasks
- [ ] Audit unmapped activities
- [ ] Create manual mapping for edge cases
- [ ] Verify all activities have types
- [ ] Verify age ranges map to categories correctly
- [ ] Create data quality dashboard

## Migration Script Example

```javascript
// Example migration logic
async function migrateActivity(activity) {
  const result = {
    activityType: null,
    activitySubtype: null,
    categories: []
  };
  
  // Map current category to activityType
  switch(activity.category) {
    case 'Swimming':
      result.activityType = 'Swimming & Aquatics';
      result.activitySubtype = mapSwimmingSubtype(activity.subcategory);
      break;
    case 'Team Sports':
      result.activityType = 'Team Sports';
      result.activitySubtype = activity.subcategory; // Basketball, Soccer, etc.
      break;
    case 'School Age':
      // Parse subcategory to determine actual activity type
      result.activityType = parseActivityType(activity.subcategory);
      result.activitySubtype = parseActivitySubtype(activity.subcategory);
      break;
    // ... more mappings
  }
  
  // Map age ranges to categories
  if (activity.ageMin !== null && activity.ageMax !== null) {
    if (activity.ageMin <= 1) {
      result.categories.push('baby-parent');
    }
    if (activity.ageMin <= 6 && activity.ageMax >= 2) {
      if (hasParentParticipation(activity)) {
        result.categories.push('early-years-parent');
      } else {
        result.categories.push('early-years-solo');
      }
    }
    if (activity.ageMin <= 13 && activity.ageMax >= 5) {
      result.categories.push('school-age');
    }
    if (activity.ageMin <= 18 && activity.ageMax >= 10) {
      result.categories.push('youth');
    }
  }
  
  return result;
}
```

## Rollback Plan

1. Keep old fields (category, subcategory) during transition
2. Maintain backward compatibility in API
3. Feature flag for new categorization system
4. Ability to quickly revert if issues arise

## Success Metrics

1. **User Experience**
   - Reduced time to find relevant activities
   - Increased filter usage
   - Better search result relevance

2. **Data Quality**
   - 100% of activities have activityType
   - 100% of activities have at least one category
   - Reduced "uncategorized" activities

3. **Technical**
   - No degradation in query performance
   - Successful migration of all existing data
   - Backward compatibility maintained

## Timeline

**Week 1**: Database setup and migration scripts
**Week 2**: Backend updates and API changes
**Week 3**: Frontend updates
**Week 4**: Testing, bug fixes, and deployment

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | High | Comprehensive backups, test migrations |
| User confusion with new system | Medium | Clear UI labels, help text, gradual rollout |
| Performance degradation | Medium | Index optimization, query testing |
| Incomplete mapping | Low | Manual review process, "Other" category |

## Next Steps

1. Review and approve plan
2. Create detailed technical specifications
3. Set up development environment for testing
4. Begin Phase 1 implementation
5. Create user communication plan