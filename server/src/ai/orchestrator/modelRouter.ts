import { AIRecommendationRequest, ModelSelection, ModelTier } from '../types/ai.types';

/**
 * Determine which model tier to use based on request complexity
 * 
 * SMALL model (gpt-4o-mini): Simple queries, parsing, short explanations
 * LARGE model (gpt-4o): Complex planning, multi-constraint optimization
 */
export function selectModel(request: AIRecommendationRequest): ModelSelection {
  const intent = request.search_intent || '';
  
  // Use LARGE model for complex queries
  if (shouldUseLargeModel(intent, request)) {
    return {
      tier: 'large',
      model: process.env.OPENAI_MODEL_LARGE || 'gpt-4o',
      reason: getComplexityReason(intent, request)
    };
  }
  
  // Default to small model
  return {
    tier: 'small',
    model: process.env.OPENAI_MODEL_SMALL || 'gpt-4o-mini',
    reason: 'Simple recommendation query'
  };
}

/**
 * Determine if the request requires a large model
 */
function shouldUseLargeModel(intent: string, request: AIRecommendationRequest): boolean {
  // Complex natural language with multiple constraints
  if (intent.length > 50) {
    const hasMultipleConstraints = 
      intent.includes(' and ') ||
      intent.includes(' but ') ||
      intent.includes(' except ') ||
      intent.includes(' however ') ||
      intent.includes(' unless ');
    
    if (hasMultipleConstraints) return true;
  }
  
  // Multi-child optimization (future)
  const childCount = request.family_context?.children?.length || 0;
  if (childCount > 2) return true;
  
  // Weekly planning (future - would be a different request type)
  
  // Complex time constraints
  const timeWindows = request.family_context?.preferences?.time_windows?.length || 0;
  if (timeWindows > 3) return true;
  
  return false;
}

/**
 * Get the reason for model selection
 */
function getComplexityReason(intent: string, request: AIRecommendationRequest): string {
  const reasons: string[] = [];
  
  if (intent.length > 50 && (intent.includes(' and ') || intent.includes(' but '))) {
    reasons.push('Multi-constraint query');
  }
  
  const childCount = request.family_context?.children?.length || 0;
  if (childCount > 2) {
    reasons.push(`${childCount} children to optimize for`);
  }
  
  const timeWindows = request.family_context?.preferences?.time_windows?.length || 0;
  if (timeWindows > 3) {
    reasons.push('Complex scheduling constraints');
  }
  
  return reasons.join(', ') || 'Complex optimization required';
}

/**
 * Get model configuration by tier
 */
export function getModelConfig(tier: ModelTier): { model: string; maxTokens: number; temperature: number } {
  const temperature = parseFloat(process.env.AI_TEMPERATURE || '0.3');
  
  if (tier === 'large') {
    return {
      model: process.env.OPENAI_MODEL_LARGE || 'gpt-4o',
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000'),
      temperature
    };
  }
  
  return {
    model: process.env.OPENAI_MODEL_SMALL || 'gpt-4o-mini',
    maxTokens: 1000,
    temperature
  };
}
