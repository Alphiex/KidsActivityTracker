# Category and Activity Type Refactor Implementation Plan (Version 2)

## Executive Summary
This plan outlines the restructuring of the activity categorization system to properly separate age-based categories from activity types, allowing for more intuitive browsing and better data organization.

## Current Issues
1. **Confused Taxonomy**: Current "category" field mixes age groups (School Age, Youth) with activity types (Swimming, Dance)
2. **Poor Search Experience**: Users can't effectively filter by age group OR activity type
3. **Data Inconsistency**: Same activity type appears under multiple "categories"
4. **Limited Multi-Category Support**: Activities can't belong to multiple age categories
5. **No Parent Participation Tracking**: Missing explicit field for parent involvement

## Proposed Solution

### New Data Model

#### Categories (Age-Based)
Fixed set of age-based categories that activities can belong to:

1. **Baby & Parent (0-1)** - Activities for babies with parent participation
2. **Early Years Solo (0-6)** - Young children activities without parents
3. **Early Years with Parent (0-6)** - Young children activities with parents
4. **School Age (5-13)** - Elementary and middle school children
5. **Youth (10-18)** - Teenagers and young adults

**Note**: Activities can belong to MULTIPLE categories (e.g., a swimming class for ages 8-14 would be in both "School Age" and "Youth")

#### Activity Types & Subtypes
Hierarchical classification of activity types:

- **activityType**: High-level grouping (e.g., "Swimming & Aquatics", "Team Sports")
- **activitySubtype**: Specific activity (e.g., "Learn to Swim", "Basketball")
- **"Other Activity"**: Catch-all type for unmapped activities with subtype "Other" for regular review

#### Parent Participation Flag
New explicit field to track parent involvement requirement, used for automatic category assignment.

## Database Schema Changes

### 1. Modify Activity Table

```prisma
model Activity {
  // ... existing fields ...
  
  // DEPRECATE (keep for backwards compatibility):
  category String  // Will be replaced but kept temporarily
  subcategory String?  // Will be replaced but kept temporarily
  
  // ADD NEW FIELDS:
  activityType      String      // Required: "Swimming & Aquatics", "Team Sports", "Other Activity"
  activitySubtype   String?     // Optional: "Basketball", "Learn to Swim", "Other"
  requiresParent    Boolean     @default(false)  // NEW: Explicit parent participation flag
  parentInvolvement String?     // NEW: Level of parent involvement (full, partial, drop-off, none)
  
  // ADD RELATIONSHIP:
  categories        ActivityCategory[]  // Many-to-many with categories
  
  // INDEXES:
  @@index([activityType])
  @@index([activityType, activitySubtype])
  @@index([requiresParent])
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
  confidence  Float     @default(1.0)     // Confidence score for auto-categorization
  source      String    @default("auto")  // "auto", "manual", "scraper"
  
  activity    Activity  @relation(fields: [activityId], references: [id], onDelete: Cascade)
  category    Category  @relation(fields: [categoryId], references: [id])
  
  @@unique([activityId, categoryId])
  @@index([activityId])
  @@index([categoryId])
}

// Activity type definitions
model ActivityType {
  id          String    @id @default(uuid())
  code        String    @unique  // "swimming-aquatics", "team-sports", "other-activity"
  name        String    // "Swimming & Aquatics", "Team Sports", "Other Activity"
  description String?
  iconName    String?   // For UI icons
  imageUrl    String?   // Default image for this activity type
  displayOrder Int
  
  subtypes    ActivitySubtype[]
  
  @@index([code])
}

model ActivitySubtype {
  id              String    @id @default(uuid())
  activityTypeId  String
  code            String    // "basketball", "learn-to-swim", "other"
  name            String    // "Basketball", "Learn to Swim", "Other"
  description     String?
  imageUrl        String?   // Specific image for this subtype
  
  activityType    ActivityType @relation(fields: [activityTypeId], references: [id])
  
  @@unique([activityTypeId, code])
  @@index([activityTypeId])
}

// Track unmapped activities for review
model UnmappedActivity {
  id              String    @id @default(uuid())
  activityId      String
  originalCategory String?
  originalSubcategory String?
  scraperText     String?   @db.Text
  reviewed        Boolean   @default(false)
  mappedType      String?   // Type after manual review
  mappedSubtype   String?   // Subtype after manual review
  notes           String?
  createdAt       DateTime  @default(now())
  reviewedAt      DateTime?
  
  @@index([reviewed])
  @@index([activityId])
}
```

## Image Hierarchy System

