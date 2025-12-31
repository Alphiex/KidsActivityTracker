/**
 * Recommend Node
 * 
 * Uses LLM to rank and explain candidate activities.
 * This is the core recommendation logic adapted from the original chain.
 */

import { AIGraphStateType } from '../state';
import { getModelByTier } from '../../models/chatModels';
import { AIResponseSchema, AIRecommendation } from '../../schemas/recommendation.schema';
import { CompressedActivity } from '../../types/ai.types';

/**
 * System prompt for recommendations
 */
const RECOMMEND_SYSTEM_PROMPT = `You are an expert kids activity recommender. 
Given a list of candidate activities and a family context, rank and explain the best matches.

Rules:
1. Consider age appropriateness carefully
2. Match activity types to stated interests
3. Consider location/distance if provided
4. Note any scheduling conflicts
5. Be honest about limitations
6. Mark sponsored activities appropriately

Return a JSON object with this structure:
{
  "recommendations": [
    {
      "activity_id": "string",
      "rank": 1,
      "is_sponsored": false,
      "why": ["reason1", "reason2"],
      "fit_score": 85,
      "warnings": []
    }
  ],
  "assumptions": ["any assumptions made"],
  "questions": ["clarifying questions if needed"]
}`;

/**
 * Build user prompt with context and candidates
 */
function buildUserPrompt(state: AIGraphStateType): string {
  const parts: string[] = [];
  
  // Add search intent
  parts.push(`Search Intent: "${state.search_intent}"`);
  
  // Add family context
  if (state.family_context) {
    const fc = state.family_context;
    if (fc.children.length > 0) {
      const childrenDesc = fc.children
        .map(c => `${c.name || 'Child'} (age ${c.age}, interests: ${c.interests.join(', ') || 'not specified'})`)
        .join('; ');
      parts.push(`Children: ${childrenDesc}`);
    }
    if (fc.location?.city) {
      parts.push(`Location: ${fc.location.city}`);
    }
    if (fc.preferences.budget_monthly) {
      parts.push(`Budget: $${fc.preferences.budget_monthly}/month`);
    }
    if (fc.preferences.days_of_week?.length) {
      parts.push(`Preferred Days: ${fc.preferences.days_of_week.join(', ')}`);
    }
  }
  
  // Add parsed filters
  if (state.parsed_filters) {
    const pf = state.parsed_filters;
    const filterParts: string[] = [];
    if (pf.ageMin !== undefined || pf.ageMax !== undefined) {
      filterParts.push(`Age: ${pf.ageMin || 0}-${pf.ageMax || 18}`);
    }
    if (pf.costMax !== undefined) {
      filterParts.push(`Max Cost: $${pf.costMax}`);
    }
    if (pf.dayOfWeek?.length) {
      filterParts.push(`Days: ${pf.dayOfWeek.join(', ')}`);
    }
    if (filterParts.length > 0) {
      parts.push(`Filters: ${filterParts.join(', ')}`);
    }
  }
  
  // Add candidates (compressed format)
  const candidates = state.candidate_activities || [];
  if (candidates.length > 0) {
    parts.push(`\nCandidate Activities (${candidates.length}):`);
    candidates.forEach((act, idx) => {
      parts.push(`${idx + 1}. [${act.id}] ${act.name} - ${act.cat} - Ages ${act.age[0]}-${act.age[1]} - $${act.cost} - ${act.days.join(',')}${act.sponsored ? ' [SPONSORED]' : ''}`);
      if (act.desc) {
        parts.push(`   ${act.desc.substring(0, 100)}...`);
      }
    });
  } else {
    parts.push('\nNo candidate activities found matching filters.');
  }
  
  parts.push('\nRank the top 10 activities with explanations. Return JSON only.');
  
  return parts.join('\n');
}

/**
 * Generate heuristic recommendations when LLM fails or is unavailable
 */
function getHeuristicRecommendations(candidates: CompressedActivity[]): AIRecommendation[] {
  // Simple scoring: prioritize sponsored, then by distance, then alphabetical
  const scored = candidates.map((act, idx) => ({
    activity: act,
    score: (act.sponsored ? 20 : 0) + (100 - idx) + (act.spots === null ? 0 : act.spots > 0 ? 10 : -50),
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, 10).map((item, idx) => ({
    activity_id: item.activity.id,
    rank: idx + 1,
    is_sponsored: item.activity.sponsored,
    why: [`Matches your search criteria`, `Suitable for ages ${item.activity.age[0]}-${item.activity.age[1]}`],
    fit_score: Math.max(50, 100 - idx * 5),
    warnings: item.activity.spots === 0 ? ['May be full'] : [],
  }));
}

/**
 * Recommend node - ranks candidates using LLM
 */
export async function recommendNode(state: AIGraphStateType): Promise<Partial<AIGraphStateType>> {
  console.log('🎯 [RecommendNode] Generating recommendations...');
  
  const candidates = state.candidate_activities || [];
  
  if (candidates.length === 0) {
    console.log('🎯 [RecommendNode] No candidates, returning empty recommendations');
    return {
      recommendations: [],
      source: 'heuristic',
    };
  }
  
  // Use heuristic for small candidate sets
  if (candidates.length <= 5) {
    console.log('🎯 [RecommendNode] Small candidate set, using heuristic');
    return {
      recommendations: getHeuristicRecommendations(candidates),
      source: 'heuristic',
    };
  }
  
  try {
    const model = getModelByTier(state.model_tier);
    const userPrompt = buildUserPrompt(state);
    
    console.log('🎯 [RecommendNode] Invoking LLM...');
    
    const result = await model.invoke([
      { role: 'system', content: RECOMMEND_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]);
    
    // Extract content
    const content = typeof result.content === 'string' 
      ? result.content 
      : JSON.stringify(result.content);
    
    // Parse and validate response
    const parsed = AIResponseSchema.parse(JSON.parse(content));
    
    console.log(`🎯 [RecommendNode] LLM returned ${parsed.recommendations.length} recommendations`);
    
    // Track tokens
    const tokensUsed = (result as any).usage_metadata?.total_tokens || 0;
    
    return {
      recommendations: parsed.recommendations,
      source: 'llm',
      tokens_used: tokensUsed,
      model_used: state.model_tier === 'large' ? 'gpt-4o' : 'gpt-4o-mini',
    };
    
  } catch (error) {
    console.error('🎯 [RecommendNode] LLM error, falling back to heuristic:', error);
    
    return {
      recommendations: getHeuristicRecommendations(candidates),
      source: 'heuristic',
      errors: [`LLM failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}
