/**
 * Parse Node
 * 
 * Parses natural language queries into structured search filters.
 * Uses LLM to extract intent, age, location, time preferences, etc.
 */

import { AIGraphStateType } from '../state';
import { getSmallModel } from '../../models/chatModels';
import { ActivitySearchParams } from '../../types/ai.types';
import { z } from 'zod';

/**
 * Schema for parsed search result
 */
const ParsedSearchSchema = z.object({
  search: z.string().optional().describe('Main activity type or keyword'),
  ageMin: z.number().optional().describe('Minimum age for the child'),
  ageMax: z.number().optional().describe('Maximum age for the child'),
  dayOfWeek: z.array(z.string()).optional().describe('Preferred days'),
  location: z.string().optional().describe('Location or area mentioned'),
  costMax: z.number().optional().describe('Maximum budget mentioned'),
  timeOfDay: z.enum(['morning', 'afternoon', 'evening']).optional(),
  confidence: z.number().min(0).max(1).describe('Confidence in parsing'),
});

/**
 * System prompt for NL parsing
 */
const PARSE_SYSTEM_PROMPT = `You are a search query parser for a kids activity finder app.
Extract structured filters from natural language queries.

Rules:
- "for my X year old" -> set ageMin = X-1, ageMax = X+1
- "near downtown" or location names -> set location
- "on Saturdays" -> set dayOfWeek: ["Saturday"]
- "in the morning" -> note as timeOfDay
- "swimming", "dance", etc -> set as search keyword
- Be conservative - only extract what's clearly stated

Return JSON only, no explanation.`;

/**
 * Parse natural language into structured filters
 */
export async function parseNode(state: AIGraphStateType): Promise<Partial<AIGraphStateType>> {
  console.log('📝 [ParseNode] Parsing natural language query...');
  
  const query = state.raw_query || state.search_intent;
  
  if (!query) {
    console.log('📝 [ParseNode] No query to parse, skipping');
    return { request_type: 'recommend' };
  }
  
  try {
    const model = getSmallModel();
    
    const result = await model.invoke([
      { role: 'system', content: PARSE_SYSTEM_PROMPT },
      { role: 'user', content: `Parse this search query: "${query}"` }
    ]);
    
    // Extract content from response
    const content = typeof result.content === 'string' 
      ? result.content 
      : JSON.stringify(result.content);
    
    // Parse JSON response
    const parsed = ParsedSearchSchema.parse(JSON.parse(content));
    
    console.log('📝 [ParseNode] Parsed filters:', parsed);
    
    // Convert to ActivitySearchParams
    const filters: ActivitySearchParams = {
      search: parsed.search,
      ageMin: parsed.ageMin,
      ageMax: parsed.ageMax,
      dayOfWeek: parsed.dayOfWeek,
      location: parsed.location,
      costMax: parsed.costMax,
    };
    
    // Track tokens
    const tokensUsed = (result as any).usage_metadata?.total_tokens || 0;
    
    return {
      parsed_filters: filters,
      search_intent: parsed.search || query,
      request_type: 'recommend', // Continue to recommendations
      tokens_used: tokensUsed,
      model_used: 'gpt-4o-mini',
    };
    
  } catch (error) {
    console.error('📝 [ParseNode] Parse error:', error);
    
    // Fallback: use raw query as search term
    return {
      parsed_filters: { search: query },
      search_intent: query,
      request_type: 'recommend',
      errors: [`Parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}