### Image Selection Logic
```javascript
function getActivityImage(activity) {
  // Priority order for image selection:
  // 1. Activity-specific image (if exists)
  // 2. Activity subtype image
  // 3. Activity type image
  // 4. Default placeholder
  
  if (activity.imageUrl) return activity.imageUrl;
  
  const subtype = await getActivitySubtype(activity.activitySubtype);
  if (subtype?.imageUrl) return subtype.imageUrl;
  
  const type = await getActivityType(activity.activityType);
  if (type?.imageUrl) return type.imageUrl;
  
  return DEFAULT_ACTIVITY_IMAGE;
}
```

## Parent Participation Detection

### Scraper Enhancement
```javascript
// Keywords to detect parent participation
const PARENT_KEYWORDS = [
  'parent participation',
  'parent and tot',
  'parent & tot',
  'parent and child',
  'parent & child',
  'mommy and me',
  'daddy and me',
  'parent/child',
  'with parent',
  'with caregiver',
  'adult participation required',
  'parent must attend',
  'parent involved',
  'family class'
];

function detectParentParticipation(activity) {
  const searchText = `${activity.name} ${activity.description} ${activity.fullDescription}`.toLowerCase();
  
  // RULE 1: Ages 1 and under ALWAYS require parent participation
  const isInfantAge = (activity.ageMin !== null && activity.ageMin <= 1) || 
                      (activity.ageMax !== null && activity.ageMax <= 1);
  
  // RULE 2: Check for explicit keywords
  const hasKeywords = PARENT_KEYWORDS.some(keyword => 
    searchText.includes(keyword.toLowerCase())
  );
  
  // RULE 3: Additional age-based heuristics
  const isToddlerClass = activity.ageMin <= 3 && searchText.includes('class');
  
  // Set flags
  activity.requiresParent = isInfantAge || hasKeywords || isToddlerClass;
  
  // Set involvement level
  if (activity.requiresParent) {
    if (isInfantAge) {
      // Infants always need full parent participation
      activity.parentInvolvement = 'full';
    } else if (searchText.includes('drop off')) {
      activity.parentInvolvement = 'drop-off';
    } else if (searchText.includes('parent optional')) {
      activity.parentInvolvement = 'partial';
    } else {
      activity.parentInvolvement = 'full';
    }
  } else {
    activity.parentInvolvement = 'none';
  }
  
  return activity;
}
```

## User Settings Simplification

### Filter by Activity Type Only
User preferences and filters will use **activity types only**, not subtypes:

```typescript
interface UserPreferences {
  interestedActivityTypes: string[];  // ["swimming-aquatics", "team-sports"]
  // NOT interestedActivitySubtypes - too granular
}

interface SearchFilters {
  categories: string[];      // Age-based categories
  activityTypes: string[];    // Activity types only
  // activitySubtypes hidden from user filters
}
```

## Migration Strategy

### Phase 1: Database Preparation (Week 1)

1. **Create new tables**
   - Categories table with 5 fixed categories
   - ActivityType and ActivitySubtype tables
   - ActivityCategory junction table
   - UnmappedActivity tracking table

2. **Populate reference data**
   - Insert 5 categories
   - Insert all activity types including "Other Activity"
   - Insert all subtypes including "Other" under each type

3. **Add new columns to Activity**
   - activityType (nullable initially)
   - activitySubtype (nullable initially)
   - requiresParent (default false)
   - parentInvolvement (nullable)

### Phase 2: Data Migration (Week 1-2)

#### Migration Script Features
```javascript
async function migrateAllActivities() {
  const activities = await prisma.activity.findMany();
  const stats = {
    total: activities.length,
    mapped: 0,
    unmapped: 0,
    parentDetected: 0,
    categoriesAssigned: 0
  };
  
  for (const activity of activities) {
    try {
      // 1. Map to new activity type/subtype
      const mapping = mapActivity(activity);
      
      // 2. Handle unmapped activities
      if (mapping.activityType === 'Other Activity') {
        await prisma.unmappedActivity.create({
          data: {
            activityId: activity.id,
            originalCategory: activity.category,
            originalSubcategory: activity.subcategory,
            scraperText: JSON.stringify(activity.rawData)
          }
        });
        stats.unmapped++;
      } else {
        stats.mapped++;
      }
      
      // 3. Detect parent participation
      const parentDetection = detectParentParticipation(activity);
      if (parentDetection.requiresParent) {
        stats.parentDetected++;
      }
      
      // 4. Auto-assign categories based on age and parent flag
      const categories = await assignCategories(activity, parentDetection.requiresParent);
      
      // 5. Update activity
      await prisma.activity.update({
        where: { id: activity.id },
        data: {
          activityType: mapping.activityType,
          activitySubtype: mapping.activitySubtype,
          requiresParent: parentDetection.requiresParent,
          parentInvolvement: parentDetection.parentInvolvement
        }
      });
      
      // 6. Create category associations
      for (const categoryCode of categories) {
        const category = await prisma.category.findUnique({
          where: { code: categoryCode }
        });
        
        if (category) {
          await prisma.activityCategory.create({
            data: {
              activityId: activity.id,
              categoryId: category.id,
              isPrimary: categories[0] === categoryCode,
              confidence: 0.9,
              source: 'migration'
            }
          });
          stats.categoriesAssigned++;
        }
      }
      
    } catch (error) {
      console.error(`Failed to migrate activity ${activity.id}:`, error);
    }
  }
  
  console.log('Migration Statistics:', stats);
  return stats;
}
```

