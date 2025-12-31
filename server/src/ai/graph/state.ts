/**
 * LangGraph State Schema
 * 
 * Defines the shared state that flows through all graph nodes.
 * Each node can read and update relevant portions of this state.
 */

import { Annotation } from '@langchain/langgraph';
import { 
  ActivitySearchParams, 
  FamilyContext, 
  CompressedActivity,
  ModelTier
} from '../types/ai.types';
import { AIRecommendation } from '../schemas/recommendation.schema';

/**
 * Request type determines which node path to take
 */
export type AIRequestType = 'recommend' | 'parse' | 'explain' | 'plan' | 'multi_child';

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
 * Weekly schedule output
 */
export interface WeeklySchedule {
  week_start: string;
  entries: Record<string, ScheduleEntry[]>; // keyed by day
  conflicts: {
    type: 'time_overlap' | 'travel_distance' | 'back_to_back';
    description: string;
    affected_entries: string[];
  }[];
  suggestions: string[];
  total_cost?: number;
  total_activities: number;
}

/**
 * Multi-child optimization mode
 */
export type MultiChildMode = 'together' | 'parallel' | 'any';

/**
 * LangGraph shared state - uses Annotation for proper state management
 */
export const AIGraphState = Annotation.Root({
  // === Request Metadata ===
  request_id: Annotation<string>({
    reducer: (_, b) => b,
    default: () => '',
  }),
  request_type: Annotation<AIRequestType>({
    reducer: (_, b) => b,
    default: () => 'recommend',
  }),
  user_id: Annotation<string | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
  
  // === Input ===
  search_intent: Annotation<string>({
    reducer: (_, b) => b,
    default: () => '',
  }),
  raw_query: Annotation<string | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
  
  // === Multi-child specific ===
  multi_child_mode: Annotation<MultiChildMode | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
  selected_child_ids: Annotation<string[] | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
  
  // === Explain specific ===
  activity_id: Annotation<string | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
  
  // === Parsed/Enriched Data ===
  parsed_filters: Annotation<ActivitySearchParams | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
  family_context: Annotation<FamilyContext | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
  
  // === Candidates from DB ===
  candidate_activities: Annotation<CompressedActivity[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  
  // === Outputs (each node populates its own) ===
  recommendations: Annotation<AIRecommendation[] | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
  explanations: Annotation<Record<string, ActivityExplanation> | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
  weekly_schedule: Annotation<WeeklySchedule | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
  
  // === Execution Metadata ===
  model_tier: Annotation<ModelTier>({
    reducer: (_, b) => b,
    default: () => 'small',
  }),
  tokens_used: Annotation<number>({
    reducer: (a, b) => a + b, // accumulate tokens across nodes
    default: () => 0,
  }),
  errors: Annotation<string[]>({
    reducer: (a, b) => [...a, ...b], // accumulate errors
    default: () => [],
  }),
  
  // === Source tracking ===
  source: Annotation<'cache' | 'heuristic' | 'llm' | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
  model_used: Annotation<string | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
  latency_ms: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0,
  }),
});

/**
 * Type helper for state access in nodes
 */
export type AIGraphStateType = typeof AIGraphState.State;
