import apiClient from './apiClient';
import { firebaseAuthService } from './firebaseAuthService';
import {
  AIRecommendationRequest,
  AIRecommendationResponse,
  AIHealthStatus,
  ParseSearchResponse,
  ExplainActivityResponse,
  WeeklyScheduleResponse,
  ActivityExplanation,
  WeeklySchedule,
  ScheduleEntry,
  PlannerConstraints,
} from '../types/ai';

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  activities?: any[];
  followUpPrompts?: string[];
  blocked?: boolean;
}

export interface ChatResponse {
  conversationId: string;
  text: string;
  activities: any[];
  followUpPrompts: string[];
  turnsRemaining: number;
  blocked?: boolean;
  reason?: string;
  quota: {
    daily: { used: number; limit: number };
    monthly: { used: number; limit: number };
  };
  latencyMs: number;
}

export interface ChatQuota {
  allowed: boolean;
  isPro: boolean;
  daily: { used: number; limit: number };
  monthly: { used: number; limit: number };
  message?: string;
}

/**
 * AI Service - Handles AI-powered recommendation features
 * 
 * Features:
 * - Get personalized activity recommendations
 * - Natural language search parsing
 * - Activity explanations for children
 * - Weekly schedule planning
 */
class AIService {
  private static instance: AIService;
  
