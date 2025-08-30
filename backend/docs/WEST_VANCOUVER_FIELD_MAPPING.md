# West Vancouver Field Mapping Analysis

## Overview

This document analyzes the field mapping between West Vancouver's Active Network system and the existing KidsActivityTracker database schema.

## West Vancouver (Active Network) Data Structure

Based on the analysis of the West Vancouver website, here's what we can expect from their Active Network platform:

### Activity Categories Available
- **Arts**: Dance, Music, Visual Arts, Theatre
- **Camps**: Day Camps, Sport Camps, Specialty Camps
- **Sports**: Soccer, Basketball, Swimming, Tennis, Hockey, etc.
- **Fitness**: Youth Fitness, Family Fitness
- **Aquatics**: Swimming Lessons, Water Safety, Aqua Fitness
- **Recreation**: General recreation programs

### Expected Data Fields

Based on Active Network platform standards, activities typically include:

#### Basic Activity Information
- **Activity Title**: Full descriptive name
- **Activity ID**: Unique identifier in their system
- **Category**: Primary category (Arts, Sports, etc.)
- **Subcategory**: More specific classification
- **Description**: Detailed program description
- **Age Range**: Minimum and maximum age requirements
- **Skill Level**: Beginner, Intermediate, Advanced

#### Scheduling Information
- **Start Date**: Program start date
- **End Date**: Program end date
- **Days of Week**: Which days the program runs
- **Start Time**: Daily start time
- **End Time**: Daily end time
- **Session Dates**: Individual session dates (if applicable)

#### Location and Facility
- **Facility Name**: Where the program is held
- **Address**: Full street address
- **Room/Area**: Specific location within facility

#### Registration Information
- **Cost/Fee**: Program cost
- **Registration Deadline**: Last day to register
- **Spots Available**: Current availability
- **Total Capacity**: Maximum participants
- **Registration Status**: Open, Closed, Full, Waitlist
- **Registration URL**: Direct link to register

#### Additional Details
- **Instructor**: Program instructor name
- **Requirements**: What to bring, prerequisites
- **Contact Information**: Phone, email for questions

## Field Mapping to Existing Database Schema

| Database Field | West Vancouver Source | Data Type | Notes |
|----------------|----------------------|-----------|-------|
| **Core Activity Fields** |
| `name` | Activity Title | String | Direct mapping |
| `externalId` | Activity ID | String | Unique identifier from Active Network |
| `providerId` | Static: West Vancouver ID | String | Set during scraping |
| `category` | Primary Category | String | Arts, Sports, Camps, etc. |
| `subcategory` | Subcategory | String | More specific classification |
| `description` | Description | String | Full program description |
| **Scheduling Fields** |
| `dateStart` | Start Date | DateTime | Parsed from date string |
| `dateEnd` | End Date | DateTime | Parsed from date string |
| `dates` | "Start Date - End Date" | String | Human-readable format |
| `schedule` | Days + Times | String | "Mon, Wed, Fri 3:00-4:00 PM" |
| `startTime` | Start Time | String | "3:00 PM" |
| `endTime` | End Time | String | "4:00 PM" |
| `dayOfWeek` | Days of Week | String[] | ["Monday", "Wednesday", "Friday"] |
| **Demographics** |
| `ageMin` | Minimum Age | Int | Parsed from age range |
| `ageMax` | Maximum Age | Int | Parsed from age range |
| **Pricing & Availability** |
| `cost` | Fee/Cost | Float | Converted to number |
| `spotsAvailable` | Available Spots | Int | Current availability |
| `totalSpots` | Total Capacity | Int | Maximum participants |
| `registrationStatus` | Status | String | Open/Closed/Full/Waitlist |
| `registrationEndDate` | Registration Deadline | DateTime | When registration closes |
| **Location Fields** |
| `locationName` | Facility Name | String | Main facility name |
| `locationId` | Location lookup | String | FK to Location table |
| `fullAddress` | Full Address | String | Complete address |
| **Registration** |
| `registrationUrl` | Registration Link | String | Direct registration URL |
| **Enhanced Details** |
| `instructor` | Instructor Name | String | Program instructor |
| `fullDescription` | Full Description | String | Complete program details |
| `whatToBring` | Requirements/Materials | String | What participants need |
| **System Fields** |
| `isActive` | true | Boolean | Set during scraping |
| `lastSeenAt` | Current timestamp | DateTime | When scraped |
| `rawData` | Complete source data | JSON | For debugging |

