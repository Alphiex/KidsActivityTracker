/**
 * Fetch Candidates Node
 * 
 * Queries the database for candidate activities based on filters.
 * Compresses activities for LLM context efficiency.
 */

import { AIGraphStateType } from '../state';
import { CompressedActivity, ActivitySearchParams } from '../../types/ai.types';
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
 * Merge parsed filters with family context preferences
 */
function mergeFiltersWithContext(
  parsedFilters: ActivitySearchParams | undefined,
  state: AIGraphStateType
): ActivitySearchParams {
  const filters: ActivitySearchParams = { ...parsedFilters };
  const context = state.family_context;
  
  if (!context) return filters;
  
  // Apply location preferences if not already set
  if (!filters.location && !filters.locations) {
    if (context.location?.city) {
      filters.location = context.location.city;
    } else if (context.location?.cities?.length) {
      filters.locations = context.location.cities;
    }
    if (context.preferences.locations?.length) {
      filters.locations = context.preferences.locations;
    }
  }
  
  // Apply age from children if not already set
  if (filters.ageMin === undefined && filters.ageMax === undefined) {
    if (context.children.length > 0) {
      const ages = context.children.map(c => c.age);
      filters.ageMin = Math.min(...ages) - 1;
      filters.ageMax = Math.max(...ages) + 1;
    }
  }
  
  // Apply day preferences
  if (!filters.dayOfWeek && context.preferences.days_of_week?.length) {
    filters.dayOfWeek = context.preferences.days_of_week;
  }
  
  // Apply budget
  if (filters.costMax === undefined && context.preferences.budget_monthly) {
    // Estimate per-activity budget as monthly / 4 activities
    filters.costMax = context.preferences.budget_monthly / 4;
  }
  
  return filters;
}

/**
 * Fetch candidate activities from database
 */
export async function fetchCandidatesNode(state: AIGraphStateType): Promise<Partial<AIGraphStateType>> {
  console.log('🔍 [FetchCandidatesNode] Fetching candidate activities...');
  
  const activityService = getActivityService();
  
  // Merge parsed filters with family context
  const filters = mergeFiltersWithContext(state.parsed_filters, state);
  
  // Set default limit
  const searchFilters: ActivitySearchParams = {
    ...filters,
    limit: filters.limit || 50, // Get more candidates for LLM to rank
    hideClosedActivities: true,
  };
  
  console.log('🔍 [FetchCandidatesNode] Search filters:', JSON.stringify(searchFilters, null, 2));
  
  try {
    // Search activities
    const result = await activityService.searchActivities(searchFilters);
    
    console.log(`🔍 [FetchCandidatesNode] Found ${result.activities.length} candidates`);
    
    // Compress for LLM context
    const compressed = compressActivities(result.activities);
    
    return {
      candidate_activities: compressed,
    };
    
  } catch (error) {
    console.error('🔍 [FetchCandidatesNode] Fetch error:', error);
    
    return {
      candidate_activities: [],
      errors: [`Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}
