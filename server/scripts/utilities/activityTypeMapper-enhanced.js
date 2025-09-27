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
 * Enhanced mapping rules for comprehensive activity type and subtype classification
 * @param {Object} activity - Activity data from scraper
 * @returns {Object} Object with activityTypeId and activitySubtypeId
 */
async function mapActivityType(activity) {
  await loadTypesCache();
  
  const searchText = `${activity.name} ${activity.subcategory || ''} ${activity.category || ''}`.toLowerCase();
  
  // Enhanced mapping rules with comprehensive subtypes
  const mappingRules = [
    // Swimming & Aquatics - Enhanced
    { 
      pattern: /swim|aquatic|water safety|lifeguard|diving|water polo|synchronized/i, 
      typeId: typeCache['swimming-aquatics'], 
      subtypeRules: [
        { pattern: /learn to swim|swimming lesson|beginner swim/i, subtypeCode: 'learn-to-swim' },
        { pattern: /competitive|masters|stroke|freestyle|backstroke|breaststroke|butterfly/i, subtypeCode: 'competitive-swimming' },
        { pattern: /diving|dive/i, subtypeCode: 'diving' },
        { pattern: /water polo/i, subtypeCode: 'water-polo' },
        { pattern: /synchronized|synchro/i, subtypeCode: 'synchronized-swimming' },
        { pattern: /aqua fitness|water fitness|aquafit/i, subtypeCode: 'aqua-fitness' },
        { pattern: /lifeguard|life guard|bronze medallion|bronze cross/i, subtypeCode: 'lifeguarding' },
        { pattern: /swim camp|swimming camp/i, subtypeCode: 'swim-camp' },
        { pattern: /parent|tot|baby|toddler/i, subtypeCode: 'other-aquatics' }
      ]
    },
    
    // Team Sports - Enhanced
    { 
      pattern: /soccer|football|basketball|volleyball|baseball|softball|hockey|lacrosse|rugby|cricket|ultimate/i, 
      typeId: typeCache['team-sports'],
      subtypeRules: [
        { pattern: /basketball/i, subtypeCode: 'basketball' },
        { pattern: /soccer/i, subtypeCode: 'soccer' },
        { pattern: /volleyball/i, subtypeCode: 'volleyball' },
        { pattern: /baseball/i, subtypeCode: 'baseball' },
        { pattern: /softball/i, subtypeCode: 'softball' },
        { pattern: /hockey(?!.*floor)/i, subtypeCode: 'hockey' },
        { pattern: /floor hockey/i, subtypeCode: 'floor-hockey' },
        { pattern: /football(?!.*flag)/i, subtypeCode: 'football' },
        { pattern: /flag football/i, subtypeCode: 'flag-football' },
        { pattern: /lacrosse/i, subtypeCode: 'lacrosse' },
        { pattern: /rugby/i, subtypeCode: 'rugby' },
        { pattern: /cricket/i, subtypeCode: 'cricket' },
        { pattern: /ultimate|frisbee/i, subtypeCode: 'ultimate-frisbee' }
      ]
    },
    
    // Individual Sports - NEW comprehensive mapping
    { 
      pattern: /track|field|running|run|cycling|bike|golf|bowling|archery|fencing|climbing|cross country|triathlon/i, 
      typeId: typeCache['individual-sports'],
      subtypeRules: [
        { pattern: /track.*field|athletics/i, subtypeCode: 'track-field' },
        { pattern: /running|run(?!.*fun)|jogging/i, subtypeCode: 'running' },
        { pattern: /cycling|bike|bicycle/i, subtypeCode: 'cycling' },
        { pattern: /golf/i, subtypeCode: 'golf' },
        { pattern: /bowling/i, subtypeCode: 'bowling' },
        { pattern: /archery|bow.*arrow/i, subtypeCode: 'archery' },
        { pattern: /fencing|sword/i, subtypeCode: 'fencing' },
        { pattern: /rock climbing|climbing/i, subtypeCode: 'rock-climbing' },
        { pattern: /cross country/i, subtypeCode: 'cross-country' },
        { pattern: /triathlon/i, subtypeCode: 'triathlon' }
      ]
    },
    
    // Racquet Sports - Enhanced
    { 
      pattern: /tennis|badminton|squash|racquet|pickleball|table tennis|ping pong/i, 
      typeId: typeCache['racquet-sports'],
      subtypeRules: [
        { pattern: /tennis(?!.*table)/i, subtypeCode: 'tennis' },
        { pattern: /badminton/i, subtypeCode: 'badminton' },
        { pattern: /squash/i, subtypeCode: 'squash' },
        { pattern: /racquetball/i, subtypeCode: 'racquetball' },
        { pattern: /pickleball/i, subtypeCode: 'pickleball' },
        { pattern: /table tennis|ping pong/i, subtypeCode: 'table-tennis' }
      ]
    },
    
    // Martial Arts - Enhanced
    { 
      pattern: /martial|karate|taekwondo|judo|kung fu|aikido|jiu.?jitsu|boxing|kickbox|self.?defense|mma/i, 
      typeId: typeCache['martial-arts'],
      subtypeRules: [
        { pattern: /karate/i, subtypeCode: 'karate' },
        { pattern: /taekwondo|tae kwon do/i, subtypeCode: 'taekwondo' },
        { pattern: /judo/i, subtypeCode: 'judo' },
        { pattern: /jiu.?jitsu|bjj/i, subtypeCode: 'jiu-jitsu' },
        { pattern: /kung fu/i, subtypeCode: 'kung-fu' },
        { pattern: /aikido/i, subtypeCode: 'aikido' },
        { pattern: /boxing(?!.*kick)/i, subtypeCode: 'boxing' },
        { pattern: /kickbox/i, subtypeCode: 'kickboxing' },
        { pattern: /mma|mixed martial/i, subtypeCode: 'mma' },
        { pattern: /self.?defense/i, subtypeCode: 'self-defense' }
      ]
    },
    
    // Dance - Enhanced
    { 
      pattern: /dance|ballet|jazz|hip.?hop|tap|contemporary|modern|ballroom|latin|salsa|bollywood|irish|african|break/i, 
      typeId: typeCache['dance'],
      subtypeRules: [
        { pattern: /ballet/i, subtypeCode: 'ballet' },
        { pattern: /jazz/i, subtypeCode: 'jazz' },
        { pattern: /tap/i, subtypeCode: 'tap' },
        { pattern: /hip.?hop|hiphop/i, subtypeCode: 'hip-hop' },
        { pattern: /contemporary/i, subtypeCode: 'contemporary' },
        { pattern: /modern/i, subtypeCode: 'modern' },
        { pattern: /ballroom/i, subtypeCode: 'ballroom' },
        { pattern: /latin/i, subtypeCode: 'latin' },
        { pattern: /salsa/i, subtypeCode: 'salsa' },
        { pattern: /bollywood/i, subtypeCode: 'bollywood' },
        { pattern: /irish/i, subtypeCode: 'irish' },
        { pattern: /african/i, subtypeCode: 'african' },
        { pattern: /break|breaking/i, subtypeCode: 'breakdancing' },
        { pattern: /creative movement|movement/i, subtypeCode: 'creative-movement' }
      ]
    },
    
    // Visual Arts - Enhanced
    { 
      pattern: /art|paint|draw|pottery|craft|sculpture|mixed media|photography|digital art|ceramics|jewelry|fashion/i, 
      typeId: typeCache['visual-arts'],
      subtypeRules: [
        { pattern: /paint/i, subtypeCode: 'painting' },
        { pattern: /draw/i, subtypeCode: 'drawing' },
        { pattern: /sculpture/i, subtypeCode: 'sculpture' },
        { pattern: /pottery/i, subtypeCode: 'pottery' },
        { pattern: /ceramic/i, subtypeCode: 'ceramics' },
        { pattern: /photography|photo/i, subtypeCode: 'photography' },
        { pattern: /digital art|computer art/i, subtypeCode: 'digital-art' },
        { pattern: /printmaking|print/i, subtypeCode: 'printmaking' },
        { pattern: /mixed media/i, subtypeCode: 'mixed-media' },
        { pattern: /craft/i, subtypeCode: 'crafts' },
        { pattern: /jewelry/i, subtypeCode: 'jewelry-making' },
        { pattern: /fashion/i, subtypeCode: 'fashion-design' }
      ]
    },
    
    // Music - Enhanced
    { 
      pattern: /music|piano|guitar|violin|drum|singing|voice|choir|band|orchestra|ukulele|brass|woodwind|theory/i, 
      typeId: typeCache['music'],
      subtypeRules: [
        { pattern: /piano/i, subtypeCode: 'piano' },
        { pattern: /guitar/i, subtypeCode: 'guitar' },
        { pattern: /violin|fiddle/i, subtypeCode: 'violin' },
        { pattern: /drum/i, subtypeCode: 'drums' },
        { pattern: /singing|voice|vocal/i, subtypeCode: 'voice' },
        { pattern: /band/i, subtypeCode: 'band' },
        { pattern: /orchestra/i, subtypeCode: 'orchestra' },
        { pattern: /choir/i, subtypeCode: 'choir' },
        { pattern: /ukulele/i, subtypeCode: 'ukulele' },
        { pattern: /brass|trumpet|trombone|horn/i, subtypeCode: 'brass' },
        { pattern: /woodwind|flute|clarinet|saxophone|oboe/i, subtypeCode: 'woodwind' },
        { pattern: /music theory|theory/i, subtypeCode: 'music-theory' },
        { pattern: /production|recording/i, subtypeCode: 'music-production' }
      ]
    },
    
    // Performing Arts - Enhanced
    { 
      pattern: /drama|theatre|acting|improv|performance|comedy|circus|puppet|story|film/i, 
      typeId: typeCache['performing-arts'],
      subtypeRules: [
        { pattern: /drama/i, subtypeCode: 'drama' },
        { pattern: /musical theatre/i, subtypeCode: 'musical-theatre' },
        { pattern: /acting/i, subtypeCode: 'acting' },
        { pattern: /improv/i, subtypeCode: 'improv' },
        { pattern: /comedy/i, subtypeCode: 'comedy' },
        { pattern: /circus/i, subtypeCode: 'circus-arts' },
        { pattern: /puppet/i, subtypeCode: 'puppetry' },
        { pattern: /story|telling/i, subtypeCode: 'storytelling' },
        { pattern: /film|movie/i, subtypeCode: 'film-making' }
      ]
    },
    
    // Skating & Wheels - NEW comprehensive mapping
    { 
      pattern: /skat|roller|inline|skateboard|scooter|bike|cycling|bmx/i, 
      typeId: typeCache['skating-wheels'],
      subtypeRules: [
        { pattern: /ice skat/i, subtypeCode: 'ice-skating' },
        { pattern: /figure skat/i, subtypeCode: 'figure-skating' },
        { pattern: /roller skat/i, subtypeCode: 'roller-skating' },
        { pattern: /inline/i, subtypeCode: 'inline-skating' },
        { pattern: /skateboard/i, subtypeCode: 'skateboarding' },
        { pattern: /scooter/i, subtypeCode: 'scooter' },
        { pattern: /cycling|bike/i, subtypeCode: 'cycling' },
        { pattern: /bmx/i, subtypeCode: 'bmx' }
      ]
    },
    
    // Gymnastics & Movement - NEW comprehensive mapping
    { 
      pattern: /gymnast|tumbl|trampoline|parkour|acrobat|cheer|rhythmic/i, 
      typeId: typeCache['gymnastics-movement'],
      subtypeRules: [
        { pattern: /gymnast/i, subtypeCode: 'gymnastics' },
        { pattern: /tumbl/i, subtypeCode: 'tumbling' },
        { pattern: /trampoline/i, subtypeCode: 'trampoline' },
        { pattern: /parkour/i, subtypeCode: 'parkour' },
        { pattern: /acrobat/i, subtypeCode: 'acrobatics' },
        { pattern: /cheer/i, subtypeCode: 'cheerleading' },
        { pattern: /rhythmic/i, subtypeCode: 'rhythmic-gymnastics' }
      ]
    },
    
    // Camps - NEW comprehensive mapping
    { 
      pattern: /camp|day camp|overnight|march break|summer camp|winter camp/i, 
      typeId: typeCache['camps'],
      subtypeRules: [
        { pattern: /day camp|full day/i, subtypeCode: 'day-camps' },
        { pattern: /overnight|residential|sleep.?over/i, subtypeCode: 'overnight-camps' },
        { pattern: /sport.*camp/i, subtypeCode: 'sports-camps' },
        { pattern: /art.*camp/i, subtypeCode: 'arts-camps' },
        { pattern: /stem.*camp|science.*camp|tech.*camp/i, subtypeCode: 'stem-camps' },
        { pattern: /adventure.*camp|outdoor.*camp/i, subtypeCode: 'adventure-camps' },
        { pattern: /specialty.*camp|special.*camp/i, subtypeCode: 'specialty-camps' },
        { pattern: /march break|spring break/i, subtypeCode: 'march-break-camps' },
        { pattern: /summer camp/i, subtypeCode: 'summer-camps' }
      ]
    },
    
    // STEM & Education - NEW comprehensive mapping
    { 
      pattern: /science|stem|coding|robot|engineering|math|computer|technology|maker|3d/i, 
      typeId: typeCache['stem-education'],
      subtypeRules: [
        { pattern: /science/i, subtypeCode: 'science' },
        { pattern: /coding|programming/i, subtypeCode: 'coding' },
        { pattern: /robot/i, subtypeCode: 'robotics' },
        { pattern: /engineering/i, subtypeCode: 'engineering' },
        { pattern: /math/i, subtypeCode: 'mathematics' },
        { pattern: /technology/i, subtypeCode: 'technology' },
        { pattern: /computer science/i, subtypeCode: 'computer-science' },
        { pattern: /maker/i, subtypeCode: 'maker-space' },
        { pattern: /3d print/i, subtypeCode: '3d-printing' }
      ]
    },
    
    // Fitness & Wellness - NEW comprehensive mapping
    { 
      pattern: /fitness|yoga|pilates|workout|exercise|strength|cardio|zumba|spin|aerobics|meditation/i, 
      typeId: typeCache['fitness-wellness'],
      subtypeRules: [
        { pattern: /yoga/i, subtypeCode: 'yoga' },
        { pattern: /pilates/i, subtypeCode: 'pilates' },
        { pattern: /zumba/i, subtypeCode: 'zumba' },
        { pattern: /strength|weight/i, subtypeCode: 'strength-training' },
        { pattern: /cardio/i, subtypeCode: 'cardio-fitness' },
        { pattern: /spin/i, subtypeCode: 'spinning' },
        { pattern: /aerobics/i, subtypeCode: 'aerobics' },
        { pattern: /meditation/i, subtypeCode: 'meditation' }
      ]
    },
    
    // Outdoor & Adventure - NEW comprehensive mapping
    { 
      pattern: /outdoor|hiking|climbing|adventure|nature|camping|survival|kayak|canoe|fish|orienteer/i, 
      typeId: typeCache['outdoor-adventure'],
      subtypeRules: [
        { pattern: /hiking|trail/i, subtypeCode: 'hiking' },
        { pattern: /climbing|boulder/i, subtypeCode: 'rock-climbing' },
        { pattern: /camping/i, subtypeCode: 'camping' },
        { pattern: /kayak/i, subtypeCode: 'kayaking' },
        { pattern: /canoe/i, subtypeCode: 'canoeing' },
        { pattern: /fish/i, subtypeCode: 'fishing' },
        { pattern: /nature/i, subtypeCode: 'nature-exploration' },
        { pattern: /survival/i, subtypeCode: 'survival-skills' },
        { pattern: /orienteer/i, subtypeCode: 'orienteering' }
      ]
    },
    
    // Culinary Arts - NEW comprehensive mapping
    { 
      pattern: /cooking|baking|culinary|chef|pastry|knife|cuisine|food|cake decorating/i, 
      typeId: typeCache['culinary-arts'],
      subtypeRules: [
        { pattern: /cooking.*class|cooking/i, subtypeCode: 'cooking-classes' },
        { pattern: /baking/i, subtypeCode: 'baking' },
        { pattern: /pastry/i, subtypeCode: 'pastry-arts' },
        { pattern: /knife/i, subtypeCode: 'knife-skills' },
        { pattern: /international|ethnic|world/i, subtypeCode: 'international-cuisine' },
        { pattern: /healthy/i, subtypeCode: 'healthy-cooking' },
        { pattern: /food safety|safety/i, subtypeCode: 'food-safety' },
        { pattern: /cake decorating|decorating/i, subtypeCode: 'cake-decorating' }
      ]
    },
    
    // Language & Culture - NEW comprehensive mapping
    { 
      pattern: /french|spanish|mandarin|chinese|german|italian|japanese|sign language|asl|culture/i, 
      typeId: typeCache['language-culture'],
      subtypeRules: [
        { pattern: /french/i, subtypeCode: 'french' },
        { pattern: /spanish/i, subtypeCode: 'spanish' },
        { pattern: /mandarin|chinese/i, subtypeCode: 'mandarin' },
        { pattern: /german/i, subtypeCode: 'german' },
        { pattern: /italian/i, subtypeCode: 'italian' },
        { pattern: /japanese/i, subtypeCode: 'japanese' },
        { pattern: /sign language|asl/i, subtypeCode: 'sign-language' },
        { pattern: /culture/i, subtypeCode: 'cultural-studies' }
      ]
    },
    
    // Special Needs Programs - NEW comprehensive mapping
    { 
      pattern: /adaptive|special needs|therapeutic|sensory|mobility|social skills|life skills/i, 
      typeId: typeCache['special-needs-programs'],
      subtypeRules: [
        { pattern: /adaptive.*sport/i, subtypeCode: 'adaptive-sports' },
        { pattern: /sensory/i, subtypeCode: 'sensory-programs' },
        { pattern: /therapeutic/i, subtypeCode: 'therapeutic-recreation' },
        { pattern: /social skill/i, subtypeCode: 'social-skills' },
        { pattern: /life skill/i, subtypeCode: 'life-skills' },
        { pattern: /mobility/i, subtypeCode: 'mobility-programs' }
      ]
    },
    
    // Multi-Sport - NEW comprehensive mapping
    { 
      pattern: /multi.?sport|sport sampling|athletic development|fundamental movement|sport introduction/i, 
      typeId: typeCache['multi-sport'],
      subtypeRules: [
        { pattern: /multi.?sport/i, subtypeCode: 'multi-sport-programs' },
        { pattern: /sport sampling/i, subtypeCode: 'sport-sampling' },
        { pattern: /athletic development/i, subtypeCode: 'athletic-development' },
        { pattern: /fundamental movement/i, subtypeCode: 'fundamental-movement' },
        { pattern: /sport introduction/i, subtypeCode: 'sport-introduction' }
      ]
    },
    
    // Life Skills & Leadership - NEW comprehensive mapping
    { 
      pattern: /leadership|babysit|first aid|cpr|public speaking|financial literacy|volunteer/i, 
      typeId: typeCache['life-skills-leadership'],
      subtypeRules: [
        { pattern: /leadership/i, subtypeCode: 'leadership' },
        { pattern: /babysit/i, subtypeCode: 'babysitting' },
        { pattern: /first aid/i, subtypeCode: 'first-aid' },
        { pattern: /cpr/i, subtypeCode: 'cpr-certification' },
        { pattern: /public speaking/i, subtypeCode: 'public-speaking' },
        { pattern: /financial/i, subtypeCode: 'financial-literacy' },
        { pattern: /volunteer/i, subtypeCode: 'volunteer-training' }
      ]
    },
    
    // Early Development - NEW comprehensive mapping
    { 
      pattern: /learn.*play|play.*learn|early years|tiny tots|parent participation|preschool|toddler|motor skills|sensory play/i, 
      typeId: typeCache['early-development'],
      subtypeRules: [
        { pattern: /play.*learn|learn.*play/i, subtypeCode: 'play-based-learning' },
        { pattern: /parent.*child|parent participation/i, subtypeCode: 'parent-child' },
        { pattern: /social development|social/i, subtypeCode: 'social-development' },
        { pattern: /motor skill/i, subtypeCode: 'motor-skills' },
        { pattern: /pre.?literacy|literacy/i, subtypeCode: 'pre-literacy' },
        { pattern: /pre.?numeracy|numeracy/i, subtypeCode: 'pre-numeracy' },
        { pattern: /sensory play/i, subtypeCode: 'sensory-play' }
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
      
      // If no specific subtype matched, don't assign a generic one
      // Let it remain null so manual classification can be done later
      
      break;
    }
  }
  
  // Default to 'other-activity' if no match
  if (!typeId) {
    typeId = typeCache['other-activity'];
    subtypeId = subtypeCache['general'] || null;
  }
  
  return {
    activityTypeId: typeId,
    activitySubtypeId: subtypeId
  };
}

module.exports = {
  mapActivityType,
  loadTypesCache
};