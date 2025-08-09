# Children Profile Management

This feature provides complete children profile management for the Kids Activity Tracker app.

## Features

- **Children List Screen**: View all added children with avatars and basic info
- **Add/Edit Child Screen**: Add new children or edit existing profiles
- **Child Profile Screen**: Detailed view of child information with enrolled and recommended activities
- **Redux State Management**: Centralized state management for children data
- **API Integration**: Complete service layer for backend communication

## Components

### Screens
- `ChildrenListScreen.tsx`: Main list view of all children
- `AddEditChildScreen.tsx`: Form for adding/editing child profiles
- `ChildProfileScreen.tsx`: Detailed child profile with activities

### Components
- `ChildCard.tsx`: Reusable card component for displaying child info
- `ChildAvatar.tsx`: Avatar component with initials fallback

### State Management
- `childrenSlice.ts`: Redux slice for children state
- `childrenService.ts`: API service for children-related operations

### Navigation
- `ChildrenNavigator.tsx`: Nested navigation for children screens

## Required Dependencies

To enable full functionality, install these additional dependencies:

```bash
npm install react-native-image-picker @react-native-community/datetimepicker
# or
yarn add react-native-image-picker @react-native-community/datetimepicker
```

For iOS, you'll also need to run:
```bash
cd ios && pod install
```

## Usage

The children management feature is integrated into the Profile tab. Users can:

1. Navigate to Profile > My Children
2. Add new children with name, date of birth, interests, and optional medical info
3. View detailed profiles with age-appropriate activity recommendations
4. Edit or delete existing child profiles
5. See enrolled activities for each child

## API Endpoints

The feature expects these backend endpoints:

- `GET /children` - Get all children for the authenticated user
- `POST /children` - Create a new child profile
- `GET /children/:id` - Get specific child details
- `PATCH /children/:id` - Update child profile
- `DELETE /children/:id` - Delete child profile
- `POST /children/:id/avatar` - Upload child avatar
- `GET /children/:id/activities` - Get child's enrolled activities
- `GET /children/:id/recommendations` - Get age-appropriate activity recommendations

## Future Enhancements

1. **Image Picker**: Once `react-native-image-picker` is installed, users can add photos
2. **Date Picker**: Native date picker for selecting birth dates
3. **Activity Enrollment**: Direct enrollment from recommended activities
4. **Sharing**: Share child profiles with family members
5. **Growth Tracking**: Track child's activity history and preferences over time