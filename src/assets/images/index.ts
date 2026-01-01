// UI Images
export const aiRobotImage = require('./ai-robot.png');
export const appLogoImage = require('./app-logo.png');

// Activity Type fallback images (used when specific activity image not available)
export const activityTypeImages: { [key: string]: any } = {
  'Swimming & Aquatics': require('./activities/swimming_aquatics/water_safety.png'),
  'Team Sports': require('./activities/team_sports/type_team_sports.png'),
  'Individual Sports': require('./activities/individual_sports/type_individual_sports.png'),
  'Racquet Sports': require('./activities/racquet_sports/type_racquet_sports.png'),
  'Martial Arts': require('./activities/martial_arts/type_martial_arts.png'),
  'Dance': require('./activities/dance/type_dance.png'),
  'Visual Arts': require('./activities/visual_arts/type_visual_arts.png'),
  'Music': require('./activities/music/type_music.png'),
  'Performing Arts': require('./activities/performing_arts/type_performing_arts.png'),
  'Skating & Wheels': require('./activities/skating_wheels/type_skating_wheels.png'),
  'Gymnastics & Movement': require('./activities/gymnastics_movement/gymnastics.png'),
  'Camps': require('./activities/camps/type_camps.png'),
  'STEM & Education': require('./activities/stem_education/type_stem_education.png'),
  'Fitness & Wellness': require('./activities/fitness_wellness/type_fitness_wellness.png'),
  'Outdoor & Adventure': require('./activities/outdoor_adventure/type_outdoor_adventure.png'),
  'Culinary Arts': require('./activities/culinary_arts/type_culinary_arts.png'),
  'Language & Culture': require('./activities/language_culture/type_language_culture.png'),
  'Special Needs Programs': require('./activities/special_needs/type_special_needs.png'),
  'Multi-Sport': require('./activities/multi_sport/type_multi_sport.png'),
  'Life Skills & Leadership': require('./activities/life_skills/type_life_skills.png'),
  'Early Development': require('./activities/early_development/type_early_development.png'),
  'Other Activity': require('./activities/other/type_other.png'),
};

