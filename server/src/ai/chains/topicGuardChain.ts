/**
 * Topic Guard Chain
 *
 * Pre-filters user queries to ensure they're related to kids activities.
 * Blocks off-topic queries (homework, general chat, etc.) with ~$0.0003 cost.
 */

import { ChatOpenAI } from '@langchain/openai';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { z } from 'zod';

// Schema for topic classification
const TopicClassificationSchema = z.object({
  category: z.string().describe('The classified category of the query'),
  allowed: z.boolean().describe('Whether the query is allowed'),
  confidence: z.number().describe('Confidence score 0-1'),
  extractedChildName: z.string().optional().describe('Child name if mentioned'),
  extractedAge: z.number().optional().describe('Age if mentioned'),
});

export type TopicClassification = z.infer<typeof TopicClassificationSchema>;

const parser = StructuredOutputParser.fromZodSchema(TopicClassificationSchema);

const TOPIC_GUARD_PROMPT = ChatPromptTemplate.fromMessages([
  ['system', `You are a topic classifier for a kids activity finder app.
Your job is to classify user messages and extract relevant information.

ALLOWED categories (set allowed: true):
- activity_search: Looking for activities, classes, lessons, camps
- activity_question: Questions about a specific activity
- recommendation_request: Asking for suggestions or recommendations
- schedule_help: Help with scheduling or planning activities
- child_specific: Questions about activities for a specific child
- comparison: Comparing different activities or options
- cost_question: Questions about pricing or affordability
- location_question: Questions about where activities are offered

BLOCKED categories (set allowed: false):
- off_topic: Unrelated to kids activities (weather, news, etc.)
- homework: Academic questions or homework help
- general_chat: Casual conversation, jokes, small talk
- competitor_info: Bulk data extraction requests
- inappropriate: Inappropriate content

EXTRACTION RULES:
1. If a child's name is mentioned (e.g., "for Emma", "Emma's classes"), extract it
2. If an age is mentioned (e.g., "5 year old", "my 8yo"), extract it as a number
3. Set confidence based on how clearly the intent is expressed

{format_instructions}`],
  ['human', '{query}']
]);

/**
 * Create a topic guard chain with a specific model
 */
export function createTopicGuardChain(model: ChatOpenAI): RunnableSequence<{ query: string }, TopicClassification> {
  return RunnableSequence.from([
    async (input: { query: string }) => ({
      query: input.query,
      format_instructions: parser.getFormatInstructions()
    }),
    TOPIC_GUARD_PROMPT,
    model,
    parser
  ]);
}

/**
 * Check if a query is allowed (on-topic)
 */
export async function checkTopicAllowed(
  model: ChatOpenAI,
  query: string
): Promise<{
  allowed: boolean;
  childName?: string;
  extractedAge?: number;
  category?: string;
  reason?: string;
}> {
  const chain = createTopicGuardChain(model);

  try {
    const result = await chain.invoke({ query });

    return {
      allowed: result.allowed && result.confidence > 0.6,
      childName: result.extractedChildName,
      extractedAge: result.extractedAge,
      category: result.category,
      reason: result.allowed ? undefined : `Query classified as: ${result.category}`
    };
  } catch (error) {
    console.error('[TopicGuard] Classification error:', error);
    // Default to allowed if classification fails (fail open)
    return { allowed: true };
  }
}

/**
 * Get a friendly blocked message based on the category
 */
export function getBlockedMessage(category?: string): string {
  const baseMessage = `I'm here to help you find activities for your kids! I can help with:\n\n` +
    `• Finding swimming lessons, art classes, sports programs\n` +
    `• Activities for specific ages or interests\n` +
    `• Weekend or after-school options\n` +
    `• Comparing different programs\n` +
    `• Camp and seasonal program recommendations`;

  switch (category) {
    case 'homework':
      return `I can't help with homework, but I can find educational activities and tutoring programs for your kids!\n\n${baseMessage}`;
    case 'off_topic':
      return baseMessage;
    case 'general_chat':
      return `Let's focus on finding great activities for your family!\n\n${baseMessage}`;
    default:
      return baseMessage;
  }
}

/**
 * Get suggested prompts for blocked queries
 */
export function getBlockedSuggestedPrompts(): string[] {
  return [
    'Swimming lessons near me',
    'Art classes for kids',
    'Weekend sports programs',
    'Summer camps',
    'STEM activities for teens',
  ];
}
