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
│   ├── AddressAutocomplete/       # Address search with suggestions
│   │   ├── AddressAutocomplete.tsx  # Main component
│   │   ├── types.ts               # Type definitions
│   │   ├── utils.ts               # Helper functions
│   │   └── index.ts               # Barrel export
│   ├── calendar/                  # Calendar components
│   ├── children/                  # Child profile components
│   ├── filters/
│   │   └── DistanceFilterSection.tsx  # Distance filtering UI
│   ├── HierarchicalSelect/        # Location picker
│   ├── TopTabNavigation.tsx       # Tab switching (no highlight for AI Recommendations)
│   ├── ai/                        # AI components
│   │   ├── AIRecommendationCard.tsx  # Activity card with "Great for your child" section
│   │   ├── AILoadingState.tsx     # Loading animation
│   │   ├── AIErrorState.tsx       # Error display
│   │   └── AISourceBadge.tsx      # AI/heuristic source indicator
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
│   │   ├── OnboardingLocationScreen.tsx
│   │   └── OnboardingDistanceScreen.tsx  # Distance preferences setup
│   ├── preferences/
│   │   └── DistancePreferencesScreen.tsx # Distance settings
│   ├── DashboardScreenModern.tsx  # Main dashboard with AI Recommendations button
│   ├── AIRecommendationsScreen.tsx # Personalized AI activity recommendations
│   ├── AIChatScreen.tsx           # Conversational AI assistant
│   ├── CalendarScreenModernFixed.tsx
│   ├── FiltersScreen.tsx          # Activity type icons and cascading selection
│   ├── ActivityDetailScreenModern.tsx
│   ├── FriendsAndFamilyScreenModern.tsx
│   ├── ProfileScreenModern.tsx
│   └── ... (50+ screens)
│
├── services/
│   ├── api.ts                     # Axios API client
│   ├── aiService.ts               # AI recommendations and chat
│   ├── authService.ts             # Authentication
│   ├── activityService.ts         # Activity operations
│   ├── childrenService.ts         # Child management
│   ├── preferencesService.ts      # User preferences
│   ├── locationService.ts         # GPS & geocoding service
│   ├── calendarExportService.ts   # Calendar export
│   ├── waitlistService.ts         # Waitlist monitoring & purge
│   └── favoritesService.ts        # Favorites management
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
│   ├── Distance Preferences
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
    ├── My Collection Stack
    │   ├── Favourites Tab       # Saved activities
    │   ├── Watching Tab         # Activities being monitored
    │   └── Waiting List Tab     # Waitlist status activities
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
        ├── Distance Preferences
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
- Distance-based filtering (GPS/saved address with radius)
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

### AIRecommendationsScreen.tsx
AI-powered activity recommendations:
- Personalized based on child profiles and preferences
- "Great for your child" explanations with child-focused benefits
- Match quality badges (Excellent Match, Great Match, Good Match)
- Pull-to-refresh for new recommendations
- No top/bottom navigation highlighting (dedicated screen)

### AIChatScreen.tsx
Conversational AI assistant:
- Natural language activity search
- Multi-turn conversations with context retention
- Suggested prompts for common queries
- Follow-up suggestions after responses
- Quota display (free vs pro tier)

### FavoritesScreenModern.tsx (My Collection)
Three-tab collection management:
- **Favourites Tab**: Saved activities with heart icon toggle
- **Watching Tab**: Activities being monitored for availability
- **Waiting List Tab**: Waitlist status activities with "Clear Closed" purge button
- Hero header with collection stats
- Pull-to-refresh on all tabs

### ActivityCard.tsx
Activity display card features:
- Activity image with price overlay
- Action buttons (favorite, watch, share, calendar)
- "Watch for Spots" button for Waitlist status activities
- Registration status badges (Open, Waitlist, Closed)
- Spots availability indicators

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

### AddressAutocomplete

Google Places-powered address search with suggestions:
```typescript
interface AddressAutocompleteProps {
  value: EnhancedAddress | null;
  onAddressSelect: (address: EnhancedAddress | null) => void;
  placeholder?: string;
  label?: string;
  country?: string | string[];  // e.g., ['ca', 'us']
  showClearButton?: boolean;
  showFallbackOption?: boolean;  // Show "Enter manually" option
  disabled?: boolean;
  error?: string;
}
```

Features:
- Real-time suggestions as user types (300ms debounce)
- Full address parsing (street, city, province, postal code, coordinates)
- Fallback to manual entry with Nominatim geocoding
- Theme-aware styling via `useTheme()`
- Selected address display with clear button

### AIRecommendationCard

```typescript
interface AIRecommendationCardProps {
  recommendation: AIRecommendation;
  activity: Activity;
  source: AISourceType;
  onPress?: () => void;
  showExplanation?: boolean;
}
```

Features:
- Activity image with rank badge (#1, #2, etc.)
- Match quality badge (Excellent/Great/Good Match)
- Price overlay with "per child" label
- Activity details (name, provider, location, dates, time, ages)
- "Great for your child:" section with child-focused benefit explanations
- Warning section for potential issues (age mismatch, schedule conflicts)
- Spots available indicator

### TopTabNavigation

Tab navigation component with active state highlighting:
- Explore (Dashboard) - 🎯 icon
- Map (MapSearch) - 🗺️ icon
- AI (AIChat) - Robot image icon
- Calendar - 📅 icon

**Note**: AIRecommendations screen returns `null` for active tab (no highlighting).

Usage:
```typescript
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { EnhancedAddress } from '../types/preferences';

const [address, setAddress] = useState<EnhancedAddress | null>(null);

<AddressAutocomplete
  value={address}
  onAddressSelect={setAddress}
  placeholder="Search for your address..."
  country={['ca', 'us']}
  showFallbackOption={true}
/>
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

### Location Service

```typescript
// src/services/locationService.ts
export const locationService = {
  // Check location permission status
  async checkPermission(): Promise<LocationPermissionStatus> { ... },

  // Request location permission from user
  async requestPermission(): Promise<LocationPermissionStatus> { ... },

  // Get current GPS coordinates
  async getCurrentLocation(): Promise<Coordinates | null> { ... },

  // Get saved address (legacy format for backward compatibility)
  getSavedAddress(): SavedAddress | null { ... },

  // Get enhanced address (new format with full details)
  getEnhancedAddress(): EnhancedAddress | null { ... },

  // Save enhanced address from autocomplete
  async saveEnhancedAddress(address: EnhancedAddress): Promise<boolean> { ... },

  // Get effective location (GPS or saved address based on preference)
  async getEffectiveLocation(): Promise<EffectiveLocation | null> { ... },

  // Get distance filter params for API calls
  async getDistanceFilterParams(): Promise<{ userLat?, userLon?, radiusKm? }> { ... }
};
```

**Distance Preferences** (stored in MMKV via preferencesService):
- `distanceFilterEnabled`: boolean - Enable/disable distance filtering
- `distanceRadiusKm`: number - Search radius (5, 10, 25, 50, 100 km)
- `locationSource`: 'gps' | 'saved_address' - Location source
- `savedAddress`: object - Geocoded saved address with coordinates

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
| `react-native-google-places-autocomplete` | Address search |
| `lucide-react-native` | Icons |
| `react-hook-form` | Form handling |
| `date-fns` | Date utilities |
| `axios` | HTTP client |

---

**Document Version**: 4.2
**Last Updated**: January 2026
