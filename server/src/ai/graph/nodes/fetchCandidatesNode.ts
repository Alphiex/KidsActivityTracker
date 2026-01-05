/**
 * Fetch Candidates Node
 *
 * Supports two filter modes:
 * - 'or' (Any child): Searches each child INDEPENDENTLY and merges results
 * - 'and' (Together): Finds activities ALL children can do together
 *
 * For OR mode:
 * - Each child searched with their own preferences
 * - Results merged (union) across all children
 * - Activity matches if it works for ANY child
 *
 * For AND mode:
 * - Single search with combined constraints
 * - Age range must fit ALL children
 * - Gender: only unisex if children have different genders
 * - Location: uses first child's location (they're doing it together)
 * - Higher priority for activities matching more children's preferences
 */

import { AIGraphStateType } from '../state';
import { CompressedActivity, ActivitySearchParams, ChildAIProfile } from '../../types/ai.types';
import { PrismaClient } from '../../../../generated/prisma';
import { EnhancedActivityService } from '../../../services/activityService.enhanced';
import { compressActivities } from '../../utils/contextCompressor';

// Singleton prisma instance
let _prisma: PrismaClient | null = null;
let _activityService: EnhancedActivityService | null = null;

function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

function getActivityService(): EnhancedActivityService {
  if (!_activityService) {
    _activityService = new EnhancedActivityService(getPrisma());
  }
  return _activityService;
}

/**
 * Validate coordinates are within Canada (roughly)
 * Canada spans roughly: lat 41.7-83.1, lon -141 to -52
 */
function isValidCanadianLocation(lat: number, lon: number): boolean {
  return lat >= 41.5 && lat <= 84 && lon >= -141 && lon <= -52;
}

/**
 * Shuffle array in place (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Build search filters for a single child (used in OR mode)
 */
function buildChildSearchFilters(
  child: ChildAIProfile,
  baseFilters: ActivitySearchParams
): any {
  const filters: any = {
    ...baseFilters,
    limit: 30, // Get candidates per child
    hideClosedActivities: true,
    sponsoredMode: 'include', // Include sponsored but don't prioritize yet
  };

  // Apply child's location (REQUIRED - use coordinates AND city for prioritization)
  if (child.location?.latitude && child.location?.longitude) {
    if (isValidCanadianLocation(child.location.latitude, child.location.longitude)) {
      filters.userLat = child.location.latitude;
      filters.userLon = child.location.longitude;
      filters.radiusKm = child.preferences?.distance_radius_km || 25;
    } else {
      console.log(`🔍 [FetchCandidatesNode] Child ${child.name}: coordinates outside Canada, skipping location filter`);
    }
  }

  // ALWAYS pass city for same-city prioritization (activities in child's city appear first)
  if (child.location?.city) {
    filters.city = child.location.city;
  }

  // Apply child's age filter
  if (child.age !== undefined) {
    filters.ageMin = Math.max(0, child.age - 1);
    filters.ageMax = Math.min(18, child.age + 1);
  }

  // Apply child's gender filter (activities matching gender OR unisex)
  if (child.gender) {
    filters.gender = child.gender;
  }

  // Apply child's activity type preferences
  if (child.preferences?.activity_types?.length) {
    filters.activityTypes = child.preferences.activity_types;
  }

  // Apply child's day preferences
  if (child.preferences?.days_of_week?.length) {
    filters.dayOfWeek = child.preferences.days_of_week;
  }

  // Apply child's price preferences
  if (child.preferences?.price_max !== undefined) {
    filters.costMax = child.preferences.price_max;
  }
  if (child.preferences?.price_min !== undefined) {
    filters.costMin = child.preferences.price_min;
  }

  // Apply child's environment preference
  if (child.preferences?.environment && child.preferences.environment !== 'all') {
    filters.environment = child.preferences.environment;
  }

  return filters;
}

/**
 * Build combined search filters for "Together" mode (AND)
 * Finds activities ALL children can do together
 */
