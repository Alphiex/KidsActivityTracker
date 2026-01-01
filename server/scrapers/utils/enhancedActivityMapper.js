/**
 * Enhanced Activity Mapper
 * Maps scraped activities to the new activity type/subtype structure
 * and detects parent participation requirements
 */

const { PrismaClient } = require('../../generated/prisma');

// Mapping of common activity names to our standardized types and subtypes
const ACTIVITY_TYPE_MAPPINGS = {
  // Swimming & Aquatics
  'swimming': { type: 'Swimming & Aquatics', subtype: 'Learn to Swim' },
  'swimming lessons': { type: 'Swimming & Aquatics', subtype: 'Learn to Swim' },
  'swim lessons': { type: 'Swimming & Aquatics', subtype: 'Learn to Swim' },
  'aquafit': { type: 'Swimming & Aquatics', subtype: 'Aqua Fitness' },
  'aqua fitness': { type: 'Swimming & Aquatics', subtype: 'Aqua Fitness' },
  'water polo': { type: 'Swimming & Aquatics', subtype: 'Water Polo' },
  'diving': { type: 'Swimming & Aquatics', subtype: 'Diving' },
  'synchronized swimming': { type: 'Swimming & Aquatics', subtype: 'Synchronized Swimming' },
  'lifeguarding': { type: 'Swimming & Aquatics', subtype: 'Lifeguarding' },
  'parent & tot swim': { type: 'Swimming & Aquatics', subtype: 'Parent & Tot Swim', requiresParent: true },
  'parent and tot swim': { type: 'Swimming & Aquatics', subtype: 'Parent & Tot Swim', requiresParent: true },
  
  // Sports - Team
  'basketball': { type: 'Sports - Team', subtype: 'Basketball' },
  'soccer': { type: 'Sports - Team', subtype: 'Soccer' },
  'hockey': { type: 'Sports - Team', subtype: 'Hockey' },
  'ice hockey': { type: 'Sports - Team', subtype: 'Hockey' },
  'baseball': { type: 'Sports - Team', subtype: 'Baseball' },
  'volleyball': { type: 'Sports - Team', subtype: 'Volleyball' },
  'football': { type: 'Sports - Team', subtype: 'Football' },
  'rugby': { type: 'Sports - Team', subtype: 'Rugby' },
  'lacrosse': { type: 'Sports - Team', subtype: 'Lacrosse' },
  
  // Sports - Individual
  'tennis': { type: 'Sports - Individual', subtype: 'Tennis' },
  'badminton': { type: 'Sports - Individual', subtype: 'Badminton' },
  'squash': { type: 'Sports - Individual', subtype: 'Squash' },
  'golf': { type: 'Sports - Individual', subtype: 'Golf' },
  'archery': { type: 'Sports - Individual', subtype: 'Archery' },
  'track and field': { type: 'Sports - Individual', subtype: 'Track & Field' },
  'cross country': { type: 'Sports - Individual', subtype: 'Cross Country' },
  
  // Arts & Crafts
  'arts and crafts': { type: 'Arts & Crafts', subtype: 'Mixed Media' },
  'art': { type: 'Arts & Crafts', subtype: 'Mixed Media' },
  'painting': { type: 'Arts & Crafts', subtype: 'Painting' },
  'drawing': { type: 'Arts & Crafts', subtype: 'Drawing' },
  'pottery': { type: 'Arts & Crafts', subtype: 'Pottery' },
  'ceramics': { type: 'Arts & Crafts', subtype: 'Pottery' },
  'sculpture': { type: 'Arts & Crafts', subtype: 'Sculpture' },
  'photography': { type: 'Arts & Crafts', subtype: 'Photography' },
  
  // Dance
  'dance': { type: 'Dance', subtype: 'General Dance' },
  'ballet': { type: 'Dance', subtype: 'Ballet' },
  'hip hop': { type: 'Dance', subtype: 'Hip Hop' },
  'jazz dance': { type: 'Dance', subtype: 'Jazz' },
  'tap dance': { type: 'Dance', subtype: 'Tap' },
  'contemporary dance': { type: 'Dance', subtype: 'Contemporary' },
  'ballroom': { type: 'Dance', subtype: 'Ballroom' },
  
  // Music
  'music': { type: 'Music', subtype: 'General Music' },
  'piano': { type: 'Music', subtype: 'Piano' },
  'guitar': { type: 'Music', subtype: 'Guitar' },
  'violin': { type: 'Music', subtype: 'Violin' },
  'drums': { type: 'Music', subtype: 'Drums' },
  'singing': { type: 'Music', subtype: 'Voice/Singing' },
  'choir': { type: 'Music', subtype: 'Voice/Singing' },
  'band': { type: 'Music', subtype: 'Band' },
  
  // Martial Arts
  'martial arts': { type: 'Martial Arts', subtype: 'Mixed Martial Arts' },
  'karate': { type: 'Martial Arts', subtype: 'Karate' },
  'taekwondo': { type: 'Martial Arts', subtype: 'Taekwondo' },
  'tkd': { type: 'Martial Arts', subtype: 'Taekwondo' },
  'judo': { type: 'Martial Arts', subtype: 'Judo' },
  'kung fu': { type: 'Martial Arts', subtype: 'Kung Fu' },
  'aikido': { type: 'Martial Arts', subtype: 'Aikido' },
  'self defense': { type: 'Martial Arts', subtype: 'Self Defense' },
  'self-defense': { type: 'Martial Arts', subtype: 'Self Defense' },
  'urban defense': { type: 'Martial Arts', subtype: 'Self Defense' },
  'boxing': { type: 'Martial Arts', subtype: 'Boxing' },
  'kickboxing': { type: 'Martial Arts', subtype: 'Kickboxing' },
  'jiu-jitsu': { type: 'Martial Arts', subtype: 'Jiu-Jitsu' },
  'jiu jitsu': { type: 'Martial Arts', subtype: 'Jiu-Jitsu' },
  'mma': { type: 'Martial Arts', subtype: 'Mixed Martial Arts' },
  'board breaking': { type: 'Martial Arts', subtype: 'Demonstration' },
  
  // Gymnastics
  'gymnastics': { type: 'Gymnastics', subtype: 'Artistic Gymnastics' },
  'rhythmic gymnastics': { type: 'Gymnastics', subtype: 'Rhythmic Gymnastics' },
  'trampoline': { type: 'Gymnastics', subtype: 'Trampoline' },
  'tumbling': { type: 'Gymnastics', subtype: 'Tumbling' },
  
  // Ice Sports
  'skating': { type: 'Ice Sports', subtype: 'Ice Skating' },
  'ice skating': { type: 'Ice Sports', subtype: 'Ice Skating' },
  'figure skating': { type: 'Ice Sports', subtype: 'Figure Skating' },
  'speed skating': { type: 'Ice Sports', subtype: 'Speed Skating' },
  'curling': { type: 'Ice Sports', subtype: 'Curling' },
  
  // Camps
  'day camp': { type: 'Camps', subtype: 'Day Camp' },
  'summer camp': { type: 'Camps', subtype: 'Summer Camp' },
  'spring break camp': { type: 'Camps', subtype: 'Holiday Camp' },
  'winter break camp': { type: 'Camps', subtype: 'Holiday Camp' },
  'pd day camp': { type: 'Camps', subtype: 'PD Day Camp' },
  'sports camp': { type: 'Camps', subtype: 'Sports Camp' },
  'art camp': { type: 'Camps', subtype: 'Arts Camp' },
  'stem camp': { type: 'Camps', subtype: 'STEM Camp' },
  
  // Fitness
  'fitness': { type: 'Fitness', subtype: 'General Fitness' },
  'yoga': { type: 'Fitness', subtype: 'Yoga' },
  'pilates': { type: 'Fitness', subtype: 'Pilates' },
  'crossfit': { type: 'Fitness', subtype: 'CrossFit' },
  'zumba': { type: 'Fitness', subtype: 'Zumba' },
  'aerobics': { type: 'Fitness', subtype: 'Aerobics' },
  'bootcamp': { type: 'Fitness', subtype: 'Bootcamp' },
  
  // Parent & Child
  'parent and child': { type: 'Parent & Child', subtype: 'General Activities', requiresParent: true },
  'parent and tot': { type: 'Parent & Child', subtype: 'Parent & Tot', requiresParent: true },
  'mommy and me': { type: 'Parent & Child', subtype: 'Parent & Tot', requiresParent: true },
  'daddy and me': { type: 'Parent & Child', subtype: 'Parent & Tot', requiresParent: true },
  'family': { type: 'Parent & Child', subtype: 'Family Activities', requiresParent: true },

  // Special Needs Programs
  'special needs': { type: 'Special Needs Programs', subtype: 'Other Special Needs' },
  'adaptive': { type: 'Special Needs Programs', subtype: 'Adaptive Sports' },
  'adaptive sports': { type: 'Special Needs Programs', subtype: 'Adaptive Sports' },
  'adaptive swimming': { type: 'Special Needs Programs', subtype: 'Adaptive Sports' },
  'inclusive': { type: 'Special Needs Programs', subtype: 'Other Special Needs' },
  'sensory': { type: 'Special Needs Programs', subtype: 'Sensory Programs' },
  'sensory friendly': { type: 'Special Needs Programs', subtype: 'Sensory Programs' },
  'autism': { type: 'Special Needs Programs', subtype: 'Other Special Needs' },
  'asd': { type: 'Special Needs Programs', subtype: 'Other Special Needs' },
  'therapeutic': { type: 'Special Needs Programs', subtype: 'Therapeutic Recreation' },
  'therapeutic recreation': { type: 'Special Needs Programs', subtype: 'Therapeutic Recreation' },
  'social skills': { type: 'Special Needs Programs', subtype: 'Social Skills' },
  'life skills': { type: 'Special Needs Programs', subtype: 'Life Skills' },
};

