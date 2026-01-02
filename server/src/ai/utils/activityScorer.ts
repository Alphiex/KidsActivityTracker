/**
 * Activity Scorer
 *
 * Implements tiered scoring system for activity recommendations.
 * - Tier 1: Hard filters (location, age, registration) - eliminates results
 * - Tier 2: Strong preferences (type, days, budget, interests) - high weight
 * - Tier 3: Soft preferences (provider, diversity, time) - lower weight
 * - Tier 4: Contextual signals (skill, availability, distance) - adjustments
 */

import { Activity, Child, Location } from '../../../generated/prisma';

// Types
export interface UserPreferences {
  preferredActivityTypes?: string[];
  daysOfWeek?: string[];
  priceRange?: { min?: number; max?: number };
  timePreferences?: {
    morning?: boolean;
    afternoon?: boolean;
    evening?: boolean;
  };
  environmentPreference?: 'indoor' | 'outdoor' | 'any';
  distanceRadiusKm?: number;
}

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  interests?: string[];
  skillProgress?: Record<string, 'beginner' | 'intermediate' | 'advanced'>;
}

export interface ScoringContext {
  userLocation: { latitude: number; longitude: number; city?: string };
  children: ChildProfile[];
  preferences: UserPreferences;
  recentActivities?: string[]; // Activity IDs for diversity
  favoriteProviders?: string[]; // Provider IDs
  favoriteActivityTypes?: string[]; // Activity types user has favorited
  // Filter mode for multi-child selection
  // 'or' (default): Show activities suitable for ANY selected child
  // 'and': Show activities suitable for ALL selected children together (premium)
  filterMode?: 'or' | 'and';
}

export interface ConversationOverrides {
  locationOverride?: { city?: string; maxDistanceKm?: number };
  ageOverride?: number;
  daysOverride?: string[];
  ignoreBudget?: boolean;
  preferNewCategories?: boolean;
  skillLevelRequired?: 'beginner' | 'intermediate' | 'advanced';
  explicitRequirements: string[];
}

export interface ScoredActivity {
  activity: Activity & { location?: Location | null };
  score: number;
  distance?: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  activityTypeMatch: number;
  dayOfWeekMatch: number;
  budgetMatch: number;
  interestMatch: number;
  providerBonus: number;
  diversityBonus: number;
  timePreferenceBonus: number;
  skillLevelBonus: number;
  availabilityBonus: number;
  distancePenalty: number;
  explicitRequirementBonus: number;
  favoriteTypeBonus: number;
}

// Scoring weights
const WEIGHTS = {
  // Tier 2: Strong preferences
  ACTIVITY_TYPE_MATCH: 25,
  DAY_OF_WEEK_MATCH: 20,
  BUDGET_MATCH: 15,
  INTEREST_MATCH: 15,

  // Tier 3: Soft preferences
  PROVIDER_FAMILIARITY: 10,
  FAVORITE_TYPE: 10,
  DIVERSITY_BONUS: 5,
  TIME_PREFERENCE: 5,
  ENVIRONMENT_PREFERENCE: 5,

  // Tier 4: Contextual
  SKILL_LEVEL_MATCH: 10,
  SKILL_LEVEL_MISMATCH: -10,
  SPOTS_MANY: 5,
  SPOTS_FEW: -5,
  DISTANCE_PENALTY_PER_5KM: -1,

  // Chat-specific
  EXPLICIT_REQUIREMENT: 30,
};

// Default thresholds
const DEFAULTS = {
  MAX_DISTANCE_KM: 50,
  SPOTS_MANY_THRESHOLD: 10,
  SPOTS_FEW_THRESHOLD: 3,
};

/**
 * Calculate Haversine distance between two points in km
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if activity is within distance threshold
 */
