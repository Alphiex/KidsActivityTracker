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
│  │  │             │  │  Middleware │  │  AI Orchestrator    │  │   │
│  │  └─────────────┘  └─────────────┘  └──────────┬──────────┘  │   │
│  └───────────────────────────────────────────────┼──────────────┘   │
│                                                  │                   │
│  ┌───────────────────────────────────────────────┼──────────────┐   │
│  │                    CLOUD SQL                  │               │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │              PostgreSQL 15 Database                     │ │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │ │   │
│  │  │  │Activities│ │  Users   │ │ Children │ │ Locations │  │ │   │
│  │  │  │(126,000+)│ │          │ │          │ │ (4,900+)  │  │ │   │
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
│  │  │     Scraper Job (Puppeteer/Cheerio + Geocoding)         │ │  │
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
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   EXTERNAL APIS                               │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐             │  │
│  │  │ OpenAI  │ │ Anthropic│ │ Google  │ │  Stripe │             │  │
│  │  │ GPT-4   │ │ Claude  │ │ Maps    │ │         │             │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘             │  │
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
│  │  │Activities│ │ Children│  │  Auth   │  │ChildFavorites│ │  │
│  │  │  Slice  │  │  Slice  │  │  Slice  │  │    Slice    │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘  │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐ │  │
│  │  │ChildActivities │  │      Subscription Slice         │ │  │
│  │  │     Slice       │  │                                 │ │  │
│  │  └─────────────────┘  └─────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                     Services Layer                         │  │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────────┐  │  │
│  │  │    API    │  │    AI     │  │     Preferences       │  │  │
│  │  │  Service  │  │  Service  │  │       Service         │  │  │
│  │  └─────┬─────┘  └───────────┘  └───────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │ Child Services (Preferences, Favorites, Activities)   │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │   Location Service (GPS, Geocoding, Distance Calc)    │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │   Notification Service (FCM + Watching Alerts)        │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │        RevenueCat Service (Subscriptions)             │  │  │
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
│  │  │ │ /auth  │ │/activit│ │/children│ │  /ai           │ │  │  │
│  │  │ │        │ │  ies   │ │         │ │  (recommend,   │ │  │  │
│  │  │ │        │ │        │ │         │ │   chat, plan)  │ │  │  │
│  │  │ └───┬────┘ └────┬───┘ └────┬────┘ └───────┬────────┘ │  │  │
│  │  │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────────┐ │  │  │
│  │  │ │/subscr │ │/partner│ │/notifi │ │   /sponsored   │ │  │  │
│  │  │ │ iption │ │   s    │ │ cations│ │                │ │  │  │
│  │  │ └───┬────┘ └────┬───┘ └───┬────┘ └───────┬────────┘ │  │  │
│  │  └─────┼───────────┼─────────┼──────────────┼──────────┘  │  │
│  │        │           │         │              │              │  │
│  │  ┌─────▼───────────▼─────────▼──────────────▼──────────┐  │  │
│  │  │                   Services                           │  │  │
│  │  │  activityService │ childrenService │ aiOrchestrator │  │  │
│  │  └─────────────────────────┬───────────────────────────┘  │  │
│  │                            │                               │  │
│  │  ┌─────────────────────────▼───────────────────────────┐  │  │
│  │  │              AI Module (LangGraph)                   │  │  │
│  │  │  parseQueryNode │ fetchCandidatesNode │ plannerNode │  │  │
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

