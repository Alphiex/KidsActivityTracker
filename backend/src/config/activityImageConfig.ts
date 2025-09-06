// Activity Image Configuration
// Maps activity categories and subcategories to appropriate child-friendly images

export interface ActivityImageMapping {
  category: string;
  subcategory?: string;
  imageKey: string;
  searchTerms: string[];
}

// Image keys that will correspond to actual image files
export const ACTIVITY_IMAGES = {
  // Swimming & Aquatics
  SWIMMING_POOL: 'swimming_pool',
  SWIMMING_LESSONS: 'swimming_lessons',
  WATER_SAFETY: 'water_safety',
  DIVING: 'diving',
  
  // Sports
  BASKETBALL: 'basketball',
  SOCCER: 'soccer',
  TENNIS: 'tennis',
  BADMINTON: 'badminton',
  VOLLEYBALL: 'volleyball',
  HOCKEY: 'hockey',
  BASEBALL: 'baseball',
  MULTISPORT: 'multisport',
  
  // Dance & Movement
  DANCE_STUDIO: 'dance_studio',
  BALLET: 'ballet',
  HIP_HOP_DANCE: 'hip_hop_dance',
  
  // Arts & Crafts
  ART_SUPPLIES: 'art_supplies',
  POTTERY: 'pottery',
  PAINTING: 'painting',
  CRAFTS: 'crafts',
  
  // Music
  MUSIC_INSTRUMENTS: 'music_instruments',
  PIANO: 'piano',
  GUITAR: 'guitar',
  
  // Fitness & Wellness
  FITNESS: 'fitness',
  YOGA: 'yoga',
  CLIMBING_WALL: 'climbing_wall',
  GYM: 'gym',
  
  // Martial Arts
  MARTIAL_ARTS: 'martial_arts',
  KARATE: 'karate',
  
  // Educational
  STEM: 'stem',
  COOKING: 'cooking',
  SCIENCE: 'science',
  LEADERSHIP: 'leadership',
  
  // Outdoor & Camps
  SUMMER_CAMP: 'summer_camp',
  OUTDOOR_ADVENTURE: 'outdoor_adventure',
  NATURE: 'nature',
  PLAYGROUND: 'playground',
  
  // Early Years
  TODDLER_PLAY: 'toddler_play',
  PRESCHOOL: 'preschool',
  KIDS_ACTIVITIES: 'kids_activities',
  
  // Skating
  ICE_SKATING: 'ice_skating',
  SKATEBOARDING: 'skateboarding',
  
  // General
  COMMUNITY_CENTER: 'community_center',
  RECREATION: 'recreation',
  FAMILY_FUN: 'family_fun',
};

