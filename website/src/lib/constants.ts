// API Configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://kids-activity-api-205843686007.us-central1.run.app';

// App Store Links
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '#';
export const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#';

// Feature List for Homepage
export const FEATURES = [
  {
    title: 'Find Activities',
    description: 'Browse swimming, sports, arts, music, and educational programs for kids of all ages.',
    icon: 'search',
  },
  {
    title: 'Filter by Age',
    description: 'Find activities perfect for your child\'s age group, from toddlers to teens.',
    icon: 'users',
  },
  {
    title: 'Track Schedules',
    description: 'Keep all your children\'s activities organized in one easy-to-use calendar.',
    icon: 'calendar',
  },
  {
    title: 'Save Favorites',
    description: 'Bookmark activities you love and get notified about registration openings.',
    icon: 'heart',
  },
  {
    title: 'Multiple Cities',
    description: 'Find activities across multiple cities in British Columbia and beyond.',
    icon: 'map',
  },
  {
    title: 'Free to Use',
    description: 'Our basic features are completely free. Upgrade for unlimited favorites and more.',
    icon: 'gift',
  },
];

// Categories
export const ACTIVITY_CATEGORIES = [
  { name: 'Swimming', icon: '🏊' },
  { name: 'Sports', icon: '⚽' },
  { name: 'Arts & Crafts', icon: '🎨' },
  { name: 'Music', icon: '🎵' },
  { name: 'Dance', icon: '💃' },
  { name: 'STEM', icon: '🔬' },
  { name: 'Nature', icon: '🌳' },
  { name: 'Camps', icon: '🏕️' },
];
