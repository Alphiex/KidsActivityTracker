# Kids Activity Tracker - Backend Server

## Overview

Node.js/Express backend API server for the Kids Activity Tracker mobile app. Provides REST APIs for activity management, user authentication, and automated web scraping from recreation centers across BC.

## Tech Stack

- **Runtime**: Node.js 20.x
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Deployment**: Google Cloud Run
- **Scraping**: Puppeteer with stealth plugins
- **Authentication**: JWT tokens
- **Caching**: Redis for session management

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

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
│   ├── api/              # API routes
│   ├── config/           # Configuration
│   ├── middleware/       # Express middleware
│   ├── services/         # Business logic
│   ├── utils/            # Utilities & filters
│   └── server.ts         # Main server file
├── prisma/               # Database ORM
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Migration history
├── scripts/              # Maintenance scripts
├── scrapers/             # Web scraping modules
└── Dockerfile            # Container configuration
```

## API Endpoints

### Activities
- `GET /api/v1/activities` - List activities with filters
  - Query params: `limit`, `offset`, `location`, `ageMin`, `ageMax`, `hideClosedOrFull`
- `GET /api/v1/activities/:id` - Get activity details
- `GET /api/v1/activities/stats/summary` - Activity statistics

### Filters & Search
- `hideClosedOrFull=true` - Hide activities that are closed OR have no spots (default: true)
- `location=North Vancouver` - Filter by location
- `ageMin=5&ageMax=10` - Age range filtering
- `activityType=Swimming` - Filter by activity type

### Reference Data
- `GET /api/v1/locations` - List all locations
- `GET /api/v1/providers` - List activity providers
- `GET /api/v1/activity-types` - List activity types
- `GET /api/v1/categories` - List categories

### User Features
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/v1/users/:id/favorites` - User favorites
- `POST /api/v1/favorites` - Add/remove favorite

## Key Features

### Global Activity Filters
The API implements smart filtering to improve UX:
```typescript
// Hide closed or full activities (OR condition)
if (filters.hideClosedOrFull) {
  // Using De Morgan's Law: NOT (A OR B) = NOT A AND NOT B
  where.AND = [
    { registrationStatus: { not: 'Closed' } },
    { spotsAvailable: { gt: 0 } }
  ]
}
```

### Database Schema

Key tables:
- `activities` - Main activity records (1000+ entries)
- `providers` - Activity providers (NVRC, community centers)
- `locations` - Physical locations across BC
- `activity_types` - Categories and subcategories
- `users` - User accounts with preferences
- `favorites` - User saved activities

## Deployment

### Google Cloud Run

```bash
# Build and deploy (from server directory)
gcloud run deploy kids-activity-api \
  --source . \
  --region=us-central1 \
  --project=kids-activity-tracker-2024 \
  --allow-unauthenticated

# Current production URL (MUST BE PRESERVED!)
# https://kids-activity-api-4ev6yi22va-uc.a.run.app
```

⚠️ **CRITICAL WARNING**:
- Cloud Run URLs change when services are deleted/recreated
- This breaks ALL deployed mobile clients
- Solution: Use custom domain mapping or never delete the service
- If URL changes, you must update `src/config/api.ts` and rebuild all apps

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DIRECT_URL=postgresql://user:pass@host:5432/dbname

# Server
NODE_ENV=production
PORT=8080

# Security
JWT_SECRET=your-secret-key-here
CORS_ORIGIN=*

# Optional
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
```

## Maintenance & Scripts

### CLI Commands
```bash
node cli.js scrape        # Run NVRC scraper
node cli.js migrate       # Run database migrations
node cli.js backup-db     # Backup database
```

### Utility Scripts
```bash
node scripts/check-activities.js    # Verify data integrity
node scripts/fix-costs.js           # Fix activity pricing
node scripts/test-filters.js        # Test filter logic
```

## Security Considerations

1. **Helmet.js**: Disabled due to iOS compatibility issues
2. **Rate Limiting**: 100 requests per 15 minutes per IP
3. **SQL Injection**: Protected via Prisma parameterized queries
4. **XSS Prevention**: Input sanitization on all endpoints
5. **Authentication**: JWT tokens with 7-day expiry
6. **HTTPS**: Enforced in production via Cloud Run

## Performance Optimizations

- Database indexes on frequently queried fields
- Pagination with limit/offset
- Prisma query optimization with `select` fields
- Connection pooling for database
- Gzip compression enabled

## Lessons Learned

### Deployment Issues
1. **URL Stability**: Cloud Run URLs change on service recreation - devastating for mobile apps
2. **CORS Headers**: Helmet security headers break iOS apps - configure carefully
3. **Database Connections**: Use connection pooling to avoid exhausting connections

### Filter Logic
1. **OR Conditions**: Require AND logic in SQL (De Morgan's Law)
2. **Null Handling**: Must check for null values in filter conditions
3. **Default Values**: Set sensible defaults (hideClosedOrFull=true)

### Best Practices
1. Always backup database before migrations
2. Test filters with production data locally
3. Monitor Cloud Run logs for errors
4. Keep API backwards compatible
5. Document all breaking changes

## Troubleshooting

### Common Issues

#### No activities returned
```sql
-- Check database
SELECT COUNT(*) FROM activities WHERE "isActive" = true;
SELECT COUNT(*) FROM activities WHERE "registrationStatus" != 'Closed';
```

#### iOS "cannot parse response"
- Check Helmet configuration
- Verify CORS headers
- Ensure Content-Type is application/json

#### Database connection errors
```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1"

# Check Cloud SQL proxy
gcloud sql instances describe kids-activity-db
```

#### API deployment failures
```bash
# Check logs
gcloud run services logs read kids-activity-api --limit=50

# Check service status
gcloud run services describe kids-activity-api --region=us-central1
```

## Development Tips

- Use `npm run dev` for hot reload during development
- Test with Postman/Insomnia for API debugging
- Use Prisma Studio for database inspection: `npx prisma studio`
- Check TypeScript errors: `npm run typecheck`
- Format code: `npm run format`

## Future Improvements

- [ ] GraphQL API endpoint
- [ ] WebSocket for real-time updates
- [ ] Redis caching for popular queries
- [ ] Elasticsearch for advanced search
- [ ] API versioning strategy
- [ ] OpenAPI/Swagger documentation

---

**Last Updated**: September 2025
**Maintained By**: Development Team