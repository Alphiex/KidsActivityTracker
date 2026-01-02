# System Architecture

This document describes the technical architecture of the Kids Activity Tracker platform.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MOBILE CLIENTS                               │
│  ┌─────────────────┐                    ┌─────────────────┐         │
│  │   iOS App       │                    │  Android App    │         │
│  │  React Native   │                    │  React Native   │         │
│  └────────┬────────┘                    └────────┬────────┘         │
└───────────┼──────────────────────────────────────┼──────────────────┘
            │                                      │
            └──────────────┬───────────────────────┘
                           │ HTTPS
            ┌──────────────┼──────────────────────┐
            │              │                      │
            ▼              ▼                      ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   RevenueCat     │ │  GCP Cloud Run   │ │  App Store /     │
│  Subscriptions   │ │    (API)         │ │  Play Store      │
└──────────────────┘ └────────┬─────────┘ └──────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                      GOOGLE CLOUD PLATFORM                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     CLOUD RUN (API)                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   Express   │  │ Auth/Rate   │  │  Activity Service   │  │   │
│  │  │   Router    │──│  Limiting   │──│  Child Service      │  │   │
│  │  │             │  │  Middleware │  │  AI Recommendations │  │   │
│  │  └─────────────┘  └─────────────┘  └──────────┬──────────┘  │   │
│  └───────────────────────────────────────────────┼──────────────┘   │
│                                                  │                   │
│  ┌───────────────────────────────────────────────┼──────────────┐   │
│  │                    CLOUD SQL                  │               │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │              PostgreSQL 15 Database                     │ │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │ │   │
│  │  │  │Activities│ │  Users   │ │ Children │ │ Providers │  │ │   │
│  │  │  │(117,700+)│ │          │ │          │ │   (80)    │  │ │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   CLOUD SCHEDULER                             │  │
│  │           (Tier 1: 3x daily, Tier 2: daily, Tier 3: weekly)   │  │
│  └───────────────────────────┬──────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────▼──────────────────────────────────┐  │
│  │                    CLOUD RUN JOBS                             │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │              Scraper Job (Puppeteer/Cheerio)            │ │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │ │  │
│  │  │  │ Perfect │ │ Active  │ │ Amilia  │ │  IC3    │ ...   │ │  │
│  │  │  │  Mind   │ │ Network │ │         │ │         │       │ │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │          Claude Vision Validation System                 │ │  │
│  │  │     (Screenshot capture → Visual extraction → Compare)  │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/Puppeteer
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL RECREATION WEBSITES                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Toronto │ │Vancouver│ │  Ottawa │ │ Calgary │ │  etc... │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend (React Native)

```
┌─────────────────────────────────────────────────────────────────┐
│                        App.tsx                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Navigation Container                      │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │  │
│  │  │ Explore │  │Favorites│  │ Family  │  │   Profile   │  │  │
│  │  │  Stack  │  │  Stack  │  │  Stack  │  │    Stack    │  │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬──────┘  │  │
│  └───────┼────────────┼───────────┼──────────────┼──────────┘  │
│          │            │           │              │              │
│  ┌───────▼────────────▼───────────▼──────────────▼──────────┐  │
│  │                      Redux Store                          │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │  │
│  │  │Activities│ │ Children│  │  Auth   │  │Subscription │  │  │
│  │  │  Slice  │  │  Slice  │  │  Slice  │  │    Slice    │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                     Services Layer                         │  │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────────┐  │  │
│  │  │    API    │  │RevenueCat │  │     Preferences       │  │  │
│  │  │  Service  │  │  Service  │  │       Service         │  │  │
│  │  └─────┬─────┘  └───────────┘  └───────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │   Location Service (GPS, Geocoding, Distance Calc)    │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │        Favorites Service (MMKV + API sync)            │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │    Waitlist Service (Watch for spots, purge closed)   │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │    Push Notification Service (FCM + Notifee)          │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  └────────┼──────────────────────────────────────────────────┘  │
│           │                                                      │
│  ┌────────▼──────────────────────────────────────────────────┐  │
│  │                    MMKV Storage                            │  │
│  │            (Encrypted local persistence)                   │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Backend (Express API)

```
┌─────────────────────────────────────────────────────────────────┐
│                        server.ts                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Express Application                     │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                    Middleware                        │  │  │
│  │  │  helmet │ cors │ rateLimit │ morgan │ bodyParser    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                           │                                │  │
│  │  ┌────────────────────────▼────────────────────────────┐  │  │
│  │  │                    Route Groups                      │  │  │
│  │  │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────────┐ │  │  │
│  │  │ │ /auth  │ │/activit│ │/subscr │ │   /sponsored   │ │  │  │
│  │  │ │        │ │  ies   │ │ iption │ │   /partners    │ │  │  │
│  │  │ └───┬────┘ └────┬───┘ └───┬────┘ └───────┬────────┘ │  │  │
│  │  └─────┼───────────┼─────────┼──────────────┼──────────┘  │  │
│  │        │           │         │              │              │  │
│  │  ┌─────▼───────────▼─────────▼──────────────▼──────────┐  │  │
│  │  │                   Services                           │  │  │
│  │  │  authService │ activityService │ subscriptionService │  │  │
│  │  └─────────────────────────┬───────────────────────────┘  │  │
│  │                            │                               │  │
│  │  ┌─────────────────────────▼───────────────────────────┐  │  │
│  │  │                  AI Module                           │  │  │
│  │  │  ActivityChatService │ TopicGuard │ QuotaService    │  │  │
│  │  └─────────────────────────┬───────────────────────────┘  │  │
│  │                            │                               │  │
│  │  ┌─────────────────────────▼───────────────────────────┐  │  │
│  │  │              Prisma ORM Client                       │  │  │
│  │  └─────────────────────────┬───────────────────────────┘  │  │
│  └────────────────────────────┼─────────────────────────────┘  │
│                               │                                  │
└───────────────────────────────┼──────────────────────────────────┘
                                ▼
                        PostgreSQL Database
