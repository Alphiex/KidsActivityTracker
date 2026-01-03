/**
 * Activity Assistant Agent
 *
 * A conversational AI agent for helping parents find activities for their children.
 * Uses OpenAI function calling with custom tools.
 *
 * Enhanced with:
 * - Query understanding for intent classification and entity extraction
 * - Clarification engine for smart questioning
 * - Conversation overrides for explicit user preferences
 * - Temporal expression resolution
 */

import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { RunnableSequence } from '@langchain/core/runnables';
import { activityTools } from '../tools/activityTools';
import { getChatAgentModel } from '../models/chatModels';
import { analyzeQuery, QueryUnderstanding, quickExtract } from '../utils/queryUnderstanding';
import { determineClarification, ClarificationDecision, generateFollowUpSuggestions } from '../utils/clarificationEngine';
import { extractOverrides, mergeOverrides, summarizeOverrides } from '../utils/conversationOverrides';
import { ConversationOverrides } from '../utils/activityScorer';
import { resolveTemporalExpression } from '../utils/temporalResolver';

// Types for family context
export interface ChildPreferencesData {
  location?: {
    formattedAddress?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  activityTypes?: string[];
  daysOfWeek?: string[];
  timePreferences?: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  };
  budget?: {
    min: number;
    max: number;
  };
  distanceRadiusKm?: number;
  environmentFilter?: 'all' | 'indoor' | 'outdoor';
}

export interface EnhancedChildProfile {
  child_id: string;
  name: string;
  age: number;
  interests?: string[];
  favorites?: { activityName: string; category: string }[];
  calendarActivities?: { name: string; category: string; status: string }[];
  // Child-specific activity preferences (per-child settings)
  preferences?: ChildPreferencesData;
  computedPreferences?: {
    preferredCategories?: string[];
    preferredDays?: string[];
  };
}

export interface EnhancedFamilyContext {
  children: EnhancedChildProfile[];
  location?: {
    city?: string;
    province?: string;
    lat?: number;
    lng?: number;
  };
  // Filter mode for multi-child selection: 'or' (any child) or 'and' (all together)
  filterMode?: 'or' | 'and';
}

export interface ChatResponse {
  conversationId: string;
  text: string;
  activities: any[];
  followUpPrompts: string[];
  turnsRemaining: number;
  shouldStartNew: boolean;
  toolsUsed?: string[];
}

/**
 * Conversation parameters accumulated across turns
 * These are extracted from user messages and remembered for follow-up searches
 */
