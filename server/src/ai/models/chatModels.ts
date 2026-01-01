import { ChatOpenAI } from '@langchain/openai';
import { costTrackerCallback } from '../callbacks/costTracker';
import { ModelTier } from '../types/ai.types';

/**
 * Create a ChatOpenAI model instance with cost tracking
 */
function createModel(
  modelName: string,
  maxTokens: number,
  temperature: number = 0.3,
  useJsonMode: boolean = true
): ChatOpenAI {
  const config: any = {
    modelName,
    temperature,
    maxTokens,
    callbacks: [costTrackerCallback],
  };

  // Enable JSON mode for structured outputs (not for tool-calling agents)
  if (useJsonMode) {
    config.modelKwargs = {
      response_format: { type: 'json_object' }
    };
  }

  return new ChatOpenAI(config);
}

// Lazy initialization to avoid errors if OPENAI_API_KEY is not set at import time
let _smallModel: ChatOpenAI | null = null;
let _largeModel: ChatOpenAI | null = null;
let _chatAgentModel: ChatOpenAI | null = null;

/**
 * Get the small model instance (gpt-4o-mini) with JSON mode
 * Used for: simple parsing, tagging, short explanations
 */
export function getSmallModel(): ChatOpenAI {
  if (!_smallModel) {
    _smallModel = createModel(
      process.env.OPENAI_MODEL_SMALL || 'gpt-4o-mini',
      1000,
      parseFloat(process.env.AI_TEMPERATURE || '0.3'),
      true // JSON mode
    );
  }
  return _smallModel;
}

/**
 * Get model for chat agent (without JSON mode, for tool calling)
 * Used for: conversational agents that use function calling
 */
export function getChatAgentModel(): ChatOpenAI {
  if (!_chatAgentModel) {
    _chatAgentModel = createModel(
      process.env.OPENAI_MODEL_SMALL || 'gpt-4o-mini',
      2000, // More tokens for chat responses
      parseFloat(process.env.AI_TEMPERATURE || '0.5'), // Slightly higher temp for natural conversation
      false // No JSON mode - conflicts with tool calling
    );
  }
  return _chatAgentModel;
}

/**
 * Get the large model instance (gpt-4o)
 * Used for: complex planning, multi-child optimization
 */
export function getLargeModel(): ChatOpenAI {
  if (!_largeModel) {
    _largeModel = createModel(
      process.env.OPENAI_MODEL_LARGE || 'gpt-4o',
      parseInt(process.env.AI_MAX_TOKENS || '2000'),
      parseFloat(process.env.AI_TEMPERATURE || '0.3')
    );
  }
  return _largeModel;
}

/**
 * Get model by tier
 */
export function getModelByTier(tier: ModelTier): ChatOpenAI {
  return tier === 'large' ? getLargeModel() : getSmallModel();
}

/**
 * Reset model instances (useful for testing or config changes)
 */
export function resetModels(): void {
  _smallModel = null;
  _largeModel = null;
  _chatAgentModel = null;
}