// Parent participation keywords
const PARENT_KEYWORDS = [
  'parent', 'mom', 'dad', 'family', 'guardian', 'caregiver',
  'adult supervision', 'accompanied', 'with adult',
  'parent and child', 'parent & child', 'parent and tot', 'parent & tot',
  'mommy and me', 'daddy and me', 'family class'
];

// Age-based category mappings
const AGE_CATEGORIES = [
  { code: 'baby-parent', name: 'Baby & Parent', ageMin: 0, ageMax: 1, requiresParent: true },
  { code: 'preschool', name: 'Preschool', ageMin: 2, ageMax: 4, requiresParent: false },
  { code: 'school-age', name: 'School Age', ageMin: 5, ageMax: 13, requiresParent: false },
  { code: 'teen', name: 'Teen', ageMin: 14, ageMax: 18, requiresParent: false },
  { code: 'all-ages', name: 'All Ages', ageMin: 0, ageMax: 99, requiresParent: false }
];

class EnhancedActivityMapper {
  constructor() {
    this.prisma = new PrismaClient();
    this.activityTypesCache = null;
    this.categoriesCache = null;
  }

  async initialize() {
    // Load activity types and categories from database
    try {
      this.activityTypesCache = await this.prisma.activityType.findMany({
        include: { subtypes: true }
      });
      this.categoriesCache = await this.prisma.category.findMany();
    } catch (error) {
      console.warn('Could not load activity types from database, using defaults');
      this.activityTypesCache = [];
      this.categoriesCache = AGE_CATEGORIES;
    }
  }

