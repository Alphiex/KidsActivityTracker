/**
 * Activity Assistant Agent
 *
 * A conversational AI agent for helping parents find activities for their children.
 * Uses OpenAI function calling with custom tools.
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

// Types for family context
export interface EnhancedChildProfile {
  child_id: string;
  name: string;
  age: number;
  interests?: string[];
  favorites?: { activityName: string; category: string }[];
  calendarActivities?: { name: string; category: string; status: string }[];
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
}

const AGENT_SYSTEM_PROMPT = `You are a friendly AI assistant for KidsActivityTracker, helping parents find activities for their children.

FAMILY CONTEXT:
{family_context}

CONVERSATION PARAMETERS (accumulated from this conversation):
{conversation_params}

YOUR CAPABILITIES:
1. Search for activities using the search_activities tool
2. Get child profile information using get_child_context
3. Get detailed activity information using get_activity_details
4. Compare activities using compare_activities

SEARCH RULES (CRITICAL - FOLLOW THESE EXACTLY):
1. ALWAYS include latitude and longitude when searching - use values from FAMILY CONTEXT or CONVERSATION PARAMETERS
2. For age filtering, use this priority order:
   - If age is in current message, use that age
   - If no age in current message but CONVERSATION PARAMETERS has extractedAge, use that
   - If no age anywhere but FAMILY CONTEXT has children, use the first child's age
3. For follow-up requests like "search again", "find more", "show similar", "try again":
   - ALWAYS reuse the lastSearchFilters from CONVERSATION PARAMETERS
   - This includes: searchTerm, minAge, maxAge, city, coordinates
4. Prefer using searchTerm over category for specific activities (skating, swimming, soccer, etc.)
5. When city is mentioned, include it in the search along with coordinates

CONTEXT PRIORITY (highest to lowest):
1. Current message explicit values (user says "for my 5 year old" now)
2. CONVERSATION PARAMETERS (values from earlier in this conversation)
3. FAMILY CONTEXT (default from user's profile/database)

GENERAL RULES:
1. ONLY discuss kids activities, classes, camps, and related topics
2. Always use tools to search for activities - don't make up information
3. Personalize recommendations based on child preferences and history
4. When asked about a specific child, get their context first
5. Be helpful, friendly, and concise

CRITICAL RESPONSE FORMAT:
- DO NOT list or describe individual activities in your text response - the app will display them as clickable cards automatically
- Just provide a brief summary like "I found X great activities for your child!" or "Here are some skating options that would be perfect for a 3-year-old"
- Add a brief note about why these are good choices or what to look for
- Keep your text response SHORT (1-2 sentences max) since activities are shown separately`;

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
      .replace('{conversation_params}', formatConversationParams(conversation.parameters));

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
    const followUpPrompts = generateFollowUpPrompts(responseText, conversation.lastContext);

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
