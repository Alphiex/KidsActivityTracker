/**
 * Query Understanding Layer
 *
 * Implements intent classification, entity extraction, and query rewriting
 * to better understand user queries before searching.
 */

import { ChatOpenAI } from '@langchain/openai';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { getSmallModel } from '../models/chatModels';
import { resolveTemporalExpression, TemporalResolution } from './temporalResolver';
import { ConversationOverrides } from './activityScorer';

// Intent types
export type QueryIntent =
  | 'activity_search'      // "swimming lessons"
  | 'schedule_planning'    // "spring break activities"
  | 'comparison'           // "which is better"
  | 'specific_query'       // "is X good for Y?"
  | 'exploration'          // "what's available?"
  | 'follow_up'            // "show me more", "try again"
  | 'clarification_response'; // User responding to our question

// Schema for query analysis
const QueryAnalysisSchema = z.object({
  intent: z.enum([
    'activity_search',
    'schedule_planning',
    'comparison',
    'specific_query',
    'exploration',
    'follow_up',
    'clarification_response',
  ]).describe('The classified intent of the query'),

  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),

  // Extracted entities
  activityTypes: z.array(z.string()).optional().describe('Activity types mentioned (skating, swimming, soccer, etc.)'),
  ageExplicit: z.number().optional().describe('Age explicitly mentioned (e.g., "5 year old" -> 5)'),
  childName: z.string().optional().describe('Child name if mentioned'),
  locationExplicit: z.string().optional().describe('Location/city mentioned'),
  daysExplicit: z.array(z.string()).optional().describe('Days of week mentioned'),
  budgetExplicit: z.number().optional().describe('Budget mentioned (e.g., "under $100" -> 100)'),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional().describe('Skill level mentioned'),
  environment: z.enum(['indoor', 'outdoor']).optional().describe('Indoor/outdoor preference'),

  // Temporal expressions
  temporalExpression: z.string().optional().describe('Time-related phrase (spring break, this weekend, summer)'),

  // Overrides detected
  distanceOverride: z.boolean().optional().describe('User said they don\'t mind distance'),
  budgetOverride: z.boolean().optional().describe('User said budget is not an issue'),
  preferNewCategories: z.boolean().optional().describe('User wants something different/new'),

  // Follow-up detection
  isFollowUp: z.boolean().describe('Whether this is a follow-up to a previous search'),
  referencedPrevious: z.boolean().optional().describe('References previous results'),

  // Rewritten query (cleaner form for search)
  rewrittenQuery: z.string().optional().describe('Clean, searchable form of the query'),
});

export type QueryAnalysis = z.infer<typeof QueryAnalysisSchema>;

// Full understanding result
export interface QueryUnderstanding {
  original: string;
  analysis: QueryAnalysis;
  temporalResolution?: TemporalResolution;
  needsClarification: boolean;
  clarificationQuestion?: string;
  clarificationOptions?: string[];
  overrides: ConversationOverrides;
  searchParams: {
    searchTerm?: string;
    activityTypes?: string[];
    minAge?: number;
    maxAge?: number;
    city?: string;
    daysOfWeek?: string[];
    maxPrice?: number;
    skillLevel?: 'beginner' | 'intermediate' | 'advanced';
    environment?: 'indoor' | 'outdoor';
    startDateAfter?: string;
    startDateBefore?: string;
  };
}

// Create the parser
const parser = StructuredOutputParser.fromZodSchema(QueryAnalysisSchema);

// Prompt for query analysis
const QUERY_ANALYSIS_PROMPT = ChatPromptTemplate.fromMessages([
  ['system', `You are a query analyzer for a kids activity finder app.
Analyze user messages to understand their intent and extract relevant information.

INTENT CLASSIFICATION:
- activity_search: Looking for specific activities (swimming, skating, art classes)
- schedule_planning: Planning activities for a time period (spring break, summer, this week)
- comparison: Comparing options or asking "which is better"
- specific_query: Questions about a specific activity
- exploration: General browsing, "what's available", "show me activities"
- follow_up: "show more", "try again", "search again", "different options"
- clarification_response: User answering a question you asked

ENTITY EXTRACTION RULES:
1. Activity types: Extract specific activity keywords (skating, swimming, soccer, piano, art)
2. Age: Extract age numbers ("5 year old" -> 5, "my 3yo" -> 3, "for toddlers" -> 2)
3. Location: Extract city names ("in Vancouver", "near Burnaby")
4. Days: Extract day preferences ("weekends" -> ["Saturday", "Sunday"])
5. Budget: Extract price limits ("under $100" -> 100, "cheap" -> 50)
6. Skill level: beginner/intro/learn-to, intermediate/continuing, advanced/competitive
7. Environment: indoor/inside, outdoor/outside

OVERRIDE DETECTION:
- "don't mind driving", "willing to travel" -> distanceOverride: true
- "budget isn't an issue", "price doesn't matter" -> budgetOverride: true
- "something different", "new activity", "try something else" -> preferNewCategories: true

TEMPORAL EXPRESSIONS:
Look for: spring break, march break, summer, winter, this weekend, next week, after school

QUERY REWRITING:
Create a clean, searchable version of the query that captures the core need.

{format_instructions}`],
  ['human', `Previous context (if any): {context}

User message: {query}`],
]);

