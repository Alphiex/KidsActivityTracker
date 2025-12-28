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

// Get more specific image based on category/subcategory/activity name
// IMPORTANT: Order matters! Check most specific terms FIRST, then fall back to generic categories
export const getActivityImageKey = (category: string, subcategory?: string, activityName?: string): string => {
  // Combine all available text for matching - activity name is most specific
  const parts = [activityName, subcategory, category].filter(Boolean);
  const categoryLower = parts.join(' ').toLowerCase();

  // ============================================================================
  // TIER 1: MOST SPECIFIC - Multi-word phrases and very specific activities
  // ============================================================================

  // Water activities - specific first
  if (categoryLower.includes('water polo')) return 'swimming';
  if (categoryLower.includes('water safety') || categoryLower.includes('lifeguard')) return 'water_safety';
  if (categoryLower.includes('diving') || categoryLower.includes('dive')) return 'diving';

  // Skating - specific types first
  if (categoryLower.includes('figure skating') || categoryLower.includes('figure skat')) return 'ice_skating';
  if (categoryLower.includes('ice skating') || categoryLower.includes('ice skat')) return 'ice_skating';
  if (categoryLower.includes('roller skating') || categoryLower.includes('roller blad')) return 'ice_skating';
  if (categoryLower.includes('skateboard') || categoryLower.includes('skate park')) return 'skateboarding';

  // Dance - specific styles
  if (categoryLower.includes('ballet') || categoryLower.includes('pointe')) return 'ballet';
  if (categoryLower.includes('hip hop') || categoryLower.includes('hip-hop') ||
      categoryLower.includes('hiphop') || categoryLower.includes('street dance')) return 'hip_hop_dance';
  if (categoryLower.includes('jazz dance')) return 'dance';
  if (categoryLower.includes('tap dance')) return 'dance';
  if (categoryLower.includes('ballroom')) return 'dance';
  if (categoryLower.includes('contemporary')) return 'dance';

  // Martial arts - specific styles
  if (categoryLower.includes('kung fu')) return 'martial_arts';
  if (categoryLower.includes('jiu jitsu') || categoryLower.includes('jujitsu')) return 'martial_arts';
  if (categoryLower.includes('tae kwon do') || categoryLower.includes('taekwondo')) return 'martial_arts';
  if (categoryLower.includes('karate')) return 'karate';
  if (categoryLower.includes('judo')) return 'martial_arts';
  if (categoryLower.includes('aikido')) return 'martial_arts';

  // Fitness - specific types
  if (categoryLower.includes('cross country')) return 'running';
  if (categoryLower.includes('track and field') || categoryLower.includes('track & field')) return 'running';
  if (categoryLower.includes('boot camp') || categoryLower.includes('bootcamp')) return 'fitness';

  // Educational - specific
  if (categoryLower.includes('story time') || categoryLower.includes('storytime')) return 'reading';
  if (categoryLower.includes('summer program')) return 'summer_camp';
  if (categoryLower.includes('first aid')) return 'leadership';

  // Special programs - specific
  if (categoryLower.includes('night out')) return 'kids_night_out';
  if (categoryLower.includes('drop-in') || categoryLower.includes('drop in')) return 'kids_night_out';
  if (categoryLower.includes('early years')) return 'early_years';
  if (categoryLower.includes('pre-school')) return 'preschool';

  // ============================================================================
  // TIER 2: SPECIFIC SINGLE-WORD ACTIVITIES (unambiguous activity names)
  // ============================================================================

  // Sports - specific
  if (categoryLower.includes('basketball')) return 'basketball';
  if (categoryLower.includes('soccer')) return 'soccer';
  if (categoryLower.includes('hockey')) return 'hockey';
  if (categoryLower.includes('volleyball')) return 'volleyball';
  if (categoryLower.includes('baseball')) return 'baseball';
  if (categoryLower.includes('softball')) return 'baseball';
  if (categoryLower.includes('tennis')) return 'tennis';
  if (categoryLower.includes('badminton')) return 'badminton';
  if (categoryLower.includes('squash')) return 'racquet_sports';
  if (categoryLower.includes('pickleball')) return 'racquet_sports';
  if (categoryLower.includes('lacrosse')) return 'sports_general';
  if (categoryLower.includes('rugby')) return 'sports_general';
  if (categoryLower.includes('football')) return 'soccer';

  // Movement & fitness - specific
  if (categoryLower.includes('gymnastics') || categoryLower.includes('gymnastic')) return 'gymnastics';
  if (categoryLower.includes('tumbling') || categoryLower.includes('tumbl')) return 'gymnastics';
  if (categoryLower.includes('acrobat')) return 'gymnastics';
  if (categoryLower.includes('cheerleading') || categoryLower.includes('cheer')) return 'cheerleading';
  if (categoryLower.includes('yoga')) return 'yoga';
  if (categoryLower.includes('pilates')) return 'yoga';
  if (categoryLower.includes('climbing') || categoryLower.includes('bouldering')) return 'climbing';
  if (categoryLower.includes('running')) return 'running';
  if (categoryLower.includes('skiing') || categoryLower.includes('ski ')) return 'skiing';
  if (categoryLower.includes('snowboard')) return 'skiing';
  if (categoryLower.includes('hiking')) return 'hiking';

  // Swimming - after water-specific checks
  if (categoryLower.includes('swimming') || categoryLower.includes('swim')) return 'swimming';
  if (categoryLower.includes('aquatic') || categoryLower.includes('aqua')) return 'swimming';

  // Music - specific instruments
  if (categoryLower.includes('piano')) return 'piano';
  if (categoryLower.includes('keyboard')) return 'piano';
  if (categoryLower.includes('guitar')) return 'guitar';
  if (categoryLower.includes('ukulele')) return 'guitar';
  if (categoryLower.includes('drums') || categoryLower.includes('drum')) return 'drums';
  if (categoryLower.includes('percussion')) return 'drums';
  if (categoryLower.includes('violin')) return 'music';
  if (categoryLower.includes('flute')) return 'music';

  // Arts - specific types
  if (categoryLower.includes('pottery')) return 'pottery';
  if (categoryLower.includes('ceramic')) return 'pottery';
  if (categoryLower.includes('clay')) return 'pottery';
  if (categoryLower.includes('painting')) return 'painting';
  if (categoryLower.includes('watercolor')) return 'painting';
  if (categoryLower.includes('acrylic')) return 'painting';
  if (categoryLower.includes('theater') || categoryLower.includes('theatre')) return 'theater';
  if (categoryLower.includes('drama')) return 'theater';
  if (categoryLower.includes('acting')) return 'theater';
  if (categoryLower.includes('improv')) return 'theater';

  // Educational - specific
  if (categoryLower.includes('cooking') || categoryLower.includes('cook')) return 'cooking';
  if (categoryLower.includes('culinary')) return 'cooking';
  if (categoryLower.includes('baking')) return 'cooking';
  if (categoryLower.includes('science')) return 'science';
  if (categoryLower.includes('robotics') || categoryLower.includes('robot')) return 'stem';
  if (categoryLower.includes('coding')) return 'stem';
  if (categoryLower.includes('programming')) return 'stem';
  if (categoryLower.includes('lego')) return 'stem';
  if (categoryLower.includes('french')) return 'language';
  if (categoryLower.includes('spanish')) return 'language';
  if (categoryLower.includes('mandarin')) return 'language';
  if (categoryLower.includes('reading')) return 'reading';
  if (categoryLower.includes('library')) return 'reading';
  if (categoryLower.includes('literacy')) return 'reading';

  // Outdoor - specific
  if (categoryLower.includes('camping') || categoryLower.includes('camp')) return 'summer_camp';
  if (categoryLower.includes('nature')) return 'nature';
  if (categoryLower.includes('wildlife')) return 'nature';
  if (categoryLower.includes('forest')) return 'nature';
  if (categoryLower.includes('garden')) return 'nature';

  // Age-specific - specific terms
  if (categoryLower.includes('toddler')) return 'early_years';
  if (categoryLower.includes('infant')) return 'early_years';
  if (categoryLower.includes('baby')) return 'early_years';
  if (categoryLower.includes('preschool')) return 'preschool';
  if (categoryLower.includes('kindergarten')) return 'preschool';

  // Special certifications
  if (categoryLower.includes('babysit')) return 'leadership';
  if (categoryLower.includes('leadership')) return 'leadership';
  if (categoryLower.includes('certification')) return 'leadership';

  // ============================================================================
  // TIER 3: CATEGORY-LEVEL (broader terms - only match if nothing specific matched)
  // ============================================================================

  if (categoryLower.includes('skating') || categoryLower.includes('skate')) return 'ice_skating';
  if (categoryLower.includes('dance') || categoryLower.includes('dancing')) return 'dance';
  if (categoryLower.includes('martial')) return 'martial_arts';
  if (categoryLower.includes('music') || categoryLower.includes('choir') ||
      categoryLower.includes('singing') || categoryLower.includes('vocal') ||
      categoryLower.includes('orchestra') || categoryLower.includes('band')) return 'music';
  if (categoryLower.includes('craft') || categoryLower.includes('crafting') ||
      categoryLower.includes('sewing') || categoryLower.includes('knitting')) return 'crafts';
  if (categoryLower.includes('paint') || categoryLower.includes('drawing') ||
      categoryLower.includes('draw') || categoryLower.includes('sketch')) return 'painting';
  if (categoryLower.includes('art') || categoryLower.includes('creative') ||
      categoryLower.includes('visual')) return 'arts_crafts';
  if (categoryLower.includes('fitness') || categoryLower.includes('workout') ||
      categoryLower.includes('exercise') || categoryLower.includes('cardio')) return 'fitness';
  if (categoryLower.includes('gym')) return 'gym';
  if (categoryLower.includes('stem') || categoryLower.includes('technology') ||
      categoryLower.includes('engineering') || categoryLower.includes('computer')) return 'stem';
  if (categoryLower.includes('language')) return 'language';
  if (categoryLower.includes('book')) return 'reading';
  if (categoryLower.includes('outdoor') || categoryLower.includes('adventure')) return 'outdoor';
  if (categoryLower.includes('trail')) return 'hiking';
  if (categoryLower.includes('racquet')) return 'racquet_sports';
  if (categoryLower.includes('track')) return 'running';
  if (categoryLower.includes('performance')) return 'theater';
  if (categoryLower.includes('playground') ||
      (categoryLower.includes('play') && categoryLower.includes('ground'))) return 'playground';

  // ============================================================================
  // TIER 4: VERY GENERIC (demographic/age-based - last resort before default)
  // ============================================================================

  if (categoryLower.includes('youth') || categoryLower.includes('teen') ||
      categoryLower.includes('junior')) return 'youth_activities';
  if (categoryLower.includes('multisport') || categoryLower.includes('multi-sport')) return 'sports_general';
  if (categoryLower.includes('sport') || categoryLower.includes('athletic')) return 'sports_general';
  if (categoryLower.includes('kid') || categoryLower.includes('child')) return 'kids_activities';
  if (categoryLower.includes('family')) return 'family_fun';
  if (categoryLower.includes('recreation') || categoryLower.includes('rec ')) return 'recreation_center';
  if (categoryLower.includes('community')) return 'community_center';

  // ============================================================================
  // DEFAULT: Generic recreation center image
  // ============================================================================
  return 'recreation_center';
};