#### Category Assignment Logic
```javascript
function assignCategories(activity, requiresParent) {
  const categories = [];
  const { ageMin, ageMax } = activity;
  
  // RULE: Activities for ages 1 and under ALWAYS go to Baby & Parent category
  // Baby & Parent (0-1) - Always requires parent
  if ((ageMin !== null && ageMin <= 1) || (ageMax !== null && ageMax <= 1)) {
    categories.push('baby-parent');
    // Don't add to other early years categories for infants
  } else {
    // Early Years (0-6) - Only for ages 2+ 
    if (ageMin !== null && ageMax !== null) {
      if ((ageMin <= 6 && ageMax >= 2)) {
        if (requiresParent) {
          categories.push('early-years-parent');
        } else {
          // Only add solo if explicitly no parent needed and age >= 2
          if (ageMin >= 2) {
            categories.push('early-years-solo');
          }
        }
      }
    }
  }
  
  // School Age (5-13)
  if (ageMin !== null && ageMax !== null) {
    if ((ageMin <= 13 && ageMax >= 5)) {
      categories.push('school-age');
    }
  }
  
  // Youth (10-18)
  if (ageMin !== null && ageMax !== null) {
    if ((ageMin <= 18 && ageMax >= 10)) {
      categories.push('youth');
    }
  }
  
  // Validation: Ensure baby activities aren't miscategorized
  if (categories.includes('baby-parent')) {
    // Remove any early-years-solo if accidentally added
    const index = categories.indexOf('early-years-solo');
    if (index > -1) {
      categories.splice(index, 1);
    }
  }
  
  return categories;
}
```

### Phase 3: Backend Updates (Week 2)

1. **Update Scraper Logic**
   - Add parent participation detection
   - Map to activity types during scraping
   - Auto-assign categories based on rules
   - Track unmapped activities

2. **API Endpoints**
   ```javascript
   // New endpoints:
   GET /api/v1/categories - Get all categories
   GET /api/v1/activity-types - Get all activity types (for filters)
   GET /api/v1/unmapped-activities - Admin endpoint for review
   POST /api/v1/unmapped-activities/:id/map - Map unmapped activity
   
   // Modified endpoints:
   GET /api/v1/activities?category=school-age&activityType=swimming-aquatics
   POST /api/v1/activities/search - Filter by type, not subtype
   ```

3. **Admin Dashboard for Unmapped Activities**
   ```javascript
   // Regular review process
   async function getUnmappedActivitiesForReview() {
     return await prisma.unmappedActivity.findMany({
       where: { reviewed: false },
       include: { activity: true },
       orderBy: { createdAt: 'desc' },
       take: 50
     });
   }
   
   async function mapUnmappedActivity(id, activityType, activitySubtype) {
     // Update the activity
     const unmapped = await prisma.unmappedActivity.findUnique({
       where: { id }
     });
     
     await prisma.activity.update({
       where: { id: unmapped.activityId },
       data: { activityType, activitySubtype }
     });
     
     // Mark as reviewed
     await prisma.unmappedActivity.update({
       where: { id },
       data: {
         reviewed: true,
         reviewedAt: new Date(),
         mappedType: activityType,
         mappedSubtype: activitySubtype
       }
     });
   }
   ```

### Phase 4: Frontend Updates (Week 2-3)

#### Home Screen Changes
```
┌─────────────────────────┐
│ Browse by Age Group     │
├─────────────────────────┤
│ • Baby & Parent (0-1)   │
│ • Early Years (0-6)     │
│ • School Age (5-13)     │
│ • Youth (10-18)         │
└─────────────────────────┘

┌─────────────────────────┐
│ Browse by Activity      │
├─────────────────────────┤
│ 🏊 Swimming & Aquatics  │
│ ⚽ Team Sports          │
│ 🎨 Visual Arts          │
│ 💃 Dance                │
│ [Show More...]          │
└─────────────────────────┘
```

