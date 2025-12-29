/**
 * Database Activity Mapper
 * Maps scraped activities to database-defined activity types and subtypes
 * Uses foreign key relationships to ensure consistency
 */

const { PrismaClient } = require('../../generated/prisma');

class DatabaseActivityMapper {
  constructor() {
    this.prisma = new PrismaClient();
    this.typesCache = null;
    this.subtypesCache = null;
    this.lastCacheUpdate = null;
    this.CACHE_TTL = 60 * 60 * 1000; // 1 hour cache
  }

  /**
   * Initialize or refresh the cache of activity types and subtypes
   */
  async refreshCache() {
    const now = Date.now();
    if (this.typesCache && this.subtypesCache && this.lastCacheUpdate && 
        (now - this.lastCacheUpdate) < this.CACHE_TTL) {
      return; // Cache is still valid
    }

    console.log('Refreshing activity types cache from database...');
    
    // Load all activity types with their subtypes
    const types = await this.prisma.activityType.findMany({
      include: {
        subtypes: true
      },
      orderBy: { displayOrder: 'asc' }
    });

    // Create lookup maps for efficient searching
    this.typesCache = new Map();
    this.subtypesCache = new Map();

    types.forEach(type => {
      // Store type by both code and name for flexible matching
      this.typesCache.set(type.code, type);
      this.typesCache.set(type.name.toLowerCase(), type);
      
      // Store subtypes with type context
      type.subtypes.forEach(subtype => {
        const key = `${type.name}:${subtype.name}`.toLowerCase();
        this.subtypesCache.set(key, { type, subtype });
        
        // Also store by subtype name alone for fuzzy matching
        const subtypeKey = subtype.name.toLowerCase();
        if (!this.subtypesCache.has(subtypeKey)) {
          this.subtypesCache.set(subtypeKey, { type, subtype });
        }
      });
    });

    this.lastCacheUpdate = now;
    console.log(`Cached ${types.length} activity types with ${this.subtypesCache.size} subtypes`);
  }

  /**
   * Map a scraped activity to database activity type and subtype IDs
   * @param {Object} scrapedActivity - The activity data from scraper
   * @returns {Object} { activityTypeId, activitySubtypeId, requiresParent, parentInvolvement }
   */
  async mapActivity(scrapedActivity) {
    await this.refreshCache();

    const {
      name = '',
      category = '',
      subcategory = '',
      description = '',
      ageMin,
      ageMax
    } = scrapedActivity;

    // Combine all text for analysis
    const searchText = `${name} ${category} ${subcategory} ${description}`.toLowerCase();

    // Detect parent participation
    const parentInfo = this.detectParentParticipation(searchText, ageMin, ageMax);

    // Find the best matching type and subtype
    const typeMapping = this.findBestTypeMatch(searchText, name, subcategory);

    return {
      activityTypeId: typeMapping.typeId,
      activitySubtypeId: typeMapping.subtypeId,
      requiresParent: parentInfo.requiresParent,
      parentInvolvement: parentInfo.parentInvolvement
    };
  }

