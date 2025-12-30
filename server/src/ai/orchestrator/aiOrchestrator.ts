import Redis from 'ioredis';
import { PrismaClient } from '../../../generated/prisma';
import { EnhancedActivityService } from '../../services/activityService.enhanced';
import { AICacheService } from '../cache/cacheService';
import { invokeRecommendationChain } from '../chains/recommendationChain';
import { getModelByTier } from '../models/chatModels';
import { selectModel } from './modelRouter';
import { compressActivities } from '../utils/contextCompressor';
import { buildFamilyContext, buildContextFromFilters } from '../utils/contextBuilder';
import { validateAndSanitize } from '../utils/responseValidator';
import { CostTrackerCallback } from '../callbacks/costTracker';
import { 
  AIRecommendationRequest, 
  AIResponseWithMeta, 
  FamilyContext,
  CompressedActivity,
  BudgetCheck
} from '../types/ai.types';
import { AIResponse } from '../schemas/recommendation.schema';

/**
 * AI Orchestrator - Main decision engine for AI features
 * 
 * Responsibilities:
 * - Check cache before calling LLM
 * - Enforce daily budget limits
 * - Select appropriate model tier
 * - Pre-filter candidates in DB
 * - Compress context for LLM
 * - Validate and sanitize responses
 * - Provide heuristic fallback when needed
 */
export class AIOrchestrator {
  private cache: AICacheService;
  private activityService: EnhancedActivityService;
  private prisma: PrismaClient;

  constructor(redis: Redis | null, prisma: PrismaClient) {
    this.cache = new AICacheService(redis);
    this.activityService = new EnhancedActivityService(prisma);
    this.prisma = prisma;
  }

  /**
   * Get AI-powered recommendations
   */
  async getRecommendations(request: AIRecommendationRequest): Promise<AIResponseWithMeta> {
    const startTime = Date.now();

    try {
      // 1. Generate cache key
      const cacheKey = this.cache.generateCacheKey(request);

      // 2. Check application-level cache
      const cached = await this.cache.getCachedRecommendations(cacheKey);
      if (cached) {
        return {
          ...cached,
          source: 'cache',
          latency_ms: Date.now() - startTime
        };
      }

      // 3. Check daily budget
      const budget = this.checkDailyBudget();
      if (budget.exceeded) {
        console.log('[AI Orchestrator] Daily budget exceeded, using heuristic fallback');
        return this.getHeuristicRecommendations(request, startTime);
      }

      // 4. Build family context FIRST to get user preferences
      const familyContext = request.family_context ||
        await this.buildFamilyContextForRequest(request);

      // 5. Merge user preferences into filters for candidate search
      const mergedFilters = this.mergePreferencesIntoFilters(request.filters, familyContext);
      
      console.log('[AI Orchestrator] Merged filters:', {
        originalFilters: request.filters,
        hasLocation: !!mergedFilters.location || !!mergedFilters.locations,
        location: mergedFilters.location,
        ageMin: mergedFilters.ageMin,
        ageMax: mergedFilters.ageMax,
        categories: mergedFilters.categories
      });

      // 6. Pre-filter candidates in DB (no LLM cost)
      const candidates = await this.activityService.searchActivities({
        ...mergedFilters,
        limit: 100, // Get more than we need for ranking
        hideClosedOrFull: true
      });

      console.log(`[AI Orchestrator] Found ${candidates.activities?.length || 0} candidates`);

      // 7. If simple query with few results, skip LLM
      if (this.isSimpleQuery(request) && (candidates.activities?.length || 0) < 20) {
        console.log('[AI Orchestrator] Simple query with few results, using heuristic');
        return this.getHeuristicRecommendations(request, startTime, candidates.activities, familyContext);
      }

      // 8. Compress context for LLM
      const compressed = compressActivities(
        candidates.activities || [],
        parseInt(process.env.AI_MAX_CANDIDATES || '30')
      );

      if (compressed.length === 0) {
        return {
          recommendations: [],
          assumptions: ['No activities found matching your criteria. Check your location preferences.'],
          questions: [],
          source: 'heuristic',
          latency_ms: Date.now() - startTime
        };
      }

      // 8. Select model tier
      const modelSelection = selectModel(request);
      const model = getModelByTier(modelSelection.tier);

      console.log(`[AI Orchestrator] Using model: ${modelSelection.model} (${modelSelection.reason})`);

      // 9. Invoke LangChain chain
      const result = await invokeRecommendationChain(
        model,
        request.search_intent,
        compressed,
        familyContext
      );

      // 10. Validate and enforce sponsorship policy
      const validated = validateAndSanitize(result, compressed);

      // 11. Build activities map (include full data to avoid client fetching each activity)
      const activitiesMap: Record<string, any> = {};
      const recommendedIds = new Set(validated.recommendations.map(r => r.activity_id));
      for (const activity of (candidates.activities || [])) {
        if (recommendedIds.has(activity.id)) {
          activitiesMap[activity.id] = activity;
        }
      }

      // 12. Build response with metadata
      const response: AIResponseWithMeta = {
        ...validated,
        activities: activitiesMap,
        source: 'llm',
        model_used: modelSelection.model,
        latency_ms: Date.now() - startTime
      };

      // 13. Cache result
      await this.cache.setCachedRecommendations(cacheKey, response);

      return response;

    } catch (error: any) {
      console.error('[AI Orchestrator] Error:', error.message);

      // Fallback to heuristic on any error
      return this.getHeuristicRecommendations(request, startTime);
    }
  }