```

### Navigation Architecture

```
App.tsx
├── RootNavigator
│   ├── AuthNavigator
│   │   ├── LoginScreen
│   │   ├── RegisterScreen
│   │   └── ForgotPasswordScreen
│   ├── OnboardingNavigator
│   │   ├── OnboardingIntro
│   │   ├── OnboardingActivityTypes
│   │   ├── OnboardingAge
│   │   ├── OnboardingLocation (GPS or city + distance)
│   │   └── OnboardingComplete
│   ├── Deep Link Screens (available in all auth states)
│   │   ├── InvitationAccept (/invite/:token)
│   │   └── ActivityDeepLink (/activity/:activityId)
│   └── MainTabs
│       ├── Explore (HomeStack)
│       │   ├── DashboardScreenModern
│       │   ├── Search & Filters
│       │   ├── CalendarScreenModernFixed
│       │   ├── ActivityList
│       │   ├── ActivityDetail
│       │   ├── FeaturedPartnersScreen
│       │   ├── CityBrowse
│       │   └── LocationBrowse
│       ├── My Collection (FavoritesStack)
│       │   ├── Favourites Tab
│       │   ├── Watching Tab
│       │   └── Waiting List Tab
│       ├── Friends & Family (FriendsStack)
│       │   ├── Children Management
│       │   ├── ChildDetailScreen
│       │   ├── Sharing
│       │   └── Activity History
│       └── Profile (ProfileStack)
│           ├── Settings
│           ├── SubscriptionScreen
│           ├── Preferences
│           └── Account
```

### Deep Linking Architecture

The app supports Universal Links (iOS) and App Links (Android) for seamless sharing.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      DEEP LINK FLOW                                  │
│                                                                      │
│  User shares activity → Generates link:                             │
│  https://kidsactivitytracker.ca/activity/{activityId}               │
│                                                                      │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐    │
│  │   Recipient clicks  │───▶│  Device checks app association   │    │
│  │       link          │    │  (apple-app-site-association /   │    │
│  └─────────────────────┘    │   assetlinks.json)               │    │
│                             └─────────────┬───────────────────┘    │
│                                           │                         │
│             ┌─────────────────────────────┼─────────────────────┐  │
│             │                             │                      │  │
│             ▼                             ▼                      │  │
│  ┌─────────────────────┐     ┌─────────────────────────────┐   │  │
│  │   App Installed     │     │     App Not Installed       │   │  │
│  │                     │     │                             │   │  │
│  │  Opens app directly │     │  Opens web fallback page    │   │  │
│  │  to ActivityDetail  │     │  with activity preview +    │   │  │
│  │  screen             │     │  App Store/Play Store links │   │  │
│  └─────────────────────┘     └─────────────────────────────┘   │  │
└─────────────────────────────────────────────────────────────────────┘
```

**Supported Deep Link Paths**:

| Path | Purpose | Handler |
|------|---------|---------|
| `/activity/{id}` | View shared activity | ActivityDetailScreen |
| `/invite/{token}` | Accept family sharing invitation | InvitationAcceptScreen |

**Configuration Files**:

