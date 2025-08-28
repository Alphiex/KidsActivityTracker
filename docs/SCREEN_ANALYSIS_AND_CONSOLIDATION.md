# Screen Analysis and Consolidation Plan

## Current Screen Inventory

### Screens Currently Used in Navigation (✅ Active)
Based on analysis of `/src/navigation/*.tsx` files:

#### Main Navigation (RootNavigator.tsx)
1. **DashboardScreen** - Main dashboard with quick access tiles
2. **SearchScreen** - Activity search and filtering
3. **FavoritesScreen** - User's saved favorite activities (recently consolidated)
4. **FriendsAndFamilyScreenSimple** ⚠️ - Using "Simple" version, full version exists
5. **ProfileScreen** - User profile and account settings
6. **ActivityDetailScreenEnhanced** ⚠️ - Using "Enhanced" version, basic version exists
7. **FilterScreen** - Global activity filters
8. **SiteAccountsScreen** - External site account management
9. **ActivityTypeScreen** - Browse activities by type
10. **NewActivitiesScreen** - Recently added activities
11. **OnboardingScreen** - First-time user setup
12. **SettingsScreen** - App settings and preferences
13. **LocationBrowseScreen** - Browse activities by location
14. **CityBrowseScreen** - Browse activities by city
15. **NotificationPreferencesScreen** - Push notification settings
16. **RecommendationsScreen** - Activity recommendations engine
17. **TestNavigationScreen** ⚠️ - Test screen that shouldn't be in production
18. **SharingManagementScreen** - Manage activity sharing
19. **AllCategoriesScreen** - Browse all activity categories
20. **RecommendedActivitiesScreen** - User-specific recommendations
21. **AllActivityTypesScreen** - Browse all activity types
22. **ActivityTypeDetailScreen** - Details for specific activity type
23. **ActivityHistoryScreen** - User's activity registration history
24. **SharedActivitiesScreen** - Activities shared with user

#### Preferences Navigation
25. **CategoryPreferencesScreen** - Select preferred categories
26. **AgePreferencesScreen** - Set child age preferences
27. **LocationPreferencesScreen** - Set location preferences
28. **BudgetPreferencesScreen** - Set budget constraints
29. **SchedulePreferencesScreen** - Set time preferences
30. **ViewSettingsScreen** - Display and view preferences

#### Auth Navigation (AuthNavigator.tsx)
31. **LoginScreen** - User authentication
32. **RegisterScreen** - New user registration
33. **ForgotPasswordScreen** - Password recovery

#### Children Navigation (ChildrenNavigator.tsx)
34. **ChildrenListScreen** - List all children
35. **AddEditChildScreen** - Add or edit child profile
36. **ChildProfileScreen** - Individual child profile
37. **ChildActivityHistoryScreen** - Child's activity history

## Duplicate/Unused Screens Analysis

### 🔴 Critical Duplicates (Need Consolidation)

#### 1. Activity Detail Screens
- **ActivityDetailScreenEnhanced.tsx** (1,372 lines) ✅ USED - Full featured with maps, registration, etc.
- **ActivityDetailScreen.tsx** (442 lines) ❌ UNUSED - Basic version
- **Analysis**: Enhanced version has significantly more features
- **Action**: Keep Enhanced, delete Basic

#### 2. Friends and Family Screens  
- **FriendsAndFamilyScreenSimple.tsx** (533 lines) ✅ USED - Currently in navigation
- **FriendsAndFamilyScreen.tsx** (680 lines) ❌ UNUSED - More features
- **Analysis**: Full version has more functionality but Simple is being used
- **Action**: Merge features from Full into Simple, keep Simple, delete Full

#### 3. Splash Screens (in components)
- **SplashScreen.tsx** (236 lines) ❌ UNUSED - Full featured
- **SplashScreenSimple.tsx** (48 lines) ❌ UNUSED - Minimal version
- **Analysis**: Both appear unused in current navigation
- **Action**: Keep one as fallback, delete the other

### 🟡 Test/Development Screens (Should be Removed)

#### Unused Test Screens
- **NavigationStructureTest.tsx** ❌ Not in navigation
- **NavigationTestScreen.tsx** ❌ Not in navigation  
- **TestNavigationScreen.tsx** ⚠️ IN NAVIGATION but shouldn't be in production

#### Potentially Unused Screens
- **ChildrenScreen.tsx** ❌ Not in navigation (separate ChildrenNavigator exists)
- **SimplifiedActivityCard.tsx** ❌ Not a screen, should be in components
- **ActivityTypeSubtypesScreen.tsx** ❌ Not in navigation

## Screen Functionality Matrix

### Primary Functions by Screen Type

#### Activity Management
| Screen | View Activities | Search/Filter | Details | Register | Favorite | Share |
|--------|----------------|---------------|---------|----------|----------|--------|
| DashboardScreen | ✅ Quick tiles | ❌ | ❌ | ❌ | ❌ | ❌ |
| SearchScreen | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ActivityDetailScreenEnhanced | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| FavoritesScreen | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| NewActivitiesScreen | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| LocationBrowseScreen | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ActivityTypeScreen | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