function isWithinDistance(
  activity: Activity & { location?: Location | null },
  userLocation: { latitude: number; longitude: number; city?: string },
  maxDistanceKm: number
): { within: boolean; distance: number | null } {
  // If activity has coordinates
  if (activity.latitude && activity.longitude) {
    const distance = calculateDistanceKm(
      userLocation.latitude,
      userLocation.longitude,
      activity.latitude,
      activity.longitude
    );
    return { within: distance <= maxDistanceKm, distance };
  }

  // If activity has location with coordinates
  if (activity.location?.latitude && activity.location?.longitude) {
    const distance = calculateDistanceKm(
      userLocation.latitude,
      userLocation.longitude,
      activity.location.latitude,
      activity.location.longitude
    );
    return { within: distance <= maxDistanceKm, distance };
  }

  // Fallback to city match if no coordinates
  if (userLocation.city && activity.location?.city) {
    const cityMatch =
      activity.location.city.toLowerCase().includes(userLocation.city.toLowerCase()) ||
      userLocation.city.toLowerCase().includes(activity.location.city.toLowerCase());
    return { within: cityMatch, distance: null };
  }

  // Can't determine - include but mark as unknown distance
  return { within: true, distance: null };
}

/**
 * Check if activity is age compatible with any child
 */
function isAgeCompatible(
  activity: Activity,
  children: ChildProfile[],
  ageOverride?: number
): boolean {
  const ages = ageOverride ? [ageOverride] : children.map((c) => c.age);

  if (ages.length === 0) return true; // No age filter

  const minAge = activity.ageMin ?? 0;
  const maxAge = activity.ageMax ?? 99;

  return ages.some((age) => age >= minAge && age <= maxAge);
}

/**
 * Check if registration is open
 */
function isRegistrationOpen(activity: Activity): boolean {
  const openStatuses = ['Open', 'Available', 'Waitlist', 'Register', 'Enroll'];
  const status = activity.registrationStatus?.toLowerCase() || '';

  // Check against known open statuses
  if (openStatuses.some((s) => status.includes(s.toLowerCase()))) {
    return true;
  }

  // Exclude explicitly closed
  if (status.includes('closed') || status.includes('full') || status.includes('cancelled')) {
    return false;
  }

  // Unknown status - include it
  return true;
}

/**
 * Check if activity matches preferred activity types
 */
function matchesActivityType(
  activity: Activity,
  preferredTypes?: string[]
): boolean {
  if (!preferredTypes || preferredTypes.length === 0) return false;

  const activityCategory = activity.category?.toLowerCase() || '';
  const activityName = activity.name?.toLowerCase() || '';
  const activityDesc = activity.description?.toLowerCase() || '';

  return preferredTypes.some((type) => {
    const typeLower = type.toLowerCase();
    return (
      activityCategory.includes(typeLower) ||
      activityName.includes(typeLower) ||
      activityDesc.includes(typeLower)
    );
  });
}

/**
 * Check if activity matches available days
 */
function matchesDaysOfWeek(
  activity: Activity,
  preferredDays?: string[]
): boolean {
  if (!preferredDays || preferredDays.length === 0) return false;

  const activityDays = activity.dayOfWeek || [];
  if (activityDays.length === 0) return false;

  const normalizedPreferred = preferredDays.map((d) => d.toLowerCase());
  const normalizedActivity = activityDays.map((d) => d.toLowerCase());

  return normalizedActivity.some((day) => normalizedPreferred.includes(day));
}

/**
 * Check if activity is within budget
 */
function isWithinBudget(
  activity: Activity,
  priceRange?: { min?: number; max?: number }
): boolean {
  if (!priceRange) return true;

  const cost = activity.cost ?? 0;

  if (priceRange.min !== undefined && cost < priceRange.min) return false;
  if (priceRange.max !== undefined && cost > priceRange.max) return false;

  return true;
}

/**
 * Check if activity matches child interests
 */
