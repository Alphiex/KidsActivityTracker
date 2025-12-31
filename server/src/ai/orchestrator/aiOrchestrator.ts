import Redis from 'ioredis';
import { PrismaClient } from '../../../generated/prisma';
import { EnhancedActivityService } from '../../services/activityService.enhanced';
import { AICacheService } from '../cache/cacheService';
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

// LangGraph imports
import { 
  executeAIGraph, 
  AIGraphStateType,
  AIRequestType,
  ActivityExplanation,
  WeeklySchedule,
  MultiChildMode
} from '../graph';

/**
 * AI Orchestrator - Main decision engine for AI features
 * 
 * Now backed by LangGraph for multi-agent orchestration.
 * Provides backwards-compatible API while leveraging graph-based execution.
 * 
 * Responsibilities:
 * - Check cache before calling LLM
 * - Enforce daily budget limits
 * - Route requests through LangGraph
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
   * Get AI-powered recommendations (backwards compatible)
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

      // 4. Build family context for graph
      const familyContext = request.family_context ||
        await this.buildFamilyContextForRequest(request);

      // 5. Determine request type based on content
      let requestType: AIRequestType = 'recommend';
      
      // Detect multi-child mode
      const multiChildMode = (request as any).multi_child_mode as MultiChildMode | undefined;
      if (multiChildMode || familyContext.children.length > 1) {
        requestType = 'multi_child';
      }

      // 6. Select model tier
      const modelSelection = selectModel(request);
      
      console.log(`[AI Orchestrator] Executing LangGraph with type: ${requestType}, model: ${modelSelection.model}`);

      // 7. Execute LangGraph
      const graphResult = await executeAIGraph({
        request_id: `req_${Date.now()}`,
        request_type: requestType,
        search_intent: request.search_intent,
        raw_query: request.search_intent,
        user_id: request.user_id,
        parsed_filters: request.filters,
        family_context: familyContext,
        multi_child_mode: multiChildMode,
        model_tier: modelSelection.tier,
      });

      // 8. Handle errors from graph
      if (graphResult.errors && graphResult.errors.length > 0) {
        console.warn('[AI Orchestrator] Graph errors:', graphResult.errors);
      }

      // 9. Build activities map from candidates
      const activitiesMap: Record<string, any> = {};
      const recommendedIds = new Set(
        (graphResult.recommendations || []).map(r => r.activity_id)
      );
      
      // Fetch full activity data for recommended activities
      if (recommendedIds.size > 0) {
        const activities = await this.prisma.activity.findMany({
          where: { id: { in: Array.from(recommendedIds) } },
          include: {
            activityType: true,
            location: true,
            provider: true,
          }
        });
        for (const activity of activities) {
          activitiesMap[activity.id] = activity;
        }
      }

      // 10. Build response for validation (AIResponse without meta)
      const responseForValidation: AIResponse = {
        recommendations: graphResult.recommendations || [],
        assumptions: [],
        questions: [],
      };

      // 11. Validate and enforce sponsorship policy
      const validated = validateAndSanitize(responseForValidation, graphResult.candidate_activities || []);

      // 12. Build full response with metadata
      const fullResponse: AIResponseWithMeta = {
        ...validated,
        activities: activitiesMap,
        source: graphResult.source || 'llm',
        model_used: graphResult.model_used,
        latency_ms: Date.now() - startTime
      };

      // 13. Cache result
      await this.cache.setCachedRecommendations(cacheKey, fullResponse);

      return fullResponse;

    } catch (error: any) {
      console.error('[AI Orchestrator] Error:', error.message);

      // Fallback to heuristic on any error
      return this.getHeuristicRecommendations(request, startTime);
    }
  }

  /**
   * Parse natural language query into structured filters
   */
  async parseSearch(query: string): Promise<{
    parsed_filters: any;
    confidence: number;
    detected_intent: string;
  }> {
    const result = await executeAIGraph({
      request_id: `parse_${Date.now()}`,
      request_type: 'parse',
      raw_query: query,
      search_intent: query,
    });

    return {
      parsed_filters: result.parsed_filters || {},
      confidence: result.errors?.length ? 0.5 : 0.9,
      detected_intent: result.search_intent || query,
    };
  }

  /**
   * Get activity explanations for children
   */
  async explainActivity(
    activityId: string,
    userId?: string,
    childIds?: string[]
  ): Promise<Record<string, ActivityExplanation>> {
    // Build family context if user is logged in
    let familyContext: FamilyContext | undefined;
    if (userId) {
      familyContext = await buildFamilyContext(userId, this.prisma);
    }

    const result = await executeAIGraph({
      request_id: `explain_${Date.now()}`,
      request_type: 'explain',
      activity_id: activityId,
      user_id: userId,
      selected_child_ids: childIds,
      family_context: familyContext,
    });

    return result.explanations || {};
  }

  /**
   * Generate weekly schedule for family
   */
  async planWeek(
    weekStart: string,
    userId: string,
    constraints?: {
      max_activities_per_child?: number;
      avoid_back_to_back?: boolean;
      max_travel_between_activities_km?: number;
    }
  ): Promise<WeeklySchedule | null> {
    // Build family context
    const familyContext = await buildFamilyContext(userId, this.prisma);

    const result = await executeAIGraph({
      request_id: `plan_${Date.now()}`,
      request_type: 'plan',
      user_id: userId,
      family_context: familyContext,
      search_intent: `Plan week starting ${weekStart}`,
      parsed_filters: constraints as any,
    });

    return result.weekly_schedule || null;
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
   * Check daily budget
   */
  private checkDailyBudget(): BudgetCheck {
    return CostTrackerCallback.checkDailyBudget();
  }

  /**
   * Generate heuristic recommendations without LLM
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

    // Build activities map
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
   * Merge user preferences from family context into search filters
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
      } else if (familyContext.location?.city) {
        merged.location = familyContext.location.city;
      }
    }

    // Age: Calculate from children if no age filter specified
    if (merged.ageMin === undefined && merged.ageMax === undefined && children.length > 0) {
      const ages = children.map(c => c.age);
      const minAge = Math.min(...ages);
      const maxAge = Math.max(...ages);
      merged.ageMin = Math.max(0, minAge - 1);
      merged.ageMax = Math.min(18, maxAge + 1);
    }

    // Days of week: Use preferences if no filter specified
    if (!merged.dayOfWeek && prefs.days_of_week?.length) {
      merged.dayOfWeek = prefs.days_of_week;
    }

    // Budget: Use preferences if no cost filter specified  
    if (merged.costMax === undefined && prefs.budget_monthly) {
      merged.costMax = Math.round(prefs.budget_monthly / 4);
    }

    return merged;
  }

  /**
   * Calculate a simple score for heuristic ranking
   */
  private calculateHeuristicScore(activity: any, request: AIRecommendationRequest): number {
    let score = 50;
    
    const targetAge = request.filters.ageMin || request.filters.ageMax;
    if (targetAge) {
      const ageMin = activity.ageMin ?? 0;
      const ageMax = activity.ageMax ?? 18;
      if (targetAge >= ageMin && targetAge <= ageMax) {
        score += 20;
      }
    }
    
    if (request.filters.costMax && activity.cost !== null) {
      if (activity.cost <= request.filters.costMax) {
        score += 10;
      }
      if (activity.cost === 0) {
        score += 5;
      }
    }
    
    if (activity.spotsAvailable && activity.spotsAvailable > 5) {
      score += 10;
    }
    
    if (activity.isFeatured) {
      score += 5;
    }
    
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
    
    if (activity.ageMin !== null && activity.ageMax !== null) {
      reasons.push(`Suitable for ages ${activity.ageMin}-${activity.ageMax}`);
    }
    
    if (activity.cost === 0) {
      reasons.push('Free activity');
    } else if (activity.cost && request.filters.costMax && activity.cost <= request.filters.costMax) {
      reasons.push('Within your budget');
    }
    
    if (activity.spotsAvailable && activity.spotsAvailable > 0) {
      reasons.push(`${activity.spotsAvailable} spots available`);
    }
    
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