  /**
   * Check if activity is a camp - MUST BE CALLED FIRST
   * Returns camp type info if camp-related keywords are found
   * Detects: "camp" in name, OR section/category names that imply camps
   * (e.g., "March Break", "Spring Break", "PA Day", "PD Day", "Summer Programs")
   */
  checkCampPattern(searchText, name) {
    // Camp detection pattern - includes section names that imply camps
    const campPattern = /camp|march break|spring break|pa day|pd day|pro.?d day|holiday program|winter break|christmas break|summer program/i;

    // If no camp-related keywords found, return null (not a camp)
    if (!campPattern.test(searchText)) {
      return { typeId: null, subtypeId: null, score: 0 };
    }

    // This IS a camp - find the Camps type
    const campType = this.findTypeByName('Camps');
    if (!campType) {
      return { typeId: null, subtypeId: null, score: 0 };
    }

    // Determine camp subtype based on secondary keywords
    const campSubtypePatterns = [
      // Activity-specific camps (check first - most specific)
      { regex: /swim|aqua|water/i, subtypeName: 'Swimming Camps' },
      { regex: /soccer|basketball|hockey|volleyball|baseball|football|lacrosse|team sport/i, subtypeName: 'Team Sports Camps' },
      { regex: /tennis|badminton|squash|pickleball|racquet/i, subtypeName: 'Racquet Sports Camps' },
      { regex: /golf|archery|track|running|cycling/i, subtypeName: 'Individual Sports Camps' },
      { regex: /dance|ballet|jazz|hip hop|tap/i, subtypeName: 'Dance Camps' },
      { regex: /music|piano|guitar|drum|violin|band|orchestra/i, subtypeName: 'Music Camps' },
      { regex: /drama|theatre|theater|acting|improv|perform/i, subtypeName: 'Performing Arts Camps' },
      { regex: /art|paint|draw|pottery|craft|sculpt/i, subtypeName: 'Visual Arts Camps' },
      { regex: /martial|karate|taekwondo|judo|kung fu|boxing|kickbox/i, subtypeName: 'Martial Arts Camps' },
      { regex: /gymnast|tumbl|trampoline|parkour|acro/i, subtypeName: 'Gymnastics Camps' },
      { regex: /skat|ice|roller|figure/i, subtypeName: 'Skating Camps' },
      { regex: /outdoor|adventure|nature|hiking|climb/i, subtypeName: 'Outdoor Adventure Camps' },
      { regex: /cook|culinary|baking|chef/i, subtypeName: 'Cooking Camps' },
      { regex: /language|french|spanish|mandarin/i, subtypeName: 'Language Camps' },
      { regex: /stem|science|tech|coding|robot|engineer/i, subtypeName: 'STEM Camps' },
      // Seasonal camps
      { regex: /march break|spring break/i, subtypeName: 'March Break Camps' },
      { regex: /summer/i, subtypeName: 'Summer Camps' },
      { regex: /winter|christmas|holiday/i, subtypeName: 'Winter Camps' },
      // Format-based camps
      { regex: /overnight|residential|sleepover/i, subtypeName: 'Overnight Camps' },
      { regex: /multi|general|variety|explorer/i, subtypeName: 'Multi-Activity Camps' },
      // Generic fallbacks
      { regex: /sport/i, subtypeName: 'Sports Camps' },
    ];

    let subtypeId = null;
    for (const pattern of campSubtypePatterns) {
      if (pattern.regex.test(searchText)) {
        const subtype = this.findSubtypeByName(campType.id, pattern.subtypeName);
        if (subtype) {
          subtypeId = subtype.id;
          break;
        }
      }
    }

    // Default to Day Camps if no specific subtype matched
    if (!subtypeId) {
      const daySubtype = this.findSubtypeByName(campType.id, 'Day Camps');
      subtypeId = daySubtype ? daySubtype.id : this.findDefaultSubtype(campType.id);
    }

    return {
      typeId: campType.id,
      subtypeId: subtypeId,
      score: 100 // Highest priority
    };
  }

  /**
   * Find the best matching activity type and subtype
   */
  findBestTypeMatch(searchText, name, subcategory) {
    // PRIORITY 0: Check for camps FIRST - if "camp" is in name, it's ALWAYS a camp
    const campMatch = this.checkCampPattern(searchText, name);
    if (campMatch.typeId) {
      return campMatch;
    }

    let bestMatch = {
      typeId: null,
      subtypeId: null,
      score: 0
    };

    // Priority 1: Check for exact subtype matches in subcategory field
    if (subcategory) {
      const subcatLower = subcategory.toLowerCase();
      
      // Check for compound matches like "Swimming Lessons"
      for (const [key, value] of this.subtypesCache.entries()) {
        if (key.includes(':') && subcatLower.includes(value.subtype.name.toLowerCase())) {
          return {
            typeId: value.type.id,
            subtypeId: value.subtype.id,
            score: 100
          };
        }
      }
    }

    // Priority 2: Check specific activity patterns
    const specificMatches = this.checkSpecificPatterns(searchText, name);
    if (specificMatches.typeId) {
      return specificMatches;
    }

    // Priority 3: Fuzzy matching based on keywords
    const keywordMatch = this.findByKeywords(searchText);
    if (keywordMatch.typeId) {
      return keywordMatch;
    }

    // Priority 4: Use subcategory as fallback
    if (subcategory) {
      const subcatMatch = this.findTypeByName(subcategory);
      if (subcatMatch) {
        return {
          typeId: subcatMatch.id,
          subtypeId: this.findDefaultSubtype(subcatMatch.id),
          score: 30
        };
      }
    }

    return bestMatch;
  }

