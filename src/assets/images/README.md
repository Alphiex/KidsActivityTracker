# Activity Images

This directory contains free images from Unsplash for each activity type in the KidsCampTracker app.

## Image Credits

All images are from Unsplash and are free to use:

- **camps.jpg** - Summer camp/outdoor activities
- **swimming.jpg** - Swimming pool/water activities  
- **martial_arts.jpg** - Martial arts/karate training
- **dance.jpg** - Dance class/movement activities
- **visual_arts.jpg** - Art supplies/creative activities
- **learn_and_play.jpg** - Children playing/educational activities
- **early_years.jpg** - Toddler activities
- **sports.jpg** - Sports activities for kids
- **music.jpg** - Music class/instruments

## Usage

Images are mapped to activity types in the `index.ts` file. To use an image in a component:

```typescript
import { getActivityImage, getPrimaryActivityImage } from '../assets/images';

// Get image for a specific activity type
const image = getActivityImage(ActivityType.SWIMMING);

// Get image for the primary (first) activity type of a camp
const image = getPrimaryActivityImage(camp.activityType);
```

## Image Specifications

- All images are downloaded at 800px width with 80% quality
- Format: JPEG
- Optimized for mobile display