  /**
   * Map camp activities to appropriate camp subtype
   * Called when "camp" is detected in the activity name
   */
  mapCampSubtype(searchText) {
    // Activity-specific camps (check first - most specific)
    if (/swim|aqua|water/.test(searchText)) {
      return { type: 'Camps', subtype: 'Swimming Camps', confidence: 0.95 };
    }
    if (/soccer|basketball|hockey|volleyball|baseball|football|lacrosse|team sport/.test(searchText)) {
      return { type: 'Camps', subtype: 'Team Sports Camps', confidence: 0.95 };
    }
    if (/tennis|badminton|squash|pickleball|racquet/.test(searchText)) {
      return { type: 'Camps', subtype: 'Racquet Sports Camps', confidence: 0.95 };
    }
    if (/golf|archery|track|running|cycling/.test(searchText)) {
      return { type: 'Camps', subtype: 'Individual Sports Camps', confidence: 0.95 };
    }
    if (/dance|ballet|jazz|hip hop|tap/.test(searchText)) {
      return { type: 'Camps', subtype: 'Dance Camps', confidence: 0.95 };
    }
    if (/music|piano|guitar|drum|violin|band|orchestra/.test(searchText)) {
      return { type: 'Camps', subtype: 'Music Camps', confidence: 0.95 };
    }
    if (/drama|theatre|theater|acting|improv|perform/.test(searchText)) {
      return { type: 'Camps', subtype: 'Performing Arts Camps', confidence: 0.95 };
    }
    if (/art|paint|draw|pottery|craft|sculpt/.test(searchText)) {
      return { type: 'Camps', subtype: 'Visual Arts Camps', confidence: 0.95 };
    }
    if (/martial|karate|taekwondo|judo|kung fu|boxing|kickbox/.test(searchText)) {
      return { type: 'Camps', subtype: 'Martial Arts Camps', confidence: 0.95 };
    }
    if (/gymnast|tumbl|trampoline|parkour|acro/.test(searchText)) {
      return { type: 'Camps', subtype: 'Gymnastics Camps', confidence: 0.95 };
    }
    if (/skat|ice|roller|figure/.test(searchText)) {
      return { type: 'Camps', subtype: 'Skating Camps', confidence: 0.95 };
    }
    if (/stem|science|tech|coding|robot|engineer/.test(searchText)) {
      return { type: 'Camps', subtype: 'STEM Camps', confidence: 0.95 };
    }
    if (/outdoor|adventure|nature|hiking|climb/.test(searchText)) {
      return { type: 'Camps', subtype: 'Outdoor Adventure Camps', confidence: 0.95 };
    }
    if (/cook|culinary|baking|chef/.test(searchText)) {
      return { type: 'Camps', subtype: 'Cooking Camps', confidence: 0.95 };
    }
    if (/language|french|spanish|mandarin/.test(searchText)) {
      return { type: 'Camps', subtype: 'Language Camps', confidence: 0.95 };
    }

    // Seasonal camps
    if (/march break|spring break/.test(searchText)) {
      return { type: 'Camps', subtype: 'March Break Camps', confidence: 0.9 };
    }
    if (/summer/.test(searchText)) {
      return { type: 'Camps', subtype: 'Summer Camps', confidence: 0.9 };
    }
    if (/winter|christmas|holiday/.test(searchText)) {
      return { type: 'Camps', subtype: 'Winter Camps', confidence: 0.9 };
    }

    // Format-based camps
    if (/overnight|residential|sleepover/.test(searchText)) {
      return { type: 'Camps', subtype: 'Overnight Camps', confidence: 0.85 };
    }
    if (/multi|general|variety|explorer/.test(searchText)) {
      return { type: 'Camps', subtype: 'Multi-Activity Camps', confidence: 0.85 };
    }

    // Generic sports fallback
    if (/sport/.test(searchText)) {
      return { type: 'Camps', subtype: 'Sports Camps', confidence: 0.8 };
    }

    // Default camp
    return { type: 'Camps', subtype: 'Day Camps', confidence: 0.8 };
  }

