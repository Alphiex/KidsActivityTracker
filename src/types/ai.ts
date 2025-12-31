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
  /** Full activity data keyed by activity_id - avoids needing to fetch each activity */
  activities?: Record<string, any>;
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

/**
 * Response from parse-search endpoint
 */
export interface ParseSearchResponse {
  success: boolean;
  parsed_filters: Partial<ActivitySearchFilters>;
  confidence: number;
  detected_intent: string;
  error?: string;
}

/**
 * Activity explanation for a specific child
 */
export interface ActivityExplanation {
  summary: string;
  benefits: {
    category: 'Physical' | 'Social' | 'Cognitive' | 'Creative' | 'Emotional';
    description: string;
  }[];
  age_appropriateness: string;
  match_score: number;
}

/**
 * Response from explain endpoint
 */
export interface ExplainActivityResponse {
  success: boolean;
  explanations: Record<string, ActivityExplanation>;
  error?: string;
}

/**
 * Weekly schedule entry
 */
export interface ScheduleEntry {
  child_id: string;
  child_name?: string;
  activity_id: string;
  activity_name: string;
  day: string;
  time: string;
  location: string;
  duration_minutes?: number;
}

/**
 * Schedule conflict
 */
export interface ScheduleConflict {
  type: 'time_overlap' | 'travel_distance' | 'back_to_back';
  description: string;
  affected_entries: string[];
}

/**
 * Weekly schedule
 */
export interface WeeklySchedule {
  week_start: string;
  entries: Record<string, ScheduleEntry[]>;
  conflicts: ScheduleConflict[];
  suggestions: string[];
  total_cost?: number;
  total_activities: number;
}

/**
 * Response from plan-week endpoint
 */
export interface WeeklyScheduleResponse {
  success: boolean;
  schedule: WeeklySchedule | null;
  error?: string;
}

/**
 * Multi-child optimization mode
 */
export type MultiChildMode = 'together' | 'parallel' | 'any';
