# Kids Activity Tracker Backend

A scalable backend API for the Kids Activity Tracker app that scrapes, stores, and serves activity data for kids in North Vancouver.

## Architecture

The backend follows a 3-tier architecture:

1. **API Layer** (Cloud Run)
   - RESTful API built with Express.js
   - Serves activity data to mobile apps
   - Handles user preferences and favorites
   - Rate limiting and security features

2. **Data Layer** (Cloud SQL + Redis)
   - PostgreSQL for persistent storage
   - Redis for job queuing and caching
   - Prisma ORM for database management

3. **Processing Layer** (Cloud Run Jobs)
   - Scheduled scraping jobs (hourly)
   - Puppeteer-based web scraping
   - Activity data normalization

## Features

- 🔄 Automated hourly scraping of activity providers
- 📊 RESTful API with comprehensive filtering
- ❤️ User favorites and recommendations
- 🔍 Advanced search and filtering
- 📈 Real-time monitoring dashboard
- 🔒 Production-ready security
- ☁️ Google Cloud Platform deployment

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker (optional)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. Set up the database:
   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

5. Start services:
   ```bash
   # Terminal 1: Start Redis
   redis-server

   # Terminal 2: Start API server
   npm run dev

   # Terminal 3: Start monitoring dashboard
   npm run monitoring
   ```

### API Endpoints

- `GET /health` - Health check
- `GET /api/v1/activities` - Search activities with filters
- `GET /api/v1/activities/:id` - Get activity details
- `POST /api/v1/users` - Create user
- `POST /api/v1/favorites` - Add favorite
- `GET /api/v1/users/:userId/favorites` - Get user favorites
- `POST /api/v1/scraper/trigger` - Manually trigger scraping

### Testing

```bash
# Run tests
npm test

# Run health check
node scripts/health-check.js
```

## Deployment

The backend is designed for Google Cloud Platform deployment:

### Infrastructure

- **Cloud Run**: Serverless container hosting
- **Cloud SQL**: Managed PostgreSQL
- **Memorystore Redis**: Managed Redis
- **Cloud Scheduler**: Cron job scheduling
- **Secret Manager**: Secure credential storage

### Deploy with Terraform

```bash
cd terraform
terraform init
terraform apply
```

### Deploy with Cloud Build

```bash
gcloud builds submit --config=cloudbuild.yaml .
```

### Manual Deployment

```bash
# Build and push Docker image
docker build -t gcr.io/PROJECT_ID/kids-activity-api .
docker push gcr.io/PROJECT_ID/kids-activity-api

# Deploy to Cloud Run
gcloud run deploy kids-activity-api \
  --image gcr.io/PROJECT_ID/kids-activity-api \
  --region us-central1
```

## Monitoring

- **Dashboard**: Access at `/monitoring` endpoint
- **Logs**: `gcloud run logs read --service=kids-activity-api`
- **Metrics**: View in Google Cloud Console

## Security

- Helmet.js for security headers
- Rate limiting on API endpoints
- CORS configuration
- SQL injection protection via Prisma
- Secrets stored in Secret Manager

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details