export interface ConversationParameters {
  extractedAge?: number;           // Age mentioned in conversation
  extractedCity?: string;          // City/location mentioned
  extractedActivityType?: string;  // "skating", "swimming", etc.
  lastSearchFilters?: {            // Filters from most recent search
    searchTerm?: string;
    minAge?: number;
    maxAge?: number;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
}

interface ConversationState {
  messages: BaseMessage[];
  turnsUsed: number;
  userId: string;
  lastContext?: EnhancedFamilyContext;
  parameters: ConversationParameters; // Accumulated parameters from conversation
  conversationOverrides: ConversationOverrides; // Explicit user preferences from conversation
  lastQueryUnderstanding?: QueryUnderstanding; // Last analyzed query
  pendingClarification?: ClarificationDecision; // Pending clarification question
}

const AGENT_SYSTEM_PROMPT = `You are a friendly AI assistant for KidsActivityTracker, helping parents find activities for their children.

FAMILY CONTEXT:
{family_context}

CONVERSATION PARAMETERS (accumulated from this conversation):
{conversation_params}

CONVERSATION OVERRIDES (explicit user preferences detected in conversation):
{conversation_overrides}

YOUR CAPABILITIES:
1. Search for activities using the search_activities or enhanced_search tool
2. Get child profile information using get_child_context
3. Get detailed activity information using get_activity_details
4. Compare activities using compare_activities
5. Use enhanced_search for complex queries with personalized scoring

SEARCH RULES (CRITICAL - FOLLOW THESE EXACTLY):
1. ALWAYS include latitude and longitude when searching - use values from FAMILY CONTEXT or CONVERSATION PARAMETERS
2. For age filtering, use this priority order:
   - If age is in CONVERSATION OVERRIDES (ageOverride), use that first
   - If age is in current message, use that age
   - If no age in current message but CONVERSATION PARAMETERS has extractedAge, use that
   - If no age anywhere but FAMILY CONTEXT has children, use the first child's age
3. For follow-up requests like "search again", "find more", "show similar", "try again":
   - ALWAYS reuse the lastSearchFilters from CONVERSATION PARAMETERS
   - This includes: searchTerm, minAge, maxAge, city, coordinates
4. Prefer using searchTerm over category for specific activities (skating, swimming, soccer, etc.)
5. When city is mentioned, include it in the search along with coordinates
6. If CONVERSATION OVERRIDES has explicitRequirements, prioritize those in your search

CONTEXT PRIORITY (highest to lowest):
1. CONVERSATION OVERRIDES (explicit preferences detected from user's words)
2. Current message explicit values (user says "for my 5 year old" now)
3. CONVERSATION PARAMETERS (values from earlier in this conversation)
4. FAMILY CONTEXT (default from user's profile/database)

OVERRIDE HANDLING:
- If user says "don't mind driving" or "willing to travel": Expand distance search to 150km
- If user says "budget isn't an issue": Ignore price filters
- If user says "something new/different": Prioritize categories they haven't tried
- If user mentions specific days: Filter to only those days

GENERAL RULES:
1. ONLY discuss kids activities, classes, camps, and related topics
2. Always use tools to search for activities - don't make up information
3. Personalize recommendations based on child preferences and history
4. When asked about a specific child, get their context first
5. Be helpful, friendly, and concise
6. If the query is complex or results are poor, use enhanced_search for better matching

CRITICAL RESPONSE FORMAT:
Your response MUST include a personalized summary that mentions specific activities and why they're recommended.

ALWAYS include activity IDs using this format: [activity:UUID] right after the activity name.
This allows the app to link directly to activity details.

Format each recommended activity as:
• **[Activity Name]** [activity:UUID-HERE] - [reason it's great for their child]

Example format:
"I found some great skating options for Aiden! Here are my top picks:

• **Learn to Skate - Beginners** [activity:abc123-def456-...] - Perfect for a 3-year-old just starting out, with small class sizes
• **Parent & Tot Skating** [activity:xyz789-ghi012-...] - You can join Aiden on the ice, great for building confidence
• **Saturday Skating Camp** [activity:jkl345-mno678-...] - Fits your weekend schedule and includes all equipment

All of these are within 15km of your location. Would you like more details on any of these?"

Guidelines:
1. Start with a brief intro acknowledging what they're looking for
2. List 2-3 TOP recommended activities BY NAME with their ID and a reason
3. Keep each reason tied to their child's age, interests, location, or stated preferences
4. End with an invitation to explore more or ask questions
5. Keep it concise but specific - parents want to know WHY each activity is a good fit`;

/**
 * Format family context for the system prompt
 */
function formatFamilyContext(ctx?: EnhancedFamilyContext): string {
  const parts: string[] = [];

  // Location info (for search filtering)
  if (ctx?.location) {
    const locParts: string[] = [];
    if (ctx.location.city) locParts.push(`City: ${ctx.location.city}`);
    if (ctx.location.province) locParts.push(`Province: ${ctx.location.province}`);
    if (ctx.location.lat && ctx.location.lng) {
      locParts.push(`Coordinates: latitude=${ctx.location.lat}, longitude=${ctx.location.lng}`);
    }
    if (locParts.length > 0) {
      parts.push('USER LOCATION:\n' + locParts.join('\n'));
    }
  }

  // Children info
  if (!ctx?.children?.length) {
    parts.push('CHILDREN: No children registered. Ask the user about their children first.');
  } else {
    const childrenInfo = ctx.children.map(child => `
- ${child.name} (age ${child.age})
  Interests: ${child.interests?.join(', ') || 'Not specified'}
  Favorites: ${child.favorites?.slice(0, 3).map(f => f.activityName).join(', ') || 'None yet'}
  Preferred categories: ${child.computedPreferences?.preferredCategories?.join(', ') || 'Unknown'}
`).join('\n');
    parts.push('CHILDREN:' + childrenInfo);
  }

  return parts.join('\n\n');
}

/**
 * Format conversation parameters for the system prompt
 */
function formatConversationParams(params?: ConversationParameters): string {
  if (!params) return 'No parameters accumulated yet.';

  const parts: string[] = [];
  if (params.extractedAge) {
    parts.push(`Age mentioned: ${params.extractedAge} years old`);
  }
  if (params.extractedCity) {
    parts.push(`Location mentioned: ${params.extractedCity}`);
  }
  if (params.extractedActivityType) {
    parts.push(`Activity type: ${params.extractedActivityType}`);
  }
  if (params.lastSearchFilters) {
    const filters = params.lastSearchFilters;
    const filterParts: string[] = [];
    if (filters.searchTerm) filterParts.push(`searchTerm="${filters.searchTerm}"`);
    if (filters.minAge !== undefined) filterParts.push(`minAge=${filters.minAge}`);
    if (filters.maxAge !== undefined) filterParts.push(`maxAge=${filters.maxAge}`);
    if (filters.city) filterParts.push(`city="${filters.city}"`);
    if (filters.latitude && filters.longitude) {
      filterParts.push(`coordinates=(${filters.latitude}, ${filters.longitude})`);
    }
    if (filterParts.length > 0) {
      parts.push(`Last search filters: ${filterParts.join(', ')}`);
    }
  }

  return parts.length > 0 ? parts.join('\n') : 'No parameters accumulated yet.';
}

/**
 * Format conversation overrides for the system prompt
 */
function formatConversationOverrides(overrides?: ConversationOverrides): string {
  if (!overrides) return 'No overrides detected.';

  const parts: string[] = [];

  if (overrides.locationOverride?.city) {
    parts.push(`City preference: ${overrides.locationOverride.city}`);
  }
  if (overrides.locationOverride?.maxDistanceKm) {
    parts.push(`Max distance: ${overrides.locationOverride.maxDistanceKm}km (user indicated willing to travel)`);
  }
  if (overrides.ageOverride !== undefined) {
    parts.push(`Age override: ${overrides.ageOverride} years`);
  }
  if (overrides.daysOverride?.length) {
    parts.push(`Day preference: ${overrides.daysOverride.join(', ')}`);
  }
  if (overrides.ignoreBudget) {
    parts.push('Budget: User indicated budget is not a concern');
  }
  if (overrides.preferNewCategories) {
    parts.push('Variety: User wants to try something new/different');
  }
  if (overrides.skillLevelRequired) {
    parts.push(`Skill level: ${overrides.skillLevelRequired}`);
  }
  if (overrides.explicitRequirements?.length) {
    parts.push(`Explicit requirements: ${overrides.explicitRequirements.join(', ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'No overrides detected.';
}

/**
 * Generate follow-up prompts based on the conversation
 */
function generateFollowUpPrompts(
  response: string,
  ctx?: EnhancedFamilyContext
): string[] {
  const prompts: string[] = [];

  // Generic follow-ups
  if (response.toLowerCase().includes('activit')) {
    prompts.push('Tell me more about the first option');
    prompts.push('Show me cheaper alternatives');
  }

  // Child-specific follow-ups
  if (ctx?.children && ctx.children.length > 1) {
    prompts.push(`What about activities for ${ctx.children[0].name}?`);
  }

  // Schedule follow-ups
  if (!response.toLowerCase().includes('weekend')) {
    prompts.push('Any weekend options?');
  }

  return prompts.slice(0, 3);
}

/**
 * Extract activity mentions from response
 */
function extractActivitiesFromResponse(response: string): any[] {
  // Try to extract activity IDs or names mentioned
  const activityIdPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
  const matches = response.match(activityIdPattern) || [];
  return matches.map(id => ({ id }));
}

/**
 * Activity Chat Service
 * Manages conversations and executes the agent
 */
export class ActivityChatService {
  private conversations: Map<string, ConversationState> = new Map();
  private model: ChatOpenAI;
  private maxTurns = 5;

  constructor() {
    // Use chat agent model (no JSON mode) for tool-calling conversations
    this.model = getChatAgentModel();
  }

  /**
   * Process a chat message
   */
  async chat(
    userId: string,
    conversationId: string | null,
    message: string,
    familyContext?: EnhancedFamilyContext,
    extractedParams?: ConversationParameters
  ): Promise<ChatResponse> {
    let conversation = conversationId ? this.conversations.get(conversationId) : null;

    // Create new conversation if needed
    if (!conversation) {
      conversationId = `conv_${Date.now()}_${userId}`;
      conversation = {
        messages: [],
        turnsUsed: 0,
        userId,
        lastContext: familyContext,
        parameters: extractedParams || {}, // Initialize with extracted params
        conversationOverrides: { explicitRequirements: [] }, // Initialize overrides
      };
      this.conversations.set(conversationId, conversation);
    } else {
      // Merge new extracted params into existing conversation params
      if (extractedParams) {
        // New extracted values override old ones (higher priority in current message)
        if (extractedParams.extractedAge !== undefined) {
          conversation.parameters.extractedAge = extractedParams.extractedAge;
        }
        if (extractedParams.extractedCity) {
          conversation.parameters.extractedCity = extractedParams.extractedCity;
        }
        if (extractedParams.extractedActivityType) {
          conversation.parameters.extractedActivityType = extractedParams.extractedActivityType;
        }
      }
    }

    // Extract conversation overrides from this message
    const messageOverrides = extractOverrides(message, conversation.conversationOverrides);
    conversation.conversationOverrides = mergeOverrides(
      conversation.conversationOverrides,
      messageOverrides
    );

    console.log(`[ActivityChatService] Conversation overrides: ${summarizeOverrides(conversation.conversationOverrides)}`);

    // Quick entity extraction for logging
    const quickEntities = quickExtract(message);
    if (quickEntities.age) {
      conversation.parameters.extractedAge = quickEntities.age;
    }
    if (quickEntities.city) {
      conversation.parameters.extractedCity = quickEntities.city;
    }
    if (quickEntities.activityType) {
      conversation.parameters.extractedActivityType = quickEntities.activityType;
    }

    // Check if we need clarification (only for first message or unclear queries)
    if (conversation.turnsUsed === 0 && quickEntities.temporal) {
      const temporalResolution = resolveTemporalExpression(quickEntities.temporal);
      if (temporalResolution.needsClarification) {
        // Store pending clarification and ask user
        conversation.pendingClarification = {
          shouldAsk: true,
          question: {
            question: temporalResolution.clarificationQuestion || 'When would you like to find activities?',
            suggestedAnswers: temporalResolution.suggestedDates?.map(d => d.label) || [
              'This weekend',
              'Next week',
              'Custom dates',
            ],
            allowFreeform: true,
            priority: 'required',
            context: `temporal_expression:${quickEntities.temporal}`,
          },
          canProceedWithDefaults: false,
        };

        // Add human message for context
        conversation.messages.push(new HumanMessage(message));
        conversation.turnsUsed++;

        return {
          conversationId: conversationId!,
          text: temporalResolution.clarificationQuestion || `I'd be happy to help you plan activities! When exactly is ${quickEntities.temporal}? Different schools have different dates.`,
          activities: [],
          followUpPrompts: temporalResolution.suggestedDates?.map(d => d.label) || ['This weekend', 'Next week', 'Custom dates'],
          turnsRemaining: this.maxTurns - conversation.turnsUsed,
          shouldStartNew: false,
          toolsUsed: [],
        };
      }
    }