| Platform | File | Location |
|----------|------|----------|
| iOS | apple-app-site-association | website/public/.well-known/ |
| Android | assetlinks.json | website/public/.well-known/ |
| Android | AndroidManifest.xml | android/app/src/main/ |
| iOS | KidsActivityTracker.entitlements | ios/KidsActivityTracker/ |

**URL Schemes**:
- Universal Links: `https://kidsactivitytracker.ca/*`
- Custom Scheme: `kidsactivitytracker://*` (fallback)

## Data Flow

### Activity Search Flow

```
User Search
    │
    ▼
┌──────────────────┐
│ Mobile App       │
│ Apply filters    │
└────────┬─────────┘
         │ GET /api/v1/activities
         │ ?activityType=aquatics
         │ &ageMin=5&ageMax=10
         │ &userLat=49.28&userLon=-123.12
         │ &radiusKm=25
         ▼
┌──────────────────┐
│ API Server       │
│ Build Prisma     │
│ where clause     │
│ + Haversine      │
│ distance filter  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ PostgreSQL       │
│ Query with       │
│ indexes          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ API Response     │
│ activities: []   │
│ pagination: {}   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Mobile App       │
│ Render list      │
└──────────────────┘
```

### Subscription Flow

```
User taps Subscribe
        │
        ▼
┌──────────────────┐
│ RevenueCat SDK   │
│ Fetch offerings  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Show Paywall     │
│ Premium options  │
└────────┬─────────┘
         │ User purchases
         ▼
┌──────────────────┐
│ App Store /      │
│ Play Store       │
│ Process payment  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ RevenueCat       │
│ Webhook → API    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Database         │
│ Update user      │
│ subscription     │
└──────────────────┘
```

### AI Chat Flow

```
User Message ("skating for my 3-year-old near me")
        │
        ▼
┌───────────────────────────────────────────┐
│          Topic Guard Chain                │
│  • Classify: activity_search (allowed)    │
│  • Extract: age=3, activityType=skating   │
│  • Detect: isFollowUp=false               │
└───────────────────┬───────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│        Context Builder                     │
│  • Load family context from DB             │
│  • Create virtual child if no children     │
│  • Apply location fallback (Vancouver)     │
└───────────────────┬───────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│       Activity Chat Service                │
│  • Load/create conversation state          │
│  • Merge extracted params into conversation│
│  • Format system prompt with context       │
│  • Execute LangChain agent with tools      │
└───────────────────┬───────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│       LangChain Tools                      │
│  • search_activities (with distance calc)  │
│  • get_child_context                       │
│  • get_activity_details                    │
│  • compare_activities                      │
└───────────────────┬───────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│       Store Search Parameters              │
│  • Save lastSearchFilters for follow-ups   │
│  • Update extractedActivityType            │
└───────────────────┬───────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│       Response                             │
│  • conversationId                          │
│  • text: "Found 8 skating activities..."   │
│  • activities: [sorted by distance]        │
│  • followUpPrompts: ["Show more", ...]     │
│  • turnsRemaining: 4                       │
└───────────────────────────────────────────┘
```

**Conversation Memory**:
- Parameters accumulated across turns: age, city, activity type, search filters
- Follow-up queries ("search again") reuse previous parameters
- Virtual child profiles created from extracted age when no children registered
- Location defaults to Vancouver when unavailable

### Scraper Data Flow

```
Cloud Scheduler (tiered schedule)
        │
        ▼
Cloud Run Job Start
        │
        ▼
┌───────────────────────────────────────────┐
│          For each Provider:               │
│  1. Load provider config (JSON)           │
│  2. Initialize Puppeteer browser          │
│  3. Navigate to recreation website        │
│  4. Extract activity data                 │
│  5. Transform & normalize                 │
│  6. Upsert to database                    │
│  7. Deactivate stale records              │
│  8. Record metrics                        │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│          Validation System:               │
│  1. Capture screenshot of web page        │
│  2. Send to Claude Vision API             │
│  3. Extract visible data                  │
│  4. Compare with scraped data             │
│  5. Generate discrepancy report           │
└───────────────────────────────────────────┘
        │
        ▼
Database Updated (117,700+ activities)
```

### Email Notification Flow