function matchesChildInterests(
  activity: Activity,
  children: ChildProfile[]
): boolean {
  const allInterests = children.flatMap((c) => c.interests || []);
  if (allInterests.length === 0) return false;

  const activityCategory = activity.category?.toLowerCase() || '';
  const activityName = activity.name?.toLowerCase() || '';
  const activityDesc = activity.description?.toLowerCase() || '';

  return allInterests.some((interest) => {
    const interestLower = interest.toLowerCase();
    return (
      activityCategory.includes(interestLower) ||
      activityName.includes(interestLower) ||
      activityDesc.includes(interestLower)
    );
  });
}

/**
 * Check if activity matches time preference
 */
function matchesTimePreference(
  activity: Activity,
  timePrefs?: { morning?: boolean; afternoon?: boolean; evening?: boolean }
): boolean {
  if (!timePrefs) return false;

  const startTime = activity.startTime?.toLowerCase() || '';
  if (!startTime) return false;

  // Parse hour from time string
  const hourMatch = startTime.match(/(\d{1,2})/);
  if (!hourMatch) return false;

  let hour = parseInt(hourMatch[1], 10);
  if (startTime.includes('pm') && hour !== 12) hour += 12;
  if (startTime.includes('am') && hour === 12) hour = 0;

  // Classify time of day
  const isMorning = hour >= 6 && hour < 12;
  const isAfternoon = hour >= 12 && hour < 17;
  const isEvening = hour >= 17 && hour < 22;

  return (
    (timePrefs.morning && isMorning) ||
    (timePrefs.afternoon && isAfternoon) ||
    (timePrefs.evening && isEvening)
  );
}

/**
 * Check if activity matches explicit requirement from conversation
 */
function matchesExplicitRequirement(
  activity: Activity,
  requirement: string
): boolean {
  const reqLower = requirement.toLowerCase();
  const activityName = activity.name?.toLowerCase() || '';
  const activityCategory = activity.category?.toLowerCase() || '';
  const activityDesc = activity.description?.toLowerCase() || '';

  // Handle common requirement variations
  const variations = expandSearchTerm(reqLower);

  return variations.some(
    (term) =>
      activityName.includes(term) ||
      activityCategory.includes(term) ||
      activityDesc.includes(term)
  );
}

/**
 * Expand search term to include common variations
 */
function expandSearchTerm(term: string): string[] {
  const variations: string[] = [term];

  // Handle -ing suffix (skating -> skate, swimming -> swim)
  if (term.endsWith('ing')) {
    const base = term.slice(0, -3);
    if (base.length >= 3) {
      variations.push(base);
      // Handle doubled consonants (swimming -> swim)
      if (base.length >= 4 && base[base.length - 1] === base[base.length - 2]) {
        variations.push(base.slice(0, -1));
      }
    }
  }

  // Handle -s suffix for plurals (sports -> sport)
  if (term.endsWith('s') && !term.endsWith('ss')) {
    variations.push(term.slice(0, -1));
  }

  // Handle base forms that might need -ing
  if (!term.endsWith('ing') && !term.endsWith('e')) {
    variations.push(term + 'ing');
  }
  if (term.endsWith('e')) {
    variations.push(term.slice(0, -1) + 'ing');
  }

  // Common synonyms
  const synonyms: Record<string, string[]> = {
    swimming: ['swim', 'aquatics', 'pool'],
    skating: ['skate', 'ice skating', 'hockey'],
    soccer: ['football', 'futbol'],
    basketball: ['hoops', 'bball'],
    art: ['arts', 'crafts', 'creative', 'painting', 'drawing'],
    music: ['musical', 'piano', 'guitar', 'violin', 'singing'],
    dance: ['dancing', 'ballet', 'hip hop'],
    martial: ['karate', 'taekwondo', 'judo', 'martial arts'],
    coding: ['programming', 'computer', 'tech', 'stem'],
    outdoor: ['outside', 'nature', 'hiking'],
    indoor: ['inside', 'gymnasium'],
    weekend: ['saturday', 'sunday'],
  };

  Object.entries(synonyms).forEach(([key, values]) => {
    if (term.includes(key)) {
      variations.push(...values);
    }
    if (values.some((v) => term.includes(v))) {
      variations.push(key);
    }
  });

  return [...new Set(variations)];
}