    // Check turn limits
    if (conversation.turnsUsed >= this.maxTurns) {
      return {
        conversationId,
        text: "We've covered a lot! Let's start fresh to keep our search focused. What activities are you looking for?",
        activities: [],
        followUpPrompts: ['Start new search', 'Swimming lessons', 'Art classes'],
        turnsRemaining: 0,
        shouldStartNew: true,
      };
    }

    // Update context if provided
    if (familyContext) {
      conversation.lastContext = familyContext;
    }

    // Ensure we have location coordinates (fallback to Vancouver as primary market)
    if (!conversation.lastContext?.location?.lat || !conversation.lastContext?.location?.lng) {
      conversation.lastContext = {
        ...conversation.lastContext,
        children: conversation.lastContext?.children || [],
        location: {
          ...conversation.lastContext?.location,
          city: conversation.lastContext?.location?.city || 'Vancouver',
          province: conversation.lastContext?.location?.province || 'BC',
          lat: conversation.lastContext?.location?.lat || 49.2827,
          lng: conversation.lastContext?.location?.lng || -123.1207,
        },
      };
      console.log('[ActivityChatService] Applied location fallback to Vancouver');
    }

    // Build messages array with system prompt
    const systemPrompt = AGENT_SYSTEM_PROMPT
      .replace('{family_context}', formatFamilyContext(conversation.lastContext))
      .replace('{conversation_params}', formatConversationParams(conversation.parameters))
      .replace('{conversation_overrides}', formatConversationOverrides(conversation.conversationOverrides));