  private constructor() {}
  
  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }
  
  /**
   * Get AI-powered activity recommendations
   * 
   * @param params - Search intent and optional filters
   * @returns Ranked recommendations with explanations
   */
  async getRecommendations(params: AIRecommendationRequest): Promise<AIRecommendationResponse> {
    try {
      console.log('[AIService] Getting recommendations:', params);

      // AI recommendations can take 15-20 seconds, use longer timeout
      const response = await apiClient.post<AIRecommendationResponse>(
        '/api/v1/ai/recommendations',
        {
          search_intent: params.search_intent,
          filters: params.filters || {},
          include_explanations: params.include_explanations ?? true
        },
        { timeout: 60000 } // 60 second timeout for AI calls
      );
      
      console.log('[AIService] Got recommendations:', {
        count: response.recommendations?.length,
        activitiesCount: response.activities ? Object.keys(response.activities).length : 0,
        source: response._meta?.source,
        cached: response._meta?.cached,
        success: response.success
      });

      return response;
    } catch (error: any) {
      console.error('[AIService] Error getting recommendations:', error);
      
      // Handle rate limiting
      if (error?.response?.status === 429) {
        return {
          success: false,
          recommendations: [],
          assumptions: [],
          questions: [],
          _meta: {
            source: 'heuristic',
            cached: false
          },
          error: 'Rate limit exceeded. Please wait a minute and try again.'
        };
      }
      
      // Handle service unavailable
      if (error?.response?.status === 503) {
        return {
          success: false,
          recommendations: [],
          assumptions: [],
          questions: [],
          _meta: {
            source: 'heuristic',
            cached: false
          },
          error: 'AI service is temporarily unavailable.'
        };
      }
      
      throw error;
    }
  }
  
  /**
   * Check AI service health
   */
  async checkHealth(): Promise<AIHealthStatus> {
    try {
      const response = await apiClient.get<AIHealthStatus>('/api/v1/ai/recommendations/health');
      return response;
    } catch (error) {
      console.error('[AIService] Health check failed:', error);
      return {
        success: false,
        status: 'unavailable',
        message: 'Unable to reach AI service'
      };
    }
  }
  
  /**
   * Build a natural language search intent from current filters
   * Used when user clicks "Find Best for Me" with existing filters
   */
  buildSearchIntent(filters: any): string {
    const parts: string[] = [];
    
    // Age
    if (filters.ageMin !== undefined || filters.ageMax !== undefined) {
      const min = filters.ageMin ?? 0;
      const max = filters.ageMax ?? 18;
      if (min === max) {
        parts.push(`for ${min} year old`);
      } else {
        parts.push(`for ages ${min}-${max}`);
      }
    }
    
    // Category
    if (filters.category || filters.categories) {
      const cat = filters.category || filters.categories.split(',')[0];
      parts.push(cat.toLowerCase());
    }
    
    // Activity type
    if (filters.activityType) {
      parts.push(filters.activityType.toLowerCase());
    }
    
    // Days
    if (filters.dayOfWeek?.length > 0) {
      if (filters.dayOfWeek.includes('Saturday') && filters.dayOfWeek.includes('Sunday')) {
        parts.push('on weekends');
      } else {
        parts.push(`on ${filters.dayOfWeek.slice(0, 2).join(', ')}`);
      }
    }
    
    // Location
    if (filters.location) {
      parts.push(`near ${filters.location}`);
    }
    
    // Price
    if (filters.costMax !== undefined) {
      if (filters.costMax === 0) {
        parts.push('free');
      } else {
        parts.push(`under $${filters.costMax}`);
      }
    }
    
    return parts.length > 0 
      ? `Find activities ${parts.join(' ')}`
      : 'Find the best activities for my family';
  }

  /**
   * Parse natural language search query into structured filters
   * 
   * @param query - Natural language query like "swimming for my 5 year old on Saturdays"
   * @returns Parsed filters and detected intent
   */
  async parseSearch(query: string): Promise<ParseSearchResponse> {
    try {
      console.log('[AIService] Parsing search query:', query);

      const response = await apiClient.post<ParseSearchResponse>(
        '/api/v1/ai/parse-search',
        { query },
        { timeout: 30000 }
      );

      console.log('[AIService] Parsed filters:', response.parsed_filters);
      return response;

    } catch (error: any) {
      console.error('[AIService] Error parsing search:', error);
      
      // Return empty parse result on error
      return {
        success: false,
        parsed_filters: {},
        confidence: 0,
        detected_intent: query
      };
    }
  }

  /**
   * Detect if a query looks like natural language
   * 
   * @param query - User input
   * @returns true if query appears to be natural language
   */
  isNaturalLanguageQuery(query: string): boolean {
    if (!query || query.length < 15) return false;
    
    // Patterns that indicate NL search
    const nlPatterns = [
      /\bfor\s+my\s+\d+\s*year\s*old\b/i,
      /\bnear\s+(downtown|me|here)\b/i,
      /\bon\s+(saturday|sunday|monday|tuesday|wednesday|thursday|friday)s?\b/i,
      /\bin\s+the\s+(morning|afternoon|evening)s?\b/i,
      /\blessons?\s+for\b/i,
      /\bclasses?\s+for\b/i,
      /\bactivities?\s+for\b/i,
      /\bfind\s+(me|us)?\b/i,
      /\blooking\s+for\b/i,
    ];
    
    return nlPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Get activity explanations for children
   * 
   * @param activityId - Activity to explain
   * @param childIds - Optional specific children to explain for
   * @returns Explanations per child with benefits and match scores
   */
  async explainActivity(
    activityId: string, 
    childIds?: string[]
  ): Promise<ExplainActivityResponse> {
    try {
      console.log('[AIService] Getting explanations for activity:', activityId);

      const response = await apiClient.post<ExplainActivityResponse>(
        '/api/v1/ai/explain',
        { 
          activity_id: activityId,
          child_ids: childIds
        },
        { timeout: 30000 }
      );

      console.log('[AIService] Got explanations:', Object.keys(response.explanations || {}).length);
      return response;

    } catch (error: any) {
      console.error('[AIService] Error getting explanations:', error);
      return {
        success: false,
        explanations: {}
      };
    }
  }

  /**
   * Generate weekly activity schedule
   *
   * @param weekStart - Start date of the week (ISO string)
   * @param constraints - Optional scheduling constraints including per-child availability
   * @returns Optimized weekly schedule
   */
  async planWeek(
    weekStart?: string,
    constraints?: PlannerConstraints
  ): Promise<WeeklyScheduleResponse> {
    try {
      console.log('[AIService] Planning week starting:', weekStart);

      const response = await apiClient.post<WeeklyScheduleResponse>(
        '/api/v1/ai/plan-week',
        { 
          week_start: weekStart,
          ...constraints
        },
        { timeout: 60000 } // 60 second timeout for complex planning
      );

      console.log('[AIService] Got schedule:', response.schedule?.total_activities, 'activities');
      return response;

    } catch (error: any) {
      console.error('[AIService] Error planning week:', error);
      
      if (error?.response?.status === 401) {
        return {
          success: false,
          schedule: null,
          error: 'Please log in to use weekly planning'
        };
      }
      
      return {
        success: false,
        schedule: null,
        error: 'Failed to generate weekly schedule'
      };
    }
  }

  /**
   * Find an alternative activity for a specific schedule slot
   *
   * @param params - Parameters for finding alternative
   * @returns Alternative activity suggestion
   */
  async findAlternativeActivity(params: {
    child_id: string;
    day: string;
    time_slot: string;
    excluded_activity_ids: string[];
    week_start: string;
  }): Promise<{
    success: boolean;
    alternative: ScheduleEntry | null;
    error?: string;
  }> {
    try {
      console.log('[AIService] Finding alternative for:', params);

      const response = await apiClient.post<{
        success: boolean;
        alternative: ScheduleEntry | null;
        error?: string;
      }>(
        '/api/v1/ai/find-alternative',
        params,
        { timeout: 30000 }
      );

      console.log('[AIService] Found alternative:', response.alternative?.activity_name);
      return response;

    } catch (error: any) {
      console.error('[AIService] Error finding alternative:', error);

      if (error?.response?.status === 401) {
        return {
          success: false,
          alternative: null,
          error: 'Please log in to use this feature'
        };
      }

      return {
        success: false,
        alternative: null,
        error: 'Failed to find alternative activity'
      };
    }
  }

  // ============================================================
  // CHAT METHODS - Conversational AI
  // ============================================================

  /**
   * Send a chat message to the AI assistant
   *
   * @param message - User's message
   * @param conversationId - Optional conversation ID to continue
   * @param childIds - Optional specific children to focus on
   * @param filterMode - 'or' (any child) or 'and' (all children together)
   * @param retryCount - Internal retry counter for auth timing
   * @returns AI response with activities and follow-up prompts
   */
  async chat(
    message: string,
    conversationId?: string,
    childIds?: string[],
    filterMode: 'or' | 'and' = 'or',
    retryCount: number = 0
  ): Promise<ChatResponse> {
    try {
      console.log('[AIService] Sending chat message:', { message, conversationId, filterMode, retryCount });

      const response = await apiClient.post<ChatResponse>(
        '/api/v1/ai/chat',
        {
          message,
          conversationId,
          childIds,
          filterMode,
          childSelectionMode: childIds?.length ? 'manual' : 'auto',
        },
        { timeout: 60000 } // 60 second timeout for AI chat
      );

      console.log('[AIService] Chat response:', {
        conversationId: response.conversationId,
        activitiesCount: response.activities?.length || 0,
        turnsRemaining: response.turnsRemaining,
        blocked: response.blocked,
      });

      return response;
    } catch (error: any) {
      console.error('[AIService] Chat error:', error);

      // Handle quota exceeded
      if (error?.response?.status === 429) {
        const data = error.response.data;
        throw new Error(data?.message || 'AI quota exceeded. Please upgrade to Pro for more queries.');
      }

      // Handle unauthorized - retry twice with force-refresh of Firebase token
      // (User must be logged in to see this screen, so 401 is a token refresh timing issue)
      if (error?.response?.status === 401) {
        if (retryCount < 2) {
          console.log('[AIService] 401 received (auth timing), force-refreshing token and retrying... attempt', retryCount + 1);
          // Force refresh the Firebase token before retrying
          try {
            await firebaseAuthService.getIdToken(true);
          } catch (tokenError) {
            console.warn('[AIService] Token refresh failed:', tokenError);
          }
          await new Promise(resolve => setTimeout(resolve, 500));
          return this.chat(message, conversationId, childIds, filterMode, retryCount + 1);
        }
        // After retries still failing, show generic error
        console.error('[AIService] Auth still failing after retries');
      }

      throw new Error('Something went wrong. Please try again.');
    }
  }

  /**
   * Get user's AI quota status
   */
  async getChatQuota(): Promise<ChatQuota> {
    try {
      const response = await apiClient.get<{ quota: ChatQuota }>('/api/v1/ai/chat/quota');
      return response.quota;
    } catch (error) {
      console.error('[AIService] Error getting quota:', error);
      // Return permissive defaults when quota fetch fails
      // Don't block the user - let them try and the server will enforce limits
      return {
        allowed: true,
        isPro: false,
        daily: { used: 0, limit: 3 },
        monthly: { used: 0, limit: 30 },
        // No message - don't show error for quota fetch failures
      };
    }
  }

  /**
   * Clear/end a conversation
   */
  async endConversation(conversationId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/v1/ai/chat/${conversationId}`);
    } catch (error) {
      console.error('[AIService] Error ending conversation:', error);
    }
  }
}

export default AIService.getInstance();