/**
 * Get skill level bonus/penalty
 */
function getSkillLevelBonus(
  activity: Activity,
  children: ChildProfile[],
  requiredLevel?: 'beginner' | 'intermediate' | 'advanced'
): number {
  // If specific level required
  if (requiredLevel) {
    const activityDesc = (activity.description || '').toLowerCase();
    const activityName = (activity.name || '').toLowerCase();

    const levelIndicators: Record<string, string[]> = {
      beginner: ['beginner', 'intro', 'introduction', 'first time', 'novice', 'level 1', 'learn to'],
      intermediate: ['intermediate', 'level 2', 'level 3', 'continuing'],
      advanced: ['advanced', 'competitive', 'level 4', 'level 5', 'elite', 'rep'],
    };

    const hasLevel = levelIndicators[requiredLevel].some(
      (indicator) => activityDesc.includes(indicator) || activityName.includes(indicator)
    );

    if (hasLevel) return WEIGHTS.SKILL_LEVEL_MATCH;

    // Check if it's explicitly a different level
    const otherLevels = Object.entries(levelIndicators)
      .filter(([level]) => level !== requiredLevel)
      .flatMap(([, indicators]) => indicators);

    const hasDifferentLevel = otherLevels.some(
      (indicator) => activityDesc.includes(indicator) || activityName.includes(indicator)
    );

    if (hasDifferentLevel) return WEIGHTS.SKILL_LEVEL_MISMATCH;
  }

  // Match based on child skill progress
  const category = activity.category?.toLowerCase() || '';
  for (const child of children) {
    if (!child.skillProgress) continue;

    for (const [skill, level] of Object.entries(child.skillProgress)) {
      if (category.includes(skill.toLowerCase())) {
        const activityDesc = (activity.description || '').toLowerCase();
        const activityName = (activity.name || '').toLowerCase();

        // Check if activity level matches child's level
        const levelIndicators: Record<string, string[]> = {
          beginner: ['beginner', 'intro', 'learn to', 'level 1'],
          intermediate: ['intermediate', 'level 2', 'level 3'],
          advanced: ['advanced', 'competitive', 'level 4'],
        };

        const matchingIndicators = levelIndicators[level] || [];
        const hasMatch = matchingIndicators.some(
          (indicator) => activityDesc.includes(indicator) || activityName.includes(indicator)
        );

        if (hasMatch) return WEIGHTS.SKILL_LEVEL_MATCH;
      }
    }
  }

  return 0;
}

/**
 * Get availability bonus/penalty based on spots
 */
function getAvailabilityBonus(activity: Activity): number {
  const spots = activity.spotsAvailable;

  if (spots === null || spots === undefined) return 0;
  if (spots >= DEFAULTS.SPOTS_MANY_THRESHOLD) return WEIGHTS.SPOTS_MANY;
  if (spots <= DEFAULTS.SPOTS_FEW_THRESHOLD && spots > 0) return WEIGHTS.SPOTS_FEW;

  return 0;
}

/**
 * Get distance penalty (closer is better)
 */
function getDistancePenalty(distance: number | null): number {
  if (distance === null) return 0;

  // -1 point per 5km
  return Math.floor(distance / 5) * WEIGHTS.DISTANCE_PENALTY_PER_5KM;
}

/**
 * Score a single activity for recommendations (profile-driven)
 */