  /**
   * Check if query is simple enough to skip LLM
   */
  private isSimpleQuery(request: AIRecommendationRequest): boolean {
    const intent = request.search_intent || '';
    
    // Simple if: no natural language intent or very short
    if (!intent || intent.length < 10) return true;
    
    // Simple if: just filter keywords
    const filterKeywords = ['near me', 'nearby', 'this week', 'this weekend'];
    const lowercaseIntent = intent.toLowerCase();
    
    return filterKeywords.some(kw => lowercaseIntent === kw);
  }

  /**
   * Build family context from request or user data
   */
  private async buildFamilyContextForRequest(
    request: AIRecommendationRequest
  ): Promise<FamilyContext> {
    // If user is logged in, fetch their family context
    if (request.user_id) {
      const context = await buildFamilyContext(request.user_id, this.prisma);
      if (context.children.length > 0 || context.location || context.preferences.preferred_categories?.length) {
        return context;
      }
    }
    
    // Otherwise, build from filters
    return buildContextFromFilters(request.filters);
  }

  /**
   * Merge user preferences from family context into search filters
   * User preferences are used as defaults, but explicit filters take priority
   */
  private mergePreferencesIntoFilters(
    filters: any,
    familyContext: FamilyContext
  ): any {
    const merged = { ...filters };
    const prefs = familyContext.preferences;
    const children = familyContext.children;

    // Location: Use family context location if no filter specified
    if (!merged.location && !merged.locations) {
      if (familyContext.location?.cities && familyContext.location.cities.length > 0) {
        merged.locations = familyContext.location.cities;
        console.log('[AI Orchestrator] Applied user location preferences:', merged.locations);
      } else if (familyContext.location?.city) {
        merged.location = familyContext.location.city;
        console.log('[AI Orchestrator] Applied user location preference:', merged.location);
      }
    }

    // Age: Calculate from children if no age filter specified
    if (merged.ageMin === undefined && merged.ageMax === undefined && children.length > 0) {
      const ages = children.map(c => c.age);
      const minAge = Math.min(...ages);
      const maxAge = Math.max(...ages);
      // Expand range slightly to include appropriate activities
      merged.ageMin = Math.max(0, minAge - 1);
      merged.ageMax = Math.min(18, maxAge + 1);
      console.log('[AI Orchestrator] Applied child age range:', { ageMin: merged.ageMin, ageMax: merged.ageMax, children: ages });
    }

    // Activity types: Use preferences if no category filter specified
    if (!merged.categories && !merged.activityType && prefs.preferred_categories?.length) {
      // Don't restrict to categories - just use them for ranking in LLM
      // This allows discovery of new activity types
      console.log('[AI Orchestrator] User preferred categories (for ranking):', prefs.preferred_categories);
    }

    // Days of week: Use preferences if no filter specified
    if (!merged.dayOfWeek && prefs.days_of_week?.length) {
      merged.dayOfWeek = prefs.days_of_week;
      console.log('[AI Orchestrator] Applied preferred days:', merged.dayOfWeek);
    }

    // Budget: Use preferences if no cost filter specified  
    if (merged.costMax === undefined && prefs.budget_monthly) {
      // Convert monthly budget to per-activity estimate (assume ~4 activities/month)
      merged.costMax = Math.round(prefs.budget_monthly / 4);
      console.log('[AI Orchestrator] Applied budget preference:', merged.costMax);
    }

    return merged;
  }