/**
 * Analyze a user query to understand intent and extract entities
 */
export async function analyzeQuery(
  query: string,
  context?: {
    previousMessages?: string[];
    childrenFromProfile?: Array<{ name: string; age: number }>;
    locationFromProfile?: string;
  }
): Promise<QueryUnderstanding> {
  const model = getSmallModel();

  // Build context string
  const contextStr = context?.previousMessages?.length
    ? `Recent conversation:\n${context.previousMessages.slice(-3).join('\n')}`
    : 'No previous context';

  try {
    // Create the chain
    const chain = QUERY_ANALYSIS_PROMPT.pipe(model).pipe(parser);

    // Run analysis
    const analysis = await chain.invoke({
      query,
      context: contextStr,
      format_instructions: parser.getFormatInstructions(),
    });

    // Resolve temporal expressions
    let temporalResolution: TemporalResolution | undefined;
    if (analysis.temporalExpression) {
      temporalResolution = resolveTemporalExpression(analysis.temporalExpression);
    }

    // Determine if clarification is needed
    const clarification = determineClarificationNeed(analysis, temporalResolution, context);

    // Build overrides
    const overrides: ConversationOverrides = {
      locationOverride: analysis.distanceOverride
        ? { maxDistanceKm: 150 }
        : analysis.locationExplicit
          ? { city: analysis.locationExplicit }
          : undefined,
      ageOverride: analysis.ageExplicit,
      daysOverride: analysis.daysExplicit,
      ignoreBudget: analysis.budgetOverride,
      preferNewCategories: analysis.preferNewCategories,
      skillLevelRequired: analysis.skillLevel,
      explicitRequirements: analysis.activityTypes || [],
    };

    // Build search params
    const searchParams: QueryUnderstanding['searchParams'] = {
      searchTerm: analysis.activityTypes?.[0] || analysis.rewrittenQuery,
      activityTypes: analysis.activityTypes,
      minAge: analysis.ageExplicit,
      maxAge: analysis.ageExplicit,
      city: analysis.locationExplicit,
      daysOfWeek: analysis.daysExplicit,
      maxPrice: analysis.budgetExplicit,
      skillLevel: analysis.skillLevel,
      environment: analysis.environment,
    };

    // Add temporal dates if resolved
    if (temporalResolution && !temporalResolution.needsClarification) {
      searchParams.startDateAfter = temporalResolution.startDate?.toISOString().split('T')[0];
      searchParams.startDateBefore = temporalResolution.endDate?.toISOString().split('T')[0];
    }

    return {
      original: query,
      analysis,
      temporalResolution,
      needsClarification: clarification.needed,
      clarificationQuestion: clarification.question,
      clarificationOptions: clarification.options,
      overrides,
      searchParams,
    };
  } catch (error) {
    console.error('[QueryUnderstanding] Analysis error:', error);

    // Fallback to basic analysis
    return basicAnalysis(query);
  }
}

/**
 * Determine if we need to ask a clarifying question
 */