export function scoreForRecommendations(
  activity: Activity & { location?: Location | null; provider?: { id: string; name: string } | null },
  context: ScoringContext
): ScoredActivity | null {
  const maxDistance = context.preferences.distanceRadiusKm || DEFAULTS.MAX_DISTANCE_KM;

  // TIER 1: HARD FILTERS
  const distanceCheck = isWithinDistance(activity, context.userLocation, maxDistance);
  if (!distanceCheck.within) return null;

  if (!isAgeCompatible(activity, context.children)) return null;

  if (!isRegistrationOpen(activity)) return null;

  // TIER 2-4: SCORING
  const breakdown: ScoreBreakdown = {
    activityTypeMatch: matchesActivityType(activity, context.preferences.preferredActivityTypes)
      ? WEIGHTS.ACTIVITY_TYPE_MATCH
      : 0,
    dayOfWeekMatch: matchesDaysOfWeek(activity, context.preferences.daysOfWeek)
      ? WEIGHTS.DAY_OF_WEEK_MATCH
      : 0,
    budgetMatch: isWithinBudget(activity, context.preferences.priceRange)
      ? WEIGHTS.BUDGET_MATCH
      : 0,
    interestMatch: matchesChildInterests(activity, context.children)
      ? WEIGHTS.INTEREST_MATCH
      : 0,
    providerBonus:
      activity.provider && context.favoriteProviders?.includes(activity.provider.id)
        ? WEIGHTS.PROVIDER_FAMILIARITY
        : 0,
    favoriteTypeBonus: matchesActivityType(activity, context.favoriteActivityTypes)
      ? WEIGHTS.FAVORITE_TYPE
      : 0,
    diversityBonus:
      context.recentActivities && !context.recentActivities.includes(activity.id)
        ? WEIGHTS.DIVERSITY_BONUS
        : 0,
    timePreferenceBonus: matchesTimePreference(activity, context.preferences.timePreferences)
      ? WEIGHTS.TIME_PREFERENCE
      : 0,
    skillLevelBonus: getSkillLevelBonus(activity, context.children),
    availabilityBonus: getAvailabilityBonus(activity),
    distancePenalty: getDistancePenalty(distanceCheck.distance),
    explicitRequirementBonus: 0, // Not used in recommendations
  };

  const score = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  return {
    activity,
    score,
    distance: distanceCheck.distance ?? undefined,
    scoreBreakdown: breakdown,
  };
}

/**
 * Score a single activity for chat (conversation-driven with profile context)
 */
export function scoreForChat(
  activity: Activity & { location?: Location | null; provider?: { id: string; name: string } | null },
  context: ScoringContext,
  overrides: ConversationOverrides
): ScoredActivity | null {
  // TIER 1: HARD FILTERS (with override support)
  const maxDistance =
    overrides.locationOverride?.maxDistanceKm ||
    context.preferences.distanceRadiusKm ||
    DEFAULTS.MAX_DISTANCE_KM;

  const effectiveLocation = overrides.locationOverride?.city
    ? { ...context.userLocation, city: overrides.locationOverride.city }
    : context.userLocation;

  const distanceCheck = isWithinDistance(activity, effectiveLocation, maxDistance);
  if (!distanceCheck.within) return null;

  if (!isAgeCompatible(activity, context.children, overrides.ageOverride)) return null;

  if (!isRegistrationOpen(activity)) return null;

  // Hard filter on explicit days if specified
  if (overrides.daysOverride && overrides.daysOverride.length > 0) {
    if (!matchesDaysOfWeek(activity, overrides.daysOverride)) return null;
  }

  // TIER 2-4: SCORING
  const breakdown: ScoreBreakdown = {
    // Explicit requirements from conversation get highest weight
    explicitRequirementBonus:
      overrides.explicitRequirements.filter((req) => matchesExplicitRequirement(activity, req))
        .length * WEIGHTS.EXPLICIT_REQUIREMENT,

    // Profile-based scoring (secondary weight in chat)
    activityTypeMatch: matchesActivityType(activity, context.preferences.preferredActivityTypes)
      ? WEIGHTS.ACTIVITY_TYPE_MATCH * 0.4 // Reduced weight in chat
      : 0,
    dayOfWeekMatch:
      !overrides.daysOverride && matchesDaysOfWeek(activity, context.preferences.daysOfWeek)
        ? WEIGHTS.DAY_OF_WEEK_MATCH * 0.5
        : 0,
    budgetMatch:
      !overrides.ignoreBudget && isWithinBudget(activity, context.preferences.priceRange)
        ? WEIGHTS.BUDGET_MATCH * 0.5
        : 0,
    interestMatch: matchesChildInterests(activity, context.children)
      ? WEIGHTS.INTEREST_MATCH * 0.5
      : 0,
    providerBonus:
      activity.provider && context.favoriteProviders?.includes(activity.provider.id)
        ? WEIGHTS.PROVIDER_FAMILIARITY
        : 0,
    favoriteTypeBonus: matchesActivityType(activity, context.favoriteActivityTypes)
      ? WEIGHTS.FAVORITE_TYPE
      : 0,
    diversityBonus: overrides.preferNewCategories
      ? (context.recentActivities && !context.recentActivities.includes(activity.id)
          ? WEIGHTS.DIVERSITY_BONUS * 2
          : 0)
      : 0,
    timePreferenceBonus: 0, // Less relevant in chat
    skillLevelBonus: getSkillLevelBonus(
      activity,
      context.children,
      overrides.skillLevelRequired
    ),
    availabilityBonus: getAvailabilityBonus(activity),
    distancePenalty: getDistancePenalty(distanceCheck.distance),
  };

  const score = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  return {
    activity,
    score,
    distance: distanceCheck.distance ?? undefined,
    scoreBreakdown: breakdown,
  };
}

