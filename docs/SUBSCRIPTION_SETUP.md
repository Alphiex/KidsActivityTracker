# Subscription & In-App Purchase Setup Guide

This guide covers the complete setup required to enable subscriptions in the Kids Activity Tracker app.

## Overview

The app uses **RevenueCat** as the subscription management layer, which handles:
- App Store (iOS) and Play Store (Android) purchase flows
- Receipt validation
- Subscription status tracking
- Webhooks for server-side events

## Prerequisites

Before setting up subscriptions, ensure you have:
- [ ] Apple Developer Program membership ($99/year)
- [ ] Google Play Developer account ($25 one-time)
- [ ] RevenueCat account (free tier available)
- [ ] Backend deployed with webhook endpoint accessible

---

## Step 1: RevenueCat Setup

### 1.1 Create RevenueCat Account
1. Go to [app.revenuecat.com](https://app.revenuecat.com)
2. Create a new account or sign in
3. Create a new project: "Kids Activity Tracker"

### 1.2 Configure iOS App
1. In RevenueCat, go to **Project Settings > Apps**
2. Click **+ New App** and select **iOS**
3. Enter your Bundle ID: `com.yourcompany.kidsactivitytracker`
4. Copy the **Public API Key** (starts with `appl_`)

### 1.3 Configure Android App
1. Click **+ New App** and select **Android**
2. Enter your Package Name: `com.yourcompany.kidsactivitytracker`
3. Upload your Google Play service account JSON (see Step 3)
4. Copy the **Public API Key** (starts with `goog_`)

### 1.4 Create Entitlement
1. Go to **Entitlements**
2. Create entitlement with identifier: `premium`
3. This maps to premium subscription access

### 1.5 Create Offering
1. Go to **Offerings**
2. Create offering with identifier: `default`
3. Add two packages:
   - `$rc_monthly` - Monthly subscription
   - `$rc_annual` - Annual subscription

---

## Step 2: App Store Connect (iOS)

### 2.1 Create In-App Purchases
1. Log in to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Go to **Subscriptions** > **Subscription Groups**
4. Create a new subscription group: "Premium"

### 2.2 Create Monthly Subscription
1. Click **+** to create subscription
2. Reference Name: `Premium Monthly`
3. Product ID: `premium_monthly`
4. Subscription Duration: 1 Month
5. Price: $5.99 USD (or local equivalent)
6. Enable **Free Trial**: 7 days (optional introductory offer)

### 2.3 Create Annual Subscription
1. Create another subscription
2. Reference Name: `Premium Annual`
3. Product ID: `premium_annual`
4. Subscription Duration: 1 Year
5. Price: $49.99 USD (or local equivalent)
6. Enable **Free Trial**: 7 days

### 2.4 Configure App Store Server Notifications
1. Go to **App Information**
2. Scroll to **App Store Server Notifications**
3. Set Notification URL: `https://api.revenuecat.com/v1/webhooks/apple`
4. Version: Version 2

### 2.5 Generate Shared Secret
1. Go to **App Information** > **App-Specific Shared Secret**
2. Generate and copy the shared secret
3. Add to RevenueCat iOS app configuration

---

## Step 3: Google Play Console (Android)

### 3.1 Create Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Go to **IAM & Admin** > **Service Accounts**
4. Create service account with name: `revenuecat-service`
5. Grant role: **Owner**
6. Create JSON key and download

### 3.2 Link Service Account to Play Console
1. Go to [Google Play Console](https://play.google.com/console)
2. Go to **Settings** > **API access**
3. Link your Google Cloud project
4. Grant access to your service account

### 3.3 Create Subscriptions
1. Select your app
2. Go to **Monetize** > **Subscriptions**
3. Create subscription: `premium_monthly`
   - Billing Period: Monthly
   - Base Price: $5.99
   - Free trial: 7 days
4. Create subscription: `premium_annual`
   - Billing Period: Yearly
   - Base Price: $49.99
   - Free trial: 7 days

### 3.4 Configure Real-time Developer Notifications
1. Go to **Monetize** > **Monetization setup**
2. Set Topic name for Real-time notifications
3. Create Pub/Sub topic linked to RevenueCat

---

## Step 4: Backend Configuration

### 4.1 Environment Variables
Add these to your backend environment:

```bash
# RevenueCat Webhook Secret
REVENUECAT_WEBHOOK_SECRET=whsec_your_webhook_secret

# Optional: For server-side validation
REVENUECAT_API_KEY=sk_your_secret_key
```

### 4.2 Webhook URL
Configure RevenueCat to send webhooks to:
```
https://your-api-domain.com/api/webhooks/revenuecat
```

### 4.3 Test Webhook
Use RevenueCat's webhook testing feature to verify your endpoint receives events.

---

## Step 5: Mobile App Configuration

### 5.1 Environment Variables
Add to your React Native environment:

```bash
# iOS
REVENUECAT_IOS_API_KEY=appl_your_ios_key

# Android
REVENUECAT_ANDROID_API_KEY=goog_your_android_key
```

### 5.2 Update revenueCatService.ts
Replace placeholder keys in:
```
src/services/revenueCatService.ts
```

---

## Step 6: Testing

### 6.1 Sandbox Testing (iOS)
1. Create Sandbox Tester in App Store Connect
2. Sign out of App Store on device
3. Sign in with sandbox account when prompted during purchase
4. Purchases renew quickly in sandbox (monthly = 5 minutes)

### 6.2 Test Track (Android)
1. Add test accounts in Play Console
2. Upload APK to internal testing track
3. Test purchases with test accounts
4. Use test card numbers for transactions

### 6.3 RevenueCat Dashboard
1. Monitor purchases in RevenueCat dashboard
2. Check customer info for test users
3. Verify webhook events in event history

---

## Step 7: Go Live Checklist

### App Store Review Requirements
- [ ] Restore Purchases button visible and functional
- [ ] Terms of Service link accessible
- [ ] Privacy Policy link accessible
- [ ] Clear subscription pricing displayed
- [ ] Subscription terms clearly stated (renewal, cancellation)

### Play Store Requirements
- [ ] Subscription disclosure at checkout
- [ ] Link to subscription management
- [ ] Privacy Policy URL in store listing

### Backend
- [ ] Webhook endpoint accessible from RevenueCat IPs
- [ ] HTTPS with valid certificate
- [ ] Error handling for webhook retries

### Analytics
- [ ] Conversion tracking configured
- [ ] Revenue tracking enabled
- [ ] Funnel events firing correctly

---

## Troubleshooting

### Purchases Not Working
1. Verify API keys are correct
2. Check product IDs match exactly
3. Ensure products are approved/active in stores
4. Check RevenueCat logs for errors

### Webhooks Not Received
1. Verify webhook URL is publicly accessible
2. Check firewall/security rules
3. Look for errors in RevenueCat webhook history
4. Verify webhook secret matches

### Subscription Status Wrong
1. Force refresh customer info in app
2. Check RevenueCat dashboard for accurate status
3. Verify entitlements are correctly configured
4. Check for billing issues

---

## Support Resources

- [RevenueCat Documentation](https://docs.revenuecat.com)
- [App Store In-App Purchase Guide](https://developer.apple.com/in-app-purchase/)
- [Google Play Billing](https://developer.android.com/google/play/billing)
- [RevenueCat Community](https://community.revenuecat.com)
