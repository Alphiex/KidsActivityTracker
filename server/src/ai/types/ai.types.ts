import { AIResponse } from '../schemas/recommendation.schema';

/**
 * Activity search parameters (matching existing activityService interface)
 */
export interface ActivitySearchParams {
  search?: string;
  category?: string;
  categories?: string;
  activityType?: string;
  activitySubtype?: string;
  ageMin?: number;
  ageMax?: number;
  costMin?: number;
  costMax?: number;
  startDate?: Date;
  endDate?: Date;
  dateMatchMode?: 'partial' | 'full';
  dayOfWeek?: string[];
  location?: string;
  locations?: string[];
  providerId?: string;
  hideClosedActivities?: boolean;
  hideFullActivities?: boolean;
  hideClosedOrFull?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'cost' | 'dateStart' | 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Child profile for personalization
 */
export interface ChildProfile {
  child_id: string;
  name?: string;
  age: number;
  age_range: { min: number; max: number };
  interests: string[];
  schedule_constraints?: TimeWindow[];
}

/**
 * Time window for scheduling
 */
export interface TimeWindow {
  day: string;
  start: string;
  end: string;
}

/**
 * Family preferences for recommendations
 */
export interface FamilyPreferences {
  budget_monthly?: number;
  max_distance_km?: number;
  time_windows?: TimeWindow[];
  days_of_week?: string[];
  preferred_categories?: string[];
  excluded_categories?: string[];
  locations?: string[]; // Preferred location/city names
}

/**
 * Family context combining children and preferences
 */
export interface FamilyContext {
  children: ChildProfile[];
  preferences: FamilyPreferences;
  location?: {
    latitude?: number;
    longitude?: number;
    city?: string;
    cities?: string[]; // Multiple preferred cities
  };
}

/**
 * Request for AI recommendations
 */
export interface AIRecommendationRequest {
  search_intent: string;
  filters: ActivitySearchParams;
  user_id?: string;
  include_explanations?: boolean;
  family_context?: FamilyContext;
}

/**
 * Extended AI response with metadata
 */
export interface AIResponseWithMeta extends AIResponse {
  source: 'cache' | 'heuristic' | 'llm';
  model_used?: string;
  latency_ms?: number;
  /** Full activity data keyed by activity_id - avoids client needing to fetch each activity */
  activities?: Record<string, any>;
}

/**
 * Model tier for routing
 */
export type ModelTier = 'small' | 'large';

/**
 * Model selection result
 */
export interface ModelSelection {
  tier: ModelTier;
  model: string;
  reason: string;
}

/**
 * Cost tracking metrics for a single AI request
 */
export interface AIRequestMetrics {
  request_id: string;
  user_id?: string;
  request_type: 'recommendations' | 'explain' | 'plan' | 'parse' | 'enhance' | 'review';
  model_used: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms: number;
  cache_hit: boolean;
  timestamp: Date;
  user_action?: 'saved' | 'booked' | 'dismissed' | null;
}

/**
 * Compressed activity for LLM context (minimal tokens)
 */
export interface CompressedActivity {
  id: string;
  name: string;
  desc: string;
  cat: string;
  tags: string[];
  age: [number, number];
  cost: number;
  days: string[];
  dist_km?: number;
  spots: number | null;
  sponsored: boolean;
}

/**
 * Budget check result
 */
export interface BudgetCheck {
  remaining_usd: number;
  exceeded: boolean;
  daily_limit_usd: number;
  spent_today_usd: number;
}