// Detailed mapping for each category/subcategory combination
export const activityImageMappings: ActivityImageMapping[] = [
  // Swimming
  {
    category: 'Swimming',
    imageKey: ACTIVITY_IMAGES.SWIMMING_POOL,
    searchTerms: ['kids swimming pool', 'children swimming', 'pool']
  },
  {
    category: 'Aquatic Leadership',
    imageKey: ACTIVITY_IMAGES.WATER_SAFETY,
    searchTerms: ['lifeguard', 'water safety', 'swimming pool safety']
  },
  
  // Team Sports
  {
    category: 'Team Sports',
    subcategory: 'Basketball',
    imageKey: ACTIVITY_IMAGES.BASKETBALL,
    searchTerms: ['kids basketball', 'basketball court', 'youth basketball']
  },
  {
    category: 'Team Sports',
    subcategory: 'Soccer',
    imageKey: ACTIVITY_IMAGES.SOCCER,
    searchTerms: ['kids soccer', 'soccer field', 'youth football']
  },
  {
    category: 'Team Sports',
    subcategory: 'Volleyball',
    imageKey: ACTIVITY_IMAGES.VOLLEYBALL,
    searchTerms: ['volleyball court', 'volleyball net', 'beach volleyball']
  },
  {
    category: 'Team Sports',
    subcategory: 'Hockey',
    imageKey: ACTIVITY_IMAGES.HOCKEY,
    searchTerms: ['ice hockey', 'hockey rink', 'youth hockey']
  },
  
  // Racquet Sports
  {
    category: 'Racquet Sports',
    subcategory: 'Tennis',
    imageKey: ACTIVITY_IMAGES.TENNIS,
    searchTerms: ['tennis court', 'kids tennis', 'tennis racket']
  },
  {
    category: 'Racquet Sports',
    subcategory: 'Badminton',
    imageKey: ACTIVITY_IMAGES.BADMINTON,
    searchTerms: ['badminton court', 'shuttlecock', 'badminton']
  },
  
  // Dance
  {
    category: 'Dance',
    imageKey: ACTIVITY_IMAGES.DANCE_STUDIO,
    searchTerms: ['dance studio', 'kids dancing', 'dance class']
  },
  {
    category: 'Dance',
    subcategory: 'Ballet',
    imageKey: ACTIVITY_IMAGES.BALLET,
    searchTerms: ['ballet studio', 'ballet shoes', 'ballet barre']
  },
  
  // Arts
  {
    category: 'Visual Arts',
    imageKey: ACTIVITY_IMAGES.ART_SUPPLIES,
    searchTerms: ['art supplies', 'kids art', 'painting class']
  },
  {
    category: 'Pottery',
    imageKey: ACTIVITY_IMAGES.POTTERY,
    searchTerms: ['pottery wheel', 'clay crafts', 'ceramics']
  },
  
  // Music
  {
    category: 'Music',
    imageKey: ACTIVITY_IMAGES.MUSIC_INSTRUMENTS,
    searchTerms: ['musical instruments', 'music notes', 'music class']
  },
  
  // Fitness
  {
    category: 'Movement & Fitness Dance',
    imageKey: ACTIVITY_IMAGES.FITNESS,
    searchTerms: ['kids fitness', 'exercise', 'fitness class']
  },
  {
    category: 'Strength & Cardio',
    imageKey: ACTIVITY_IMAGES.GYM,
    searchTerms: ['gym equipment', 'fitness center', 'exercise']
  },
  {
    category: 'Yoga',
    imageKey: ACTIVITY_IMAGES.YOGA,
    searchTerms: ['yoga mat', 'yoga studio', 'meditation']
  },
  
  // Climbing
  {
    category: 'Climbing',
    imageKey: ACTIVITY_IMAGES.CLIMBING_WALL,
    searchTerms: ['climbing wall', 'rock climbing', 'bouldering']
  },
  
  // Martial Arts
  {
    category: 'Martial Arts',
    imageKey: ACTIVITY_IMAGES.MARTIAL_ARTS,
    searchTerms: ['martial arts dojo', 'karate', 'taekwondo']
  },
  
  // Educational
  {
    category: 'Cooking',
    imageKey: ACTIVITY_IMAGES.COOKING,
    searchTerms: ['kids cooking', 'cooking class', 'kitchen']
  },
  {
    category: 'Certifications and Leadership',
    imageKey: ACTIVITY_IMAGES.LEADERSHIP,
    searchTerms: ['leadership', 'teamwork', 'first aid']
  },
  
  // Camps
  {
    category: 'Camps',
    imageKey: ACTIVITY_IMAGES.SUMMER_CAMP,
    searchTerms: ['summer camp', 'day camp', 'camp activities']
  },
  
  // Early Years
  {
    category: 'Early Years Playtime',
    imageKey: ACTIVITY_IMAGES.TODDLER_PLAY,
    searchTerms: ['toddler play', 'playground', 'early learning']
  },
  {
    category: 'Early Years: On My Own',
    imageKey: ACTIVITY_IMAGES.PRESCHOOL,
    searchTerms: ['preschool activities', 'early childhood', 'kids learning']
  },
  {
    category: 'Early Years: Parent Participation',
    imageKey: ACTIVITY_IMAGES.FAMILY_FUN,
    searchTerms: ['parent child activities', 'family fun', 'toddler class']
  },
  
  // Skating
  {
    category: 'Skating',
    imageKey: ACTIVITY_IMAGES.ICE_SKATING,
    searchTerms: ['ice skating rink', 'figure skating', 'ice skates']
  },
  
  // Multisport
  {
    category: 'Multisport',
    imageKey: ACTIVITY_IMAGES.MULTISPORT,
    searchTerms: ['sports variety', 'multiple sports', 'athletic activities']
  },
  
  // School Age
  {
    category: 'School Age',
    imageKey: ACTIVITY_IMAGES.KIDS_ACTIVITIES,
    searchTerms: ['school age activities', 'kids programs', 'youth activities']
  },
  
  // Youth
  {
    category: 'Youth',
    imageKey: ACTIVITY_IMAGES.RECREATION,
    searchTerms: ['youth programs', 'teen activities', 'recreation']
  },
  
  // All Ages & Family
  {
    category: 'All Ages & Family',
    imageKey: ACTIVITY_IMAGES.FAMILY_FUN,
    searchTerms: ['family activities', 'all ages', 'family fun']
  },
  
  // Default
  {
    category: 'Adult',
    imageKey: ACTIVITY_IMAGES.COMMUNITY_CENTER,
    searchTerms: ['community center', 'recreation center', 'adult programs']
  },
];

// Note: The actual getActivityImageKey function is in utils/activityHelpers.ts
// This config file just defines the mappings and constants

// Get search terms for downloading images
export function getSearchTermsForActivity(category: string, subcategory?: string): string[] {
  const mapping = activityImageMappings.find(
    m => m.category === category && 
    (subcategory ? m.subcategory === subcategory : !m.subcategory)
  );
  
  return mapping?.searchTerms || ['community center', 'kids activities'];
}