### AI Architecture (LangGraph)

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI ORCHESTRATOR                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   LangGraph State Machine                   │ │
│  │                                                             │ │
│  │   START                                                     │ │
│  │     │                                                       │ │
│  │     ▼                                                       │ │
│  │  ┌─────────────────┐                                       │ │
│  │  │ parseQueryNode  │ ← Extract intent, filters, entities   │ │
│  │  └────────┬────────┘                                       │ │
│  │           │                                                 │ │
│  │           ▼                                                 │ │
│  │  ┌─────────────────┐                                       │ │
│  │  │fetchCandidatesNode│ ← Query activities with filters     │ │
│  │  └────────┬────────┘                                       │ │
│  │           │                                                 │ │
│  │           ▼                                                 │ │
│  │  ┌─────────────────┐                                       │ │
│  │  │rankActivitiesNode│ ← Score & rank by child preferences  │ │
│  │  └────────┬────────┘                                       │ │
│  │           │                                                 │ │
│  │           ▼                                                 │ │
│  │  ┌─────────────────┐                                       │ │
│  │  │generateExplanationsNode│ ← "Great for your child..."   │ │
│  │  └────────┬────────┘                                       │ │
│  │           │                                                 │ │
│  │           ▼                                                 │ │
│  │        END                                                  │ │
│  │                                                             │ │
│  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │ │
│  │                                                             │ │
│  │  Weekly Planner Branch:                                     │ │
│  │     │                                                       │ │
│  │     ▼                                                       │ │
│  │  ┌─────────────────┐                                       │ │
│  │  │  plannerNode    │ ← Per-child availability, conflicts   │ │
│  │  └─────────────────┘                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  External APIs:                                                  │
│  ┌─────────┐  ┌─────────┐                                      │
│  │ OpenAI  │  │Anthropic│ (for scraper validation)             │
│  │ GPT-4o  │  │ Claude  │                                      │
│  └─────────┘  └─────────┘                                      │
└─────────────────────────────────────────────────────────────────┘
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
│       │   ├── SearchScreen
│       │   ├── MapSearchScreen (geographic browsing)
│       │   ├── CalendarScreenModernFixed
│       │   ├── WeeklyPlannerScreen (AI scheduling)
│       │   ├── AIRecommendationsScreen
│       │   ├── AIChatScreen
│       │   ├── ActivityList
│       │   └── ActivityDetailScreen
│       ├── My Collection (FavoritesStack)
│       │   ├── Favourites Tab (per-child favorites)
│       │   ├── Watching Tab (monitoring for spots)
│       │   └── Enrolled Tab (current activities)
│       ├── Friends & Family (FriendsStack)
│       │   ├── Children Management
│       │   ├── ChildDetailScreen (with tabs: Upcoming, Past, Dropped)
│       │   ├── AddEditChildScreen
│       │   └── Activity History
│       └── Profile (ProfileStack)
│           ├── Settings
│           ├── SubscriptionScreen
│           ├── Preferences
│           └── Account
```

### Child Management Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHILD DATA MODEL                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      Child                               │    │
│  │  ┌─────────────────────────────────────────────────────┐│    │
│  │  │ Profile: name, dateOfBirth, gender, photo           ││    │
│  │  │ Location: savedAddress, latitude, longitude         ││    │
│  │  └─────────────────────────────────────────────────────┘│    │
│  │                         │                                │    │
│  │           ┌─────────────┼─────────────┐                 │    │
│  │           ▼             ▼             ▼                 │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │    │
│  │  │ Preferences │ │  Favorites  │ │ChildActivities  │   │    │
│  │  │             │ │  (starred)  │ │                 │   │    │
│  │  │ activityTypes│ │             │ │ status:         │   │    │
│  │  │ daysOfWeek  │ │             │ │ - interested    │   │    │
│  │  │ distanceKm  │ │             │ │ - enrolled      │   │    │
│  │  │ priceRange  │ │             │ │ - completed     │   │    │
│  │  │ environment │ │             │ │ - dropped       │   │    │
│  │  └─────────────┘ └─────────────┘ │ - watching      │   │    │
│  │                                   └─────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Custom Events                          │    │
│  │  (Family-created activities not from scrapers)          │    │
│  │  title, description, startDate, endDate, recurring      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

Child Selection Modes:
┌────────────────────────────────────────────────────────────────┐
│ Manual Mode: User explicitly selects children for filtering    │
│ Auto Mode: System determines based on activity age requirements│
│ Filter Mode: OR (any child matches) vs AND (all children match)│
└────────────────────────────────────────────────────────────────┘
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

### Map View Flow

```
User opens Map
    │
    ▼
┌──────────────────┐
│ Mobile App       │
│ Get viewport     │
│ bounds           │
└────────┬─────────┘
         │ GET /api/v1/activities/bounds
         │ ?minLat=49.2&maxLat=49.4
         │ &minLng=-123.2&maxLng=-123.0
         ▼
