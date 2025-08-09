# Kids Activity Tracker - Deployment Checklist

## Pre-Deployment Verification

### 1. Database Setup ✓
- [ ] PostgreSQL database created
- [ ] Connection string configured in `.env`
- [ ] Prisma migrations applied: `npx prisma migrate deploy`
- [ ] Database seeded with initial data (if needed)
- [ ] Backup strategy in place

### 2. Environment Configuration ✓
- [ ] All environment variables set:
  - [ ] `DATABASE_URL` - PostgreSQL connection string
  - [ ] `JWT_SECRET` - Strong secret for JWT tokens
  - [ ] `JWT_REFRESH_SECRET` - Different secret for refresh tokens
  - [ ] `EMAIL_HOST` - SMTP server host
  - [ ] `EMAIL_PORT` - SMTP server port
  - [ ] `EMAIL_USER` - SMTP username
  - [ ] `EMAIL_PASS` - SMTP password
  - [ ] `EMAIL_FROM` - Default from email address
  - [ ] `FRONTEND_URL` - Mobile app URL for CORS
  - [ ] `API_URL` - Backend API URL
  - [ ] `NODE_ENV` - Set to `production`

### 3. Backend Services ✓
- [ ] All TypeScript files compiled: `npm run build`
- [ ] Dependencies installed: `npm install --production`
- [ ] API server starts without errors: `npm start`
- [ ] All endpoints responding correctly
- [ ] Authentication flow working
- [ ] Email service configured and tested

### 4. Security Checklist ✓
- [ ] HTTPS/SSL certificates configured
- [ ] CORS properly configured for mobile app
- [ ] Rate limiting enabled on all endpoints
- [ ] Input validation on all API endpoints
- [ ] SQL injection protection (Prisma handles this)
- [ ] Password hashing implemented (bcrypt)
- [ ] JWT tokens have appropriate expiration
- [ ] Sensitive data not logged

### 5. Mobile App Configuration ✓
- [ ] API base URL updated in `src/config/api.ts`
- [ ] App built for production: `npm run build`
- [ ] iOS build created and tested
- [ ] Android build created and tested
- [ ] App icons and splash screens configured
- [ ] Push notifications configured (if applicable)

## Deployment Steps

### Backend Deployment

#### Option 1: Docker Deployment
```bash
# Build Docker image
docker build -t kids-activity-tracker-api .

# Run container
docker run -d \
  --name kids-api \
  -p 3000:3000 \
  --env-file .env \
  kids-activity-tracker-api
```

#### Option 2: Traditional Deployment
```bash
# Clone repository
git clone <repository-url>
cd KidsActivityTracker/backend

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run migrations
npx prisma migrate deploy

# Start server
npm start
```

#### Option 3: Cloud Platform Deployment

**Google Cloud Run:**
```bash
# Build and push image
gcloud builds submit --config cloudbuild.yaml

# Deploy to Cloud Run
gcloud run deploy kids-api \
  --image gcr.io/[PROJECT-ID]/kids-activity-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

**Heroku:**
```bash
# Create Heroku app
heroku create kids-activity-api

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Deploy
git push heroku main

# Run migrations
heroku run npx prisma migrate deploy
```

### Mobile App Deployment

#### iOS Deployment
1. Update bundle identifier and version in Xcode
2. Archive the app: `Product > Archive`
3. Upload to App Store Connect
4. Submit for review

#### Android Deployment
1. Update version in `android/app/build.gradle`
2. Generate signed APK/AAB: `cd android && ./gradlew bundleRelease`
3. Upload to Google Play Console
4. Submit for review

## Post-Deployment Verification

### 1. API Health Checks
```bash
# Check health endpoint
curl https://your-api-url/health

# Test authentication
curl -X POST https://your-api-url/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 2. Database Verification
```bash
# Connect to production database
psql $DATABASE_URL

# Check tables
\dt

# Verify data
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM activities;
```

### 3. Mobile App Testing
- [ ] Install production app on test devices
- [ ] Verify all screens load correctly
- [ ] Test user registration and login
- [ ] Test child profile creation
- [ ] Test activity search and filtering
- [ ] Test activity registration flow
- [ ] Verify offline functionality

### 4. Monitoring Setup
- [ ] Error logging configured (e.g., Sentry)
- [ ] Performance monitoring enabled
- [ ] Database backup automation verified
- [ ] Uptime monitoring configured
- [ ] SSL certificate expiration alerts

## Rollback Plan

### Database Rollback
```bash
# Revert last migration
npx prisma migrate resolve --rolled-back <migration-name>
```

### API Rollback
```bash
# Docker
docker stop kids-api
docker run -d --name kids-api <previous-image-tag>

# Traditional
git checkout <previous-tag>
npm install
npm run build
npm start
```

## Maintenance Tasks

### Daily
- [ ] Check error logs
- [ ] Monitor API response times
- [ ] Verify backup completion

### Weekly
- [ ] Review user feedback
- [ ] Check for security updates
- [ ] Analyze performance metrics

### Monthly
- [ ] Update dependencies
- [ ] Review and optimize database queries
- [ ] Test disaster recovery procedure
- [ ] Review security logs

## Support Information

### Technical Contacts
- Backend Issues: [backend-team@example.com]
- Mobile App Issues: [mobile-team@example.com]
- Database Issues: [dba-team@example.com]

### Documentation
- API Documentation: `/backend/docs/API_DOCUMENTATION.md`
- Mobile App Guide: `/src/docs/APP_FEATURES_GUIDE.md`
- Integration Tests: `/backend/docs/INTEGRATION_TESTS.md`

### Emergency Procedures
1. **API Down:** Check server logs, restart service, check database connection
2. **Database Issues:** Check connection, verify credentials, restore from backup if needed
3. **Authentication Failures:** Verify JWT secrets, check token expiration, clear token cache

## Sign-off

- [ ] Backend deployed and verified: _______________
- [ ] Mobile app deployed and verified: _______________
- [ ] Documentation updated: _______________
- [ ] Stakeholders notified: _______________

Deployment completed by: _______________
Date: _______________