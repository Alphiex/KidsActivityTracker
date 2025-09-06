import { ActivityType } from '../types';

// Map category strings from backend to ActivityType enum
export const mapCategoryToActivityType = (category: string): ActivityType => {
  const categoryLower = category.toLowerCase();
  
  // Check for swimming-related categories
  if (categoryLower.includes('swim') || categoryLower.includes('aqua')) {
    return ActivityType.SWIMMING;
  }
  
  // Check for camps
  if (categoryLower.includes('camp')) {
    return ActivityType.CAMPS;
  }
  
  // Check for skating (separate from other sports)
  if (categoryLower.includes('skating') || categoryLower.includes('skate')) {
    return ActivityType.SPORTS; // Still categorize as sports but handle image separately
  }
  
  // Check for sports
  if (categoryLower.includes('sport') || 
      categoryLower.includes('basketball') || 
      categoryLower.includes('soccer') || 
      categoryLower.includes('tennis') ||
      categoryLower.includes('hockey') ||
      categoryLower.includes('baseball') ||
      categoryLower.includes('football') ||
      categoryLower.includes('volleyball') ||
      categoryLower.includes('martial') ||
      categoryLower.includes('karate') ||
      categoryLower.includes('gymnastics') ||
      categoryLower.includes('climbing') ||
      categoryLower.includes('fitness')) {
    return ActivityType.SPORTS;
  }
  
  // Check for arts
  if (categoryLower.includes('art') || 
      categoryLower.includes('dance') || 
      categoryLower.includes('music') || 
      categoryLower.includes('theater') ||
      categoryLower.includes('theatre') ||
      categoryLower.includes('drama') ||
      categoryLower.includes('paint') ||
      categoryLower.includes('draw') ||
      categoryLower.includes('craft') ||
      categoryLower.includes('pottery') ||
      categoryLower.includes('visual')) {
    return ActivityType.ARTS;
  }
  
  // Check for education
  if (categoryLower.includes('learn') || 
      categoryLower.includes('education') ||
      categoryLower.includes('science') ||
      categoryLower.includes('stem') ||
      categoryLower.includes('coding') ||
      categoryLower.includes('technology') ||
      categoryLower.includes('school')) {
    return ActivityType.EDUCATION;
  }
  
  // Default to general
  return ActivityType.GENERAL;
};

// Get more specific image based on category/subcategory
export const getActivityImageKey = (category: string, subcategory?: string): string => {
  const fullCategory = subcategory ? `${category} ${subcategory}` : category;
  const categoryLower = fullCategory.toLowerCase();
  
  // Swimming and water activities
  if (categoryLower.includes('swim') || categoryLower.includes('aquatic')) {
    return 'swimming';
  }
  
  // Martial arts
  if (categoryLower.includes('martial') || categoryLower.includes('karate') || 
      categoryLower.includes('taekwondo') || categoryLower.includes('judo')) {
    return 'martial_arts';
  }
  
  // Dance
  if (categoryLower.includes('dance') || categoryLower.includes('ballet')) {
    return 'dance';
  }
  
  // Skating activities
  if (categoryLower.includes('skating') || categoryLower.includes('skate')) {
    return 'ice_skating';
  }
  
  // Team sports
  if (categoryLower.includes('basketball')) return 'basketball';
  if (categoryLower.includes('soccer') || categoryLower.includes('football')) return 'soccer';
  if (categoryLower.includes('hockey')) return 'hockey';
  if (categoryLower.includes('volleyball')) return 'volleyball';
  if (categoryLower.includes('baseball')) return 'baseball';
  
  // Racquet sports
  if (categoryLower.includes('tennis')) return 'tennis';
  if (categoryLower.includes('badminton')) return 'badminton';
  if (categoryLower.includes('racquet')) return 'racquet_sports';
  
  // Music (check before arts to avoid false matches)
  if (categoryLower.includes('music') || categoryLower.includes('piano') || 
      categoryLower.includes('guitar') || categoryLower.includes('drum')) {
    return 'music';
  }
  
  // Pottery (check before arts_crafts)
  if (categoryLower.includes('pottery') || categoryLower.includes('clay')) {
    return 'pottery';
  }
  
  // Arts and crafts (more general, check last)
  if (categoryLower.includes('art') || categoryLower.includes('paint') || 
      categoryLower.includes('draw') || categoryLower.includes('craft')) {
    return 'arts_crafts';
  }
  
  // Fitness and wellness
  if (categoryLower.includes('fitness') || categoryLower.includes('gym') || 
      categoryLower.includes('strength') || categoryLower.includes('cardio')) {
    return 'fitness';
  }
  if (categoryLower.includes('yoga')) return 'yoga';
  if (categoryLower.includes('climb')) return 'climbing';
  
  // Cooking (check early to avoid arts match)
  if (categoryLower.includes('cook') || categoryLower.includes('culinary')) {
    return 'cooking';
  }
  
  // Educational
  if (categoryLower.includes('stem') || categoryLower.includes('science') || 
      categoryLower.includes('technology') || categoryLower.includes('engineering')) {
    return 'stem';
  }
  if (categoryLower.includes('language')) return 'language';
  
  // Outdoor activities
  if (categoryLower.includes('camp')) return 'summer_camp';
  if (categoryLower.includes('outdoor') || categoryLower.includes('nature')) {
    return 'outdoor';
  }
  if (categoryLower.includes('hiking')) return 'hiking';
  
  // Age-specific
  if (categoryLower.includes('early years') || categoryLower.includes('toddler') || 
      categoryLower.includes('preschool')) {
    return 'early_years';
  }
  if (categoryLower.includes('youth') || categoryLower.includes('teen')) {
    return 'youth_activities';
  }
  
  // Special programs
  if (categoryLower.includes('leadership') || categoryLower.includes('babysit')) {
    return 'leadership';
  }
  if (categoryLower.includes('night out')) return 'kids_night_out';
  
  // Multi-sport or general
  if (categoryLower.includes('multisport') || categoryLower.includes('sport')) {
    return 'sports_general';
  }
  
  // Default - use general recreation center image
  return 'recreation_center';
};