/**
 * Fetch Candidates Node
 *
 * NEW ARCHITECTURE:
 * - Searches EACH child INDEPENDENTLY using their own:
 *   - Location (lat/lon coordinates + distance radius)
 *   - Preferences (activity types, days, price, environment)
 *   - Age and gender filters
 * - Results are merged (OR) across all children
 * - Deduplicates by activity ID
 * - Prioritizes: Sponsored first, then best matches
 * - Randomizes within priority tiers
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
 * Build search filters for a single child
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
    console.log(`🔍 [FetchCandidatesNode] Child ${child.name}: using city "${child.location.city}" for prioritization`);
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
 * Fetch candidate activities from database
 * Searches each child independently and merges results
 */
export async function fetchCandidatesNode(state: AIGraphStateType): Promise<Partial<AIGraphStateType>> {
  console.log('🔍 [FetchCandidatesNode] Fetching candidate activities...');

  const activityService = getActivityService();
  const childrenProfiles = state.children_profiles || [];

  // If no children profiles provided, fall back to old behavior with family_context
  if (childrenProfiles.length === 0) {
    console.log('🔍 [FetchCandidatesNode] No children_profiles, falling back to legacy search');
    return await legacyFetchCandidates(state, activityService);
  }

  console.log(`🔍 [FetchCandidatesNode] Searching for ${childrenProfiles.length} children independently`);

  // Track all activities and which children they match
  const activityMap = new Map<string, {
    activity: any;
    matchedChildren: string[];
    isSponsored: boolean;
    totalMatchScore: number;
  }>();

  // Search for each child independently
  for (const child of childrenProfiles) {
    console.log(`🔍 [FetchCandidatesNode] Searching for child: ${child.name} (age ${child.age})`);
    console.log(`🔍 [FetchCandidatesNode] Child location:`, child.location);
    console.log(`🔍 [FetchCandidatesNode] Child preferences:`, child.preferences);

    const searchFilters = buildChildSearchFilters(child, state.parsed_filters || {});
    console.log(`🔍 [FetchCandidatesNode] Search filters for ${child.name}:`, JSON.stringify(searchFilters, null, 2));

    try {
      const result = await activityService.searchActivities(searchFilters);
      console.log(`🔍 [FetchCandidatesNode] Found ${result.activities.length} activities for ${child.name}`);

      // Process results
      for (const activity of result.activities) {
        const existing = activityMap.get(activity.id);
        // Check if sponsored via partnerId (sponsored activities have a partner)
        const isSponsored = (activity as any).partnerId != null || (activity as any).sponsorshipLevel != null;

        // Calculate match score for this child
        let matchScore = 1;

        // Boost if activity matches child's interests
        if (child.preferences?.activity_types?.length) {
          // Use category field which is always available
          const activityCategory = activity.category || '';
          if (child.preferences.activity_types.some(t =>
            activityCategory?.toLowerCase().includes(t.toLowerCase())
          )) {
            matchScore += 2;
          }
        }

        // Boost if child has favorited or is watching this activity
        if (child.history?.favorited_activity_ids?.includes(activity.id)) {
          matchScore += 3; // High boost for favorites
        }
        if (child.history?.watching_activity_ids?.includes(activity.id)) {
          matchScore += 2; // Medium boost for watching
        }

        // Slight penalty if already enrolled (don't recommend duplicates)
        if (child.history?.enrolled_activity_ids?.includes(activity.id)) {
          matchScore -= 5; // Skip enrolled activities
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

  console.log(`🔍 [FetchCandidatesNode] Total unique activities found: ${activityMap.size}`);

  // Convert to array and sort
  let activities = Array.from(activityMap.values());

  // Filter out activities where all matched children are already enrolled
  activities = activities.filter(a => a.totalMatchScore > 0);

  // Separate sponsored and regular activities
  const sponsored = activities.filter(a => a.isSponsored);
  const regular = activities.filter(a => !a.isSponsored);

  // Sort regular activities by match score (descending)
  regular.sort((a, b) => b.totalMatchScore - a.totalMatchScore);

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
function shuffleWithinScoreTiers(activities: Array<{ totalMatchScore: number; activity: any }>): Array<{ totalMatchScore: number; activity: any }> {
  if (activities.length === 0) return [];

  // Group by score
  const tiers = new Map<number, Array<{ totalMatchScore: number; activity: any }>>();
  for (const a of activities) {
    const score = Math.floor(a.totalMatchScore); // Round to integer tiers
    if (!tiers.has(score)) tiers.set(score, []);
    tiers.get(score)!.push(a);
  }

  // Sort tiers by score (descending) and shuffle within each tier
  const sortedScores = Array.from(tiers.keys()).sort((a, b) => b - a);
  const result: Array<{ totalMatchScore: number; activity: any }> = [];

  for (const score of sortedScores) {
    const tier = tiers.get(score)!;
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
