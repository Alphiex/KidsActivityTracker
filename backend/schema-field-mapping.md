# Production Schema Field Mapping for Scrapers

## Activity Model Fields (from production schema)

### Required Fields
- `id` - auto-generated
- `providerId` - from Provider relation
- `externalId` - unique identifier from provider (courseId or similar)
- `name` - activity name
- `category` - main category
- `cost` - price (default 0)

### Important Optional Fields
- `subcategory` - subcategory/section
- `activityTypeId` - link to ActivityType table
- `activitySubtypeId` - link to ActivitySubtype table  
- `description` - full description
- `schedule` - human-readable schedule
- `dates` - date range string (e.g., "Sep 11 - Oct 9")
- `dateStart` - start date
- `dateEnd` - end date
- `registrationDate` - when registration opens
- `registrationEndDate` - when registration closes
- `registrationEndTime` - time registration closes
- `ageMin` - minimum age
- `ageMax` - maximum age
- `costIncludesTax` - boolean (default true)
- `taxAmount` - if tax is separate
- `spotsAvailable` - current spots
- `totalSpots` - total capacity
- `locationId` - link to Location table
- `locationName` - location as string
- `registrationUrl` - registration link
- `courseId` - provider's course ID
- `dayOfWeek` - array of days (String[])
- `startTime` - activity start time
- `endTime` - activity end time
- `rawData` - JSON for original data

### System Fields
- `isActive` - boolean (default true)
- `lastSeenAt` - timestamp
- `createdAt` - timestamp
- `updatedAt` - timestamp

## Scraper Field Mapping

### NVRC (PerfectMind) → Database
```javascript
{
  externalId: courseId,
  name: name,
  category: section,
  subcategory: activitySection,
  description: fullDescription,
  schedule: formatSchedule(daysOfWeek, time),
  dates: dates,
  dateStart: startDate,
  dateEnd: endDate,
  registrationEndDate: registrationEndDate,
  registrationEndTime: registrationEndTime,
  ageMin: ageRange.min,
  ageMax: ageRange.max,
  cost: cost,
  costIncludesTax: costIncludesTax,
  taxAmount: taxAmount,
  spotsAvailable: spotsAvailable,
  totalSpots: totalSpots,
  locationName: location,
  registrationUrl: registrationUrl,
  courseId: courseId,
  dayOfWeek: daysOfWeek,
  startTime: startTime,
  endTime: endTime,
  rawData: {...originalData}
}
```

### West Vancouver (Active Network) → Database  
```javascript
{
  externalId: categoryId || activityId,
  name: name,
  category: category,
  subcategory: subcategory,
  description: description,
  schedule: schedule,
  dates: dates,
  dateStart: startDate,
  dateEnd: endDate,
  ageMin: ageRange.min,
  ageMax: ageRange.max,
  cost: cost,
  spotsAvailable: spotsAvailable,
  totalSpots: totalSpots,
  locationName: location,
  registrationUrl: detailUrl,
  dayOfWeek: extractDaysFromSchedule(schedule),
  startTime: extractTimeFromSchedule(schedule),
  rawData: {...originalData}
}
```

## Key Differences Between Providers

### NVRC (PerfectMind)
- Uses `courseId` as unique identifier
- Has hierarchical sections and activity types
- Provides detailed session information
- Rich detail pages with comprehensive data

### West Vancouver (Active Network)
- Uses `categoryId` or custom ID
- Category-based navigation
- Search-based discovery
- May have less structured data

## Implementation Notes

1. **Always save raw data** - Store original scraped data in `rawData` field for debugging
2. **Handle missing fields gracefully** - Use null/undefined for missing optional fields
3. **Normalize costs** - Ensure costs are numeric, handle "$" signs and commas
4. **Parse dates carefully** - Convert to proper DateTime objects
5. **Extract day arrays** - Convert schedule strings to dayOfWeek arrays
6. **Maintain provider uniqueness** - Use providerId + externalId as unique constraint