  /**
   * Check for specific activity patterns
   */
  checkSpecificPatterns(searchText, name) {
    const patterns = [
      // Swimming patterns
      { regex: /swim|aqua|water|pool/i, typeName: 'Swimming & Aquatics' },
      { regex: /learn to swim/i, typeName: 'Swimming & Aquatics', subtypeName: 'Learn to Swim' },
      { regex: /competitive swim/i, typeName: 'Swimming & Aquatics', subtypeName: 'Competitive Swimming' },
      { regex: /diving/i, typeName: 'Swimming & Aquatics', subtypeName: 'Diving' },
      { regex: /water polo/i, typeName: 'Swimming & Aquatics', subtypeName: 'Water Polo' },
      { regex: /lifeguard/i, typeName: 'Swimming & Aquatics', subtypeName: 'Lifeguarding' },
      
      // Team Sports patterns
      { regex: /basketball/i, typeName: 'Team Sports', subtypeName: 'Basketball' },
      { regex: /soccer|football/i, typeName: 'Team Sports', subtypeName: 'Soccer' },
      { regex: /volleyball/i, typeName: 'Team Sports', subtypeName: 'Volleyball' },
      { regex: /baseball/i, typeName: 'Team Sports', subtypeName: 'Baseball' },
      { regex: /softball/i, typeName: 'Team Sports', subtypeName: 'Softball' },
      { regex: /hockey/i, typeName: 'Team Sports', subtypeName: 'Hockey' },
      { regex: /lacrosse/i, typeName: 'Team Sports', subtypeName: 'Lacrosse' },
      { regex: /rugby/i, typeName: 'Team Sports', subtypeName: 'Rugby' },
      
      // Racquet Sports patterns
      { regex: /tennis/i, typeName: 'Racquet Sports', subtypeName: 'Tennis' },
      { regex: /badminton/i, typeName: 'Racquet Sports', subtypeName: 'Badminton' },
      { regex: /squash/i, typeName: 'Racquet Sports', subtypeName: 'Squash' },
      { regex: /racquetball/i, typeName: 'Racquet Sports', subtypeName: 'Racquetball' },
      { regex: /pickleball/i, typeName: 'Racquet Sports', subtypeName: 'Pickleball' },
      { regex: /table tennis|ping pong/i, typeName: 'Racquet Sports', subtypeName: 'Table Tennis' },
      
      // Martial Arts patterns
      { regex: /martial arts/i, typeName: 'Martial Arts', subtypeName: 'Mixed Martial Arts' },
      { regex: /karate/i, typeName: 'Martial Arts', subtypeName: 'Karate' },
      { regex: /taekwondo|tkd/i, typeName: 'Martial Arts', subtypeName: 'Taekwondo' },
      { regex: /judo/i, typeName: 'Martial Arts', subtypeName: 'Judo' },
      { regex: /jiu[\s-]?jitsu|bjj/i, typeName: 'Martial Arts', subtypeName: 'Jiu-Jitsu' },
      { regex: /kung fu/i, typeName: 'Martial Arts', subtypeName: 'Kung Fu' },
      { regex: /aikido/i, typeName: 'Martial Arts', subtypeName: 'Aikido' },
      { regex: /boxing/i, typeName: 'Martial Arts', subtypeName: 'Boxing' },
      { regex: /kickbox/i, typeName: 'Martial Arts', subtypeName: 'Kickboxing' },
      { regex: /self[\s-]?defen/i, typeName: 'Martial Arts', subtypeName: 'Self Defense' },
      
      // Dance patterns
      { regex: /dance/i, typeName: 'Dance' },
      { regex: /ballet/i, typeName: 'Dance', subtypeName: 'Ballet' },
      { regex: /jazz/i, typeName: 'Dance', subtypeName: 'Jazz' },
      { regex: /tap/i, typeName: 'Dance', subtypeName: 'Tap' },
      { regex: /hip[\s-]?hop/i, typeName: 'Dance', subtypeName: 'Hip Hop' },
      { regex: /contemporary/i, typeName: 'Dance', subtypeName: 'Contemporary' },
      { regex: /modern/i, typeName: 'Dance', subtypeName: 'Modern' },
      { regex: /ballroom/i, typeName: 'Dance', subtypeName: 'Ballroom' },
      { regex: /latin/i, typeName: 'Dance', subtypeName: 'Latin' },
      { regex: /salsa/i, typeName: 'Dance', subtypeName: 'Salsa' },
      { regex: /bollywood/i, typeName: 'Dance', subtypeName: 'Bollywood' },
      
      // Music patterns
      { regex: /music/i, typeName: 'Music' },
      { regex: /piano/i, typeName: 'Music', subtypeName: 'Piano' },
      { regex: /guitar/i, typeName: 'Music', subtypeName: 'Guitar' },
      { regex: /violin/i, typeName: 'Music', subtypeName: 'Violin' },
      { regex: /drum/i, typeName: 'Music', subtypeName: 'Drums' },
      { regex: /voice|sing|vocal/i, typeName: 'Music', subtypeName: 'Voice/Singing' },
      { regex: /choir/i, typeName: 'Music', subtypeName: 'Choir' },
      { regex: /band/i, typeName: 'Music', subtypeName: 'Band' },
      { regex: /orchestra/i, typeName: 'Music', subtypeName: 'Orchestra' },
      { regex: /ukulele/i, typeName: 'Music', subtypeName: 'Ukulele' },
      
      // Visual Arts patterns
      { regex: /art|craft/i, typeName: 'Visual Arts' },
      { regex: /paint/i, typeName: 'Visual Arts', subtypeName: 'Painting' },
      { regex: /draw/i, typeName: 'Visual Arts', subtypeName: 'Drawing' },
      { regex: /sculpt/i, typeName: 'Visual Arts', subtypeName: 'Sculpture' },
      { regex: /pottery|ceramic/i, typeName: 'Visual Arts', subtypeName: 'Pottery' },
      { regex: /photo/i, typeName: 'Visual Arts', subtypeName: 'Photography' },
      { regex: /digital art/i, typeName: 'Visual Arts', subtypeName: 'Digital Art' },
      { regex: /jewelry/i, typeName: 'Visual Arts', subtypeName: 'Jewelry Making' },
      
      // Skating patterns
      { regex: /skating|skate/i, typeName: 'Skating & Wheels' },
      { regex: /ice skat/i, typeName: 'Skating & Wheels', subtypeName: 'Ice Skating' },
      { regex: /figure skat/i, typeName: 'Skating & Wheels', subtypeName: 'Figure Skating' },
      { regex: /roller skat/i, typeName: 'Skating & Wheels', subtypeName: 'Roller Skating' },
      { regex: /skateboard/i, typeName: 'Skating & Wheels', subtypeName: 'Skateboarding' },
      
      // Gymnastics patterns
      { regex: /gymnastic/i, typeName: 'Gymnastics & Movement' },
      { regex: /trampoline/i, typeName: 'Gymnastics & Movement', subtypeName: 'Trampoline' },
      { regex: /tumbling/i, typeName: 'Gymnastics & Movement', subtypeName: 'Tumbling' },
      { regex: /parkour/i, typeName: 'Gymnastics & Movement', subtypeName: 'Parkour' },
      { regex: /ninja/i, typeName: 'Gymnastics & Movement', subtypeName: 'Ninja Training' },
      { regex: /cheer/i, typeName: 'Gymnastics & Movement', subtypeName: 'Cheerleading' },
      
      // Camp patterns
      { regex: /camp/i, typeName: 'Camps' },
      { regex: /day camp/i, typeName: 'Camps', subtypeName: 'Day Camp' },
      { regex: /summer camp/i, typeName: 'Camps', subtypeName: 'Summer Camp' },
      { regex: /march break/i, typeName: 'Camps', subtypeName: 'March Break Camp' },
      { regex: /winter camp/i, typeName: 'Camps', subtypeName: 'Winter Camp' },
      
      // STEM patterns
      { regex: /robot/i, typeName: 'STEM & Education', subtypeName: 'Robotics' },
      { regex: /coding|programming/i, typeName: 'STEM & Education', subtypeName: 'Coding' },
      { regex: /science/i, typeName: 'STEM & Education', subtypeName: 'Science' },
      { regex: /minecraft/i, typeName: 'STEM & Education', subtypeName: 'Minecraft' },
      { regex: /lego/i, typeName: 'STEM & Education', subtypeName: 'LEGO' },
      
      // Fitness patterns
      { regex: /yoga/i, typeName: 'Fitness & Wellness', subtypeName: 'Yoga' },
      { regex: /pilates/i, typeName: 'Fitness & Wellness', subtypeName: 'Pilates' },
      { regex: /fitness/i, typeName: 'Fitness & Wellness', subtypeName: 'Fitness Training' },
      { regex: /zumba/i, typeName: 'Fitness & Wellness', subtypeName: 'Zumba' },
      { regex: /crossfit/i, typeName: 'Fitness & Wellness', subtypeName: 'CrossFit Kids' }
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(searchText)) {
        const type = this.findTypeByName(pattern.typeName);
        if (type) {
          let subtypeId = null;
          
          if (pattern.subtypeName) {
            const subtype = this.findSubtypeByName(type.id, pattern.subtypeName);
            if (subtype) {
              subtypeId = subtype.id;
            }
          }
          
          // If no specific subtype found, use the default for this type
          if (!subtypeId) {
            subtypeId = this.findDefaultSubtype(type.id);
          }
          
          return {
            typeId: type.id,
            subtypeId: subtypeId,
            score: 90
          };
        }
      }
    }

