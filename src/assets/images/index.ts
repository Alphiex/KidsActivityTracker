import { ActivityType } from '../../types';

// Activity type image mapping
export const activityImages = {
  [ActivityType.CAMPS]: require('./camps.jpg'),
  [ActivityType.SWIMMING]: require('./swimming.jpg'),
  [ActivityType.MARTIAL_ARTS]: require('./martial_arts.jpg'),
  [ActivityType.DANCE]: require('./dance.jpg'),
  [ActivityType.VISUAL_ARTS]: require('./visual_arts.jpg'),
  [ActivityType.LEARN_AND_PLAY]: require('./learn_and_play.jpg'),
  [ActivityType.EARLY_YEARS]: require('./early_years.jpg'),
  [ActivityType.SPORTS]: require('./sports.jpg'),
  [ActivityType.MUSIC]: require('./music.jpg'),
  [ActivityType.GENERAL]: require('./learn_and_play.jpg'), // For general activities
};

// Helper function to get image for activity type
export const getActivityImage = (activityType: ActivityType) => {
  return activityImages[activityType] || activityImages[ActivityType.CAMPS];
};

// Get primary activity image (first activity type)
export const getPrimaryActivityImage = (activityTypes: ActivityType[]) => {
  if (activityTypes.length === 0) {
    return activityImages[ActivityType.CAMPS];
  }
  return getActivityImage(activityTypes[0]);
};