    // Add human message
    conversation.messages.push(new HumanMessage(message));

    // Create the model with tools bound
    const modelWithTools = this.model.bindTools(activityTools);

    // Execute with tool calling loop
    let response: AIMessage;
    const toolsUsed: string[] = [];
    let iterations = 0;
    const maxIterations = 5;
    let foundActivities: any[] = []; // Store activities from search results

    // Prepare messages for the model
    const allMessages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...conversation.messages,
    ];

    while (iterations < maxIterations) {
      response = await modelWithTools.invoke(allMessages);

      // Check if there are tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        allMessages.push(response);

        // Execute each tool call
        for (const toolCall of response.tool_calls) {
          const tool = activityTools.find(t => t.name === toolCall.name);
          if (tool) {
            toolsUsed.push(toolCall.name);
            try {
              // Inject userId for tools that need it
              const args = { ...toolCall.args };
              if (toolCall.name === 'get_child_context' && !args.userId) {
                args.userId = userId;
              }

              const toolResult = await (tool as any).invoke(args);

              // Extract activities from search_activities tool results
              if (toolCall.name === 'search_activities') {
                // Store search parameters for follow-up queries
                const searchArgs = toolCall.args as any;
                conversation!.parameters.lastSearchFilters = {
                  searchTerm: searchArgs.searchTerm,
                  minAge: searchArgs.minAge,
                  maxAge: searchArgs.maxAge,
                  city: searchArgs.city,
                  latitude: searchArgs.latitude,
                  longitude: searchArgs.longitude,
                };
                // Also extract activity type from search term for easier reference
                if (searchArgs.searchTerm) {
                  conversation!.parameters.extractedActivityType = searchArgs.searchTerm;
                }
                console.log(`[ActivityChatService] Stored search params:`, conversation!.parameters.lastSearchFilters);

                try {
                  const parsed = JSON.parse(toolResult);
                  if (parsed.activities && Array.isArray(parsed.activities)) {
                    foundActivities = parsed.activities;
                    console.log(`[ActivityChatService] Found ${foundActivities.length} activities from search`);
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }

              allMessages.push({
                role: 'tool',
                content: toolResult,
                tool_call_id: toolCall.id,
              } as any);
            } catch (error: any) {
              allMessages.push({
                role: 'tool',
                content: JSON.stringify({ error: error.message }),
                tool_call_id: toolCall.id,
              } as any);
            }
          }
        }

        iterations++;
      } else {
        // No more tool calls, we have the final response
        break;
      }
    }

    // Add assistant response to conversation
    conversation.messages.push(response!);
    conversation.turnsUsed++;

    // Extract content
    const responseText = typeof response!.content === 'string'
      ? response!.content
      : Array.isArray(response!.content)
        ? response!.content.map(c => ('text' in c ? c.text : '')).join('')
        : '';

    // Use activities from tool results, fallback to extracting from text
    const activities = foundActivities.length > 0
      ? foundActivities
      : extractActivitiesFromResponse(responseText);

    // Generate enhanced follow-up suggestions based on results
    const followUpPrompts = conversation.lastQueryUnderstanding
      ? generateFollowUpSuggestions(
          activities.length,
          conversation.lastQueryUnderstanding,
          {
            children: conversation.lastContext?.children?.map(c => ({
              id: c.child_id,
              name: c.name,
              age: c.age,
            })),
            location: conversation.lastContext?.location ? {
              city: conversation.lastContext.location.city,
              latitude: conversation.lastContext.location.lat,
              longitude: conversation.lastContext.location.lng,
            } : undefined,
          }
        )
      : generateFollowUpPrompts(responseText, conversation.lastContext);

    return {
      conversationId,
      text: responseText,
      activities,
      followUpPrompts,
      turnsRemaining: this.maxTurns - conversation.turnsUsed,
      shouldStartNew: false,
      toolsUsed,
    };
  }

  /**
   * Clear a conversation
   */
  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  /**
   * Clean up old conversations (call periodically)
   */
  cleanupOldConversations(maxAgeMs: number = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [id, _conversation] of this.conversations) {
      const timestamp = parseInt(id.split('_')[1] || '0');
      if (now - timestamp > maxAgeMs) {
        this.conversations.delete(id);
      }
    }
  }
}

// Singleton instance
let _chatService: ActivityChatService | null = null;

export function getChatService(): ActivityChatService {
  if (!_chatService) {
    _chatService = new ActivityChatService();
  }
  return _chatService;
}
