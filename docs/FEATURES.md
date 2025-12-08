# Kids Activity Tracker - Features Guide

## Overview

Kids Activity Tracker is a React Native mobile application that helps parents discover, track, and manage children's activities in the Greater Vancouver area.

---

## Core Features

### Activity Discovery

**Browse Activities**
- 2,900+ activities from local recreation providers
- Filter by activity type, age range, cost, location, and dates
- Search activities by name, description, or instructor
- View detailed activity information including schedules and requirements
- Real-time availability and registration status

**Activity Types**
- **Aquatics**: Swimming lessons, water safety, competitive programs
- **Arts**: Visual arts, music, drama, crafts
- **Sports**: Team sports, individual athletics, martial arts
- **Dance**: Ballet, hip-hop, contemporary, cultural dance
- **Camps**: Day camps, overnight camps, specialty programs
- **Early Years**: Parent-child programs, preschool activities
- **Youth**: Teen programs, leadership, career exploration
- **Fitness**: Yoga, fitness classes, strength training
- **Education**: Tutoring, STEM, languages

**Browse Options**
- Browse by Activity Type - Categorized activities
- Browse by Location/City - Find activities near you
- Browse by Age Group - Age-appropriate activities
- New This Week - Recently added activities
- Recommended for You - Personalized suggestions

### Child Profiles

**Profile Management**
- Create profiles for each child with birthdate and interests
- Avatar/photo support
- Gender and notes fields
- Soft delete and permanent delete options
- Bulk create multiple children

**Smart Features**
- Automatic age calculation from birthdate
- Age-appropriate activity recommendations
- Interest-based suggestions
- Activity history tracking per child

### Activity Management

**Calendar Integration**
- Add activities to child's calendar
- Track activity status (planned, in progress, completed)
- Scheduled date and time management
- Calendar views (week, month, year)
- Visual calendar with color-coded activities

**Status Tracking**
- **Planned**: Activities the child will join
- **In Progress**: Currently enrolled activities
- **Completed**: Finished activities with optional rating

**Activity Ratings**
- 1-5 star rating system for completed activities
- Rating-based recommendations

---

## User Experience

### Navigation Structure

**Bottom Tab Navigation**
- **Explore**: Main dashboard and activity discovery
- **Favourites**: Saved favorite activities
- **Friends & Family**: Child management and sharing
- **Profile**: Account settings and preferences

### Explore Tab

**Dashboard Screen**
- Personalized activity recommendations
- "New This Week" section
- Quick access to browse options
- Search functionality
- Global filter settings indicator

**Browse Screens**
- All Activity Types - Grid of activity categories
- All Age Groups - Age-based browsing
- All Categories - Traditional category view
- City Browse - Location-based discovery
- Location Browse - Venue-specific activities

**Search & Filter**
- Full-text search across activities
- Advanced filters:
  - Activity type and subtype
  - Age range (min/max)
  - Cost range (min/max)
  - Date range
  - Days of week
  - Location/city
  - Hide closed/full activities

### Favourites Tab

- View all favorited activities
- Quick access to activity details
- One-tap unfavorite
- Activity availability status

### Friends & Family Tab

**Children Management**
- View all children profiles
- Add new children
- Edit child details
- View child's activity history

**Sharing Features**
- Share child profiles with co-parents
- Invite family members
- View shared children from others
- Manage sharing permissions

**Activity Tracking**
- View activities per child
- Activity history with ratings
- Shared activities view

### Profile Tab

**Account Settings**
- Profile information (name, email, phone)
- Change password
- Delete account (Apple App Store requirement)

**Preferences**
- Activity Type Preferences
- Age Preferences
- Location Preferences
- Budget Preferences
- Schedule Preferences
- View Settings (hide closed/full activities)

**Notification Settings**
- Activity reminders
- Registration alerts
- New activity notifications

---

## Activity Cards

**Visual Design**
- Category-colored thumbnails
- Price displayed prominently
- Availability badges (spots remaining)
- Registration status indicators

**Information Displayed**
- Activity name and organization
- Day(s) of week badges (highlighted)
- Time (startTime - endTime)
- Location name
- Cost with tax indicator
- Age range
- Available spots

**Actions**
- Tap to view details
- Heart icon to favorite
- Quick add to child's calendar

---

## Activity Detail Screen

**Overview Section**
- Full activity name and organization
- Category and subcategory
- Registration status badge
- Favorite button

**Schedule Information**
- Date range (start - end)
- Time schedule
- Days of week
- Session details (if multi-session)

**Participant Information**
- Age range requirements
- Available spots / total spots
- Instructor name
- Prerequisites

**Cost Information**
- Price with tax status
- Required extras/materials
- Payment information

**Location Details**
- Venue name
- Full address
- City and province
- Map integration (Apple Maps link)

**Additional Information**
- Full description
- What to bring
- Prerequisites
- Contact information

**Actions**
- Register Now (links to provider)
- Add to Child's Calendar
- Add to Favorites
- Share via Email

---

## Calendar Features

**Views**
- Week view
- Month view
- Year view

**Features**
- Color-coded activities by child
- Activity status indicators
- Quick add from calendar
- Date navigation
- Today button

**Calendar Events Show**
- Activity name
- Child name
- Time
- Location
- Status

---

## Authentication

**Account Management**
- Email/password registration
- Email verification
- Password reset via email
- Password change
- Account deletion

**Session Management**
- JWT-based authentication
- Automatic token refresh
- Secure token storage (MMKV encrypted)
- Session persistence

---

## Onboarding Flow

**New User Onboarding**
1. Welcome screen
2. Activity type preferences
3. Age preferences (children's ages)
4. Location preferences
5. Budget preferences
6. Schedule preferences
7. Completion

**Preference Screens**
- Multi-select activity types
- Age range sliders
- City/location selection
- Budget range
- Available days/times

---

## Sharing & Collaboration

**Child Sharing**
- Invite family members by email
- Share specific children
- Permission levels
- View shared children's activities

**Activity Sharing**
- Share activity via email
- Formatted email with all details
- Registration link included
- Copy activity information

---

## Technical Features

### Performance
- Pagination on all list endpoints (max 100 items)
- Optimized database queries with indexes
- Batch operations for bulk actions
- Lazy loading of activity lists

### Security
- JWT authentication with refresh tokens
- Device-specific MMKV encryption
- Secure logging (sensitive data redaction)
- Rate limiting on API endpoints

### Offline Support
- Cached preferences
- Stored authentication
- Offline-friendly UI states

---

## Provider Coverage

**Current Providers**
- North Vancouver Recreation Commission (NVRC)

**Planned Expansion**
- City of Vancouver Recreation
- West Vancouver Recreation
- Burnaby Parks & Recreation
- Additional BC municipalities

---

## Planned Features

### Near-term
- Push notifications for registration reminders
- iOS Calendar sync
- Activity conflict detection
- Bulk activity operations

### Future
- Province-wide activity search
- Activity reviews and ratings
- Group registration coordination
- Transportation time consideration
- Budget tracking and planning
- Waitlist notifications

---

**Document Version**: 4.0
**Last Updated**: December 2024
**Next Review**: March 2025