#### User Management
| Screen | Profile | Children | Preferences | History | Auth |
|--------|---------|----------|-------------|---------|------|
| ProfileScreen | ✅ | ❌ | ❌ | ❌ | ❌ |
| ChildrenListScreen | ❌ | ✅ | ❌ | ❌ | ❌ |
| AddEditChildScreen | ❌ | ✅ | ❌ | ❌ | ❌ |
| ChildProfileScreen | ❌ | ✅ | ❌ | ❌ | ❌ |
| LoginScreen | ❌ | ❌ | ❌ | ❌ | ✅ |
| RegisterScreen | ❌ | ❌ | ❌ | ❌ | ✅ |
| ActivityHistoryScreen | ❌ | ❌ | ❌ | ✅ | ❌ |

#### Social Features
| Screen | Friends | Sharing | Recommendations | Notifications |
|--------|---------|---------|-----------------|---------------|
| FriendsAndFamilyScreenSimple | ✅ | ❌ | ❌ | ❌ |
| SharingManagementScreen | ❌ | ✅ | ❌ | ❌ |
| SharedActivitiesScreen | ❌ | ✅ | ❌ | ❌ |
| RecommendationsScreen | ❌ | ❌ | ✅ | ❌ |
| RecommendedActivitiesScreen | ❌ | ❌ | ✅ | ❌ |
| NotificationPreferencesScreen | ❌ | ❌ | ❌ | ✅ |

## Navigation Flow Analysis

### Main App Flow
```
DashboardScreen (Hub)
├── SearchScreen → ActivityDetailScreenEnhanced
├── FavoritesScreen → ActivityDetailScreenEnhanced  
├── NewActivitiesScreen → ActivityDetailScreenEnhanced
├── LocationBrowseScreen → ActivityDetailScreenEnhanced
├── ActivityTypeScreen → ActivityDetailScreenEnhanced
├── AllCategoriesScreen → ActivityTypeScreen
├── AllActivityTypesScreen → ActivityTypeDetailScreen
├── RecommendationsScreen → RecommendedActivitiesScreen
└── ProfileScreen
    ├── SettingsScreen
    ├── NotificationPreferencesScreen
    └── Preference Screens (6 total)
```

### Secondary Flows
```
FriendsAndFamilyScreenSimple
├── SharingManagementScreen
└── SharedActivitiesScreen

Children Management
├── ChildrenListScreen
├── AddEditChildScreen → ChildProfileScreen
└── ChildActivityHistoryScreen

ActivityDetailScreenEnhanced
├── Registration Flow (External URLs)
├── Sharing Flow → SharingManagementScreen
└── Child Registration → AddEditChildScreen
```

## Data Flow Analysis

### Service Dependencies
Most screens depend on these core services:
- **ActivityService**: API calls for activity data
- **FavoritesService**: Local storage for favorites (MMKV)
- **PreferencesService**: User preferences storage
- **AuthService**: Authentication management
- **LocationService**: Geolocation and geocoding
- **SharingService**: Social features and activity sharing

### State Management
- **Redux Store**: Global app state (auth, children, preferences)
- **Local State**: Individual screen state (loading, data, errors)
- **Navigation State**: Screen parameters and back stack
- **MMKV Storage**: Persistent local storage (favorites, preferences)

## Consolidation Plan

### Phase 1: Remove Test/Development Screens
- Delete `NavigationStructureTest.tsx`
- Delete `NavigationTestScreen.tsx`  
- Remove `TestNavigationScreen` from RootNavigator
- Delete `ChildrenScreen.tsx` (superseded by ChildrenNavigator)
- Move `SimplifiedActivityCard.tsx` to components/ or delete if unused

### Phase 2: Consolidate Duplicate Screens
1. **Activity Detail Screens**
   - Keep `ActivityDetailScreenEnhanced.tsx`
   - Delete `ActivityDetailScreen.tsx`

2. **Friends and Family Screens**
   - Analyze feature differences
   - Merge missing features from `FriendsAndFamilyScreen.tsx` into `FriendsAndFamilyScreenSimple.tsx`
   - Delete `FriendsAndFamilyScreen.tsx`

3. **Splash Screens**
   - Determine if either is used
   - Keep one, delete the other

### Phase 3: Clean Up Unused Screens
- Remove `ActivityTypeSubtypesScreen.tsx` if truly unused
- Audit any other screens not in navigation

### Phase 4: Create Rules and Documentation
1. **Pre-Development Check Rule**
2. **Screen Creation Guidelines**
3. **Consolidation Documentation**
4. **Regular Cleanup Schedule**

## Implementation Priority

### High Priority (Immediate)
1. Remove test screens from navigation
2. Delete unused test files
3. Consolidate Activity Detail screens

### Medium Priority (This Sprint)
1. Consolidate Friends and Family screens
2. Clean up splash screens
3. Update navigation imports

### Low Priority (Next Sprint)
1. Audit all screen usage
2. Create prevention rules
3. Set up regular cleanup process

## Success Metrics
- Reduce screen file count by ~20%
- Eliminate all duplicate functionality
- Establish clear naming conventions
- Create prevention documentation
- Zero test screens in production navigation

---

**Next Steps**: Execute Phase 1 consolidation plan