function determineClarificationNeed(
  analysis: QueryAnalysis,
  temporal?: TemporalResolution,
  context?: {
    childrenFromProfile?: Array<{ name: string; age: number }>;
    locationFromProfile?: string;
  }
): { needed: boolean; question?: string; options?: string[] } {
  // Priority 1: Ambiguous temporal expression
  if (temporal?.needsClarification) {
    return {
      needed: true,
      question: temporal.clarificationQuestion || 'When would you like to find activities?',
      options: temporal.suggestedDates?.map((d) =>
        `${d.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${d.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      ),
    };
  }

  // Priority 2: No age and no children in profile for schedule_planning
  if (
    analysis.intent === 'schedule_planning' &&
    !analysis.ageExplicit &&
    (!context?.childrenFromProfile || context.childrenFromProfile.length === 0)
  ) {
    return {
      needed: true,
      question: 'What age is your child?',
      options: ['3-5 years (preschool)', '6-8 years', '9-12 years', '13+ years (teen)'],
    };
  }

  // Priority 3: Multiple children and activity might not suit all
  if (
    context?.childrenFromProfile &&
    context.childrenFromProfile.length > 1 &&
    !analysis.childName &&
    analysis.intent !== 'exploration'
  ) {
    const children = context.childrenFromProfile;
    const ageDiff = Math.max(...children.map((c) => c.age)) - Math.min(...children.map((c) => c.age));

    if (ageDiff > 3) {
      return {
        needed: true,
        question: 'Which child are you looking for activities for?',
        options: [
          ...children.map((c) => `${c.name} (age ${c.age})`),
          'Activities they can do together',
        ],
      };
    }
  }

  // Priority 4: Exploration with no direction
  if (
    analysis.intent === 'exploration' &&
    !analysis.activityTypes?.length &&
    analysis.confidence < 0.7
  ) {
    return {
      needed: true,
      question: 'What type of activities are you interested in?',
      options: ['Sports & Fitness', 'Arts & Music', 'Swimming & Aquatics', 'STEM & Learning'],
    };
  }

  return { needed: false };
}

/**
 * Basic fallback analysis without LLM
 */
function basicAnalysis(query: string): QueryUnderstanding {
  const queryLower = query.toLowerCase();

  // Extract activity types
  const activityKeywords = [
    'swimming', 'skating', 'hockey', 'soccer', 'basketball', 'baseball',
    'dance', 'ballet', 'gymnastics', 'art', 'music', 'piano', 'guitar',
    'coding', 'martial arts', 'karate', 'tennis', 'golf',
  ];

  const activityTypes = activityKeywords.filter((kw) => queryLower.includes(kw));

  // Extract age
  const ageMatch = queryLower.match(/(\d{1,2})\s*(year|yr|yo)/);
  const ageExplicit = ageMatch ? parseInt(ageMatch[1], 10) : undefined;

  // Extract days
  const daysExplicit: string[] = [];
  if (queryLower.includes('weekend')) {
    daysExplicit.push('Saturday', 'Sunday');
  }
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach((day) => {
    if (queryLower.includes(day)) {
      daysExplicit.push(day.charAt(0).toUpperCase() + day.slice(1));
    }
  });

  // Detect temporal
  const temporalPatterns = ['spring break', 'march break', 'summer', 'winter break', 'this weekend', 'next week'];
  const temporalExpression = temporalPatterns.find((p) => queryLower.includes(p));

  // Detect intent
  let intent: QueryIntent = 'activity_search';
  if (temporalExpression) intent = 'schedule_planning';
  if (queryLower.includes('show more') || queryLower.includes('try again')) intent = 'follow_up';
  if (queryLower.includes('what') && queryLower.includes('available')) intent = 'exploration';

  // Detect overrides
  const distanceOverride = queryLower.includes('don\'t mind') || queryLower.includes('willing to travel');
  const budgetOverride = queryLower.includes('budget') && queryLower.includes('issue');

  // Build temporal resolution if needed
  let temporalResolution: TemporalResolution | undefined;
  if (temporalExpression) {
    temporalResolution = resolveTemporalExpression(temporalExpression);
  }

  return {
    original: query,
    analysis: {
      intent,
      confidence: 0.6,
      activityTypes: activityTypes.length > 0 ? activityTypes : undefined,
      ageExplicit,
      daysExplicit: daysExplicit.length > 0 ? daysExplicit : undefined,
      temporalExpression,
      distanceOverride,
      budgetOverride,
      isFollowUp: intent === 'follow_up',
    },
    temporalResolution,
    needsClarification: temporalResolution?.needsClarification || false,
    clarificationQuestion: temporalResolution?.clarificationQuestion,
    overrides: {
      locationOverride: distanceOverride ? { maxDistanceKm: 150 } : undefined,
      ageOverride: ageExplicit,
      daysOverride: daysExplicit.length > 0 ? daysExplicit : undefined,
      ignoreBudget: budgetOverride,
      explicitRequirements: activityTypes,
    },
    searchParams: {
      searchTerm: activityTypes[0],
      activityTypes,
      minAge: ageExplicit,
      maxAge: ageExplicit,
      daysOfWeek: daysExplicit.length > 0 ? daysExplicit : undefined,
    },
  };
}

/**
 * Quick entity extraction without full LLM analysis
 * Used when we need fast extraction (e.g., in topic guard)
 */
export function quickExtract(query: string): {
  activityType?: string;
  age?: number;
  city?: string;
  temporal?: string;
} {
  const queryLower = query.toLowerCase();

  // Activity type
  const activityKeywords = [
    'swimming', 'skating', 'hockey', 'soccer', 'basketball', 'baseball',
    'dance', 'ballet', 'gymnastics', 'art', 'music', 'piano', 'guitar',
    'coding', 'martial arts', 'karate', 'tennis', 'golf', 'volleyball',
    'yoga', 'cooking', 'pottery', 'drama', 'theater', 'science',
  ];
  const activityType = activityKeywords.find((kw) => queryLower.includes(kw));

  // Age
  const ageMatch = queryLower.match(/(\d{1,2})\s*(year|yr|yo)/);
  const age = ageMatch ? parseInt(ageMatch[1], 10) : undefined;

  // City (common BC/Canadian cities)
  const cities = [
    'vancouver', 'north vancouver', 'west vancouver', 'burnaby', 'richmond',
    'surrey', 'coquitlam', 'new westminster', 'delta', 'langley', 'maple ridge',
    'port coquitlam', 'port moody', 'white rock', 'victoria', 'kelowna',
    'toronto', 'ottawa', 'calgary', 'edmonton', 'montreal',
  ];
  const city = cities.find((c) => queryLower.includes(c));

  // Temporal
  const temporalPatterns = ['spring break', 'march break', 'summer', 'winter break', 'this weekend', 'next week', 'after school'];
  const temporal = temporalPatterns.find((p) => queryLower.includes(p));

  return { activityType, age, city, temporal };
}

export default {
  analyzeQuery,
  quickExtract,
};