/**
 * Score a single activity for scheduler (calendar-aware)
 */
export function scoreForScheduler(
  activity: Activity & { location?: Location | null },
  child: ChildProfile,
  existingCalendar: Array<{ category?: string; dayOfWeek?: string[]; startTime?: string }>,
  context: ScoringContext
): ScoredActivity | null {
  const maxDistance = context.preferences.distanceRadiusKm || DEFAULTS.MAX_DISTANCE_KM;

  // TIER 1: HARD FILTERS
  const distanceCheck = isWithinDistance(activity, context.userLocation, maxDistance);
  if (!distanceCheck.within) return null;

  if (!isAgeCompatible(activity, [child])) return null;

  if (!isRegistrationOpen(activity)) return null;

  // Check for time conflicts
  const activityDays = activity.dayOfWeek || [];
  const activityStart = activity.startTime;

  for (const existing of existingCalendar) {
    const existingDays = existing.dayOfWeek || [];
    const existingStart = existing.startTime;

    // Check day overlap
    const dayOverlap = activityDays.some((d) =>
      existingDays.map((e) => e.toLowerCase()).includes(d.toLowerCase())
    );

    if (dayOverlap && activityStart && existingStart) {
      // Simple time conflict check (within 1 hour)
      const parseTime = (t: string): number => {
        const match = t.match(/(\d{1,2})/);
        if (!match) return 0;
        let hour = parseInt(match[1], 10);
        if (t.toLowerCase().includes('pm') && hour !== 12) hour += 12;
        if (t.toLowerCase().includes('am') && hour === 12) hour = 0;
        return hour;
      };

      const actHour = parseTime(activityStart);
      const existHour = parseTime(existingStart);

      if (Math.abs(actHour - existHour) < 2) {
        return null; // Time conflict
      }
    }
  }

  // SCHEDULER-SPECIFIC SCORING
  const existingCategories = existingCalendar
    .map((a) => a.category?.toLowerCase())
    .filter(Boolean) as string[];
  const existingDays = existingCalendar.flatMap((a) => a.dayOfWeek || []).map((d) => d.toLowerCase());

  // Count activities per day
  const dayLoad: Record<string, number> = {};
  for (const day of existingDays) {
    dayLoad[day] = (dayLoad[day] || 0) + 1;
  }

  const breakdown: ScoreBreakdown = {
    activityTypeMatch: matchesActivityType(activity, context.preferences.preferredActivityTypes)
      ? WEIGHTS.ACTIVITY_TYPE_MATCH * 0.5
      : 0,
    dayOfWeekMatch: 0, // Different handling for scheduler
    budgetMatch: isWithinBudget(activity, context.preferences.priceRange)
      ? WEIGHTS.BUDGET_MATCH * 0.5
      : 0,
    interestMatch: matchesChildInterests(activity, [child])
      ? WEIGHTS.INTEREST_MATCH
      : 0,
    providerBonus: 0,
    favoriteTypeBonus: 0,
    // Category diversity is MORE important for scheduler
    diversityBonus: !existingCategories.includes(activity.category?.toLowerCase() || '')
      ? WEIGHTS.DIVERSITY_BONUS * 3
      : 0,
    timePreferenceBonus: 0,
    skillLevelBonus: getSkillLevelBonus(activity, [child]),
    availabilityBonus: getAvailabilityBonus(activity),
    distancePenalty: getDistancePenalty(distanceCheck.distance),
    explicitRequirementBonus: 0,
  };

  // Balance across the week bonus
  for (const day of activityDays) {
    const dayLower = day.toLowerCase();
    const load = dayLoad[dayLower] || 0;

    if (load === 0) {
      breakdown.dayOfWeekMatch += 15; // Empty day gets priority
    } else if (load >= 2) {
      breakdown.dayOfWeekMatch -= 10; // Already busy day
    }
  }

  const score = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  return {
    activity,
    score,
    distance: distanceCheck.distance ?? undefined,
    scoreBreakdown: breakdown,
  };
}

