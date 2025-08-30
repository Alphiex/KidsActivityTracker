# Capability Gaps and Requirements Analysis

## Overview

This document identifies the gaps between our current NVRC-only scraper system and the requirements for a generic multi-provider scraper system, starting with West Vancouver.

## Current System Capabilities

### ✅ What We Have Working
1. **NVRC PerfectMind Scraper**
   - Comprehensive activity extraction
   - Detail page scraping with sessions and prerequisites
   - Parallel processing with 5 concurrent browsers
   - Database integration with create/update/deactivate logic
   - Enhanced activity details (instructor, full descriptions, sessions)
   - Location handling with fuzzy matching
   - Activity type parsing and categorization

2. **Database Schema**
   - Robust Activity model with all necessary fields
   - Provider, Location, ActivityType models
   - Session and Prerequisite tracking
   - User accounts and favorites system

3. **API Infrastructure**
   - RESTful API with filtering and search
   - Activity categories and providers endpoints
   - Real-time activity data serving

4. **Monitoring and Maintenance**
   - Scrape job tracking
   - Error handling and logging
   - Data validation and cleanup

## Capability Gaps

### 🔧 Infrastructure Gaps

#### 1. Generic Scraper Framework
**Current State**: Single, hardcoded NVRC scraper
**Required**: 
- Abstract base scraper class
- Scraper factory pattern
- Provider-specific configuration system
- Plugin architecture for new scrapers

#### 2. Configuration Management
**Current State**: Hardcoded scraper settings
**Required**:
- Database-driven provider configurations
- Runtime configuration updates
- Field mapping configurations per provider
- Rate limiting and concurrency settings per provider

#### 3. Data Normalization Layer
**Current State**: NVRC-specific field parsing
**Required**:
- Generic field mapping engine
- Date/time format standardization
- Age range parsing utilities
- Cost format normalization
- Location name standardization

### 🌐 Platform-Specific Gaps

#### 1. Active Network Platform Support
**Current State**: Only PerfectMind support
**Required**:
- Active Network scraper implementation
- JavaScript-rendered content handling
- CSRF token management
- Category-based navigation system

#### 2. Different Data Structures
**Current State**: PerfectMind widget structure
**Required**:
- JSON API response parsing
- HTML table/card parsing
- Search result pagination
- Category-based data organization

### 📊 Data Processing Gaps

#### 1. Multi-Provider Data Consistency
**Current State**: Single provider data model
**Required**:
- Cross-provider data validation
- Duplicate detection across providers
- Data quality metrics per provider
- Standardized categorization across providers

#### 2. Location Management
**Current State**: NVRC location handling
**Required**:
- Multi-city location management
- Geocoding for multiple regions
- Facility type standardization across providers
- Address format normalization

### 🔧 Technical Implementation Requirements

## Phase 1: Core Framework (Weeks 1-2)

### 1.1 Base Scraper Architecture
```javascript
// Files to create:
backend/scrapers/base/BaseScraper.js
backend/scrapers/base/ScraperFactory.js
backend/scrapers/base/DataNormalizer.js
backend/services/ScraperConfigService.js
```

**Requirements**:
- Abstract base class with standard interface
- Configuration loading from database
- Error handling and retry logic
- Logging and metrics collection

