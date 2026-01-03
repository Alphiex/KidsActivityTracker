# Kids Activity Tracker - Backend Server

## Overview

Node.js/Express backend API server for the Kids Activity Tracker mobile app. Provides REST APIs for activity management, user authentication, AI-powered recommendations, and automated web scraping from recreation centers across Canada.

## Tech Stack

- **Runtime**: Node.js 20.x
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 15 with Prisma ORM
- **Deployment**: Google Cloud Run
- **Scraping**: Puppeteer with stealth plugins
- **AI**: OpenAI GPT-4o, LangGraph orchestration
- **Authentication**: JWT tokens
- **Geocoding**: Google Maps API
- **Payments**: Stripe (partners), RevenueCat (consumers)

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
npm run migrate:dev

# Start development server
npm run dev  # Runs on http://localhost:3000

# Build for production
npm run build
npm start
```

## Directory Structure

```
server/
├── src/                   # TypeScript source code
│   ├── ai/               # AI features
│   │   ├── graph/        # LangGraph nodes
│   │   ├── orchestrator/ # AI orchestration
│   │   └── routes/       # AI API routes
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic services
│   ├── middleware/       # Express middleware
│   └── server.ts         # Main server file
├── prisma/               # Database ORM
│   ├── schema.prisma     # Database schema (40+ tables)
│   └── migrations/       # Migration history
├── generated/            # Generated Prisma client
├── scrapers/             # Web scraping modules
│   ├── base/             # BaseScraper class with geocoding
│   ├── platforms/        # Platform-specific scrapers
│   ├── configs/          # Provider JSON configs
│   ├── scripts/          # Scraper utility scripts
│   └── validation/       # Claude Vision validation
├── scripts/              # Maintenance scripts
└── Dockerfile            # Container configuration
```

## API Endpoints

### Activities
- `GET /api/v1/activities` - Search with filters (age, cost, type, location, date, etc.)
- `GET /api/v1/activities/bounds` - Geographic search within map viewport
- `GET /api/v1/activities/:id` - Get activity details
- `GET /api/v1/activities/stats/summary` - Activity statistics

### Children
- `GET /api/v1/children` - List user's children
- `POST /api/v1/children` - Create child
- `PUT /api/v1/children/:id` - Update child
- `DELETE /api/v1/children/:id` - Delete child
- `GET /api/v1/children/:id/activities` - Child's activities
- `POST /api/v1/children/:id/activities` - Add activity to child
- `PUT /api/v1/children/:id/activities/:activityId` - Update activity status
- `GET /api/v1/children/:id/favorites` - Child's favorites
- `POST /api/v1/children/:id/custom-events` - Create custom event

### AI Features
- `POST /api/v1/ai/recommendations` - Personalized activity recommendations
- `POST /api/v1/ai/chat` - Conversational AI assistant
- `POST /api/v1/ai/plan-week` - Weekly schedule generation
- `GET /api/v1/ai/chat/quota` - Check user's AI quota

### Reference Data
- `GET /api/v1/locations` - List all locations
- `GET /api/v1/providers` - List activity providers
- `GET /api/v1/activity-types` - List activity types
- `GET /api/v1/categories` - List categories

### Partners & Sponsorship
- `GET /api/v1/partners/sponsored` - Sponsored activities
- `POST /api/v1/partners/impressions` - Track ad impressions
- `POST /api/v1/partners/clicks` - Track ad clicks

## Key Statistics

| Metric | Value |
|--------|-------|
| Activities | 126,000+ |
| Locations | 4,900+ |
| Providers | 85 |
| Cities | 80 |
| Provinces | 11 |
| Geocoded Activities | 99.3% |
| Geocoded Locations | 95.9% |

## Key Features

### Geographic Search
The `/api/v1/activities/bounds` endpoint supports map viewport filtering:
```typescript
// Query by map bounds
GET /api/v1/activities/bounds?minLat=49.2&maxLat=49.4&minLng=-123.2&maxLng=-123.0
```

### Activity Status Filtering
```typescript
// Hide closed or full activities
if (filters.hideClosedOrFull) {
  where.AND = [
    { registrationStatus: { not: 'Closed' } },
    { spotsAvailable: { gt: 0 } }
  ]
}
```

### Child Activity States
```typescript
type ActivityStatus =
  | 'interested'  // Saved/favorited
  | 'enrolled'    // Currently participating
  | 'completed'   // Finished
  | 'dropped'     // Withdrew
  | 'watching';   // Monitoring for availability