```
┌───────────────────────────────────────────┐
│         NOTIFICATION TRIGGERS             │
│                                           │
│  ┌─────────────┐    ┌─────────────────┐  │
│  │Daily Digest │    │  Post-Scraper   │  │
│  │ (7 AM PST)  │    │     Alerts      │  │
│  └──────┬──────┘    └────────┬────────┘  │
│         │                    │           │
│  ┌──────┴──────┐    ┌───────┴────────┐  │
│  │Weekly Digest│    │ Activity Change │  │
│  │(Sun 9 AM)   │    │   Detection     │  │
│  └──────┬──────┘    └───────┬────────┘  │
└─────────┼───────────────────┼────────────┘
          │                   │
          ▼                   ▼
┌───────────────────────────────────────────┐
│         NOTIFICATION SERVICE              │
│                                           │
│  1. Match activities to user preferences  │
│  2. Check deduplication (24h window)      │
│  3. Validate quiet hours                  │
│  4. Generate unsubscribe tokens           │
│  5. Build HTML email from template        │
│  6. Send via Nodemailer/SMTP              │
│  7. Log notification to database          │
└───────────────────────────┬───────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Daily     │   │  Capacity   │   │    Price    │
│   Digest    │   │    Alert    │   │    Drop     │
│   Email     │   │   Email     │   │   Email     │
└─────────────┘   └─────────────┘   └─────────────┘
```

**Notification Types**:
| Type | Trigger | Frequency |
|------|---------|-----------|
| Daily Digest | Cron (7 AM PST) | Max 1/day per user |
| Weekly Digest | Cron (Sun 9 AM PST) | Max 1/week per user |
| Capacity Alert | Post-scraper | Max 1/4h per activity |
| Price Drop | Post-scraper | Max 1/24h per activity |
| Spots Available | Post-scraper | When activity becomes available |

**Core Services**:
- `NotificationService`: Orchestrates email sending, deduplication, token generation
- `UserPreferenceMatcherService`: Matches activities to user preferences
- `ActivitySnapshotService`: Detects price/capacity changes between scrapes

### Push Notification Flow

```
┌───────────────────────────────────────────┐
│         MOBILE APP STARTUP                │
│                                           │
│  1. Request notification permissions      │
│  2. Get FCM token from Firebase           │
│  3. Register token with backend API       │
│  4. Set up message handlers               │
└───────────────────┬───────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────┐
│           BACKEND API                     │
│                                           │
│  POST /api/push-tokens                    │
│  - Store token in DevicePushToken table   │
│  - Handle device switching users          │
│  - Support multiple devices per user      │
└───────────────────┬───────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────┐
│     NOTIFICATION TRIGGERS                 │
│                                           │
│  ┌────────────┐  ┌────────────────────┐  │
│  │ Waitlist   │  │  Post-Scraper      │  │
│  │ Available  │  │  Alerts            │  │
│  └─────┬──────┘  └─────────┬──────────┘  │
│        │                   │              │
│        ▼                   ▼              │
│  ┌────────────────────────────────────┐  │
│  │    Firebase Admin SDK (Server)     │  │
│  │    Send to FCM with user tokens    │  │
│  └────────────────────────────────────┘  │
└───────────────────┬───────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────┐
│     FIREBASE CLOUD MESSAGING (FCM)        │
│                                           │
│  - APNs for iOS devices                   │
│  - Direct connection for Android          │
└───────────────────┬───────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────┐
│         MOBILE APP RECEPTION              │
│                                           │
│  Foreground: Display via Notifee          │
│  Background: System notification          │
│  Quit state: Wake app on tap              │
│                                           │
│  Deep link to:                            │
│  - Activity Detail (activityId)           │
│  - Waiting List screen                    │
│  - Custom screens (data.screen)           │
└───────────────────────────────────────────┘
```

**Push Notification Types**:
| Type | Trigger | Deep Link |
|------|---------|-----------|
| spots_available | Waitlist activity gets spots | Activity Detail |
| capacity_alert | Favorite activity getting full | Activity Detail |
| price_drop | Activity price decreased | Activity Detail |
| general | System announcements | Custom screen |

## Technology Stack

### Frontend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React Native 0.80 | Cross-platform mobile |
| Language | TypeScript | Type safety |
| State | Redux Toolkit | State management |
| Storage | MMKV | Encrypted persistence |
| Navigation | React Navigation 7.x | Screen routing |
| UI | Custom + MaterialCommunityIcons | Design system |
| HTTP | Axios | API communication |
| Forms | react-hook-form | Form handling |
| Payments | RevenueCat | Subscription management |
| Push Notifications | @react-native-firebase/messaging | FCM token management |
| Local Notifications | @notifee/react-native | Foreground display |

### Backend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js 20 | Server runtime |
| Framework | Express 4.x | HTTP server |
| Language | TypeScript | Type safety |
| ORM | Prisma 6.x | Database access |
| Auth | JWT | Token authentication |
| Validation | express-validator | Input validation |
| Security | Helmet, CORS | HTTP security |
| Docs | Swagger/OpenAPI | API documentation |
| AI | OpenAI GPT-4o-mini, LangChain | Conversational assistant & tools |
| Push | firebase-admin | FCM server SDK |

