import Redis from 'ioredis';
import { PrismaClient } from '../../../generated/prisma';
import { EnhancedActivityService } from '../../services/activityService.enhanced';
import { AICacheService } from '../cache/cacheService';
import { getModelByTier } from '../models/chatModels';
import { selectModel } from './modelRouter';
import { compressActivities } from '../utils/contextCompressor';
import { buildFamilyContext, buildContextFromFilters, buildScoringContext, buildScoringContextFromFilters } from '../utils/contextBuilder';
import { validateAndSanitize } from '../utils/responseValidator';
import { CostTrackerCallback } from '../callbacks/costTracker';
import { scoreAndRankActivities, ScoringContext } from '../utils/activityScorer';
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
   * Find an alternative activity for a schedule slot
   * Used when user declines a planned activity and wants something different
   */
  async findAlternativeActivity(params: {
    child_id: string;
    day: string;
    time_slot: string;
    excluded_activity_ids: string[];
    week_start: string;
    feedback?: string;
    current_activity_name?: string;
    feedback_history?: Array<{
      activity_id: string;
      activity_name?: string;
      feedback: string;
    }>;
    user_id: string;
  }): Promise<{
    success: boolean;
    alternative: {
      child_id: string;
      child_name?: string;
      activity_id: string;
      activity_name: string;
      day: string;
      time: string;
      location: string;
      duration_minutes?: number;
    } | null;
    error?: string;
  }> {
    try {
      console.log('[AIOrchestrator] Finding alternative activity:', {
        child_id: params.child_id,
        day: params.day,
        time_slot: params.time_slot,
        excluded_count: params.excluded_activity_ids.length,
        feedback: params.feedback,
      });

      // Get child info
      const child = await this.prisma.child.findFirst({
        where: { id: params.child_id, userId: params.user_id },
        include: { preferences: true }
      });

      if (!child) {
        return { success: false, alternative: null, error: 'Child not found' };
      }

      // Calculate child's age
      const birthDate = new Date(child.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      // Get child's location from preferences
      const prefs = child.preferences;
      const savedAddress = prefs?.savedAddress as { latitude?: number; longitude?: number } | null;
      const latitude = savedAddress?.latitude ?? null;
      const longitude = savedAddress?.longitude ?? null;
      const radiusKm = prefs?.distanceRadiusKm ?? 25;

      // Build search filters - keep them relaxed to get more results
      const filters: any = {
        ageMin: Math.max(0, age - 2),  // Slightly wider age range
        ageMax: Math.min(18, age + 2),
        limit: 50,  // Get more candidates
        hideClosedOrFull: true,
      };

      // Add location filter if available
      if (latitude && longitude) {
        filters.latitude = latitude;
        filters.longitude = longitude;
        filters.radiusKm = Math.max(radiusKm, 30);  // At least 30km radius
      }

      // Note: Don't filter by dayOfWeek - many activities run multiple days
      // and we want variety in suggestions

      // Add preferred activity types if available (but not required)
      if (prefs?.preferredActivityTypes && prefs.preferredActivityTypes.length > 0) {
        // Don't add this filter to get more variety
        // filters.activityTypes = prefs.preferredActivityTypes;
      }

      // Add gender filter based on child (this one is important)
      if (child.gender) {
        filters.gender = child.gender;
      }

      console.log('[AIOrchestrator] Searching with filters:', JSON.stringify(filters));

      // Search for activities
      const result = await this.activityService.searchActivities(filters);
      let activities = result.activities || [];

      console.log('[AIOrchestrator] Found', activities.length, 'activities before exclusion');

      // Filter out excluded activities
      const excludedSet = new Set(params.excluded_activity_ids);
      activities = activities.filter(a => !excludedSet.has(a.id));

      if (activities.length === 0) {
        return {
          success: false,
          alternative: null,
          error: 'No suitable alternatives found'
        };
      }

      // Combine all feedback: current message + history of why activities were declined
      const allFeedback: string[] = [];
      if (params.feedback) {
        allFeedback.push(params.feedback);
      }
      if (params.feedback_history && params.feedback_history.length > 0) {
        for (const hist of params.feedback_history) {
          if (hist.feedback && hist.feedback !== 'declined without specific feedback') {
            allFeedback.push(hist.feedback);
          }
        }
      }

      // Extract preferences from all feedback
      const combinedFeedback = allFeedback.join(' ').toLowerCase();

      // Positive preferences (what user wants)
      const wantsOutdoor = combinedFeedback.includes('outdoor') || combinedFeedback.includes('outside');
      const wantsIndoor = combinedFeedback.includes('indoor') || combinedFeedback.includes('inside');
      const wantsFree = combinedFeedback.includes('free') || combinedFeedback.includes('no cost') || combinedFeedback.includes('cheap');
      const wantsCreative = combinedFeedback.includes('art') || combinedFeedback.includes('creative') || combinedFeedback.includes('craft') || combinedFeedback.includes('music');
      const wantsSport = combinedFeedback.includes('sport') || combinedFeedback.includes('athletic') || combinedFeedback.includes('physical') || combinedFeedback.includes('active');
      const wantsSwimming = combinedFeedback.includes('swim') || combinedFeedback.includes('pool') || combinedFeedback.includes('water');
      const wantsDance = combinedFeedback.includes('dance') || combinedFeedback.includes('ballet');
      const wantsMartialArts = combinedFeedback.includes('martial') || combinedFeedback.includes('karate') || combinedFeedback.includes('taekwondo');
      const wantsSocial = combinedFeedback.includes('social') || combinedFeedback.includes('friends') || combinedFeedback.includes('group');

      // Negative preferences (what user doesn't want - from reasons for declining)
      const avoidsTooFar = combinedFeedback.includes('too far') || combinedFeedback.includes('distance');
      const avoidsTooExpensive = combinedFeedback.includes('expensive') || combinedFeedback.includes('too much') || combinedFeedback.includes('cost');
      const avoidsSport = combinedFeedback.includes("don't like sport") || combinedFeedback.includes("not sporty");
      const avoidsTooLong = combinedFeedback.includes('too long') || combinedFeedback.includes('shorter');

      console.log('[AIOrchestrator] Extracted preferences from feedback:', {
        feedbackCount: allFeedback.length,
        wantsOutdoor, wantsIndoor, wantsFree, wantsCreative, wantsSport,
        avoidsTooFar, avoidsTooExpensive
      });

      // Score activities based on all feedback
      activities = activities.map(a => {
        let score = 0;
        const name = a.name?.toLowerCase() || '';
        const type = a.activityType?.name?.toLowerCase() || '';

        // Positive scoring (what user wants)
        if (wantsOutdoor && (a.isOutdoor || name.includes('outdoor'))) score += 15;
        if (wantsIndoor && a.isIndoor) score += 15;
        if (wantsFree && (a.cost === 0 || a.cost === null)) score += 15;
        if (wantsCreative && (type.includes('art') || type.includes('creative') || type.includes('craft') || type.includes('music'))) score += 15;
        if (wantsSport && (type.includes('sport') || type.includes('gym') || type.includes('athletic'))) score += 15;
        if (wantsSwimming && (type.includes('swim') || type.includes('aquatic'))) score += 15;
        if (wantsDance && type.includes('dance')) score += 15;
        if (wantsMartialArts && type.includes('martial')) score += 15;
        if (wantsSocial && (name.includes('group') || name.includes('team') || name.includes('class'))) score += 10;

        // Negative scoring (what user is avoiding)
        if (avoidsTooExpensive && a.cost && a.cost > 50) score -= 20;
        if (avoidsSport && (type.includes('sport') || type.includes('athletic'))) score -= 20;
        if (avoidsTooLong && a.durationMinutes && a.durationMinutes > 90) score -= 10;

        return { ...a, feedbackScore: score };
      }).sort((a, b) => (b as any).feedbackScore - (a as any).feedbackScore);

      // Pick the best match
      const bestMatch = activities[0];

      // Map time slot to display time
      const timeDisplay = params.time_slot === 'morning' ? '9:00 AM' :
                         params.time_slot === 'afternoon' ? '1:00 PM' :
                         params.time_slot === 'evening' ? '5:00 PM' : params.time_slot;

      const alternative = {
        child_id: params.child_id,
        child_name: child.name,
        activity_id: bestMatch.id,
        activity_name: bestMatch.name,
        day: params.day,
        time: timeDisplay,
        location: bestMatch.location?.city || bestMatch.location?.address || 'Location TBD',
        duration_minutes: bestMatch.durationMinutes || 60,
      };

      console.log('[AIOrchestrator] Found alternative:', alternative.activity_name);

      return {
        success: true,
        alternative,
      };

    } catch (error: any) {
      console.error('[AIOrchestrator] Error finding alternative:', error);
      return {
        success: false,
        alternative: null,
        error: 'Failed to find alternative activity'
      };
    }
  }

  /**
   * Generate weekly schedule for family
   */
  async planWeek(
    weekStart: string,
    userId: string,
    constraints?: {
      child_ids?: string[];
      max_activities_per_child?: number;
      avoid_back_to_back?: boolean;
      max_travel_between_activities_km?: number;
      schedule_siblings_together?: boolean;
      allow_gaps?: boolean;
      child_availability?: Array<{
        child_id: string;
        available_slots: {
          [day: string]: {
            morning: boolean;
            afternoon: boolean;
            evening: boolean;
          };
        };
      }>;
    }
  ): Promise<WeeklySchedule | null> {
    // Build family context
    let familyContext = await buildFamilyContext(userId, this.prisma);

    // Filter to specific children if child_ids provided
    if (constraints?.child_ids && constraints.child_ids.length > 0) {
      const filteredChildren = familyContext.children.filter(
        child => constraints.child_ids!.includes(child.child_id)
      );
      if (filteredChildren.length > 0) {
        familyContext = {
          ...familyContext,
          children: filteredChildren,
        };
        console.log(`[AIOrchestrator] Filtered to ${filteredChildren.length} children:`,
          filteredChildren.map(c => c.name).join(', '));
      }
    }

    console.log('[AIOrchestrator] Planning with constraints:', {
      child_ids: constraints?.child_ids,
      max_activities_per_child: constraints?.max_activities_per_child,
      avoid_back_to_back: constraints?.avoid_back_to_back,
      allow_gaps: constraints?.allow_gaps,
      schedule_siblings_together: constraints?.schedule_siblings_together,
      child_availability_count: constraints?.child_availability?.length,
    });

    const result = await executeAIGraph({
      request_id: `plan_${Date.now()}`,
      request_type: 'plan',
      user_id: userId,
      family_context: familyContext,
      search_intent: `Plan week starting ${weekStart}`,
      planner_constraints: constraints,
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
   * Now uses the enhanced tiered scoring system for better results
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
        limit: 100, // Fetch more candidates for better scoring
        hideClosedOrFull: true
      });
      activities = result.activities || [];
    }

    // Build scoring context
    let scoringContext: ScoringContext;
    if (request.user_id) {
      try {
        scoringContext = await buildScoringContext(request.user_id);
      } catch (error) {
        console.warn('[AI Orchestrator] Failed to build scoring context, using filters:', error);
        scoringContext = buildScoringContextFromFilters(request.filters);
      }
    } else {
      scoringContext = buildScoringContextFromFilters(request.filters);
    }

    // Use new tiered scoring system
    const scoredActivities = scoreAndRankActivities(
      activities,
      scoringContext,
      'recommendations',
      {
        limit: 15,
        ensureDiversity: true,
      }
    );

    // Build recommendations from scored results
    const recommendations = scoredActivities.map((item, index) => ({
      activity_id: item.activity.id,
      rank: index + 1,
      is_sponsored: (item.activity as any).isFeatured || false,
      why: this.generateEnhancedReasons(item),
      fit_score: Math.round(item.score),
      warnings: item.distance && item.distance > 30 ? ['This activity is a bit far from your location'] : []
    }));

    // Build activities map
    const activitiesMap: Record<string, any> = {};
    for (const item of scoredActivities) {
      activitiesMap[item.activity.id] = item.activity;
    }

    return {
      recommendations,
      activities: activitiesMap,
      assumptions: ['Using enhanced matching based on your profile and preferences'],
      questions: [],
      source: 'heuristic',
      latency_ms: Date.now() - startTime
    };
  }

  /**
   * Generate reasons based on score breakdown
   */
  private generateEnhancedReasons(scoredItem: {
    activity: any;
    score: number;
    distance?: number;
    scoreBreakdown: any;
  }): string[] {
    const reasons: string[] = [];
    const breakdown = scoredItem.scoreBreakdown;
    const activity = scoredItem.activity;

    // Top scoring factors
    if (breakdown.activityTypeMatch > 0) {
      reasons.push('Matches your preferred activity types');
    }
    if (breakdown.dayOfWeekMatch > 0) {
      reasons.push('Available on your preferred days');
    }
    if (breakdown.budgetMatch > 0) {
      reasons.push('Within your budget');
    }
    if (breakdown.interestMatch > 0) {
      reasons.push('Matches your child\'s interests');
    }
    if (breakdown.favoriteTypeBonus > 0) {
      reasons.push('Similar to activities you\'ve favorited');
    }
    if (breakdown.providerBonus > 0) {
      reasons.push('From a provider you trust');
    }

    // Add age suitability
    if (activity.ageMin !== null && activity.ageMax !== null) {
      reasons.push(`Suitable for ages ${activity.ageMin}-${activity.ageMax}`);
    }

    // Add distance if available and close
    if (scoredItem.distance !== undefined && scoredItem.distance < 10) {
      reasons.push('Close to your location');
    }

    // Add availability
    if (activity.spotsAvailable && activity.spotsAvailable > 5) {
      reasons.push('Good availability');
    }

    return reasons.slice(0, 3); // Max 3 reasons
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
