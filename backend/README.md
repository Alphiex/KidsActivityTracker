# Backend Service

## Directory Structure

```
backend/
├── api/                    # Express API server
│   ├── server.js          # Main API server
│   └── routes/            # API route handlers
├── src/                   # TypeScript source code
│   ├── config/            # Configuration files
│   ├── constants/         # Application constants
│   ├── middleware/        # Express middleware
│   ├── routes/            # Route definitions
│   ├── services/          # Business logic services
│   ├── utils/             # Utility functions
│   └── server.ts          # TypeScript server
├── scrapers/              # Web scraping modules
│   ├── base/              # Base scraper classes
│   ├── providers/         # Provider-specific scrapers
│   └── nvrcEnhancedParallelScraper.js
├── prisma/                # Database ORM
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── deploy/                # Deployment configurations
│   ├── cloudbuild-api.yaml
│   ├── cloudbuild-scraper-enhanced.yaml
│   ├── Dockerfile.api
│   └── Dockerfile.scraper
├── scripts/               # Utility scripts
│   ├── cloud-migration-job.js
│   └── scraper-job.js
└── cli.js                 # Unified CLI tool
```

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run development server
npm run dev

# Run production server
npm start
```

## CLI Commands

```bash
# Run scraper
node cli.js scrape

# Run database migrations
node cli.js migrate

# Fix activity costs
node cli.js fix-costs

# Backup database
node cli.js backup-db
```

## Environment Variables

Create a `.env` file with:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/kidsactivity
JWT_SECRET=your-secret-key
PORT=3000
NODE_ENV=development
```

## API Endpoints

- `GET /api/v1/activities` - List activities with filters
- `GET /api/v1/activities/:id` - Get activity details
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/children` - Get user's children
- `POST /api/children` - Create child profile

## Development

```bash
# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Production Deployment

```bash
# Deploy API to Google Cloud Run
gcloud builds submit --config deploy/cloudbuild-api.yaml

# Deploy scraper job
gcloud builds submit --config deploy/cloudbuild-scraper-enhanced.yaml
```