### 1.2 Provider Configuration System
```sql
-- Database schema additions:
CREATE TABLE ScraperConfig (
  id UUID PRIMARY KEY,
  provider_id UUID REFERENCES Provider(id),
  platform VARCHAR(50), -- 'perfectmind', 'activenetwork'
  config JSONB, -- Platform-specific configuration
  field_mappings JSONB, -- Field mapping rules
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Requirements**:
- Dynamic configuration loading
- Field mapping rules engine
- Rate limiting configuration
- Validation rules per provider

### 1.3 Refactor Existing NVRC Scraper
**Requirements**:
- Extend new BaseScraper class
- Extract configuration to database
- Maintain backward compatibility
- Add comprehensive testing

## Phase 2: West Vancouver Implementation (Weeks 3-4)

### 2.1 Active Network Scraper
```javascript
// Files to create:
backend/scrapers/platforms/ActiveNetworkScraper.js
backend/scrapers/providers/WestVancouverScraper.js
```

**Requirements**:
- Handle client-side rendered content
- Category-based navigation
- Search result parsing
- Registration link extraction

### 2.2 West Vancouver Specific Features
**Requirements**:
- Age-filtered activity search (max_age=18)
- Active Network authentication handling
- West Vancouver location mapping
- Category mapping to existing system

### 2.3 Data Integration
**Requirements**:
- West Vancouver provider setup
- Location creation for West Van facilities
- Activity type mapping
- Cost and schedule normalization

## Phase 3: Generic Framework Enhancement (Weeks 5-6)

### 3.1 Multi-Provider Orchestration
```javascript
// Files to create:
backend/jobs/MultiProviderScraperJob.js
backend/services/ScraperOrchestrator.js
```

**Requirements**:
- Parallel provider scraping
- Cross-provider data validation
- Consolidated reporting
- Failure isolation (one provider failure doesn't affect others)

### 3.2 Monitoring and Alerting
**Requirements**:
- Provider-specific health checks
- Data quality metrics dashboard
- Email/Slack notifications for failures
- Performance monitoring per provider

### 3.3 Admin Interface
**Requirements**:
- Provider configuration UI
- Scraper status dashboard
- Manual scraper triggers
- Data quality reports

## Technical Challenges and Solutions

### Challenge 1: JavaScript-Rendered Content
**Problem**: West Vancouver uses client-side rendering
**Solution**: 
- Use Puppeteer with longer wait times
- Implement content detection patterns
- Handle dynamic loading states

### Challenge 2: Different Authentication Patterns
**Problem**: Each platform may have different auth requirements
**Solution**:
- Abstract authentication layer
- Provider-specific auth handlers
- Session management per platform

### Challenge 3: Rate Limiting and Politeness
**Problem**: Different sites have different rate limits
**Solution**:
- Configurable rate limiting per provider
- Exponential backoff on errors
- Request queuing system

### Challenge 4: Data Quality Consistency
**Problem**: Different providers may have varying data quality
**Solution**:
- Provider-specific validation rules
- Data quality scoring
- Fallback and default values

## Database Schema Enhancements Required

### New Tables
```sql
-- Scraper configuration
CREATE TABLE ScraperConfig (
  id UUID PRIMARY KEY,
  provider_id UUID REFERENCES Provider(id),
  platform VARCHAR(50),
  config JSONB,
  field_mappings JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Provider-specific data quality metrics
CREATE TABLE ProviderMetrics (
  id UUID PRIMARY KEY,
  provider_id UUID REFERENCES Provider(id),
  scrape_date DATE,
  activities_found INTEGER,
  activities_processed INTEGER,
  data_quality_score FLOAT,
  errors JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Schema Updates
```sql
-- Add provider-specific fields to existing tables
ALTER TABLE Provider ADD COLUMN platform VARCHAR(50);
ALTER TABLE Provider ADD COLUMN region VARCHAR(100);
ALTER TABLE Provider ADD COLUMN contact_info JSONB;

-- Add indexing for multi-provider queries
CREATE INDEX idx_activity_provider_category ON Activity(provider_id, category);
CREATE INDEX idx_location_provider_city ON Location(provider_id, city);
```

## Resource Requirements

### Development Resources
- **Senior Developer**: 4-6 weeks full-time for core architecture
- **Mid-level Developer**: 2-3 weeks for West Vancouver implementation
- **DevOps Engineer**: 1 week for deployment and monitoring setup

### Infrastructure Requirements
- **Additional Cloud Run Instance**: For West Vancouver scraper
- **Database Storage**: ~20% increase for multi-provider data
- **Monitoring Tools**: Enhanced logging and alerting

### Testing Requirements
- **Unit Tests**: All new scraper components
- **Integration Tests**: Multi-provider scenarios
- **Load Testing**: Parallel scraper performance
- **Data Quality Tests**: Cross-provider validation

## Success Metrics

### Technical Metrics
- **Scraper Reliability**: >95% success rate per provider
- **Data Quality**: >98% valid activities (no missing required fields)
- **Performance**: Complete scraping within 30 minutes per provider
- **Coverage**: Support for 2+ municipalities within 6 weeks

### Business Metrics
- **Activity Coverage**: 100% of kids activities from both providers
- **Data Freshness**: Daily updates from all active providers
- **User Experience**: Seamless cross-provider activity browsing
- **Maintenance**: <2 hours/week ongoing maintenance per provider

## Risk Mitigation

### High Risk: Website Structure Changes
- **Mitigation**: Comprehensive error handling and alerting
- **Backup Plan**: Generic scraper fallbacks

### Medium Risk: Rate Limiting/Blocking
- **Mitigation**: Respectful scraping practices and rate limiting
- **Backup Plan**: Manual data entry processes

### Low Risk: Performance Issues
- **Mitigation**: Parallel processing and optimization
- **Backup Plan**: Staggered scraping schedules

## Next Steps for Implementation

1. **Week 1**: Implement base scraper framework and refactor NVRC
2. **Week 2**: Create provider configuration system and testing
3. **Week 3**: Build West Vancouver scraper prototype
4. **Week 4**: Complete West Vancouver integration and testing
5. **Week 5**: Implement monitoring and admin interface
6. **Week 6**: Performance optimization and production deployment

This analysis provides a comprehensive roadmap for extending the Kids Activity Tracker to support multiple municipalities while maintaining high data quality and system reliability.