### Database
| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | PostgreSQL 15 | Primary datastore |
| Hosting | Cloud SQL | Managed service |
| Migrations | Prisma Migrate | Schema versioning |
| Tables | 35+ | Full schema |

### Scraping
| Component | Technology | Purpose |
|-----------|------------|---------|
| Browser | Puppeteer | Web automation |
| Parser | Cheerio | HTML parsing |
| Scheduling | Cloud Scheduler | Tiered cron jobs |
| Execution | Cloud Run Jobs | Serverless compute |
| Validation | Claude Vision | Data verification |

## Performance Optimization

### Frontend
- **Lazy Loading**: Screens loaded on demand
- **List Virtualization**: FlatList with windowSize optimization
- **Image Caching**: Automatic with optimized loading
- **MMKV Storage**: 30x faster than AsyncStorage
- **Memoization**: useMemo/useCallback for expensive renders
- **Modern Screens**: Optimized *Modern.tsx components

### Backend
- **Database Indexes**: On frequently queried columns
- **Batch Operations**: Prevent N+1 queries
- **Pagination**: Max 100 items per page
- **Connection Pooling**: Prisma default pool
- **Query Optimization**: Selective includes
- **Caching**: Response caching for static data

### Infrastructure
- **Auto-scaling**: 0 to 100 instances on Cloud Run
- **Memory Allocation**: 2GB for API and scraper jobs
- **Cold Start**: Optimized container images
- **CDN**: Static assets cached at edge

## GCP Resource Management

### Container Registry (GCR)
| Image | Purpose | Retention |
|-------|---------|-----------|
| `kids-activity-api` | Backend API | Keep latest + 5 untagged |
| `kids-activity-scraper` | Scraper jobs | Keep latest + 3 untagged |
| `website` | Partner portal | Keep latest + 3 untagged |

### Cloud Storage
| Bucket | Purpose | Lifecycle |
|--------|---------|-----------|
| `kids-activity-tracker-2024_cloudbuild` | Build artifacts | Auto-delete after 7 days |
| `run-sources-*` | Cloud Run sources | GCP-managed |

### Cloud Run Services
| Service | Min Instances | Max Instances | Memory |
|---------|---------------|---------------|--------|
| `kids-activity-api` | 0 | 10 | 2GB |
| `kids-activity-website` | 0 | 3 | 1GB |

### Cloud Run Jobs
| Job | Schedule | Memory | Timeout |
|-----|----------|--------|---------|
| `kids-activity-scraper` | Tier-based (3x/daily, daily, weekly) | 2GB | 1 hour |

### Cloud SQL
| Instance | Tier | Storage | Backups |
|----------|------|---------|---------|
| PostgreSQL 15 | db-g1-small | 20GB SSD | Daily automated |

### Cost Optimization Practices
1. **Container cleanup**: Automated removal of untagged images
2. **Build artifact lifecycle**: 7-day retention policy
3. **Revision management**: Cloud Run manages old revisions
4. **Min instances = 0**: Scale to zero when not in use
5. **Scheduled scraping**: Run during off-peak hours

## Key Metrics Targets

| Metric | Target |
|--------|--------|
| API Response Time | < 200ms (p95) |
| Database Query Time | < 50ms (p95) |
| Error Rate | < 0.1% |
| Scraper Success | > 99% |
| App Launch Time | < 2s |
| Search Results | < 500ms |

## Technology Decisions

| Decision | Rationale |
|----------|-----------|
| React Native | Single codebase, native performance, hot reload |
| TypeScript | Type safety, better IDE support, fewer bugs |
| Node.js/Express | JavaScript everywhere, async I/O, ecosystem |
| PostgreSQL | Relational model fits, ACID, Prisma support |
| Google Cloud | Serverless scaling, managed services, cost-effective |
| Prisma | Type-safe ORM, migrations, good DX |
| MMKV | Fast, encrypted, cross-platform storage |
| JWT | Stateless auth, mobile-friendly |
| RevenueCat | Simplified subscription management, cross-platform |
| Claude Vision | Accurate validation without brittle selectors |

## Security Architecture

### Authentication
- JWT tokens with 15-minute access / 7-day refresh
- Bcrypt password hashing (12 rounds)
- Rate limiting on auth endpoints (5/15min)

### Data Protection
- MMKV encrypted local storage
- HTTPS-only API communication
- No PII in logs
- Secure token storage

### API Security
- Helmet security headers
- CORS whitelist
- Request validation
- SQL injection prevention (Prisma)

---

**Document Version**: 5.3
**Last Updated**: January 2026
