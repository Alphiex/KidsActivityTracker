# Frontend Guide

React Native mobile application for Kids Activity Tracker.

## Overview

| | |
|---|---|
| **Framework** | React Native 0.80 |
| **Language** | TypeScript |
| **State** | Redux Toolkit |
| **Storage** | MMKV (encrypted) |
| **Navigation** | React Navigation 7.x |
| **Platforms** | iOS, Android |

## Project Structure

```
src/
├── components/
│   ├── ActivityCard.tsx           # Activity display card
│   ├── modern/
│   │   └── ActivityCardModern.tsx # Modern styled card
│   ├── calendar/                  # Calendar components
│   ├── children/                  # Child profile components
│   ├── HierarchicalSelect/        # Location picker
│   ├── TopTabNavigation.tsx       # Tab switching
│   ├── NetworkStatus.tsx          # Connectivity indicator
│   └── LoadingIndicator.tsx       # Loading states
│
├── screens/
│   ├── auth/
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   └── ForgotPasswordScreen.tsx
│   ├── onboarding/
│   │   ├── OnboardingScreenModern.tsx
│   │   ├── OnboardingAgeScreen.tsx
│   │   └── OnboardingLocationScreen.tsx
│   ├── DashboardScreenModern.tsx  # Main dashboard
│   ├── CalendarScreenModernFixed.tsx
│   ├── FiltersScreen.tsx
│   ├── ActivityDetailScreenModern.tsx
│   ├── FriendsAndFamilyScreenModern.tsx
│   ├── ProfileScreenModern.tsx
│   └── ... (45+ screens)
│
├── services/
│   ├── api.ts                     # Axios API client
│   ├── authService.ts             # Authentication
│   ├── activityService.ts         # Activity operations
│   ├── childrenService.ts         # Child management
│   ├── preferencesService.ts      # User preferences
│   └── calendarExportService.ts   # Calendar export
│
├── store/
│   ├── slices/
│   │   ├── authSlice.ts           # Auth state
│   │   ├── activitiesSlice.ts     # Activities state
│   │   ├── childrenSlice.ts       # Children state
│   │   └── preferencesSlice.ts    # Preferences state
│   ├── store.ts                   # Store configuration
│   └── hooks.ts                   # Typed hooks
│
├── types/
│   ├── activity.ts                # Activity types
│   ├── preferences.ts             # Preference types
│   └── navigation.ts              # Navigation types
│
├── navigation/                    # React Navigation setup
├── theme/                         # Design tokens
├── utils/                         # Utility functions
└── contexts/                      # React contexts
```

## Navigation Structure

```
App
├── Auth Stack
│   ├── Login
│   ├── Register
│   └── Forgot Password
│
├── Onboarding Stack
│   ├── Welcome
│   ├── Activity Type Preferences
│   ├── Age Preferences
│   ├── Location Preferences
│   └── Complete
│
└── Main Tabs
    ├── Explore (Home Stack)
    │   ├── Dashboard
    │   ├── Filters
    │   ├── Calendar
    │   ├── Activity List
    │   ├── Activity Detail
    │   ├── Search Results
    │   ├── City Browse
    │   └── Location Browse
    │
    ├── Favorites Stack
    │   └── Favorites List
    │
    ├── Friends & Family Stack
    │   ├── Children List
    │   ├── Add/Edit Child
    │   ├── Child Profile
    │   ├── Activity History
    │   ├── Sharing Management
    │   └── Shared Activities
    │
    └── Profile Stack
        ├── Profile
        ├── Settings
        ├── Notification Preferences
        ├── Activity Type Preferences
        ├── Location Preferences
        └── Legal
```

## Key Screens

### DashboardScreenModern.tsx
Main landing screen with:
- Personalized activity recommendations
- "New This Week" section
- Budget-friendly activities
- Quick action tiles

### CalendarScreenModernFixed.tsx
Calendar view features:
- Week, month, year views
- Color-coded by child
- Activity scheduling
- Export to device calendar

### FiltersScreen.tsx
Advanced filtering:
- Activity type selection
- Age range sliders
- Cost range
- Date range picker
- Days of week selection
- Location hierarchy (Province > City > Venue)
- Hide closed/full toggles

