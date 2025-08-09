# Kids Activity Tracker - Deployment Guide

This guide will help you deploy the API to the cloud and connect your mobile app to it.

## Quick Start - Deploy to Railway (Recommended)

Railway is the easiest option with a free tier that includes PostgreSQL.

### 1. Create Railway Account
1. Go to [railway.app](https://railway.app/)
2. Sign up with GitHub

### 2. Deploy the API
```bash
cd backend

# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize new project
railway init

# Add PostgreSQL database
railway add postgresql

# Deploy
railway up
```

### 3. Get Your API URL
After deployment, Railway will provide you with a URL like:
`https://your-app-name.up.railway.app`

### 4. Configure Database
Railway automatically sets the DATABASE_URL for you. To run migrations:
```bash
railway run npx prisma migrate deploy
```

### 5. Update Mobile App

Edit `/src/config/api.ts`:
```typescript
BASE_URL: 'https://your-app-name.up.railway.app',  // Your Railway URL
```

## Alternative: Deploy to Render

### 1. Push to GitHub
First, push your code to GitHub.

### 2. Create Render Account
Go to [render.com](https://render.com/) and sign up.

### 3. Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - Name: `kids-activity-api`
   - Environment: `Node`
   - Build Command: `npm install && npx prisma generate`
   - Start Command: `node api/server.js`

### 4. Add PostgreSQL
1. Click "New +" → "PostgreSQL"
2. Create database
3. Copy the connection string

### 5. Set Environment Variables
In your web service settings, add:
- `DATABASE_URL`: Your PostgreSQL connection string
- `NODE_ENV`: `production`

### 6. Update Mobile App
Edit `/src/config/api.ts`:
```typescript
BASE_URL: 'https://kids-activity-api.onrender.com',  // Your Render URL
```

## Testing Your Deployment

### 1. Test API Health
```bash
curl https://your-api-url/health
```

### 2. Test Activities Endpoint
```bash
curl https://your-api-url/api/v1/activities?limit=5
```

### 3. Run the Mobile App
```bash
cd ..  # Back to project root
npx react-native run-ios
# or
npx react-native run-android
```

## Troubleshooting

### API Connection Issues
1. Check CORS settings in production
2. Ensure DATABASE_URL is set correctly
3. Check API logs in your cloud provider dashboard

### Database Issues
1. Run migrations: `npx prisma migrate deploy`
2. Check database connection string
3. Ensure SSL is enabled for production databases

### Mobile App Issues
1. Clear app cache/data
2. Ensure API URL doesn't have trailing slash
3. Check network permissions in app

## Security Checklist

- [ ] Change default CORS origins to your app domain
- [ ] Set strong database password
- [ ] Enable rate limiting
- [ ] Use HTTPS only
- [ ] Set appropriate environment variables
- [ ] Remove debug logs in production

## Monitoring

Both Railway and Render provide:
- Real-time logs
- Performance metrics
- Automatic scaling
- Health checks

Access these through their respective dashboards.