const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Cache for activity types and subtypes
let typeCache = null;
let subtypeCache = null;

/**
 * Load and cache activity types and subtypes
 */
async function loadTypesCache() {
  if (!typeCache) {
    const types = await prisma.activityType.findMany();
    typeCache = {};
    types.forEach(t => {
      typeCache[t.code] = t.id;
    });
  }
  
  if (!subtypeCache) {
    const subtypes = await prisma.activitySubtype.findMany();
    subtypeCache = {};
    subtypes.forEach(s => {
      subtypeCache[s.code] = s.id;
    });
  }
  
  return { typeCache, subtypeCache };
}

/**
 * Map activity to appropriate type and subtype
 * @param {Object} activity - Activity data from scraper
 * @returns {Object} Object with activityTypeId and activitySubtypeId
 */
async function mapActivityType(activity) {
  await loadTypesCache();
  
  const searchText = `${activity.name} ${activity.subcategory || ''} ${activity.category || ''}`.toLowerCase();
  
  // Mapping rules based on activity patterns
  // IMPORTANT: Order matters - more specific patterns should come first
  // CAMPS MUST BE FIRST to catch all camp activities before other type patterns match
  const mappingRules = [
    // CAMPS - MUST BE FIRST to ensure all camp activities are categorized as Camps
    // Detects: "camp" in name, OR section/category names that imply camps
    // (e.g., "March Break", "Spring Break", "PA Day", "PD Day", "Summer Programs")
    { pattern: /camp|march break|spring break|pa day|pd day|pro.?d day|holiday program|winter break|christmas break|summer program/i, typeId: typeCache['camps'],
      subtypeRules: [
        // Activity-specific camps (check FIRST - most specific)
        { pattern: /swim|aqua|water/i, subtypeCode: 'swimming-camps' },
        { pattern: /soccer|basketball|hockey|volleyball|baseball|football|lacrosse|team sport/i, subtypeCode: 'team-sports-camps' },
        { pattern: /tennis|badminton|squash|pickleball|racquet/i, subtypeCode: 'racquet-sports-camps' },
        { pattern: /golf|archery|track|running|cycling/i, subtypeCode: 'individual-sports-camps' },
        { pattern: /dance|ballet|jazz|hip hop|tap/i, subtypeCode: 'dance-camps' },
        { pattern: /music|piano|guitar|drum|violin|band|orchestra/i, subtypeCode: 'music-camps' },
        { pattern: /drama|theatre|theater|acting|improv|perform/i, subtypeCode: 'performing-arts-camps' },
        { pattern: /art|paint|draw|pottery|craft|sculpt/i, subtypeCode: 'visual-arts-camps' },
        { pattern: /martial|karate|taekwondo|judo|kung fu|boxing|kickbox/i, subtypeCode: 'martial-arts-camps' },
        { pattern: /gymnast|tumbl|trampoline|parkour|acro/i, subtypeCode: 'gymnastics-camps' },
        { pattern: /skat|ice|roller|figure/i, subtypeCode: 'skating-camps' },
        { pattern: /outdoor|adventure|nature|hiking|climb/i, subtypeCode: 'outdoor-adventure-camps' },
        { pattern: /cook|culinary|baking|chef/i, subtypeCode: 'cooking-camps' },
        { pattern: /language|french|spanish|mandarin/i, subtypeCode: 'language-camps' },
        { pattern: /stem|science|tech|coding|robot|engineer/i, subtypeCode: 'stem-camps' },
        // Seasonal camps
        { pattern: /march break|spring break/i, subtypeCode: 'march-break-camps' },
        { pattern: /summer/i, subtypeCode: 'summer-camps' },
        { pattern: /winter|christmas|holiday/i, subtypeCode: 'winter-camps' },
        // Format-based camps
        { pattern: /overnight|residential|sleepover/i, subtypeCode: 'overnight-camps' },
        { pattern: /multi|general|variety|explorer/i, subtypeCode: 'multi-activity-camps' },
        // Generic sports fallback (after specific sports)
        { pattern: /sport/i, subtypeCode: 'sports-camps' },
        // Default fallback
        { pattern: /day|full day|half day/i, subtypeCode: 'day-camps' }
      ]
    },

    // Early Development - Check before other categories to catch toddler/parent programs
    { pattern: /toddler|tiny tot|parent.*tot|tot.*parent|learn.*play|play.*learn|early years|parent participation|preschool|baby.*me|me.*baby|kindergym|wiggle|reading|writing|bookworm|story.*time|storytime|literacy/i, typeId: typeCache['early-development'],
      subtypeRules: [
        { pattern: /play/i, subtypeCode: 'play-based-learning' },
        { pattern: /parent|tot|me/i, subtypeCode: 'parent-child' },
        { pattern: /social/i, subtypeCode: 'social-skills' },
        { pattern: /motor|movement/i, subtypeCode: 'motor-skills' },
        { pattern: /reading|writing|bookworm|story|literacy/i, subtypeCode: 'play-based-learning' }
      ]
    },

    // Swimming & Aquatics
    { pattern: /swim|aquatic|water safety|lifeguard/i, typeId: typeCache['swimming-aquatics'],
      subtypeRules: [
        { pattern: /parent|tot|baby/i, subtypeCode: 'parent-child' },
        { pattern: /lesson|learn/i, subtypeCode: 'swimming-lessons' },
        { pattern: /master|competitive/i, subtypeCode: 'competitive' },
        { pattern: /aqua|fitness/i, subtypeCode: 'aqua-fitness' },
        { pattern: /adapted|special/i, subtypeCode: 'adapted' }
      ]
    },
    
    // Team Sports
    { pattern: /soccer|basketball|volleyball|baseball|hockey|football|lacrosse/i, typeId: typeCache['team-sports'],
      subtypeRules: [
        { pattern: /soccer/i, subtypeCode: 'soccer' },
        { pattern: /basketball/i, subtypeCode: 'basketball' },
        { pattern: /volleyball/i, subtypeCode: 'volleyball' },
        { pattern: /baseball|t-ball/i, subtypeCode: 'baseball' },
        { pattern: /hockey/i, subtypeCode: 'hockey' },
        { pattern: /football/i, subtypeCode: 'football' },
        { pattern: /lacrosse/i, subtypeCode: 'lacrosse' }
      ]
    },
    
    // Racquet Sports
    { pattern: /tennis|badminton|squash|racquet|pickleball/i, typeId: typeCache['racquet-sports'],
      subtypeRules: [
        { pattern: /tennis/i, subtypeCode: 'tennis' },
        { pattern: /badminton/i, subtypeCode: 'badminton' },
        { pattern: /squash/i, subtypeCode: 'squash' },
        { pattern: /pickleball/i, subtypeCode: 'pickleball' }
      ]
    },
    
    // Martial Arts
    { pattern: /martial|karate|taekwondo|judo|kung fu|aikido|jiu-jitsu|boxing|kickbox|self defense|capoeira|kendo|fencing|wrestling/i, typeId: typeCache['martial-arts'],
      subtypeRules: [
        { pattern: /karate/i, subtypeCode: 'karate' },
        { pattern: /taekwondo|tae kwon do/i, subtypeCode: 'taekwondo' },
        { pattern: /judo/i, subtypeCode: 'judo' },
        { pattern: /kung fu/i, subtypeCode: 'kung-fu' },
        { pattern: /jiu-jitsu|jiu jitsu|bjj/i, subtypeCode: 'jiu-jitsu' },
        { pattern: /boxing/i, subtypeCode: 'boxing' },
        { pattern: /kickbox/i, subtypeCode: 'kickboxing' },
        { pattern: /self defense/i, subtypeCode: 'self-defense' }
      ]
    },
    
    // Dance
    { pattern: /dance|ballet|jazz|hip hop|tap|contemporary|ballroom|tutu/i, typeId: typeCache['dance'],
      subtypeRules: [
        { pattern: /ballet/i, subtypeCode: 'ballet' },
        { pattern: /jazz/i, subtypeCode: 'jazz' },
        { pattern: /hip hop|hip-hop|hiphop/i, subtypeCode: 'hip-hop' },
        { pattern: /tap/i, subtypeCode: 'tap' },
        { pattern: /contemporary|modern/i, subtypeCode: 'contemporary' },
        { pattern: /ballroom|latin/i, subtypeCode: 'ballroom' }
      ]
    },
    
    // Visual Arts
    { pattern: /art|paint|draw|pottery|craft|sculpture|mixed media|colour|create/i, typeId: typeCache['visual-arts'],
      subtypeRules: [
        { pattern: /paint/i, subtypeCode: 'painting' },
        { pattern: /draw/i, subtypeCode: 'drawing' },
        { pattern: /pottery|ceramic|clay/i, subtypeCode: 'pottery' },
        { pattern: /sculpture/i, subtypeCode: 'sculpture' },
        { pattern: /mixed media/i, subtypeCode: 'mixed-media' },
        { pattern: /craft/i, subtypeCode: 'crafts' }
      ]
    },
    
    // Music
    { pattern: /music|piano|guitar|singing|choir|drum|violin|band|orchestra/i, typeId: typeCache['music'],
      subtypeRules: [
        { pattern: /piano/i, subtypeCode: 'piano' },
        { pattern: /guitar/i, subtypeCode: 'guitar' },
        { pattern: /singing|voice|vocal|choir/i, subtypeCode: 'singing' },
        { pattern: /drum/i, subtypeCode: 'drums' },
        { pattern: /violin|fiddle/i, subtypeCode: 'violin' },
        { pattern: /band/i, subtypeCode: 'band' },
        { pattern: /orchestra/i, subtypeCode: 'orchestra' }
      ]
    },
    
    // Performing Arts
    { pattern: /drama|theatre|acting|improv|performance/i, typeId: typeCache['performing-arts'],
      subtypeRules: [
        { pattern: /drama|acting/i, subtypeCode: 'drama' },
        { pattern: /musical theatre/i, subtypeCode: 'musical-theatre' },
        { pattern: /improv/i, subtypeCode: 'improv' }
      ]
    },
    
    // Skating & Wheels
    { pattern: /skat|hockey|figure|wheel|roller|scooter|bike|cycling/i, typeId: typeCache['skating-wheels'],
      subtypeRules: [
        { pattern: /ice skat|figure skat/i, subtypeCode: 'ice-skating' },
        { pattern: /roller|inline/i, subtypeCode: 'roller-skating' },
        { pattern: /skateboard/i, subtypeCode: 'skateboarding' },
        { pattern: /scooter/i, subtypeCode: 'scooter' },
        { pattern: /bike|cycling/i, subtypeCode: 'cycling' }
      ]
    },
    
    // Gymnastics & Movement
    { pattern: /gymnast|tumbl|acro|trampoline|parkour/i, typeId: typeCache['gymnastics-movement'],
      subtypeRules: [
        { pattern: /gymnast/i, subtypeCode: 'gymnastics' },
        { pattern: /tumbl/i, subtypeCode: 'tumbling' },
        { pattern: /trampoline/i, subtypeCode: 'trampoline' },
        { pattern: /parkour/i, subtypeCode: 'parkour' }
      ]
    },
    
    // STEM & Education
    { pattern: /science|stem|coding|robot|engineering|math|computer|technology|chess|scientist|lego|minecraft|build/i, typeId: typeCache['stem-education'],
      subtypeRules: [
        { pattern: /science|scientist/i, subtypeCode: 'science' },
        { pattern: /coding|programming/i, subtypeCode: 'coding' },
        { pattern: /robot/i, subtypeCode: 'robotics' },
        { pattern: /engineering/i, subtypeCode: 'engineering' },
        { pattern: /math/i, subtypeCode: 'mathematics' },
        { pattern: /chess/i, subtypeCode: 'other' },
        { pattern: /lego|minecraft|build/i, subtypeCode: 'engineering' }
      ]
    },
    
    // Fitness & Wellness
    { pattern: /fitness|yoga|pilates|workout|exercise|strength|cardio|zumba|spin/i, typeId: typeCache['fitness-wellness'],
      subtypeRules: [
        { pattern: /yoga/i, subtypeCode: 'yoga' },
        { pattern: /pilates/i, subtypeCode: 'pilates' },
        { pattern: /zumba/i, subtypeCode: 'zumba' },
        { pattern: /spin|cycling/i, subtypeCode: 'spin' },
        { pattern: /strength|weight/i, subtypeCode: 'strength-training' }
      ]
    },
    
    // Outdoor & Adventure
    { pattern: /outdoor|hiking|climbing|adventure|nature|camping|survival/i, typeId: typeCache['outdoor-adventure'],
      subtypeRules: [
        { pattern: /hiking|trail/i, subtypeCode: 'hiking' },
        { pattern: /climbing|boulder/i, subtypeCode: 'climbing' },
        { pattern: /camping/i, subtypeCode: 'camping' },
        { pattern: /nature/i, subtypeCode: 'nature-exploration' }
      ]
    },
    
    // Early Development
    { pattern: /learn.*play|play.*learn|early years|tiny tots|parent participation|preschool|toddler/i, typeId: typeCache['early-development'],
      subtypeRules: [
        { pattern: /play/i, subtypeCode: 'play-based-learning' },
        { pattern: /parent/i, subtypeCode: 'parent-child' },
        { pattern: /social/i, subtypeCode: 'social-skills' }
      ]
    },
    
    // Life Skills & Leadership
    { pattern: /leadership|life skills|babysit|first aid|certif/i, typeId: typeCache['life-skills-leadership'],
      subtypeRules: [
        { pattern: /leadership/i, subtypeCode: 'leadership' },
        { pattern: /babysit/i, subtypeCode: 'babysitting' },
        { pattern: /first aid|cpr/i, subtypeCode: 'first-aid' }
      ]
    },

    // Culinary Arts
    { pattern: /cook|culinary|baking|kitchen|chef|cupcake|food|recipe/i, typeId: typeCache['culinary-arts'],
      subtypeRules: [
        { pattern: /baking|cupcake|cake|cookie/i, subtypeCode: 'baking' },
        { pattern: /cook/i, subtypeCode: 'cooking' }
      ]
    },

    // Language & Culture
    { pattern: /language|mandarin|chinese|french|spanish|german|japanese|korean|english conversation|esl|culture|heritage/i, typeId: typeCache['language-culture'],
      subtypeRules: [
        { pattern: /mandarin|chinese/i, subtypeCode: 'mandarin' },
        { pattern: /french/i, subtypeCode: 'french' },
        { pattern: /spanish/i, subtypeCode: 'spanish' }
      ]
    },

    // Individual Sports
    { pattern: /golf|archery|fencing|track|running|triathlon|marathon/i, typeId: typeCache['individual-sports'],
      subtypeRules: [
        { pattern: /golf/i, subtypeCode: 'golf' },
        { pattern: /archery/i, subtypeCode: 'archery' },
        { pattern: /track|running/i, subtypeCode: 'track-and-field' }
      ]
    }
  ];
  
  let typeId = null;
  let subtypeId = null;
  
  // Find matching rule
  for (const rule of mappingRules) {
    if (rule.pattern.test(searchText)) {
      typeId = rule.typeId;
      
      // Find matching subtype if rules exist
      if (rule.subtypeRules) {
        for (const subtypeRule of rule.subtypeRules) {
          if (subtypeRule.pattern.test(searchText)) {
            subtypeId = subtypeCache[subtypeRule.subtypeCode] || null;
            break;
          }
        }
      }
      
      // If no specific subtype matched, use a general one
      if (!subtypeId && rule.subtypeRules && rule.subtypeRules.length > 0) {
        subtypeId = subtypeCache['general'] || subtypeCache['other'] || null;
      }
      
      break;
    }
  }
  
  // Default to 'other-activity' if no match
  if (!typeId) {
    typeId = typeCache['other-activity'];
    subtypeId = subtypeCache['other'] || null;
  }

  // Detect indoor/outdoor environment
  const isIndoor = detectIndoorOutdoor(activity, searchText);

  return { activityTypeId: typeId, activitySubtypeId: subtypeId, isIndoor };
}