### ActivityDetailScreenModern.tsx
Activity information:
- Full description
- Schedule and dates
- Pricing information
- Location with map
- Registration link
- Prerequisites
- Action buttons (register, favorite, add to calendar)

## State Management

### Redux Slices

**authSlice.ts**
```typescript
interface AuthState {
  user: User | null;
  tokens: Tokens | null;
  isLoading: boolean;
  error: string | null;
}
```

**activitiesSlice.ts**
```typescript
interface ActivitiesState {
  items: Activity[];
  filters: ActivityFilters;
  pagination: Pagination;
  isLoading: boolean;
}
```

**childrenSlice.ts**
```typescript
interface ChildrenState {
  children: Child[];
  selectedChildId: string | null;
  isLoading: boolean;
}
```

### MMKV Storage

Encrypted local storage for:
- Authentication tokens
- User preferences
- Cached data
- Onboarding state

```typescript
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({
  id: 'kidsactivity-storage',
  encryptionKey: deviceId
});
```

## Components

### ActivityCard

```typescript
interface ActivityCardProps {
  activity: Activity;
  onPress: () => void;
  onFavorite?: () => void;
  showDays?: boolean;
}
```

Features:
- Activity name and category
- Time display (9:30 am - 12:00 pm)
- Location name
- Cost badge
- Days of week badges (pink)
- Spots available indicator
- Favorite button

### HierarchicalSelect

Multi-level location picker:
```typescript
interface HierarchicalSelectProps {
  data: LocationHierarchy;
  selected: string[];
  onChange: (selected: string[]) => void;
  levels: ['province', 'city', 'location'];
}
```

## API Integration

### API Service

```typescript
// src/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://kids-activity-api-205843686007.us-central1.run.app',
  timeout: 30000,
});

// Interceptors for auth token injection
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Automatic token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await refreshTokens();
      return api.request(error.config);
    }
    throw error;
  }
);
```

### Service Pattern

```typescript
// src/services/activityService.ts
export const activityService = {
  async getActivities(filters: ActivityFilters): Promise<ActivityResponse> {
    const response = await api.get('/api/v1/activities', { params: filters });
    return response.data;
  },

  async getActivityById(id: string): Promise<Activity> {
    const response = await api.get(`/api/v1/activities/${id}`);
    return response.data.data;
  },

  async searchActivities(query: string): Promise<Activity[]> {
    const response = await api.get('/api/v1/activities', {
      params: { search: query }
    });
    return response.data.data;
  }
};
```

## Styling

### Theme System

```typescript
// src/theme/index.ts
export const theme = {
  colors: {
    primary: '#FF6B6B',
    secondary: '#4ECDC4',
    background: '#FFFFFF',
    text: '#333333',
    textSecondary: '#666666',
    border: '#E0E0E0',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    h1: { fontSize: 28, fontWeight: '700' },
    h2: { fontSize: 24, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: '400' },
    caption: { fontSize: 12, fontWeight: '400' },
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },
};
```

### Design Patterns
- Airbnb-style card layouts
- Pink accent badges
- Rounded corners
- Subtle shadows
- Clean typography

## Running the App

### iOS Development

```bash
# Required: Use iOS 18.6 simulator
./scripts/ios/run-simulator.sh

# Or specify UDID
npx react-native run-ios --udid="A8661E75-FE3E-483F-8F13-AC87110E8EE2"
```

### Metro Bundler

```bash
npx react-native start --reset-cache
```

### Android Development

```bash
npx react-native run-android
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- ActivityCard.test.tsx
```

## Code Quality

```bash
# Lint check
npm run lint

# Type check
npm run typecheck

# Fix lint issues
npm run lint -- --fix
```

## Key Libraries

| Library | Purpose |
|---------|---------|
| `react-native-mmkv` | Encrypted storage |
| `@reduxjs/toolkit` | State management |
| `@react-navigation/native` | Navigation |
| `react-native-reanimated` | Animations |
| `react-native-calendars` | Calendar UI |
| `react-native-maps` | Map integration |
| `lucide-react-native` | Icons |
| `react-hook-form` | Form handling |
| `date-fns` | Date utilities |
| `axios` | HTTP client |

---

**Document Version**: 4.0
**Last Updated**: December 2024