  /**
   * Map scraped activity to standardized type and subtype
   */
  mapActivityType(activityName, sectionName = '') {
    if (!activityName) {
      return { type: 'Other Activity', subtype: 'General', confidence: 0.1 };
    }

    const searchText = `${activityName} ${sectionName}`.toLowerCase().trim();

    // PRIORITY CHECK: If camp-related keywords found, ALWAYS categorize as Camps
    // Detects: "camp" in name, OR section/category names that imply camps
    // (e.g., "March Break", "Spring Break", "PA Day", "PD Day", "Summer Programs")
    const campPattern = /camp|march break|spring break|pa day|pd day|pro.?d day|holiday program|winter break|christmas break|summer program/i;
    if (campPattern.test(searchText)) {
      return this.mapCampSubtype(searchText);
    }

    // Try exact mapping first
    for (const [keyword, mapping] of Object.entries(ACTIVITY_TYPE_MAPPINGS)) {
      if (searchText.includes(keyword)) {
        return { ...mapping, confidence: 0.9 };
      }
    }

    // Try fuzzy matching with section name
    if (sectionName) {
      const sectionLower = sectionName.toLowerCase();
      
      // Common section to type mappings
      if (sectionLower.includes('swim') || sectionLower.includes('aquatic')) {
        return { type: 'Swimming & Aquatics', subtype: 'Learn to Swim', confidence: 0.7 };
      }
      if (sectionLower.includes('martial') || sectionLower.includes('karate') || sectionLower.includes('taekwondo')) {
        return { type: 'Martial Arts', subtype: 'Mixed Martial Arts', confidence: 0.8 };
      }
      if (sectionLower.includes('dance')) {
        return { type: 'Dance', subtype: 'General Dance', confidence: 0.7 };
      }
      if (sectionLower.includes('sport')) {
        return { type: 'Sports - Team', subtype: 'Multi-Sport', confidence: 0.6 };
      }
      if (sectionLower.includes('art') || sectionLower.includes('visual')) {
        return { type: 'Arts & Crafts', subtype: 'Mixed Media', confidence: 0.7 };
      }
      if (sectionLower.includes('music')) {
        return { type: 'Music', subtype: 'General Music', confidence: 0.7 };
      }
      if (sectionLower.includes('fitness')) {
        return { type: 'Fitness', subtype: 'General Fitness', confidence: 0.7 };
      }
      if (sectionLower.includes('camp')) {
        return { type: 'Camps', subtype: 'Day Camp', confidence: 0.7 };
      }
      if (sectionLower.includes('gymnastics')) {
        return { type: 'Gymnastics', subtype: 'Artistic Gymnastics', confidence: 0.7 };
      }
      if (sectionLower.includes('skating') || sectionLower.includes('ice')) {
        return { type: 'Ice Sports', subtype: 'Ice Skating', confidence: 0.7 };
      }
    }

    // Default to Other Activity
    return { 
      type: 'Other Activity', 
      subtype: this.sanitizeSubtype(activityName), 
      confidence: 0.3 
    };
  }

