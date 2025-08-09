# Authentication System Migration Guide

## Overview
This guide explains how to integrate the new authentication system with your existing Kids Activity Tracker backend.

## Quick Start

### 1. Environment Setup
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_ACCESS_SECRET` - Strong random string for access tokens
- `JWT_REFRESH_SECRET` - Strong random string for refresh tokens
- `SMTP_*` - Email service configuration

### 2. Database Migration
The authentication system uses the existing User model in your Prisma schema. No additional migrations needed.

### 3. Running the New Server

#### Development:
```bash
npm run dev
```

#### Production Build:
```bash
npm run build
npm start
```

#### Legacy Server (if needed):
```bash
npm run dev:legacy
```

## API Endpoints

### Authentication Endpoints

#### Register
```
POST /api/auth/register
Body: {
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "phoneNumber": "+1234567890" // optional
}
```

#### Login
```
POST /api/auth/login
Body: {
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

#### Refresh Token
```
POST /api/auth/refresh
Body: {
  "refreshToken": "eyJhbGciOiJIUzI1..."
}
```

#### Verify Email
```
GET /api/auth/verify-email?token=uuid-token
```

#### Request Password Reset
```
POST /api/auth/forgot-password
Body: {
  "email": "user@example.com"
}
```

#### Reset Password
```
POST /api/auth/reset-password
Body: {
  "token": "reset-token",
  "newPassword": "NewSecurePass123!"
}
```

### Protected Endpoints

Add the `verifyToken` middleware to protect routes:

```typescript
import { verifyToken } from './middleware/auth';

// Protected route
app.get('/api/protected-route', verifyToken, (req, res) => {
  // req.user contains { id, email }
  res.json({ user: req.user });
});
```

## Frontend Integration

### Storing Tokens
Store tokens securely in the frontend:
```javascript
// After login/register
localStorage.setItem('accessToken', response.tokens.accessToken);
localStorage.setItem('refreshToken', response.tokens.refreshToken);
```

### Making Authenticated Requests
Include the access token in requests:
```javascript
fetch('/api/protected-route', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});
```

### Token Refresh Logic
```javascript
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  
  if (response.ok) {
    const data = await response.json();
    localStorage.setItem('accessToken', data.tokens.accessToken);
    localStorage.setItem('refreshToken', data.tokens.refreshToken);
    return data.tokens.accessToken;
  }
  
  // Refresh failed, redirect to login
  window.location.href = '/login';
}
```

## Security Features

### Rate Limiting
- General API: 100 requests per 15 minutes
- Auth endpoints: 5 requests per 15 minutes
- Password reset: 3 requests per hour

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Token Expiry
- Access Token: 15 minutes
- Refresh Token: 7 days
- Password Reset Token: 2 hours
- Email Verification: 24 hours

## Migration Checklist

- [ ] Copy and configure `.env` file
- [ ] Install dependencies: `npm install`
- [ ] Generate Prisma client: `npm run db:generate`
- [ ] Test email service connection
- [ ] Update frontend to use new auth endpoints
- [ ] Implement token storage and refresh logic
- [ ] Update protected routes with auth middleware
- [ ] Test registration flow with email verification
- [ ] Test password reset flow
- [ ] Configure production environment variables
- [ ] Deploy and monitor

## Troubleshooting

### Email Not Sending
1. Check SMTP configuration in `.env`
2. For Gmail, use app-specific passwords
3. Check firewall/security group rules

### Token Errors
1. Ensure JWT secrets are set in environment
2. Check token expiry times
3. Verify token format in Authorization header

### Database Errors
1. Run `npm run db:generate` after schema changes
2. Check DATABASE_URL connection string
3. Ensure PostgreSQL is running

## Production Considerations

1. **Use strong secrets**: Generate cryptographically secure JWT secrets
2. **Enable HTTPS**: Required for secure cookie handling
3. **Configure CORS**: Set appropriate origins in production
4. **Monitor rate limits**: Adjust based on usage patterns
5. **Set up email service**: Use professional email service (SendGrid, AWS SES)
6. **Enable logging**: Monitor authentication attempts and failures
7. **Regular backups**: Backup user data and sessions

## Support

For issues or questions:
1. Check existing error messages and logs
2. Verify environment configuration
3. Test with the provided curl commands
4. Review security best practices