#### User Settings (Simplified)
```typescript
// User selects activity TYPES only
const ActivityTypeSelector = () => {
  const activityTypes = [
    'Swimming & Aquatics',
    'Team Sports',
    'Martial Arts',
    'Dance',
    'Visual Arts',
    // ... etc (25 types instead of 200+ subtypes)
  ];
  
  return (
    <View>
      <Text>Select activities your child is interested in:</Text>
      {activityTypes.map(type => (
        <CheckBox key={type} label={type} />
      ))}
    </View>
  );
};
```

#### Activity Display
```typescript
// Show type and subtype in activity cards
<ActivityCard>
  <Badge>{activity.activityType}</Badge>
  {activity.activitySubtype && (
    <SubBadge>{activity.activitySubtype}</SubBadge>
  )}
  {activity.requiresParent && (
    <ParentBadge>Parent Required</ParentBadge>
  )}
</ActivityCard>
```

## Quality Assurance

### Validation Scripts
```javascript
// Ensure all activities are properly categorized
async function validateMigration() {
  const issues = [];
  
  // Check for activities without types
  const noType = await prisma.activity.count({
    where: { activityType: null }
  });
  if (noType > 0) issues.push(`${noType} activities without type`);
  
  // Check for activities without categories
  const noCategory = await prisma.activity.findMany({
    where: {
      categories: { none: {} }
    }
  });
  if (noCategory.length > 0) {
    issues.push(`${noCategory.length} activities without categories`);
  }
  
  // Check parent participation consistency
  const inconsistent = await prisma.activity.findMany({
    where: {
      AND: [
        { requiresParent: true },
        { categories: { some: { category: { code: 'early-years-solo' } } } }
      ]
    }
  });
  if (inconsistent.length > 0) {
    issues.push(`${inconsistent.length} activities with inconsistent parent flags`);
  }
  
  return issues;
}
```

### Admin Review Dashboard
Create an admin interface to:
1. View all "Other Activity" items
2. Batch-map similar unmapped activities
3. Add new activity types/subtypes as discovered
4. Monitor mapping statistics

## Implementation Checklist

### Database Tasks
- [ ] Create Prisma migration for new tables
- [ ] Add requiresParent and parentInvolvement fields
- [ ] Create UnmappedActivity tracking table
- [ ] Seed Categories table with 5 categories
- [ ] Seed ActivityType table (including "Other Activity")
- [ ] Seed ActivitySubtype table (including "Other" for each type)
- [ ] Create comprehensive migration script
- [ ] Create category assignment script
- [ ] Test migration on development database
- [ ] Create rollback plan

### Backend Tasks
- [ ] Add parent participation detection to scrapers
- [ ] Update Activity model with new fields
- [ ] Create services for Categories and ActivityTypes
- [ ] Implement "Other Activity" catch-all logic
- [ ] Create admin endpoints for unmapped review
- [ ] Update search to use activity types only
- [ ] Create validation scripts
- [ ] Add image hierarchy logic
- [ ] Write backend tests

### Frontend Tasks
- [ ] Simplify activity type selection (types only)
- [ ] Update home screen with dual browse
- [ ] Add parent participation badges
- [ ] Implement image fallback hierarchy
- [ ] Create admin review interface
- [ ] Update user preferences (types only)
- [ ] Update filter screens (no subtype filters)
- [ ] Update activity cards display
- [ ] Write frontend tests

### Data Quality Tasks
- [ ] Run initial migration and review stats
- [ ] Manual review of "Other Activity" items
- [ ] Create mapping rules for common patterns
- [ ] Document unmapped activity review process
- [ ] Set up weekly review schedule
- [ ] Create dashboards for monitoring

## Success Metrics

1. **Data Quality**
   - < 5% activities in "Other Activity" after initial migration
   - 100% of activities have at least one category
   - 100% of activities with age < 2 have requiresParent = true
   - Weekly review reduces "Other Activity" count

2. **User Experience**
   - Simplified filters (25 types vs 200+ subtypes)
   - Clear age group browsing
   - Accurate parent participation indicators
   - Proper image display with fallbacks

3. **Technical**
   - No performance degradation
   - Successful migration of all data
   - Automated category assignment accuracy > 95%
   - Parent participation detection accuracy > 90%

## Regular Review Process

### Weekly Tasks
1. Review new "Other Activity" entries
2. Map activities to existing types where possible
3. Identify patterns for new activity types
4. Update mapping rules for common patterns

### Monthly Tasks
1. Analyze unmapped activity trends
2. Consider adding new activity types/subtypes
3. Review parent participation detection accuracy
4. Update scraper rules based on findings

## Migration Rollback Plan

1. Keep old fields during transition period
2. Dual-write to both old and new fields
3. Feature flag for new categorization
4. Quick revert capability if issues arise
5. Backup before migration

## Next Steps

1. Review and approve updated plan
2. Create migration scripts
3. Set up test environment
4. Run test migration
5. Review unmapped activities
6. Begin phased implementation