/**
 * Detect if activity is indoor or outdoor
 * @param {Object} activity - Activity data from scraper
 * @param {string} searchText - Combined text for pattern matching
 * @returns {boolean|null} true = indoor, false = outdoor, null = unknown/both
 */
function detectIndoorOutdoor(activity, searchText) {
  const locationText = `${activity.locationName || ''} ${activity.fullAddress || ''} ${activity.location || ''}`.toLowerCase();
  const fullSearchText = `${searchText} ${locationText}`;

  // ============================================
  // Priority 1: Explicit indoor/outdoor keywords
  // ============================================
  const indoorKeywords = [
    'indoor', 'indoors', 'inside',
    'indoor pool', 'indoor rink', 'indoor court',
    'indoor soccer', 'indoor field'
  ];

  const outdoorKeywords = [
    'outdoor', 'outdoors', 'outside',
    'outdoor pool', 'outdoor rink', 'outdoor field',
    'outdoor soccer', 'open air', 'beach soccer'
  ];

  // Check for explicit indoor keywords
  for (const keyword of indoorKeywords) {
    if (fullSearchText.includes(keyword)) {
      return true; // Indoor
    }
  }

  // Check for explicit outdoor keywords
  for (const keyword of outdoorKeywords) {
    if (fullSearchText.includes(keyword)) {
      return false; // Outdoor
    }
  }

  // ============================================
  // Priority 2: Venue/location hints
  // ============================================
  const indoorVenues = [
    'arena', 'gymnasium', 'gym', 'studio',
    'community centre', 'community center', 'rec centre', 'rec center',
    'recreation centre', 'recreation center', 'fitness centre', 'fitness center',
    'aquatic centre', 'aquatic center', 'natatorium',
    'mall', 'library', 'museum',
    'church hall', 'multiplex', 'sportsplex',
    'dance studio', 'martial arts', 'dojo',
    'bowling', 'arcade'
  ];

  const outdoorVenues = [
    'park', 'field', 'diamond', 'pitch',
    'playground', 'trail', 'garden', 'farm',
    'outdoor pool', 'beach', 'lake', 'river',
    'golf course', 'ski hill', 'ski resort',
    'campground', 'nature', 'forest', 'woods',
    'skatepark'
  ];

  for (const venue of indoorVenues) {
    if (fullSearchText.includes(venue)) {
      // Double-check it's not "outdoor" + venue
      if (!fullSearchText.includes('outdoor ' + venue) && !fullSearchText.includes('outside ' + venue)) {
        return true; // Indoor
      }
    }
  }

  for (const venue of outdoorVenues) {
    if (fullSearchText.includes(venue)) {
      // Exclude cases like "indoor pool" when checking "pool"
      if (!fullSearchText.includes('indoor ' + venue) && !fullSearchText.includes('inside ' + venue)) {
        return false; // Outdoor
      }
    }
  }

  // ============================================
  // Priority 3: Activity type defaults
  // Some activities are almost always one or the other
  // ============================================
  const typicallyIndoor = [
    /dance|ballet|jazz dance|hip hop|tap dance/i,
    /gymnast|tumbl|trampoline/i,
    /martial|karate|taekwondo|judo|kung fu|boxing|kickbox/i,
    /music|piano|guitar|drum|violin|band|orchestra|choir|sing/i,
    /art|paint|draw|pottery|craft|sculpt|ceramic/i,
    /stem|coding|robot|science|engineering|computer|chess|lego/i,
    /drama|theatre|theater|acting|improv/i,
    /cook|culinary|baking|kitchen|chef/i,
    /language|mandarin|chinese|french|spanish/i,
    /badminton|squash|table tennis|racquetball/i,
    /bowling/i,
    /figure skat|ice skat/i,
    /yoga|pilates|fitness|workout|exercise|zumba|spin/i
  ];

  const typicallyOutdoor = [
    /outdoor|hiking|camping|nature|adventure/i,
    /golf/i,
    /ski|snowboard/i,
    /skateboard|skatepark/i,
    /baseball|softball/i,
    /rugby|lacrosse/i,
    /track|running|cross country|marathon/i,
    /cycling|mountain biking/i,
    /kayak|canoe|sail|rowing/i,
    /fishing|archery/i
  ];

  // Check if activity matches typically indoor patterns
  for (const pattern of typicallyIndoor) {
    if (pattern.test(searchText)) {
      return true;
    }
  }

  // Check if activity matches typically outdoor patterns
  for (const pattern of typicallyOutdoor) {
    if (pattern.test(searchText)) {
      return false;
    }
  }

  // ============================================
  // Return null for ambiguous activities
  // These can be indoor OR outdoor depending on venue:
  // - Swimming (indoor vs outdoor pool)
  // - Soccer (indoor vs outdoor)
  // - Basketball (indoor vs outdoor)
  // - Tennis (indoor vs outdoor courts)
  // - Volleyball (indoor vs beach)
  // - Hockey (ice vs field/ball)
  // - Camps (can be either)
  // ============================================
  return null;
}

module.exports = { mapActivityType, loadTypesCache, detectIndoorOutdoor };