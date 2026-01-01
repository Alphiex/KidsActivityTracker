// UI Images
export const aiRobotImage = require('./ai-robot.png');

// Direct image mapping by key - organized by activity type directories
export const activityImageMap: { [key: string]: any } = {
  // Swimming & Aquatics
  swimming: require('./activities/swimming_aquatics/swimming.jpg'),

  // Team Sports
  soccer: require('./activities/team_sports/soccer.jpg'),
  hockey: require('./activities/team_sports/hockey.jpg'),
  football: require('./activities/team_sports/football.jpg'),
  lacrosse: require('./activities/team_sports/lacrosse.jpg'),
  sports_general: require('./activities/team_sports/sports_general.jpg'),

  // Individual Sports
  running: require('./activities/individual_sports/running.jpg'),
  climbing: require('./activities/individual_sports/climbing.jpg'),
  archery: require('./activities/individual_sports/archery.jpg'),

  // Racquet Sports
  racquet_sports: require('./activities/racquet_sports/racquet_sports.jpg'),

  // Martial Arts
  karate: require('./activities/martial_arts/karate.jpg'),
  taekwondo: require('./activities/martial_arts/taekwondo.jpg'),

  // Dance
  ballet: require('./activities/dance/ballet.jpg'),
  hip_hop_dance: require('./activities/dance/hip_hop_dance.jpg'),

  // Visual Arts
  arts_crafts: require('./activities/visual_arts/arts_crafts.jpg'),
  pottery: require('./activities/visual_arts/pottery.jpg'),
  crafts: require('./activities/visual_arts/crafts.jpg'),
  drawing: require('./activities/visual_arts/drawing.jpg'),

  // Music
  music: require('./activities/music/music.jpg'),
  choir: require('./activities/music/choir.jpg'),

  // Performing Arts
  theater: require('./activities/performing_arts/theater.jpg'),

  // Skating & Wheels
  skateboarding: require('./activities/skating_wheels/skateboarding.jpg'),
  bmx: require('./activities/skating_wheels/bmx.jpg'),
  scooter: require('./activities/skating_wheels/scooter.jpg'),

  // STEM & Education
  stem: require('./activities/stem_education/stem.jpg'),
  science: require('./activities/stem_education/science.jpg'),
  reading: require('./activities/stem_education/reading.jpg'),
  coding: require('./activities/stem_education/coding.jpg'),
  robotics: require('./activities/stem_education/robotics.jpg'),

  // Fitness & Wellness
  yoga: require('./activities/fitness_wellness/yoga.jpg'),
  meditation: require('./activities/fitness_wellness/meditation.jpg'),

  // Outdoor & Adventure
  nature: require('./activities/outdoor_adventure/nature.jpg'),
  hiking: require('./activities/outdoor_adventure/hiking.jpg'),
  skiing: require('./activities/outdoor_adventure/skiing.jpg'),
  camping: require('./activities/outdoor_adventure/camping.jpg'),

  // Language & Culture
  language: require('./activities/language_culture/language.jpg'),
  french: require('./activities/language_culture/french.jpg'),
  spanish: require('./activities/language_culture/spanish.jpg'),

  // Special Needs Programs
  recreation_center: require('./activities/special_needs/recreation_center.jpg'),
  community_center: require('./activities/special_needs/community_center.jpg'),

  // Life Skills & Leadership
  leadership: require('./activities/life_skills/leadership.jpg'),

  // Early Development
  early_years: require('./activities/early_development/early_years.jpg'),
  toddler_play: require('./activities/early_development/toddler_play.jpg'),
  preschool: require('./activities/early_development/preschool.jpg'),
  kids_activities: require('./activities/early_development/kids_activities.jpg'),
  sensory_play: require('./activities/early_development/sensory_play.jpg'),

  // Other / General
  family_fun: require('./activities/other/family_fun.jpg'),
  youth_activities: require('./activities/other/youth_activities.jpg'),

  // Legacy mappings (kept for backward compatibility)
  sports: require('./activities/multi_sport/sports_general.jpg'),
  visual_arts: require('./activities/visual_arts/arts_crafts.jpg'),
  learn_and_play: require('./activities/early_development/kids_activities.jpg'),
};

// Get image by key with fallback
export const getActivityImageByKey = (key: string) => {
  return activityImageMap[key] || activityImageMap.recreation_center;
};

// Legacy support for ActivityType enum (kept for backward compatibility)
export const getPrimaryActivityImage = (activityTypes: any[]) => {
  // Default fallback
  return activityImageMap.learn_and_play;
};
