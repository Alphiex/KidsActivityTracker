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
import { getSmallModel, getLargeModel } from '../models/chatModels';

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

interface ConversationState {
  messages: BaseMessage[];
  turnsUsed: number;
  userId: string;
  lastContext?: EnhancedFamilyContext;
}

const AGENT_SYSTEM_PROMPT = `You are a friendly AI assistant for KidsActivityTracker, helping parents find activities for their children.

FAMILY CONTEXT:
{family_context}

YOUR CAPABILITIES:
1. Search for activities using the search_activities tool
2. Get child profile information using get_child_context
3. Get detailed activity information using get_activity_details
4. Compare activities using compare_activities

RULES:
1. ONLY discuss kids activities, classes, camps, and related topics
2. Always use tools to search for activities - don't make up information
3. Personalize recommendations based on child preferences and history
4. When asked about a specific child, get their context first
5. Provide 3-5 specific activity recommendations when asked
6. Explain why each activity is a good match
7. Be helpful, friendly, and concise

RESPONSE FORMAT:
- Start with a brief, friendly response
- List recommended activities with key details
- Suggest 1-2 follow-up questions they might have`;

/**
 * Format family context for the system prompt
 */
function formatFamilyContext(ctx?: EnhancedFamilyContext): string {
  if (!ctx?.children?.length) {
    return 'No children registered. Ask the user about their children first.';
  }

  return ctx.children.map(child => `
- ${child.name} (age ${child.age})
  Interests: ${child.interests?.join(', ') || 'Not specified'}
  Favorites: ${child.favorites?.slice(0, 3).map(f => f.activityName).join(', ') || 'None yet'}
  Preferred categories: ${child.computedPreferences?.preferredCategories?.join(', ') || 'Unknown'}
`).join('\n');
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
    this.model = getSmallModel();
  }

  /**
   * Process a chat message
   */
  async chat(
    userId: string,
    conversationId: string | null,
    message: string,
    familyContext?: EnhancedFamilyContext
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
      };
      this.conversations.set(conversationId, conversation);
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

    // Build messages array with system prompt
    const systemPrompt = AGENT_SYSTEM_PROMPT.replace(
      '{family_context}',
      formatFamilyContext(conversation.lastContext)
    );

    // Add human message
    conversation.messages.push(new HumanMessage(message));

    // Create the model with tools bound
    const modelWithTools = this.model.bindTools(activityTools);

    // Execute with tool calling loop
    let response: AIMessage;
    const toolsUsed: string[] = [];
    let iterations = 0;
    const maxIterations = 5;

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

    // Parse activities from response
    const activities = extractActivitiesFromResponse(responseText);
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