// Direct image mapping by key - prefers PNG, falls back to JPG
export const activityImageMap: { [key: string]: any } = {
  // === Swimming & Aquatics ===
  swimming: require('./activities/swimming_aquatics/swimming.jpg'),
  water_safety: require('./activities/swimming_aquatics/water_safety.png'),
  water_polo: require('./activities/swimming_aquatics/water_polo.png'),

  // === Team Sports ===
  basketball: require('./activities/team_sports/basketball.png'),
  volleyball: require('./activities/team_sports/volleyball.png'),
  baseball: require('./activities/team_sports/baseball.png'),
  rugby: require('./activities/team_sports/rugby.png'),
  soccer: require('./activities/team_sports/soccer.jpg'),
  hockey: require('./activities/team_sports/hockey.jpg'),
  football: require('./activities/team_sports/football.jpg'),
  lacrosse: require('./activities/team_sports/lacrosse.jpg'),
  sports_general: require('./activities/team_sports/sports_general.jpg'),

  // === Individual Sports ===
  cycling: require('./activities/individual_sports/cycling.png'),
  golf: require('./activities/individual_sports/golf.png'),
  fencing: require('./activities/individual_sports/fencing.png'),
  running: require('./activities/individual_sports/running.jpg'),
  climbing: require('./activities/individual_sports/climbing.jpg'),
  archery: require('./activities/individual_sports/archery.jpg'),

  // === Racquet Sports ===
  tennis: require('./activities/racquet_sports/tennis.png'),
  badminton: require('./activities/racquet_sports/badminton.png'),
  table_tennis: require('./activities/racquet_sports/table_tennis.png'),
  squash: require('./activities/racquet_sports/squash.png'),
  pickleball: require('./activities/racquet_sports/pickleball.png'),
  racquet_sports: require('./activities/racquet_sports/racquet_sports.jpg'),

  // === Martial Arts ===
  martial_arts: require('./activities/martial_arts/martial_arts.png'),
  judo: require('./activities/martial_arts/judo.png'),
  boxing: require('./activities/martial_arts/boxing.png'),
  karate: require('./activities/martial_arts/karate.jpg'),
  taekwondo: require('./activities/martial_arts/taekwondo.jpg'),

  // === Dance ===
  dance: require('./activities/dance/dance.png'),
  tap_dance: require('./activities/dance/tap_dance.png'),
  contemporary: require('./activities/dance/contemporary.png'),
  ballet: require('./activities/dance/ballet.jpg'),
  hip_hop_dance: require('./activities/dance/hip_hop_dance.jpg'),

  // === Visual Arts ===
  sculpture: require('./activities/visual_arts/sculpture.png'),
  arts_crafts: require('./activities/visual_arts/arts_crafts.jpg'),
  pottery: require('./activities/visual_arts/pottery.jpg'),
  crafts: require('./activities/visual_arts/crafts.jpg'),
  drawing: require('./activities/visual_arts/drawing.jpg'),
  painting: require('./activities/visual_arts/arts_crafts.jpg'), // Fallback - painting.png not generated

  // === Music ===
  piano: require('./activities/music/piano.png'),
  guitar: require('./activities/music/guitar.png'),
  drums: require('./activities/music/drums.png'),
  violin: require('./activities/music/violin.png'),
  band: require('./activities/music/band.png'),
  music: require('./activities/music/music.jpg'),
  choir: require('./activities/music/choir.jpg'),

  // === Performing Arts ===
  drama: require('./activities/performing_arts/drama.png'),
  musical_theatre: require('./activities/performing_arts/musical_theatre.png'),
  improv: require('./activities/performing_arts/improv.png'),
  circus: require('./activities/performing_arts/circus.png'),
  theater: require('./activities/performing_arts/theater.jpg'),

  // === Skating & Wheels ===
  ice_skating: require('./activities/skating_wheels/ice_skating.png'),
  roller_skating: require('./activities/skating_wheels/roller_skating.png'),
  inline_skating: require('./activities/skating_wheels/inline_skating.png'),
  skateboarding: require('./activities/skating_wheels/skateboarding.jpg'),
  bmx: require('./activities/skating_wheels/bmx.jpg'),
  scooter: require('./activities/skating_wheels/scooter.jpg'),

  // === Gymnastics & Movement ===
  gymnastics: require('./activities/gymnastics_movement/gymnastics.png'),
  trampoline: require('./activities/gymnastics_movement/trampoline.png'),
  parkour: require('./activities/gymnastics_movement/parkour.png'),
  cheerleading: require('./activities/gymnastics_movement/cheerleading.png'),

  // === Camps ===
  summer_camp: require('./activities/camps/summer_camp.png'),

  // === STEM & Education ===
  stem: require('./activities/stem_education/stem.jpg'),
  science: require('./activities/stem_education/science.jpg'),
  reading: require('./activities/stem_education/reading.jpg'),
  coding: require('./activities/stem_education/coding.jpg'),
  robotics: require('./activities/stem_education/robotics.jpg'),

  // === Fitness & Wellness ===
  pilates: require('./activities/fitness_wellness/pilates.png'),
  yoga: require('./activities/fitness_wellness/yoga.jpg'),
  meditation: require('./activities/fitness_wellness/meditation.jpg'),

  // === Outdoor & Adventure ===
  nature: require('./activities/outdoor_adventure/nature.jpg'),
  hiking: require('./activities/outdoor_adventure/hiking.jpg'),
  skiing: require('./activities/outdoor_adventure/skiing.jpg'),
  camping: require('./activities/outdoor_adventure/camping.jpg'),

  // === Language & Culture ===
  language: require('./activities/language_culture/language.jpg'),
  french: require('./activities/language_culture/french.jpg'),
  spanish: require('./activities/language_culture/spanish.jpg'),

  // === Special Needs Programs ===
  recreation_center: require('./activities/special_needs/recreation_center.jpg'),
  community_center: require('./activities/special_needs/community_center.jpg'),

  // === Life Skills & Leadership ===
  leadership: require('./activities/life_skills/leadership.jpg'),

  // === Early Development ===
  early_years: require('./activities/early_development/early_years.jpg'),
  toddler_play: require('./activities/early_development/toddler_play.jpg'),
  preschool: require('./activities/early_development/preschool.jpg'),
  kids_activities: require('./activities/early_development/kids_activities.jpg'),
  sensory_play: require('./activities/early_development/sensory_play.jpg'),

  // === Other / General ===
  family_fun: require('./activities/other/family_fun.jpg'),
  youth_activities: require('./activities/other/youth_activities.jpg'),

  // Legacy mappings (kept for backward compatibility)
  sports: require('./activities/multi_sport/sports_general.jpg'),
  visual_arts: require('./activities/visual_arts/arts_crafts.jpg'),
  learn_and_play: require('./activities/early_development/kids_activities.jpg'),
};

// Default fallback image
const defaultImage = activityTypeImages['Other Activity'];

// Get image by key with fallback to activity type, then default
export const getActivityImageByKey = (key: string, activityType?: string) => {
  // Try exact key match first
  if (activityImageMap[key]) {
    return activityImageMap[key];
  }

  // Try activity type fallback
  if (activityType && activityTypeImages[activityType]) {
    return activityTypeImages[activityType];
  }

  // Return default
  return defaultImage;
};

// Get activity type image directly
export const getActivityTypeImage = (activityType: string) => {
  return activityTypeImages[activityType] || defaultImage;
};

// Legacy support for ActivityType enum (kept for backward compatibility)
export const getPrimaryActivityImage = (activityTypes: any[]) => {
  if (activityTypes && activityTypes.length > 0) {
    const firstType = activityTypes[0];
    if (typeof firstType === 'string' && activityTypeImages[firstType]) {
      return activityTypeImages[firstType];
    }
  }
  return defaultImage;
};
