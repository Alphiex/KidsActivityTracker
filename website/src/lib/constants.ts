// API Configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kidsactivitytracker.ca';

// App Store Links
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '#';
export const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#';

// Feature List for Homepage
export const FEATURES = [
  {
    title: 'AI-Powered Search',
    description: 'Search naturally like "swimming for my 5 year old on Saturdays" and get instant results.',
    icon: 'sparkles',
  },
  {
    title: 'Smart Recommendations',
    description: 'Get AI explanations for why activities are perfect for your child\'s age and interests.',
    icon: 'star',
  },
  {
    title: 'Waitlist Alerts',
    description: 'Join waitlists for full activities and get push notifications when spots open up.',
    icon: 'bell',
  },
  {
    title: 'Family Calendar',
    description: 'Track all your children\'s activities in one calendar. Share with co-parents.',
    icon: 'calendar',
  },
  {
    title: 'Multiple Cities',
    description: 'Find activities across Canadian cities from BC to Ontario and growing.',
    icon: 'map',
  },
  {
    title: 'iOS & Android',
    description: 'Available on both platforms. Free to download with optional premium features.',
    icon: 'phone',
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
