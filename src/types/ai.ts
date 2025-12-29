/**
 * AI-related types for the mobile app
 */

/**
 * A single AI recommendation with explanation
 */
export interface AIRecommendation {
  activity_id: string;
  rank: number;
  is_sponsored: boolean;
  why: string[];
  fit_score: number;
  warnings: string[];
}

/**
 * Response from AI recommendations endpoint
 */
export interface AIRecommendationResponse {
  success: boolean;
  recommendations: AIRecommendation[];
  assumptions: string[];
  questions: string[];
  _meta: {
    source: 'cache' | 'heuristic' | 'llm';
    model?: string;
    latency_ms?: number;
    cached: boolean;
  };
  error?: string;
}

/**
 * Request parameters for AI recommendations
 */
export interface AIRecommendationRequest {
  search_intent: string;
  filters?: ActivitySearchFilters;
  include_explanations?: boolean;
}

/**
 * Activity search filters (subset used for AI)
 */
export interface ActivitySearchFilters {
  search?: string;
  category?: string;
  categories?: string;
  activityType?: string;
  ageMin?: number;
  ageMax?: number;
  costMin?: number;
  costMax?: number;
  dayOfWeek?: string[];
  location?: string;
  locations?: string[];
}

/**
 * AI service health status
 */
export interface AIHealthStatus {
  success: boolean;
  status: 'healthy' | 'unavailable' | 'error';
  cache?: {
    keys: number;
    memoryUsed: string;
  };
  cost?: {
    today_requests: number;
    today_cost_usd: string;
  };
  message?: string;
}

/**
 * Source badge display type
 */
export type AISourceType = 'cache' | 'heuristic' | 'llm';