    return { typeId: null, subtypeId: null, score: 0 };
  }

  /**
   * Find activity type by name
   */
  findTypeByName(name) {
    if (!name) return null;
    const nameLower = name.toLowerCase();
    return this.typesCache.get(nameLower) || null;
  }

  /**
   * Find subtype by name within a specific type
   */
  findSubtypeByName(typeId, subtypeName) {
    if (!typeId || !subtypeName) return null;
    
    const type = Array.from(this.typesCache.values()).find(t => t.id === typeId);
    if (!type) return null;
    
    const subtypeNameLower = subtypeName.toLowerCase();
    return type.subtypes.find(s => s.name.toLowerCase() === subtypeNameLower) || null;
  }

  /**
   * Find the default subtype for a type (usually "Other" or the first one)
   */
  findDefaultSubtype(typeId) {
    const type = Array.from(this.typesCache.values()).find(t => t.id === typeId);
    if (!type || !type.subtypes || type.subtypes.length === 0) return null;
    
    // Look for "Other" subtype
    const otherSubtype = type.subtypes.find(s => s.name.includes('Other'));
    if (otherSubtype) return otherSubtype.id;
    
    // Otherwise return the first subtype
    return type.subtypes[0].id;
  }

  /**
   * Find activity type by keywords
   */
  findByKeywords(searchText) {
    const keywords = searchText.toLowerCase().split(/\s+/);
    let bestMatch = { typeId: null, subtypeId: null, score: 0 };

    for (const [key, type] of this.typesCache.entries()) {
      if (typeof key !== 'string') continue;
      
      const typeKeywords = key.split(/[\s-]+/);
      let matchCount = 0;
      
      for (const typeKeyword of typeKeywords) {
        if (keywords.includes(typeKeyword)) {
          matchCount++;
        }
      }
      
      const score = (matchCount / typeKeywords.length) * 50;
      if (score > bestMatch.score) {
        bestMatch = {
          typeId: type.id,
          subtypeId: this.findDefaultSubtype(type.id),
          score
        };
      }
    }

    return bestMatch;
  }

  /**
   * Detect if activity requires parent participation
   */
  detectParentParticipation(searchText, ageMin, ageMax) {
    const parentKeywords = [
      'parent', 'mom', 'dad', 'family', 'guardian', 'caregiver',
      'adult supervision', 'accompanied', 'with adult',
      'parent and child', 'parent & child', 'parent and tot', 'parent & tot',
      'mommy and me', 'daddy and me', 'family class'
    ];

    let requiresParent = false;
    let parentInvolvement = null;

    // Check for parent keywords
    for (const keyword of parentKeywords) {
      if (searchText.includes(keyword)) {
        requiresParent = true;
        
        if (keyword.includes('tot') || keyword.includes('baby')) {
          parentInvolvement = 'Full Participation';
        } else if (keyword.includes('family')) {
          parentInvolvement = 'Family Activity';
        } else {
          parentInvolvement = 'Supervision Required';
        }
        break;
      }
    }

    // Check age-based requirements
    if (!requiresParent && ageMax !== null && ageMax <= 3) {
      requiresParent = true;
      parentInvolvement = 'Full Participation';
    } else if (!requiresParent && ageMax !== null && ageMax <= 5) {
      // May require parent for very young children
      if (searchText.includes('drop off') || searchText.includes('independent')) {
        requiresParent = false;
      } else if (searchText.includes('parent optional')) {
        parentInvolvement = 'Optional';
      }
    }

    return { requiresParent, parentInvolvement };
  }

  /**
   * Close database connection
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = DatabaseActivityMapper;