function buildTogetherModeFilters(
  children: ChildAIProfile[],
  baseFilters: ActivitySearchParams
): any {
  const filters: any = {
    ...baseFilters,
    limit: 50,
    hideClosedActivities: true,
    sponsoredMode: 'include',
  };

  // Age range: Activity must accept ALL children
  // ageMin filter: activity.ageMax >= oldest child (activity can handle oldest)
  // ageMax filter: activity.ageMin <= youngest child (activity accepts youngest)
  const ages = children.map(c => c.age).filter(a => a !== undefined) as number[];
  if (ages.length > 0) {
    const youngestAge = Math.min(...ages);
    const oldestAge = Math.max(...ages);
    // We want activities where: activity.ageMin <= youngestAge AND activity.ageMax >= oldestAge
    // The API filters work as: ageMin param filters activity.ageMax, ageMax param filters activity.ageMin
    // So we set ageMax (param) = youngestAge to ensure activity.ageMin <= youngestAge
    // And ageMin (param) = oldestAge to ensure activity.ageMax >= oldestAge
    filters.ageMin = oldestAge;  // Activity must go up to at least this age
    filters.ageMax = youngestAge; // Activity must accept ages as low as this
    console.log(`🔍 [FetchCandidatesNode] Together mode: ages ${youngestAge}-${oldestAge}, activity must fit ALL children`);
  }

  // Gender: If children have different genders, only show unisex activities
  const genders = children.map(c => c.gender).filter(g => g != null);
  const uniqueGenders = [...new Set(genders)];
  if (uniqueGenders.length > 1) {
    // Mixed genders - only unisex activities
    filters.gender = null; // This will filter for gender IS NULL (unisex)
    console.log(`🔍 [FetchCandidatesNode] Together mode: mixed genders, showing only unisex activities`);
  } else if (uniqueGenders.length === 1) {
    filters.gender = uniqueGenders[0];
  }

  // Location: Use first child's location (they'll do the activity together)
  const childWithLocation = children.find(c => c.location?.latitude && c.location?.longitude);
  if (childWithLocation?.location) {
    const loc = childWithLocation.location;
    if (isValidCanadianLocation(loc.latitude!, loc.longitude!)) {
      filters.userLat = loc.latitude;
      filters.userLon = loc.longitude;
      // Use minimum distance radius (must be reachable by all)
      const radii = children
        .map(c => c.preferences?.distance_radius_km)
        .filter(r => r != null) as number[];
      filters.radiusKm = radii.length > 0 ? Math.min(...radii) : 25;
    }
    if (loc.city) {
      filters.city = loc.city;
    }
  }

  // Activity types: Union of all children's preferences (show any type any child likes)
  const allTypes = new Set<string>();
  for (const child of children) {
    if (child.preferences?.activity_types?.length) {
      child.preferences.activity_types.forEach(t => allTypes.add(t));
    }
  }
  if (allTypes.size > 0) {
    filters.activityTypes = Array.from(allTypes);
  }

  // Days: Intersection (all children must be available)
  const dayArrays = children
    .map(c => c.preferences?.days_of_week)
    .filter(d => d && d.length > 0) as string[][];
  if (dayArrays.length > 0) {
    let commonDays = new Set(dayArrays[0]);
    for (let i = 1; i < dayArrays.length; i++) {
      commonDays = new Set(dayArrays[i].filter(d => commonDays.has(d)));
    }
    if (commonDays.size > 0 && commonDays.size < 7) {
      filters.dayOfWeek = Array.from(commonDays);
    }
  }

  // Price: Intersection (range that works for all)
  const minPrices = children.map(c => c.preferences?.price_min).filter(p => p != null) as number[];
  const maxPrices = children.map(c => c.preferences?.price_max).filter(p => p != null) as number[];
  if (minPrices.length > 0) {
    filters.costMin = Math.max(...minPrices);
  }
  if (maxPrices.length > 0) {
    filters.costMax = Math.min(...maxPrices);
  }

  // Environment: Must work for all
  const envPrefs = children
    .map(c => c.preferences?.environment)
    .filter(e => e && e !== 'all');
  const uniqueEnvs = [...new Set(envPrefs)];
  if (uniqueEnvs.length === 1) {
    filters.environment = uniqueEnvs[0];
  }

  return filters;
}