┌──────────────────┐
│ API Server       │
│ Query activities │
│ with coordinates │
│ within bounds    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ PostgreSQL       │
│ Filter by lat/lng│
│ (99.3% geocoded) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Mobile App       │
│ Render markers   │
│ on MapView       │
└──────────────────┘
```

### AI Recommendations Flow

```
User opens AI Recommendations
        │
        ▼
┌───────────────────────────────────────────┐
│          Load Family Context               │
│  • Selected children                       │
│  • Child preferences (merged)              │
│  • Filter mode (OR/AND)                    │
└───────────────────┬───────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│        AI Orchestrator (LangGraph)         │
│  • parseQueryNode: Extract search intent   │
│  • fetchCandidatesNode: Query activities   │
│  • rankActivitiesNode: Score by match      │
│  • generateExplanationsNode: Benefits      │
└───────────────────┬───────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│       Response                             │
│  • recommendations: [activity + score]     │
│  • explanations: "Great for your child..." │
│  • match quality: Excellent/Great/Good     │
└───────────────────────────────────────────┘
```

### Weekly Planner Flow

```
User selects week + child availability
        │
        ▼
┌───────────────────────────────────────────┐
│        Availability Grid                   │
│  Per child: 7 days × 3 time slots          │
│  (morning, afternoon, evening)             │
└───────────────────┬───────────────────────┘
        │ POST /api/v1/ai/plan-week
        ▼
┌───────────────────────────────────────────┐
│        Planner Node                        │
│  • Match activities to available slots     │
│  • Consider sibling grouping preference    │
│  • Detect conflicts                        │
│  • Generate optimized schedule             │
└───────────────────┬───────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│       Response                             │
│  • Per-child schedules                     │
│  • Suggested activities per slot           │
│  • Conflict warnings                       │
│  • User can approve/reject, bulk add       │
└───────────────────────────────────────────┘
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
│  6. Create/update locations               │
│  7. Geocode new locations (Google Maps)   │
│  8. Upsert activities to database         │
│  9. Propagate coordinates to activities   │
│  10. Deactivate stale records             │
│  11. Record metrics                       │
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
Database Updated (126,000+ activities, 99.3% geocoded)
```

### Watching/Notification Flow

```
User marks activity as "Watching"
        │
        ▼
┌──────────────────┐
│ ChildActivity    │
│ status: watching │
└────────┬─────────┘
         │
         ▼
┌───────────────────────────────────────────┐
│     Post-Scraper Processing               │
│  • Compare old vs new spotsAvailable      │
│  • If spots opened: trigger notification  │
└───────────────────┬───────────────────────┘
         │
         ▼
┌───────────────────────────────────────────┐
│     Notification Service                   │
│  • Get users watching this activity        │
│  • Send push notification via FCM          │
│  • Send email notification                 │
└───────────────────┬───────────────────────┘
         │
         ▼
┌──────────────────┐
│ User receives    │
│ "Spots available │
│ for [Activity]"  │
└──────────────────┘
```

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
| Maps | react-native-maps | Geographic display |
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
| AI | OpenAI GPT-4o, LangGraph | AI orchestration |
| Geocoding | Google Maps API | Address to coordinates |
| Push | firebase-admin | FCM server SDK |
| Payments | Stripe | Partner payments |

### Database
| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | PostgreSQL 15 | Primary datastore |
| Hosting | Cloud SQL | Managed service |
| Migrations | Prisma Migrate | Schema versioning |
| Tables | 40+ | Full schema |

### Scraping
| Component | Technology | Purpose |
|-----------|------------|---------|
| Browser | Puppeteer | Web automation |
| Parser | Cheerio | HTML parsing |
| Scheduling | Cloud Scheduler | Tiered cron jobs |
| Execution | Cloud Run Jobs | Serverless compute |
| Validation | Claude Vision | Data verification |
| Geocoding | Google Maps | Location coordinates |

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
- **Geocoding**: 99.3% of activities pre-geocoded

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
| Geocoding Coverage | > 99% |

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
| LangGraph | Structured AI workflows, state management |
| Google Maps Geocoding | Accurate coordinates, high coverage |

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
- API keys in environment variables (gitignored)

### API Security
- Helmet security headers
- CORS whitelist
- Request validation
- SQL injection prevention (Prisma)

---

**Document Version**: 6.0
**Last Updated**: January 2026
