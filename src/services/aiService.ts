import apiClient from './apiClient';
import { 
  AIRecommendationRequest, 
  AIRecommendationResponse, 
  AIHealthStatus 
} from '../types/ai';

/**
 * AI Service - Handles AI-powered recommendation features
 * 
 * Features:
 * - Get personalized activity recommendations
 * - Natural language search parsing (future)
 * - Weekly schedule planning (future)
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
      
      const response = await apiClient.post<AIRecommendationResponse>(
        '/api/v1/ai/recommendations',
        {
          search_intent: params.search_intent,
          filters: params.filters || {},
          include_explanations: params.include_explanations ?? true
        }
      );
      
      console.log('[AIService] Got recommendations:', {
        count: response.recommendations?.length,
        source: response._meta?.source,
        cached: response._meta?.cached
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
}

export default AIService.getInstance();