  /**
   * Detect if parent participation is required
   */
  detectParentParticipation(activity) {
    // Rule 1: Ages 1 and under ALWAYS require parent
    if (activity.ageMin !== null && activity.ageMin <= 1) {
      return { required: true, involvement: 'full', confidence: 1.0 };
    }
    if (activity.ageMax !== null && activity.ageMax <= 1) {
      return { required: true, involvement: 'full', confidence: 1.0 };
    }

    // Rule 1.5: Check if activity is in Parent Participation section
    const section = (activity.section || activity.category || '').toLowerCase();
    if (section.includes('parent participation')) {
      return { required: true, involvement: 'full', confidence: 1.0 };
    }

    // Rule 2: Check for parent keywords in various fields
    const searchText = `
      ${activity.name || ''} 
      ${activity.description || ''} 
      ${activity.activityType || ''}
      ${activity.category || ''}
      ${activity.subcategory || ''}
      ${activity.section || ''}
      ${activity.details || ''}
      ${activity.whatToBring || ''}
    `.toLowerCase();

    for (const keyword of PARENT_KEYWORDS) {
      if (searchText.includes(keyword)) {
        // Determine involvement level
        const involvement = searchText.includes('drop off') ? 'drop-off' :
                          searchText.includes('optional') ? 'optional' :
                          searchText.includes('watch') ? 'watch' : 'full';
        
        return { required: true, involvement, confidence: 0.9 };
      }
    }

    // Rule 3: Check activity type mapping
    const typeMapping = this.mapActivityType(activity.name, activity.activityType);
    if (typeMapping.requiresParent) {
      return { required: true, involvement: 'full', confidence: 0.8 };
    }

    return { required: false, involvement: null, confidence: 0.95 };
  }

  /**
   * Assign age-based categories to activity
   */
  assignCategories(activity) {
    const categories = [];
    
    // If no age range specified, assign to all-ages
    if ((activity.ageMin === null || activity.ageMin === undefined) && 
        (activity.ageMax === null || activity.ageMax === undefined)) {
      categories.push('all-ages');
      return categories;
    }

    const ageMin = activity.ageMin || 0;
    const ageMax = activity.ageMax || 99;

    // Check each category for overlap
    for (const category of AGE_CATEGORIES) {
      // Check if activity age range overlaps with category age range
      if (ageMax >= category.ageMin && ageMin <= category.ageMax) {
        categories.push(category.code);
      }
    }

    // If no categories matched, default to all-ages
    if (categories.length === 0) {
      categories.push('all-ages');
    }

    return categories;
  }

  /**
   * Sanitize subtype name
   */
  sanitizeSubtype(name) {
    if (!name) return 'General';
    
    // Remove special characters and limit length
    return name
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim()
      .substring(0, 50) || 'General';
  }

  /**
   * Process a scraped activity and return enhanced data
   */
  async processActivity(scrapedActivity) {
    if (!this.categoriesCache) {
      await this.initialize();
    }

    // Map activity type
    const typeMapping = this.mapActivityType(
      scrapedActivity.name,
      scrapedActivity.activityType || scrapedActivity.section
    );

    // Detect parent participation
    const parentInfo = this.detectParentParticipation(scrapedActivity);

    // Assign categories
    const categories = this.assignCategories(scrapedActivity);

    // Ensure city is set properly
    const city = scrapedActivity.city || 'North Vancouver';

    return {
      ...scrapedActivity,
      activityType: typeMapping.type,
      activitySubtype: typeMapping.subtype,
      requiresParent: parentInfo.required,
      parentInvolvement: parentInfo.involvement,
      categories: categories,
      city: city,
      mappingConfidence: Math.min(typeMapping.confidence, parentInfo.confidence)
    };
  }

  async close() {
    await this.prisma.$disconnect();
  }
}

module.exports = EnhancedActivityMapper;