/**
 * Calculate match score for an activity based on how well it matches children's preferences
 */
function calculateMatchScore(
  activity: any,
  children: ChildAIProfile[],
  filterMode: 'or' | 'and'
): { score: number; matchedChildren: string[] } {
  let score = 1;
  const matchedChildren: string[] = [];

  for (const child of children) {
    let childMatches = true;
    let childScore = 0;

    // Check age fit
    if (child.age !== undefined) {
      const activityAgeMin = activity.ageMin ?? 0;
      const activityAgeMax = activity.ageMax ?? 18;
      if (child.age < activityAgeMin - 1 || child.age > activityAgeMax + 1) {
        childMatches = false;
      }
    }

    // Boost if activity matches child's interests
    if (child.preferences?.activity_types?.length) {
      const activityCategory = (activity.category || '').toLowerCase();
      if (child.preferences.activity_types.some(t =>
        activityCategory.includes(t.toLowerCase())
      )) {
        childScore += 2;
      }
    }

    // Boost if child has favorited or is watching this activity
    if (child.history?.favorited_activity_ids?.includes(activity.id)) {
      childScore += 3;
    }
    if (child.history?.watching_activity_ids?.includes(activity.id)) {
      childScore += 2;
    }

    // Penalty if already enrolled
    if (child.history?.enrolled_activity_ids?.includes(activity.id)) {
      childScore -= 5;
      childMatches = false; // Don't recommend enrolled activities
    }

    if (childMatches) {
      matchedChildren.push(child.child_id);
      score += childScore;
    }
  }

  // In "Together" mode, give BIG bonus for activities that match ALL children
  if (filterMode === 'and') {
    if (matchedChildren.length === children.length) {
      score += 10; // Big bonus for activities all children can do
    } else if (matchedChildren.length < children.length) {
      score -= 5; // Penalty if not all children match
    }
  }

  return { score, matchedChildren };
}

/**
 * Fetch candidate activities from database
 * Handles both 'or' (Any child) and 'and' (Together) filter modes
 */
