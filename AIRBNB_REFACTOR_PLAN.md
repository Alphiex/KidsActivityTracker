# Airbnb-Style App Refactoring Plan

## Design Patterns from DashboardScreenModern.tsx

**Key Design Elements:**
- Clean white/light backgrounds
- Animated scrolling headers that shrink and fade
- Tab-style navigation with underlines for active states
- Card-based layouts with rounded corners and shadows
- Heart icons for favorites functionality
- Price overlays on activity cards
- Minimal use of gradients, focus on clean typography
- Consistent spacing and padding

## Prioritized Refactoring Plan

### **Phase 1: Core Navigation & Main Screens (High Priority)**
1. **SearchScreen.tsx** - Main search functionality, needs animated header ✅ CURRENT
2. **FavoritesScreen.tsx** - Core tab screen, apply consistent card layouts
3. **ProfileScreen.tsx** - Core tab screen, clean card-based settings
4. **FilterScreen.tsx** - Modal/sheet styling consistency

### **Phase 2: Activity-Related Screens (High Priority)**
5. **ActivityDetailScreenEnhanced.tsx** - Key user journey screen
6. **AllActivityTypesScreen.tsx** - Category browsing experience
7. **ActivityListScreen.tsx** - Activity browsing consistency
8. **NewActivitiesScreen.tsx** - Dashboard-linked screen
9. **RecommendedActivitiesScreen.tsx** - Dashboard-linked screen

### **Phase 3: Browse & Discovery Screens (Medium Priority)**
10. **LocationBrowseScreen.tsx** - Location-based browsing
11. **CityBrowseScreen.tsx** - City selection interface
12. **AllCategoriesScreen.tsx** - Category browsing
13. **CategoryDetailScreen.tsx** - Category detail pages
14. **ActivityTypeDetailScreen.tsx** - Activity type details

### **Phase 4: User Management Screens (Medium Priority)**
15. **ChildrenListScreen.tsx** - Family management
16. **ChildProfileScreen.tsx** - Child details
17. **AddEditChildScreen.tsx** - Child forms
18. **ChildActivityHistoryScreen.tsx** - Child activity tracking

### **Phase 5: Settings & Preferences (Medium Priority)**
19. **SettingsScreen.tsx** - Main settings screen
20. **ActivityTypePreferencesScreen.tsx** - User preferences
21. **AgePreferencesScreen.tsx** - Age-related preferences
22. **BudgetPreferencesScreen.tsx** - Budget settings
23. **LocationPreferencesScreen.tsx** - Location preferences
24. **SchedulePreferencesScreen.tsx** - Schedule preferences
25. **ViewSettingsScreen.tsx** - Display preferences
26. **NotificationPreferencesScreen.tsx** - Notification settings

### **Phase 6: Social & Sharing Features (Low Priority)**
27. **FriendsAndFamilyScreenSimple.tsx** - Social features
28. **SharedActivitiesScreen.tsx** - Activity sharing
29. **SharingManagementScreen.tsx** - Sharing settings
30. **SiteAccountsScreen.tsx** - Account connections

### **Phase 7: History & Tracking (Low Priority)**
31. **ActivityHistoryScreen.tsx** - Activity history
32. **RecommendationsScreen.tsx** - Personalized recommendations

### **Phase 8: Authentication (Low Priority)**
33. **LoginScreen.tsx** - Login interface
34. **RegisterScreen.tsx** - Registration interface  
35. **ForgotPasswordScreen.tsx** - Password recovery
36. **OnboardingScreen.tsx** - First-time user experience

## Design System Components to Create

### **Shared Components to Develop:**
- **AirbnbHeader** - Animated scrolling header component
- **AirbnbTabBar** - Clean tab navigation with underlines
- **AirbnbCard** - Consistent card styling for activities
- **AirbnbButton** - Primary and secondary button styles
- **AirbnbSearchBar** - Clean search input component
- **AirbnbModal** - Full-screen modal with sections
- **AirbnbExpandableSection** - Collapsible filter sections

### **Consistent Styling Patterns:**
- Header animations (shrink/fade on scroll)
- Card shadows and rounded corners (8px radius)
- Typography hierarchy (consistent font sizes and weights)
- Color palette (whites, grays, accent colors)
- Spacing system (8px grid system)
- Activity card layouts with price overlays and heart icons
- Modal overlays with expandable sections
- Clean search interfaces with suggestion lists

## Current Status
- ✅ Dashboard refactored with Airbnb styling
- 🔄 SearchScreen refactoring in progress
- ⏳ 35 screens remaining

## Notes
- Start with SearchScreen as modal popup from dashboard search bar
- Include expandable sections for filters (location, activity type, schedule)
- Each screen should be reviewed before moving to next