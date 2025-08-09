# Kids Activity Tracker Backend

Node.js backend API for the Kids Activity Tracker mobile application, providing activity data, user authentication, and real-time updates from North Vancouver Recreation & Culture.

## Overview

This backend provides:
- 🔄 Automated activity scraping from NVRC (5000+ activities)
- 🔐 JWT-based authentication with refresh tokens
- 📊 RESTful API with advanced filtering and pagination
- ❤️ User favorites and preferences management
- 🚀 Production deployment on Google Cloud Run
- 📈 Real-time monitoring and analytics
- 💾 PostgreSQL with Prisma ORM
- ⚡ Redis caching for performance

## Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 14+ with Prisma ORM
- **Caching**: Redis 6+
- **Authentication**: JWT (access/refresh tokens)
- **Deployment**: Google Cloud Run
- **Scraping**: Puppeteer
- **Monitoring**: Custom dashboard

## Project Structure

```
backend/
├── src/                    # TypeScript source code
│   ├── routes/            # API route handlers
│   │   ├── auth.ts        # Authentication endpoints
│   │   ├── activities.ts  # Activity endpoints
│   │   ├── favorites.ts   # Favorites management
│   │   └── reference.ts   # Categories, locations, etc.
│   ├── services/          # Business logic
│   │   ├── authService.ts # JWT handling
│   │   ├── activityService.ts # Activity operations
│   │   └── scraperService.ts # NVRC scraping
│   ├── middleware/        # Express middleware
│   │   ├── auth.ts        # JWT verification
│   │   ├── cors.ts        # CORS configuration
│   │   └── rateLimit.ts   # Rate limiting
│   ├── utils/            # Utility functions
│   └── server.ts         # Main application
├── prisma/               # Database schema
│   ├── schema.prisma     # Prisma schema definition
│   ├── migrations/       # Database migrations
│   └── seed.js          # Sample data seeding
├── scripts/             # Utility scripts
├── monitoring/          # Monitoring dashboard
└── tests/              # Test files
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (optional for caching)
- npm or yarn

### Installation

1. **Clone and install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/kidsactivitytracker"
   
   # Redis (optional)
   REDIS_URL="redis://localhost:6379"
   
   # JWT Secrets (generate secure random strings)
   JWT_ACCESS_SECRET="your-access-secret"
   JWT_REFRESH_SECRET="your-refresh-secret"
   
   # Session
   SESSION_SECRET="your-session-secret"
   
   # Server
   PORT=3000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:8081
   ```

3. **Set up database**
   ```bash
   # Create database
   createdb kidsactivitytracker
   
   # Generate Prisma client
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   
   # Seed with sample data (optional)
   npm run db:seed
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:3000`

## API Documentation

### Base URL
- **Production**: `https://kids-activity-api-44042034457.us-central1.run.app`
- **Local**: `http://localhost:3000`

### Authentication

All authenticated endpoints require:
```
Authorization: Bearer <access_token>
```

#### POST /api/auth/register
Create a new account
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

#### POST /api/auth/login
Login with credentials
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

Response includes access and refresh tokens with expiry timestamps.

### Activities

#### GET /api/v1/activities
Search and filter activities

Query parameters:
- `search` - Text search
- `category` - Filter by category
- `ageMin`, `ageMax` - Age range
- `costMin`, `costMax` - Price range
- `location` - Location filter
- `limit` - Results per page (default: 50)
- `offset` - Pagination offset

Example:
```
GET /api/v1/activities?category=Swimming&ageMin=6&ageMax=12&limit=20
```

### User Features

#### GET /api/favorites
Get user's favorite activities (requires auth)

#### POST /api/favorites
Add activity to favorites
```json
{
  "activityId": "uuid"
}
```

#### DELETE /api/favorites/:activityId
Remove from favorites

### Reference Data

#### GET /api/v1/categories
Get all activity categories

#### GET /api/v1/locations
Get all locations

#### GET /api/v1/providers
Get all activity providers

## Development

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Database commands
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Run migrations
npm run db:migrate:prod # Production migrations
npm run db:studio      # Open Prisma Studio
npm run db:seed        # Seed sample data
npm run db:reset       # Reset database

# Testing
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report

# Code quality
npm run lint          # ESLint
npm run format        # Prettier
npm run type-check    # TypeScript check

# Monitoring
npm run monitoring    # Start monitoring dashboard
```

### Testing API

Use the included test script:
```bash
./TEST_API.sh
```

Or test manually with curl:
```bash
# Health check
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

## Deployment

### Google Cloud Run

The backend is deployed on Google Cloud Run for automatic scaling and high availability.

#### Prerequisites
- Google Cloud Project with billing enabled
- gcloud CLI installed and configured
- Docker installed (for local builds)

#### Deploy with Cloud Build
```bash
npm run gcp:deploy
```

#### Manual deployment
```bash
# Build Docker image
docker build -t gcr.io/PROJECT_ID/kids-activity-api .

# Push to Container Registry
docker push gcr.io/PROJECT_ID/kids-activity-api

# Deploy to Cloud Run
gcloud run deploy kids-activity-api \
  --image gcr.io/PROJECT_ID/kids-activity-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Environment Configuration

Production environment variables are stored in Google Secret Manager:
- `database-url`
- `jwt-access-secret`
- `jwt-refresh-secret`
- `session-secret`
- `redis-url`

## Monitoring

### Health Check
```bash
curl https://kids-activity-api-44042034457.us-central1.run.app/health
```

### Monitoring Dashboard
Available at `/monitoring` endpoint showing:
- Request counts and response times
- Error rates and types
- Database connection status
- Cache hit rates
- System metrics

### Logging
- Structured JSON logging
- Cloud Logging integration
- Error tracking
- Performance metrics

### Alerts
Set up in Google Cloud Monitoring for:
- High error rates (>1%)
- Slow response times (>1s)
- Database connection failures
- Memory/CPU usage

## Security

- **Authentication**: JWT with short-lived access tokens (15 min)
- **Password Security**: bcrypt with 12 rounds
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: express-validator on all endpoints
- **SQL Injection**: Protected by Prisma parameterized queries
- **XSS Protection**: Helmet.js security headers
- **CORS**: Configured for mobile app origins
- **Secrets**: Stored in Google Secret Manager

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Verify PostgreSQL is running
   - Check network connectivity
   - For Cloud SQL, ensure Cloud SQL Proxy is running

2. **JWT Authentication Errors**
   - Verify JWT secrets are set
   - Check token expiration
   - Ensure Authorization header format is correct
   - Verify refresh token flow

3. **Scraping Issues**
   - Check Puppeteer dependencies
   - Verify Chrome/Chromium is installed
   - Check NVRC website changes
   - Review scraper logs

4. **Performance Problems**
   - Enable Redis caching
   - Check database indexes
   - Review query optimization
   - Monitor Cloud Run scaling

### Debug Mode

Enable detailed logging:
```bash
DEBUG=* npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- Conventional commits

### Testing Requirements
- Unit tests for new features
- Integration tests for API endpoints
- Minimum 80% code coverage
- All tests must pass

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:
1. Check the [FAQ](../FAQ.md)
2. Review [DEBUG_API.md](../DEBUG_API.md)
3. Open a GitHub issue
4. Contact the development team