export async function fetchCandidatesNode(state: AIGraphStateType): Promise<Partial<AIGraphStateType>> {
  console.log('🔍 [FetchCandidatesNode] Fetching candidate activities...');

  const activityService = getActivityService();
  const childrenProfiles = state.children_profiles || [];
  const filterMode = state.filter_mode || 'or';

  console.log(`🔍 [FetchCandidatesNode] Filter mode: ${filterMode}`);

  // If no children profiles provided, fall back to old behavior with family_context
  if (childrenProfiles.length === 0) {
    console.log('🔍 [FetchCandidatesNode] No children_profiles, falling back to legacy search');
    return await legacyFetchCandidates(state, activityService);
  }

  // Track all activities and their match data
  const activityMap = new Map<string, {
    activity: any;
    matchedChildren: string[];
    isSponsored: boolean;
    totalMatchScore: number;
  }>();

  if (filterMode === 'and') {
    // ==========================================
    // TOGETHER MODE: Single search for activities ALL children can do
    // ==========================================
    console.log(`🔍 [FetchCandidatesNode] TOGETHER mode: searching for activities ALL ${childrenProfiles.length} children can do`);

    const searchFilters = buildTogetherModeFilters(childrenProfiles, state.parsed_filters || {});
    console.log(`🔍 [FetchCandidatesNode] Together mode filters:`, JSON.stringify(searchFilters, null, 2));

    try {
      const result = await activityService.searchActivities(searchFilters);
      console.log(`🔍 [FetchCandidatesNode] Together mode found ${result.activities.length} activities`);

      // Process and score each activity
      for (const activity of result.activities) {
        const isSponsored = (activity as any).partnerId != null || (activity as any).sponsorshipLevel != null;
        const { score, matchedChildren } = calculateMatchScore(activity, childrenProfiles, 'and');

        // Only include if it works for all children (or at least most)
        if (matchedChildren.length >= Math.ceil(childrenProfiles.length * 0.5)) {
          activityMap.set(activity.id, {
            activity,
            matchedChildren,
            isSponsored,
            totalMatchScore: score,
          });
        }
      }
    } catch (error) {
      console.error(`🔍 [FetchCandidatesNode] Together mode search error:`, error);
    }

  } else {
    // ==========================================
    // ANY MODE: Search each child independently and merge
    // ==========================================
    console.log(`🔍 [FetchCandidatesNode] ANY mode: searching for ${childrenProfiles.length} children independently`);

    for (const child of childrenProfiles) {
      console.log(`🔍 [FetchCandidatesNode] Searching for child: ${child.name} (age ${child.age})`);
      console.log(`🔍 [FetchCandidatesNode] Child location:`, child.location);

      const searchFilters = buildChildSearchFilters(child, state.parsed_filters || {});

      try {
        const result = await activityService.searchActivities(searchFilters);
        console.log(`🔍 [FetchCandidatesNode] Found ${result.activities.length} activities for ${child.name}`);

        // Process results
        for (const activity of result.activities) {
          const existing = activityMap.get(activity.id);
          const isSponsored = (activity as any).partnerId != null || (activity as any).sponsorshipLevel != null;

          // Calculate match score for this child
          let matchScore = 1;

          // Boost if activity matches child's interests
          if (child.preferences?.activity_types?.length) {
            const activityCategory = activity.category || '';
            if (child.preferences.activity_types.some(t =>
              activityCategory?.toLowerCase().includes(t.toLowerCase())
            )) {
              matchScore += 2;
            }
          }

          // Boost if child has favorited or is watching this activity
          if (child.history?.favorited_activity_ids?.includes(activity.id)) {
            matchScore += 3;
          }
          if (child.history?.watching_activity_ids?.includes(activity.id)) {
            matchScore += 2;
          }

          // Penalty if already enrolled
          if (child.history?.enrolled_activity_ids?.includes(activity.id)) {
            matchScore -= 5;
          }

          if (existing) {
            // Activity already found for another child - merge
            if (!existing.matchedChildren.includes(child.child_id)) {
              existing.matchedChildren.push(child.child_id);
            }
            existing.totalMatchScore += matchScore;
            existing.isSponsored = existing.isSponsored || isSponsored;
          } else {
            // New activity
            activityMap.set(activity.id, {
              activity,
              matchedChildren: [child.child_id],
              isSponsored,
              totalMatchScore: matchScore,
            });
          }
        }
      } catch (error) {
        console.error(`🔍 [FetchCandidatesNode] Error searching for ${child.name}:`, error);
      }
    }
  }

  console.log(`🔍 [FetchCandidatesNode] Total unique activities found: ${activityMap.size}`);

  // Convert to array and sort
  let activities = Array.from(activityMap.values());

  // Filter out activities with negative scores (enrolled activities)
  activities = activities.filter(a => a.totalMatchScore > 0);

  // Separate sponsored and regular activities
  const sponsored = activities.filter(a => a.isSponsored);
  const regular = activities.filter(a => !a.isSponsored);

  // Sort regular activities by match score (descending)
  // In Together mode, activities matching more children rank higher
  regular.sort((a, b) => {
    // First by number of matched children (more is better)
    if (b.matchedChildren.length !== a.matchedChildren.length) {
      return b.matchedChildren.length - a.matchedChildren.length;
    }
    // Then by total match score
    return b.totalMatchScore - a.totalMatchScore;
  });

  // Randomize within similar match scores
  const shuffledRegular = shuffleWithinScoreTiers(regular);

  // Randomize sponsored activities
  const shuffledSponsored = shuffleArray(sponsored);

  // Combine: sponsored first, then best matches
  const sortedActivities = [
    ...shuffledSponsored,
    ...shuffledRegular,
  ].slice(0, 50); // Limit to 50 candidates for LLM

  console.log(`🔍 [FetchCandidatesNode] Final candidates: ${sortedActivities.length} (${shuffledSponsored.length} sponsored)`);
  if (filterMode === 'and' && sortedActivities.length > 0) {
    const avgMatched = sortedActivities.reduce((sum, a) => sum + a.matchedChildren.length, 0) / sortedActivities.length;
    console.log(`🔍 [FetchCandidatesNode] Together mode: avg ${avgMatched.toFixed(1)} children matched per activity`);
  }

  // Extract just the activities for compression
  const finalActivities = sortedActivities.map(a => a.activity);

  // Compress for LLM context
  const compressed = compressActivities(finalActivities);

  return {
    candidate_activities: compressed,
  };
}

