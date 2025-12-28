// Direct image mapping by key
export const activityImageMap: { [key: string]: any } = {
  // Swimming & Aquatics
  swimming: require('./activities/swimming.jpg'),
  water_safety: require('./activities/water_safety.jpg'),
  diving: require('./activities/diving.jpg'),
  
  // Team Sports
  basketball: require('./activities/basketball.jpg'),
  soccer: require('./activities/soccer.jpg'),
  tennis: require('./activities/tennis.jpg'),
  badminton: require('./activities/badminton.jpg'),
  volleyball: require('./activities/volleyball.jpg'),
  hockey: require('./activities/hockey.jpg'),
  baseball: require('./activities/baseball.jpg'),
  sports_general: require('./activities/sports_general.jpg'),
  racquet_sports: require('./activities/racquet_sports.jpg'),
  
  // Dance & Movement
  dance: require('./activities/dance.jpg'),
  ballet: require('./activities/ballet.jpg'),
  hip_hop_dance: require('./activities/hip_hop_dance.jpg'),
  cheerleading: require('./activities/cheerleading.jpg'),
  
  // Arts & Crafts
  arts_crafts: require('./activities/arts_crafts.jpg'),
  pottery: require('./activities/pottery.jpg'),
  painting: require('./activities/painting.jpg'),
  crafts: require('./activities/crafts.jpg'),
  theater: require('./activities/theater.jpg'),
  
  // Music
  music: require('./activities/music.jpg'),
  piano: require('./activities/piano.jpg'),
  guitar: require('./activities/guitar.jpg'),
  drums: require('./activities/drums.jpg'),
  
  // Fitness & Wellness
  fitness: require('./activities/fitness.jpg'),
  yoga: require('./activities/yoga.jpg'),
  climbing: require('./activities/climbing.jpg'),
  gym: require('./activities/gym.jpg'),
  running: require('./activities/running.jpg'),
  gymnastics: require('./activities/gymnastics.jpg'),
  
  // Martial Arts
  martial_arts: require('./activities/martial_arts.jpg'),
  karate: require('./activities/karate.jpg'),
  
  // Educational
  stem: require('./activities/stem.jpg'),
  cooking: require('./activities/cooking.jpg'),
  science: require('./activities/science.jpg'),
  leadership: require('./activities/leadership.jpg'),
  language: require('./activities/language.jpg'),
  reading: require('./activities/reading.jpg'),
  
  // Outdoor & Camps
  summer_camp: require('./activities/summer_camp.jpg'),
  outdoor: require('./activities/outdoor.jpg'),
  nature: require('./activities/nature.jpg'),
  playground: require('./activities/playground.jpg'),
  hiking: require('./activities/hiking.jpg'),
  skiing: require('./activities/skiing.jpg'),
  
  // Early Years
  early_years: require('./activities/early_years.jpg'),
  toddler_play: require('./activities/toddler_play.jpg'),
  preschool: require('./activities/preschool.jpg'),
  kids_activities: require('./activities/kids_activities.jpg'),
  
  // Special Programs
  kids_night_out: require('./activities/kids_night_out.jpg'),
  youth_activities: require('./activities/youth_activities.jpg'),
  
  // Skating
  ice_skating: require('./activities/ice_skating.jpg'),
  skateboarding: require('./activities/skateboarding.jpg'),
  
  // General
  recreation_center: require('./activities/recreation_center.jpg'),
  community_center: require('./activities/community_center.jpg'),
  family_fun: require('./activities/family_fun.jpg'),
  
  // Legacy mappings (kept for backward compatibility)
  camps: require('./activities/summer_camp.jpg'),
  sports: require('./activities/sports_general.jpg'),
  visual_arts: require('./activities/arts_crafts.jpg'),
  learn_and_play: require('./activities/kids_activities.jpg'),
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