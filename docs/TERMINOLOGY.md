# Kids Activity Tracker - Terminology Guide

## IMPORTANT: Understanding Activity Types vs Categories

This document clarifies the key terminology used throughout the Kids Activity Tracker application to prevent confusion.

## Activity Type & Subtype (Activity Grouping)

**Activity Type** and **Activity Subtype** are hierarchical classifications for the TYPE of activity being performed.

### Activity Type
The main grouping of activities based on what they are:
- **Team Sports** - Sports played in teams
- **Individual Sports** - Solo sports activities  
- **Martial Arts** - Combat and self-defense activities
- **Swimming & Aquatics** - Water-based activities
- **Dance** - Dance and movement activities
- **Music** - Musical instruction and performance
- **Visual Arts** - Art, painting, drawing activities
- **STEM** - Science, Technology, Engineering, Math activities
- **Drama & Theatre** - Acting and performance activities

### Activity Subtype
The specific activity within an Activity Type:
- Under **Team Sports**: Soccer, Basketball, Baseball, Hockey, etc.
- Under **Martial Arts**: Karate, Taekwondo, Judo, etc.
- Under **Swimming & Aquatics**: Swimming Lessons, Water Polo, Diving, etc.
- Under **Dance**: Ballet, Hip Hop, Jazz, Tap, etc.

## Category (Age & Participation Grouping)

**Category** is completely separate from Activity Types and relates to AGE GROUPS and PARTICIPATION STYLE:

### Examples of Categories:
- **Parent & Tot** - Activities where parents participate with toddlers
- **Preschool** - Activities for preschool-aged children (3-5 years)
- **Youth** - Activities for school-aged children (6-12 years)
- **Teen** - Activities for teenagers (13-18 years)
- **All Ages** - Activities open to multiple age groups
- **Adult & Child** - Activities requiring adult participation

## Database Structure

```sql
-- Activity Types (what kind of activity)
ActivityType
├── id
├── code (e.g., "team-sports")
├── name (e.g., "Team Sports")
└── displayOrder

-- Activity Subtypes (specific activity)
ActivitySubtype
├── id
├── activityTypeId (foreign key to ActivityType)
├── code (e.g., "soccer")
├── name (e.g., "Soccer")
└── displayOrder

-- Categories (age/participation groups)
Category
├── id
├── code (e.g., "parent-tot")
├── name (e.g., "Parent & Tot")
├── ageMin
├── ageMax
└── requiresParent

-- Activities (actual programs/classes)
Activity
├── id
├── name (e.g., "U8 Soccer League")
├── activityTypeId (links to Team Sports)
├── activitySubtypeId (links to Soccer)
├── category (e.g., "Youth")
├── ageMin (e.g., 6)
├── ageMax (e.g., 8)
└── ... other fields
```

## Examples to Clarify

### Example 1: Youth Soccer Program
- **Activity Type**: Team Sports
- **Activity Subtype**: Soccer
- **Category**: Youth
- **Age Range**: 8-10 years

### Example 2: Parent & Tot Swimming
- **Activity Type**: Swimming & Aquatics
- **Activity Subtype**: Swimming Lessons
- **Category**: Parent & Tot
- **Age Range**: 2-4 years

### Example 3: Teen Karate Class
- **Activity Type**: Martial Arts
- **Activity Subtype**: Karate
- **Category**: Teen
- **Age Range**: 13-17 years

## Common Mistakes to Avoid

❌ **WRONG**: "Soccer is a category"
✅ **CORRECT**: "Soccer is an Activity Subtype under the Team Sports Activity Type"

❌ **WRONG**: "Youth Soccer is an activity type"
✅ **CORRECT**: "Soccer is the Activity Subtype, Youth is the Category"

❌ **WRONG**: "Parent & Tot is an activity type"
✅ **CORRECT**: "Parent & Tot is a Category indicating age group and participation style"

## API Usage

When filtering activities:

```javascript
// Filter by activity type and subtype (WHAT the activity is)
{
  activityType: "Team Sports",
  activitySubtype: "Soccer"
}

// Filter by category (WHO it's for)
{
  category: "Youth",
  ageMin: 8,
  ageMax: 12
}

// Combined filtering
{
  activityType: "Swimming & Aquatics",
  activitySubtype: "Swimming Lessons",
  category: "Parent & Tot",
  ageMin: 2,
  ageMax: 4
}
```

## Summary

- **Activity Type/Subtype** = WHAT the activity is (the actual sport/art/skill)
- **Category** = WHO it's for (age group and participation requirements)
- These are completely separate classification systems that work together