/**
 * Shuffle activities within same score tiers
 */
function shuffleWithinScoreTiers(activities: Array<{ totalMatchScore: number; matchedChildren: string[]; activity: any }>): Array<{ totalMatchScore: number; matchedChildren: string[]; activity: any }> {
  if (activities.length === 0) return [];

  // Group by score (including matched children count)
  const tiers = new Map<string, Array<{ totalMatchScore: number; matchedChildren: string[]; activity: any }>>();
  for (const a of activities) {
    const tierKey = `${a.matchedChildren.length}-${Math.floor(a.totalMatchScore)}`;
    if (!tiers.has(tierKey)) tiers.set(tierKey, []);
    tiers.get(tierKey)!.push(a);
  }

  // Sort tiers by matched children (desc), then score (desc) and shuffle within each tier
  const sortedKeys = Array.from(tiers.keys()).sort((a, b) => {
    const [aChildren, aScore] = a.split('-').map(Number);
    const [bChildren, bScore] = b.split('-').map(Number);
    if (bChildren !== aChildren) return bChildren - aChildren;
    return bScore - aScore;
  });

  const result: Array<{ totalMatchScore: number; matchedChildren: string[]; activity: any }> = [];

  for (const key of sortedKeys) {
    const tier = tiers.get(key)!;
    result.push(...shuffleArray(tier));
  }

  return result;
}

/**
 * Legacy fetch for backwards compatibility (when no children_profiles provided)
 */
async function legacyFetchCandidates(
  state: AIGraphStateType,
  activityService: EnhancedActivityService
): Promise<Partial<AIGraphStateType>> {
  const context = state.family_context;
  const filters: any = { ...state.parsed_filters };

  // Build search filters from family_context
  const searchFilters: any = {
    ...filters,
    limit: 50,
    hideClosedActivities: true,
    sponsoredMode: 'top',
  };

  // Apply location from family_context
  if (context?.location?.latitude && context?.location?.longitude) {
    if (isValidCanadianLocation(context.location.latitude, context.location.longitude)) {
      searchFilters.userLat = context.location.latitude;
      searchFilters.userLon = context.location.longitude;
      searchFilters.radiusKm = context.preferences?.max_distance_km || 25;
    }
  }

  // Apply age from children
  if (context?.children?.length) {
    const ages = context.children.map(c => c.age);
    searchFilters.ageMin = Math.min(...ages) - 1;
    searchFilters.ageMax = Math.max(...ages) + 1;
  }

  console.log('🔍 [FetchCandidatesNode] Legacy search filters:', JSON.stringify(searchFilters, null, 2));

  try {
    const result = await activityService.searchActivities(searchFilters);
    console.log(`🔍 [FetchCandidatesNode] Legacy search found ${result.activities.length} candidates`);

    const compressed = compressActivities(result.activities);
    return { candidate_activities: compressed };
  } catch (error) {
    console.error('🔍 [FetchCandidatesNode] Legacy fetch error:', error);
    return {
      candidate_activities: [],
      errors: [`Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}
