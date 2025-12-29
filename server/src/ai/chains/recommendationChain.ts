import { ChatOpenAI } from '@langchain/openai';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { AIResponseSchema, AIResponse } from '../schemas/recommendation.schema';
import { SYSTEM_PROMPT, getSponsorPolicyText } from '../prompts/system';
import { RECOMMENDATION_PROMPT } from '../prompts/recommendations';
import { CompressedActivity, FamilyContext } from '../types/ai.types';
import { buildCompactFamilyContext } from '../utils/contextCompressor';

/**
 * Create structured output parser from Zod schema
 */
const outputParser = StructuredOutputParser.fromZodSchema(AIResponseSchema);

/**
 * Create the chat prompt template
 */
const promptTemplate = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT),
  HumanMessagePromptTemplate.fromTemplate(RECOMMENDATION_PROMPT)
]);

/**
 * Create a recommendation chain with a specific model
 */
export function createRecommendationChain(model: ChatOpenAI): RunnableSequence<any, AIResponse> {
  return RunnableSequence.from([
    promptTemplate,
    model,
    outputParser
  ]);
}

/**
 * Build the input for the recommendation chain
 */
export function buildChainInput(
  searchIntent: string,
  activities: CompressedActivity[],
  familyContext: FamilyContext | undefined
): Record<string, string> {
  return {
    search_intent: searchIntent || 'Find suitable activities for my family',
    activities: JSON.stringify(activities, null, 2),
    family_context: buildCompactFamilyContext(familyContext),
    sponsor_policy: getSponsorPolicyText(),
    format_instructions: outputParser.getFormatInstructions()
  };
}

/**
 * Invoke the recommendation chain
 */
export async function invokeRecommendationChain(
  model: ChatOpenAI,
  searchIntent: string,
  activities: CompressedActivity[],
  familyContext: FamilyContext | undefined
): Promise<AIResponse> {
  const chain = createRecommendationChain(model);
  const input = buildChainInput(searchIntent, activities, familyContext);
  
  try {
    const result = await chain.invoke(input);
    return result;
  } catch (error: any) {
    console.error('[Recommendation Chain] Error:', error.message);
    
    // Try to parse raw response if structured parsing failed
    if (error.message.includes('Could not parse')) {
      console.log('[Recommendation Chain] Attempting raw JSON parse...');
      // Return empty response on parse failure
      return {
        recommendations: [],
        assumptions: ['Failed to generate recommendations'],
        questions: []
      };
    }
    
    throw error;
  }
}
