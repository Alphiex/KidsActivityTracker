import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { Serialized } from '@langchain/core/load/serializable';
import { LLMResult } from '@langchain/core/outputs';
import { prisma } from '../../lib/prisma';
import { AIRequestMetrics } from '../types/ai.types';

/**
 * Pricing per 1M tokens (as of 2024)
 * Update these when OpenAI changes pricing
 */
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 }
};

/**
 * In-memory storage for daily budget tracking
 * In production, this should be Redis-based
 */
interface DailyBudget {
  date: string;
  spent_usd: number;
  request_count: number;
}

let dailyBudget: DailyBudget = {
  date: new Date().toISOString().split('T')[0],
  spent_usd: 0,
  request_count: 0
};

/**
 * Context for the current AI request
 */
interface RequestContext {
  user_id?: string;
  endpoint?: string;
}

/**
 * LangChain callback handler for cost tracking
 */
export class CostTrackerCallback extends BaseCallbackHandler {
  name = 'cost_tracker';

  private requestMetrics: Map<string, Partial<AIRequestMetrics> & RequestContext> = new Map();
  private metricsLog: AIRequestMetrics[] = [];
  private currentContext: RequestContext = {};

  /**
   * Set context for the next AI request (user_id, endpoint)
   * Call this before invoking the AI to track who is making the request
   */
  setContext(context: RequestContext): void {
    this.currentContext = { ...context };
  }

  /**
   * Clear the current context
   */
  clearContext(): void {
    this.currentContext = {};
  }

  /**
   * Called when LLM starts processing
   */
  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string
  ): Promise<void> {
    // Extract model name from serialized LLM
    const modelName = (llm as any)?.kwargs?.model || 
                      (llm as any)?.kwargs?.modelName || 
                      'unknown';
    
    this.requestMetrics.set(runId, {
      request_id: runId,
      model_used: modelName,
      timestamp: new Date(),
      ...this.currentContext
    });

    // Clear context after capturing
    this.currentContext = {};
    
    console.log(`[AI Cost] Starting request ${runId.substring(0, 8)}... with ${modelName}`);
  }
  
  /**
   * Called when LLM finishes processing
   */
  async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    const metrics = this.requestMetrics.get(runId);
    if (!metrics) return;
    
    // Extract token usage from response
    const usage = output.llmOutput?.tokenUsage || output.llmOutput?.usage;
    const model = metrics.model_used || 'gpt-4o-mini';
    const pricing = PRICING[model] || PRICING['gpt-4o-mini'];
    
    const tokensIn = usage?.promptTokens || usage?.prompt_tokens || 0;
    const tokensOut = usage?.completionTokens || usage?.completion_tokens || 0;
    
    // Calculate cost
    const costUsd = (
      (tokensIn * pricing.input / 1_000_000) +
      (tokensOut * pricing.output / 1_000_000)
    );
    
    // Update metrics
    metrics.tokens_in = tokensIn;
    metrics.tokens_out = tokensOut;
    metrics.cost_usd = costUsd;
    metrics.cache_hit = false;
    
    // Log the cost
    console.log(`[AI Cost] Request ${runId.substring(0, 8)}... completed:`, {
      model,
      tokens: `${tokensIn} in / ${tokensOut} out`,
      cost: `$${costUsd.toFixed(4)}`
    });
    
    // Update daily budget
    this.updateDailyBudget(costUsd);

    // Persist to database (fire-and-forget to not block the callback)
    prisma.aIUsageLog.create({
      data: {
        requestId: runId,
        userId: metrics.user_id || null,
        model: model,
        tokensIn: tokensIn,
        tokensOut: tokensOut,
        costUsd: costUsd,
        cacheHit: false,
        endpoint: metrics.endpoint || 'recommendations',
        latencyMs: metrics.latency_ms || null,
        success: true,
        errorMessage: null,
        metadata: {}
      }
    }).catch(err => {
      console.error('[AI Cost] Failed to persist usage log:', err.message);
    });

    // Store metrics
    const fullMetrics = metrics as AIRequestMetrics;
    this.metricsLog.push(fullMetrics);
    
    // Keep only last 1000 entries in memory
    if (this.metricsLog.length > 1000) {
      this.metricsLog = this.metricsLog.slice(-1000);
    }
    
    // Clean up
    this.requestMetrics.delete(runId);
  }
  
  /**
   * Called when LLM encounters an error
   */
  async handleLLMError(err: Error, runId: string): Promise<void> {
    console.error(`[AI Cost] Error in request ${runId.substring(0, 8)}...:`, err.message);

    const metrics = this.requestMetrics.get(runId);

    // Persist error to database
    prisma.aIUsageLog.create({
      data: {
        requestId: runId,
        userId: metrics?.user_id || null,
        model: metrics?.model_used || 'unknown',
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        cacheHit: false,
        endpoint: metrics?.endpoint || 'unknown',
        latencyMs: null,
        success: false,
        errorMessage: err.message.substring(0, 500),
        metadata: {}
      }
    }).catch(persistErr => {
      console.error('[AI Cost] Failed to persist error log:', persistErr.message);
    });

    this.requestMetrics.delete(runId);
  }
  
  /**
   * Update daily budget tracking
   */
  private updateDailyBudget(costUsd: number): void {
    const today = new Date().toISOString().split('T')[0];
    
    // Reset if new day
    if (dailyBudget.date !== today) {
      dailyBudget = {
        date: today,
        spent_usd: 0,
        request_count: 0
      };
    }
    
    dailyBudget.spent_usd += costUsd;
    dailyBudget.request_count += 1;
  }
  
  /**
   * Check if daily budget is exceeded
   */
  static checkDailyBudget(): { 
    remaining_usd: number; 
    exceeded: boolean; 
    daily_limit_usd: number;
    spent_today_usd: number;
  } {
    const today = new Date().toISOString().split('T')[0];
    const limit = parseFloat(process.env.AI_DAILY_BUDGET_USD || '10.00');
    
    // Reset if checking on a new day
    if (dailyBudget.date !== today) {
      dailyBudget = {
        date: today,
        spent_usd: 0,
        request_count: 0
      };
    }
    
    const remaining = Math.max(0, limit - dailyBudget.spent_usd);
    
    return {
      remaining_usd: remaining,
      exceeded: remaining <= 0,
      daily_limit_usd: limit,
      spent_today_usd: dailyBudget.spent_usd
    };
  }
  
  /**
   * Get aggregated cost metrics
   */
  static getMetrics(): {
    today: { requests: number; cost_usd: number };
    recent: AIRequestMetrics[];
  } {
    const instance = costTrackerCallback;
    
    return {
      today: {
        requests: dailyBudget.request_count,
        cost_usd: dailyBudget.spent_usd
      },
      recent: instance.metricsLog.slice(-10)
    };
  }
}

// Singleton instance
export const costTrackerCallback = new CostTrackerCallback();