  /**
   * Check daily budget
   */
  private checkDailyBudget(): BudgetCheck {
    return CostTrackerCallback.checkDailyBudget();
  }

  /**
   * Generate heuristic recommendations without LLM
   * Uses simple scoring based on relevance signals
   */
  private async getHeuristicRecommendations(
    request: AIRecommendationRequest,
    startTime: number,
    activities?: any[],
    familyContext?: FamilyContext
  ): Promise<AIResponseWithMeta> {
    // Fetch activities if not provided
    if (!activities) {
      // Build family context if not provided
      const context = familyContext || await this.buildFamilyContextForRequest(request);
      const mergedFilters = this.mergePreferencesIntoFilters(request.filters, context);
      
      const result = await this.activityService.searchActivities({
        ...mergedFilters,
        limit: 30,
        hideClosedOrFull: true
      });
      activities = result.activities || [];
    }

    // Score and rank activities
    const scored = activities.map((activity, index) => ({
      activity,
      score: this.calculateHeuristicScore(activity, request)
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Take top 15 for recommendations
    const topScored = scored.slice(0, 15);

    // Build recommendations
    const recommendations = topScored.map((item, index) => ({
      activity_id: item.activity.id,
      rank: index + 1,
      is_sponsored: item.activity.isFeatured || false,
      why: this.generateHeuristicReasons(item.activity, request),
      fit_score: Math.round(item.score),
      warnings: []
    }));

    // Build activities map (include full data to avoid client fetching each activity)
    const activitiesMap: Record<string, any> = {};
    for (const item of topScored) {
      activitiesMap[item.activity.id] = item.activity;
    }

    return {
      recommendations,
      activities: activitiesMap,
      assumptions: ['Using quick match (heuristic) due to simple query or system constraints'],
      questions: [],
      source: 'heuristic',
      latency_ms: Date.now() - startTime
    };
  }

  /**
   * Calculate a simple score for heuristic ranking
   */
  private calculateHeuristicScore(activity: any, request: AIRecommendationRequest): number {
    let score = 50; // Base score
    
    // Age fit
    const targetAge = request.filters.ageMin || request.filters.ageMax;
    if (targetAge) {
      const ageMin = activity.ageMin ?? 0;
      const ageMax = activity.ageMax ?? 18;
      if (targetAge >= ageMin && targetAge <= ageMax) {
        score += 20;
      }
    }
    
    // Price fit
    if (request.filters.costMax && activity.cost !== null) {
      if (activity.cost <= request.filters.costMax) {
        score += 10;
      }
      // Bonus for free activities
      if (activity.cost === 0) {
        score += 5;
      }
    }
    
    // Available spots
    if (activity.spotsAvailable && activity.spotsAvailable > 5) {
      score += 10;
    }
    
    // Sponsored items get small boost (but capped by policy)
    if (activity.isFeatured) {
      score += 5;
    }
    
    // Recent/updated activities
    if (activity.updatedAt) {
      const daysSinceUpdate = (Date.now() - new Date(activity.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 7) {
        score += 5;
      }
    }
    
    return Math.min(100, score);
  }

  /**
   * Generate simple reasons for heuristic recommendations
   */
  private generateHeuristicReasons(activity: any, request: AIRecommendationRequest): string[] {
    const reasons: string[] = [];
    
    // Age match
    if (activity.ageMin !== null && activity.ageMax !== null) {
      reasons.push(`Suitable for ages ${activity.ageMin}-${activity.ageMax}`);
    }
    
    // Price
    if (activity.cost === 0) {
      reasons.push('Free activity');
    } else if (activity.cost && request.filters.costMax && activity.cost <= request.filters.costMax) {
      reasons.push('Within your budget');
    }
    
    // Availability
    if (activity.spotsAvailable && activity.spotsAvailable > 0) {
      reasons.push(`${activity.spotsAvailable} spots available`);
    }
    
    // Category match
    if (activity.activityType?.name) {
      reasons.push(`Category: ${activity.activityType.name}`);
    }
    
    return reasons.slice(0, 3);
  }

  /**
   * Get cache stats
   */
  async getCacheStats(): Promise<{ keys: number; memoryUsed: string }> {
    return this.cache.getStats();
  }

  /**
   * Get cost metrics
   */
  getCostMetrics() {
    return CostTrackerCallback.getMetrics();
  }
}