```

### Geocoding Integration
New locations are automatically geocoded during scraping:
```javascript
// In BaseScraper.js
await this.geocodeNewLocations(createdLocations);
```

### AI Architecture (LangGraph)
```
Request → AI Orchestrator → LangGraph State Machine
                              ├── parseQueryNode
                              ├── fetchCandidatesNode
                              ├── rankActivitiesNode
                              ├── generateExplanationsNode
                              └── plannerNode (weekly planning)
```

## Deployment

### Google Cloud Run

```bash
# Deploy API
./scripts/deployment/deploy-api.sh

# Or manually:
gcloud run deploy kids-activity-api \
  --source . \
  --region=us-central1 \
  --project=kids-activity-tracker-2024 \
  --allow-unauthenticated
```

**Production URL**: `https://kids-activity-api-4ev6yi22va-uc.a.run.app`

⚠️ **CRITICAL**: Cloud Run URLs change on service deletion. Never delete the service.

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Server
NODE_ENV=production
PORT=8080

# AI
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Geocoding
GOOGLE_MAPS_API_KEY=AIza...

# Payments
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Security
JWT_SECRET=your-secret-key
CORS_ORIGIN=*
```

## Scraper System

### Platforms Supported
- PerfectMind (Vancouver, North Vancouver, etc.)
- ActiveNetwork (Toronto, Ottawa, etc.)
- Amilia (Calgary, Edmonton)
- IC3 (Various cities)
- CivicRec (Various cities)
- Custom scrapers for specific providers

### Running Scrapers

```bash
# Run specific provider
node scrapers/scripts/runScraper.js --provider=vancouver

# Run all scrapers
node scrapers/scripts/runAllScrapers.js

# Validate scraper output
node scrapers/scripts/runValidation.js --provider=vancouver --sample=5

# Backfill geocoding
node scrapers/scripts/geocodeLocations.js --limit=1000
```

### Schedule Configuration
Each provider has a JSON config with schedule settings:
```json
{
  "schedule": {
    "frequency": "daily",
    "times": ["06:00", "18:00"],
    "tier": "critical"
  }
}
```

## Maintenance Scripts

```bash
# Fix city/province data
node scripts/maintenance/fix-city-provinces.js

# Normalize locations
node scripts/maintenance/normalize-locations.js

# Database check
node scripts/database/check-database.js
```

## Security

1. **Authentication**: JWT tokens with 15-min access / 7-day refresh
2. **Rate Limiting**: 100 requests per 15 minutes per IP
3. **SQL Injection**: Protected via Prisma parameterized queries
4. **Input Validation**: express-validator on all endpoints
5. **HTTPS**: Enforced via Cloud Run
6. **API Keys**: Stored in environment variables (gitignored)

## Performance

- Database indexes on frequently queried columns
- Pagination with configurable limit/offset
- 99.3% of activities pre-geocoded for fast map queries
- Connection pooling via Prisma
- Gzip compression enabled
- Response caching for static data

## Troubleshooting

### No activities returned
```sql
SELECT COUNT(*) FROM "Activity" WHERE "isActive" = true;
SELECT COUNT(*) FROM "Activity" WHERE "registrationStatus" != 'Closed';
```

### Database connection errors
```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1"

# Check Cloud SQL
gcloud sql instances describe kids-activity-db-dev
```

### API deployment failures
```bash
# Check logs
gcloud run services logs read kids-activity-api --limit=50

# Check service status
gcloud run services describe kids-activity-api --region=us-central1
```

## Development

```bash
# Hot reload development
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Prisma Studio (database GUI)
npx prisma studio

# Format code
npm run format
```

---

**Last Updated**: January 2026
**Version**: 6.0
