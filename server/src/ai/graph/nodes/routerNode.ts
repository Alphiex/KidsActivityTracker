/**
 * Router Node
 * 
 * Classifies the incoming request and determines which path to take.
 * This is a lightweight node that analyzes the request to set request_type.
 */

import { AIGraphStateType, AIRequestType } from '../state';

/**
 * Patterns that indicate natural language search
 */
const NL_PATTERNS = [
  /\bfor\s+my\s+\d+\s*year\s*old\b/i,
  /\bnear\s+(downtown|me|here)\b/i,
  /\bon\s+(saturday|sunday|monday|tuesday|wednesday|thursday|friday)s?\b/i,
  /\bin\s+the\s+(morning|afternoon|evening)s?\b/i,
  /\blessons?\s+for\b/i,
  /\bclasses?\s+for\b/i,
];

/**
 * Patterns that indicate explanation request
 */
const EXPLAIN_PATTERNS = [
  /\bwhy\s+(is|should|would)\b/i,
  /\bexplain\b/i,
  /\bgood\s+for\s+(my\s+)?child\b/i,
  /\bbenefits?\b/i,
];

/**
 * Patterns that indicate scheduling/planning request
 */
const PLAN_PATTERNS = [
  /\bschedule\b/i,
  /\bplan\s+(our|my|the)\s+week\b/i,
  /\bweekly\b/i,
  /\boptimize\b/i,
  /\bfit\s+into\b/i,
];

/**
 * Detect if query contains NL search patterns
 */
function isNaturalLanguageSearch(query: string): boolean {
  // Short queries are likely just keywords
  if (query.length < 20) return false;
  
  // Check for NL patterns
  return NL_PATTERNS.some(pattern => pattern.test(query));
}

/**
 * Detect if query is asking for explanation
 */
function isExplanationRequest(query: string, hasActivityId: boolean): boolean {
  if (hasActivityId) return true;
  return EXPLAIN_PATTERNS.some(pattern => pattern.test(query));
}

/**
 * Detect if query is asking for schedule planning
 */
function isPlanningRequest(query: string): boolean {
  return PLAN_PATTERNS.some(pattern => pattern.test(query));
}

/**
 * Router node - determines request type based on input analysis
 */
export async function routerNode(state: AIGraphStateType): Promise<Partial<AIGraphStateType>> {
  console.log('🔀 [RouterNode] Analyzing request...');
  
  const query = state.raw_query || state.search_intent || '';
  const hasActivityId = !!state.activity_id;
  const hasMultiChildMode = !!state.multi_child_mode;
  const hasMultipleChildren = (state.selected_child_ids?.length || 0) > 1;
  
  let requestType: AIRequestType = state.request_type || 'recommend';
  
  // If request_type is already explicitly set, use it
  if (state.request_type && state.request_type !== 'recommend') {
    console.log(`🔀 [RouterNode] Using explicit request_type: ${state.request_type}`);
    return { request_type: state.request_type };
  }
  
  // Auto-detect based on content
  if (hasActivityId || isExplanationRequest(query, hasActivityId)) {
    requestType = 'explain';
  } else if (isPlanningRequest(query)) {
    requestType = 'plan';
  } else if (hasMultiChildMode || hasMultipleChildren) {
    requestType = 'multi_child';
  } else if (isNaturalLanguageSearch(query)) {
    requestType = 'parse';
  } else {
    requestType = 'recommend';
  }
  
  console.log(`🔀 [RouterNode] Detected request_type: ${requestType}`);
  
  return {
    request_type: requestType,
  };
}
