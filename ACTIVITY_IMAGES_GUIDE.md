# Kids Activity Tracker - Activity Images Guide

## Overview
The app now uses a comprehensive image mapping system that displays appropriate images for each activity type based on its category and subcategory.

## Current Status

### ✅ Completed
1. **Database Analysis**: Scanned cloud database and identified 30 unique activity categories with 4,246 total activities
2. **Image Mapping System**: Created intelligent mapping that matches activities to appropriate images
3. **Placeholder Images**: Generated 50 color-coded placeholder images for all activity types
4. **App Integration**: Updated the app to use activity-specific images instead of generic mountain image

### 📁 Files Created
- `/src/config/activityImageConfig.ts` - Comprehensive activity-to-image mapping configuration
- `/src/utils/activityHelpers.ts` - Enhanced `getActivityImageKey()` function with detailed category matching
- `/src/assets/images/index.ts` - Updated to include all 50 activity image types
- `/backend/IMAGE_DOWNLOAD_GUIDE.md` - Complete guide for downloading child-friendly images
- `/backend/image-download-list.json` - JSON list of all images needed with search terms
- `/backend/image-download-list.csv` - CSV format for easy reference

### 🖼️ Image Categories (50 total)

#### Swimming & Aquatics (3 images)
- `swimming.jpg` - Kids swimming pool
- `water_safety.jpg` - Water safety/lifeguard training
- `diving.jpg` - Diving board

#### Team Sports (8 images)
- `basketball.jpg` - Kids basketball court
- `soccer.jpg` - Children playing soccer
- `tennis.jpg` - Kids tennis lessons
- `badminton.jpg` - Badminton court
- `volleyball.jpg` - Volleyball net
- `hockey.jpg` - Youth ice hockey
- `baseball.jpg` - Kids baseball field
- `sports_general.jpg` - Various sports activities

#### Arts & Creative (7 images)
- `arts_crafts.jpg` - Kids art class
- `pottery.jpg` - Pottery wheel/ceramics
- `painting.jpg` - Kids painting
- `crafts.jpg` - Craft activities
- `dance.jpg` - Dance studio
- `ballet.jpg` - Ballet class
- `music.jpg` - Musical instruments

#### And 32 more categories...

## How It Works

1. **Activity Detection**: When displaying an activity, the system checks its category and subcategory
2. **Smart Matching**: Uses the `getActivityImageKey()` function to find the best matching image
3. **Fallback System**: If no exact match is found, uses keyword matching or defaults to `recreation_center.jpg`

## Next Steps

### To Replace Placeholder Images:

1. **Download Child-Friendly Images**:
   - Use the search terms in `/backend/IMAGE_DOWNLOAD_GUIDE.md`
   - Focus on images with children or no people
   - Prefer bright, colorful, engaging images
   - Landscape orientation (800x600 or similar)

2. **Recommended Image Sources**:
   - Unsplash (https://unsplash.com)
   - Pexels (https://pexels.com)
   - Pixabay (https://pixabay.com)
   - Freepik (https://freepik.com)

3. **Save Images**:
   - Replace placeholder images in `/assets/images/activities/`
   - Keep the same filenames (e.g., `swimming.jpg`, `basketball.jpg`)
   - Use JPG format with good compression (quality 85%)

4. **Test in App**:
   - Run the app and browse activities
   - Verify each activity shows an appropriate image
   - Check that images load quickly and look good

## Example Activity Mappings

- **Swimming Lessons** → `swimming.jpg`
- **Basketball (School Age)** → `basketball.jpg`
- **Early Years: Arts & Crafts** → `arts_crafts.jpg`
- **Martial Arts - Karate** → `martial_arts.jpg`
- **Summer Camp** → `summer_camp.jpg`
- **Parent & Toddler Yoga** → `yoga.jpg`

## Technical Details

The mapping logic (in order of precedence):
1. Exact category + subcategory match
2. Category-only match
3. Keyword detection in category/subcategory
4. Default fallback to `recreation_center.jpg`

This ensures every activity has an appropriate image, even if it's a new or unusual category.