/**
 * Score and rank a list of activities
 */
export function scoreAndRankActivities(
  activities: Array<Activity & { location?: Location | null; provider?: { id: string; name: string } | null }>,
  context: ScoringContext,
  mode: 'recommendations' | 'chat' | 'scheduler',
  options?: {
    overrides?: ConversationOverrides;
    child?: ChildProfile;
    existingCalendar?: Array<{ category?: string; dayOfWeek?: string[]; startTime?: string }>;
    limit?: number;
    ensureDiversity?: boolean;
  }
): ScoredActivity[] {
  const scored: ScoredActivity[] = [];

  for (const activity of activities) {
    let result: ScoredActivity | null = null;

    switch (mode) {
      case 'recommendations':
        result = scoreForRecommendations(activity, context);
        break;
      case 'chat':
        result = scoreForChat(
          activity,
          context,
          options?.overrides || { explicitRequirements: [] }
        );
        break;
      case 'scheduler':
        if (options?.child && options?.existingCalendar) {
          result = scoreForScheduler(activity, options.child, options.existingCalendar, context);
        }
        break;
    }

    if (result) {
      scored.push(result);
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Apply diversity if requested
  if (options?.ensureDiversity) {
    return applyDiversity(scored, options.limit || 15);
  }

  return scored.slice(0, options?.limit || 15);
}

/**
 * Apply diversity to ensure variety in results
 */
function applyDiversity(scored: ScoredActivity[], limit: number): ScoredActivity[] {
  const result: ScoredActivity[] = [];
  const categoryCount: Record<string, number> = {};
  const providerCount: Record<string, number> = {};

  for (const item of scored) {
    if (result.length >= limit) break;

    const category = item.activity.category?.toLowerCase() || 'unknown';
    const provider = (item.activity as any).provider?.id || 'unknown';

    // Limit to 3 per category, 2 per provider in top results
    if ((categoryCount[category] || 0) >= 3) continue;
    if ((providerCount[provider] || 0) >= 2) continue;

    result.push(item);
    categoryCount[category] = (categoryCount[category] || 0) + 1;
    providerCount[provider] = (providerCount[provider] || 0) + 1;
  }

  // Fill remaining slots if diversity caused gaps
  if (result.length < limit) {
    for (const item of scored) {
      if (result.length >= limit) break;
      if (!result.includes(item)) {
        result.push(item);
      }
    }
  }

  return result;
}

export default {
  scoreForRecommendations,
  scoreForChat,
  scoreForScheduler,
  scoreAndRankActivities,
  calculateDistanceKm,
  expandSearchTerm,
};