## Platform-Specific Mapping Challenges

### 1. Date Format Variations
Active Network may use different date formats:
- ISO dates: "2024-09-15"
- US format: "09/15/2024"
- Display format: "September 15, 2024"

**Solution**: Implement flexible date parsing utilities

### 2. Age Range Formats
Expected formats:
- "6-12 years"
- "Ages 8-14"
- "Youth (13-17)"
- "Adult 18+"

**Solution**: Robust regex parsing for age extraction

### 3. Cost Representation
Possible formats:
- "$75.00"
- "$75"
- "Free"
- "Member: $65, Non-member: $75"

**Solution**: Parse multiple cost scenarios, default to primary cost

### 4. Schedule Complexity
Active Network schedules might be:
- "Mondays 3:00-4:00 PM"
- "Mon/Wed/Fri 3:00-4:00 PM"
- "Weekdays 3:00-4:00 PM"
- Multiple time slots per week

**Solution**: Parse into standardized format, store original in `schedule` field

## Location Handling

### West Vancouver Facilities
Expected facilities:
- West Vancouver Community Centre
- West Vancouver Aquatic Centre
- Various parks and outdoor facilities
- Schools (partnerships)

### Location Normalization Strategy
1. **Create Location Records**: For each unique facility
2. **Geocoding**: Add latitude/longitude for mapping
3. **Facility Type Classification**: Recreation Centre, Pool, Park, etc.
4. **Address Standardization**: Consistent format

## Data Quality Considerations

### Validation Rules
1. **Required Fields**: name, externalId, category, cost
2. **Date Validation**: startDate ≤ endDate
3. **Age Validation**: ageMin ≤ ageMax, both ≥ 0, both ≤ 18
4. **Cost Validation**: cost ≥ 0
5. **URL Validation**: registrationUrl is valid URL

### Data Enrichment
1. **Category Standardization**: Map to consistent categories
2. **Activity Type Classification**: Use existing ActivityType system
3. **Location Enhancement**: Add geocoding and facility details

## Implementation Notes

### Scraper Configuration
```javascript
const westVancouverConfig = {
  name: 'West Vancouver Recreation',
  code: 'westvancouver',
  platform: 'activenetwork',
  baseUrl: 'https://anc.ca.apm.activecommunities.com/westvanrec',
  scraperConfig: {
    type: 'search',
    entryPoints: [
      '/activity/search?max_age=18&viewMode=list'
    ],
    rateLimits: {
      requestsPerMinute: 30,
      concurrentRequests: 3
    },
    fieldMappings: {
      // Custom mappings for West Vancouver
    }
  }
};
```

### Error Handling
- **Missing Fields**: Provide sensible defaults
- **Invalid Data**: Log warnings, skip problematic records
- **Network Issues**: Implement retry logic with exponential backoff

## Integration with Existing System

### Database Updates Required
- Add West Vancouver as new Provider
- Create Location records for West Vancouver facilities
- Update ActivityType mappings for West Vancouver categories

### API Compatibility
The existing API should work seamlessly with West Vancouver activities:
- `/api/v1/activities` - Will include West Vancouver activities
- Filtering by provider will distinguish between NVRC and West Vancouver
- All existing app functionality will work with new data

## Next Steps for Implementation

1. **Build prototype scraper** to validate field mappings
2. **Test with small dataset** to ensure data quality
3. **Implement full scraper** using generic architecture
4. **Add monitoring** for data quality and scraper health
5. **Deploy and test** in production environment

This mapping ensures West Vancouver activities integrate seamlessly with the existing KidsActivityTracker system while maintaining data quality and consistency.