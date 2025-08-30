# Generic Scraper Architecture Plan

## Overview

This document outlines the design for a generic scraper architecture that can handle multiple community recreation websites, starting with North Vancouver (NVRC - PerfectMind) and West Vancouver (Active Network).

## Current State Analysis

### North Vancouver (NVRC) - PerfectMind System
- **Platform**: PerfectMind widget-based system
- **URL Pattern**: `https://nvrc.perfectmind.com/23734/Clients/BookMe4?widgetId=...`
- **Architecture**: Widget-based with hierarchical navigation
- **Data Extraction**: 
  - Activities grouped by age sections (Early Years, School Age, Youth, etc.)
  - Rich detail pages with sessions, prerequisites, instructor info
  - Registration URLs available
- **Challenges**: Dynamic content, requires multiple page navigation

### West Vancouver - Active Network System
- **Platform**: Active Network (ActiveCommunities)
- **URL Pattern**: `https://anc.ca.apm.activecommunities.com/westvanrec/activity/search`
- **Architecture**: Category-based with search filters
- **Data Extraction**:
  - JSON-driven configuration
  - Category-based activity organization
  - Age filtering supported (max_age=18 for kids)
- **Challenges**: Client-side rendering, potential CSRF protection

## Generic Scraper Architecture

### 1. Base Scraper Interface

```typescript
interface BaseScraper {
  // Core methods every scraper must implement
  scrape(): Promise<ScrapedActivity[]>;
  validateConfig(): boolean;
  getProviderInfo(): ProviderConfig;
  
  // Optional enhancement methods
  getActivityDetails?(activityUrl: string): Promise<ActivityDetails>;
  supportsBulkScraping?(): boolean;
  supportsIncrementalUpdates?(): boolean;
}
```

### 2. Provider Configuration System

```typescript
interface ProviderConfig {
  name: string;
  code: string; // 'nvrc', 'westvancouver', etc.
  platform: 'perfectmind' | 'activenetwork' | 'other';
  baseUrl: string;
  scraperConfig: {
    type: 'widget' | 'search' | 'api';
    entryPoints: string[];
    requiresAuth?: boolean;
    rateLimits?: {
      requestsPerMinute: number;
      concurrentRequests: number;
    };
    fieldMappings: FieldMapping;
  };
}
```

### 3. Scraper Factory Pattern

```typescript
class ScraperFactory {
  static createScraper(providerConfig: ProviderConfig): BaseScraper {
    switch (providerConfig.platform) {
      case 'perfectmind':
        return new PerfectMindScraper(providerConfig);
      case 'activenetwork':
        return new ActiveNetworkScraper(providerConfig);
      default:
        return new GenericScraper(providerConfig);
    }
  }
}
```

### 4. Data Normalization Layer

```typescript
interface ActivityData {
  // Core fields (always present)
  name: string;
  externalId: string;
  category: string;
  subcategory?: string;
  
  // Dates and scheduling
  dateStart?: Date;
  dateEnd?: Date;
  schedule?: string; // Human readable
  daysOfWeek?: string[];
  startTime?: string;
  endTime?: string;
  
  // Pricing and availability
  cost: number;
  spotsAvailable?: number;
  totalSpots?: number;
  registrationStatus: 'Open' | 'Full' | 'Closed' | 'Waitlist';
  
  // Demographics
  ageMin?: number;
  ageMax?: number;
  
  // Location
  locationName?: string;
  address?: string;
  
  // Registration
  registrationUrl?: string;
  
  // Enhanced details (optional)
  description?: string;
  instructor?: string;
  prerequisites?: string[];
  sessions?: ActivitySession[];
  
  // Metadata
  rawData: any; // Original scraped data for debugging
}
```

## Implementation Plan

### Phase 1: Core Architecture (Week 1-2)

1. **Create base scraper framework**
   - `BaseScraperService` abstract class
   - `ProviderConfigService` for configuration management
   - `ScraperFactory` for scraper instantiation

2. **Implement data normalization**
   - `ActivityDataNormalizer` service
   - Field mapping utilities
   - Validation schemas

3. **Extend existing NVRC scraper**
   - Refactor existing `NVRCEnhancedParallelScraper` to implement `BaseScraper`
   - Extract configuration to database

### Phase 2: West Vancouver Implementation (Week 3-4)

1. **Research and prototype**
   - Build test scraper for West Vancouver
   - Identify exact HTML/JSON patterns
   - Handle Active Network platform specifics

2. **Implement ActiveNetworkScraper**
   - Category-based navigation
   - Activity listing extraction
   - Detail page scraping (if available)

3. **Testing and validation**
   - Compare data quality with NVRC
   - Validate field mappings
   - Performance testing

### Phase 3: Generic Framework (Week 5-6)

1. **Configuration system**
   - Database schema for provider configs
   - Admin interface for configuration management
   - Runtime configuration updates

2. **Monitoring and maintenance**
   - Scraper health checks
   - Failure notifications
   - Data quality metrics

3. **Documentation and deployment**
   - Developer guides
   - Configuration examples
   - Production deployment

## File Structure

```
backend/
├── scrapers/
│   ├── base/
│   │   ├── BaseScraper.js
│   │   ├── ScraperFactory.js
│   │   └── DataNormalizer.js
│   ├── platforms/
│   │   ├── PerfectMindScraper.js
│   │   ├── ActiveNetworkScraper.js
│   │   └── GenericScraper.js
│   ├── providers/
│   │   ├── NVRCScraper.js (extends PerfectMindScraper)
│   │   └── WestVancouverScraper.js (extends ActiveNetworkScraper)
│   └── utils/
│       ├── fieldMapping.js
│       ├── dateParser.js
│       └── locationNormalizer.js
├── services/
│   ├── ProviderConfigService.js
│   └── ScraperOrchestrator.js
└── jobs/
    └── MultiProviderScraperJob.js
```

## Key Design Principles

### 1. Modularity
- Each scraper is independent and replaceable
- Platform-specific logic separated from provider-specific logic
- Clear interfaces between components

### 2. Configurability
- Provider settings stored in database
- Runtime configuration updates
- Easy addition of new providers

### 3. Reliability
- Comprehensive error handling
- Retry mechanisms with exponential backoff
- Data validation at multiple levels

### 4. Scalability
- Parallel processing capabilities
- Rate limiting and resource management
- Incremental updates where possible

### 5. Maintainability
- Clear separation of concerns
- Extensive logging and monitoring
- Standardized field mappings

## Field Mapping Strategy

### Core Field Mappings

| Standard Field | NVRC (PerfectMind) | West Vancouver (Active Network) | Notes |
|----------------|--------------------|---------------------------------|-------|
| name | activity.name | title | |
| externalId | courseId | ActivityID | Unique identifier from source |
| cost | activity.cost | fee | Normalized to float |
| ageMin/ageMax | Parsed from age text | age_min/age_max | Extracted from various formats |
| locationName | activity.location | facility | |
| schedule | activity.schedule | schedule_text | Human readable format |
| registrationUrl | activity.registrationUrl | registration_link | |

### Platform-Specific Mappings

Each scraper will have its own field mapping configuration that translates platform-specific data into our standardized format.

## Next Steps

1. Implement base scraper framework
2. Refactor existing NVRC scraper to use new architecture
3. Build West Vancouver scraper
4. Add configuration management
5. Deploy and monitor

This architecture will allow us to easily add new municipalities and recreation providers while maintaining code quality and reliability.