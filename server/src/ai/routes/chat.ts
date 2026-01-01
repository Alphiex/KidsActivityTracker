/**
 * AI Chat Route
 *
 * Conversational AI endpoint for activity recommendations.
 */

import { Router, Request, Response } from 'express';
import { getChatService, EnhancedFamilyContext, EnhancedChildProfile, ConversationParameters } from '../agents/activityAssistantAgent';
import { checkTopicAllowed, getBlockedMessage, getBlockedSuggestedPrompts } from '../chains/topicGuardChain';
import { getSmallModel } from '../models/chatModels';
import { checkAIQuota, recordAIUsage, getUsageStats, getTurnLimit } from '../services/quotaService';
import { buildEnhancedFamilyContext } from '../utils/contextBuilder';
import { verifyToken } from '../../middleware/auth';

const router = Router();

/**
 * Create a virtual child profile from extracted age when user has no registered children
 */
function createVirtualChildFromExtraction(
  extractedAge?: number,
  extractedName?: string
): EnhancedChildProfile | null {
  if (!extractedAge) return null;

  return {
    child_id: 'virtual-child',
    name: extractedName || 'Your child',
    age: extractedAge,
    interests: [],
    favorites: [],
    calendarActivities: [],
    computedPreferences: {
      preferredCategories: [],
      preferredDays: [],
    },
  };
}

/**
 * POST /api/v1/ai/chat
 * Main conversational AI endpoint
 */
router.post('/', verifyToken, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { message, conversationId, childIds, childSelectionMode } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Message too long (max 500 characters)' });
    }

    // Check quota first
    const quota = await checkAIQuota(userId);
    if (!quota.allowed) {
      return res.status(429).json({
        error: 'AI quota exceeded',
        quota,
        upgradeRequired: !quota.isPro,
        message: quota.message,
      });
    }

    // Topic guard - block off-topic queries
    const model = getSmallModel();
    const topicCheck = await checkTopicAllowed(model, message);

    if (!topicCheck.allowed) {
      // Record the blocked query (don't count against quota)
      await recordAIUsage(userId, {
        model: 'gpt-4o-mini',
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.0001,
        latencyMs: Date.now() - startTime,
        success: true,
        metadata: { blocked: true, category: topicCheck.category },
      });

      return res.json({
        conversationId: null,
        text: getBlockedMessage(topicCheck.category),
        activities: [],
        followUpPrompts: getBlockedSuggestedPrompts(),
        blocked: true,
        reason: topicCheck.reason,
        quota: {
          daily: quota.daily,
          monthly: quota.monthly,
        },
      });
    }

    // Load family context
    let familyContext: EnhancedFamilyContext | undefined;
    try {
      familyContext = await buildEnhancedFamilyContext(
        userId,
        childIds,
        childSelectionMode || 'auto'
      );

      // If child name was extracted from query, filter to that child
      if (topicCheck.childName && !childIds?.length && familyContext?.children) {
        const matchedChild = familyContext.children.find(
          c => c.name.toLowerCase().includes(topicCheck.childName!.toLowerCase())
        );
        if (matchedChild) {
          familyContext = { ...familyContext, children: [matchedChild] };
        }
      }

      // If no children registered but age was mentioned, create a virtual child profile
      if (!familyContext?.children?.length && topicCheck.extractedAge) {
        const virtualChild = createVirtualChildFromExtraction(
          topicCheck.extractedAge,
          topicCheck.childName
        );
        if (virtualChild) {
          familyContext = {
            ...familyContext,
            children: [virtualChild],
          };
          console.log(`[Chat] Created virtual child from extracted age: ${topicCheck.extractedAge}`);
        }
      }
    } catch (error) {
      console.warn('[Chat] Could not load family context:', error);
      // Continue without family context - still try to create virtual child if age extracted
      if (topicCheck.extractedAge) {
        const virtualChild = createVirtualChildFromExtraction(
          topicCheck.extractedAge,
          topicCheck.childName
        );
        if (virtualChild) {
          familyContext = { children: [virtualChild] };
          console.log(`[Chat] Created virtual child from extracted age (fallback): ${topicCheck.extractedAge}`);
        }
      }
    }

    // Build initial parameters from extracted values in this message
    const extractedParams: ConversationParameters = {};
    if (topicCheck.extractedAge) {
      extractedParams.extractedAge = topicCheck.extractedAge;
    }
    if (topicCheck.extractedCity) {
      extractedParams.extractedCity = topicCheck.extractedCity;
    }
    if (topicCheck.extractedActivityType) {
      extractedParams.extractedActivityType = topicCheck.extractedActivityType;
    }

    // Log extraction for debugging
    if (topicCheck.extractedAge || topicCheck.extractedCity || topicCheck.extractedActivityType || topicCheck.isFollowUp) {
      console.log(`[Chat] Extracted from message:`, {
        age: topicCheck.extractedAge,
        city: topicCheck.extractedCity,
        activityType: topicCheck.extractedActivityType,
        isFollowUp: topicCheck.isFollowUp,
      });
    }

    // Execute chat with extracted parameters
    const chatService = getChatService();
    const response = await chatService.chat(
      userId,
      conversationId,
      message,
      familyContext,
      extractedParams
    );

    // Record usage
    const latencyMs = Date.now() - startTime;
    await recordAIUsage(userId, {
      model: 'gpt-4o-mini',
      tokensIn: message.length * 2, // Rough estimate
      tokensOut: response.text.length,
      cost: 0.0006, // Estimated cost per query
      latencyMs,
      success: true,
      metadata: {
        conversationId: response.conversationId,
        toolsUsed: response.toolsUsed,
        turnsRemaining: response.turnsRemaining,
      },
    });

    res.json({
      ...response,
      quota: {
        daily: { used: quota.daily.used + 1, limit: quota.daily.limit },
        monthly: { used: quota.monthly.used + 1, limit: quota.monthly.limit },
      },
      latencyMs,
    });
  } catch (error: any) {
    console.error('[AI Chat] Error:', error);

    // Record failed usage
    const userId = (req as any).user?.id;
    if (userId) {
      await recordAIUsage(userId, {
        latencyMs: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      });
    }

    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

/**
 * DELETE /api/v1/ai/chat/:conversationId
 * End a conversation
 */
router.delete('/:conversationId', (req: Request, res: Response) => {
  const { conversationId } = req.params;
  getChatService().clearConversation(conversationId);
  res.json({ success: true });
});

/**
 * GET /api/v1/ai/chat/quota
 * Get user's AI quota status
 */
router.get('/quota', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    // User should exist since verifyToken ran, but check anyway
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const quota = await checkAIQuota(userId);
    const stats = await getUsageStats(userId);
    const turnLimit = getTurnLimit(quota.isPro);

    res.json({
      quota,
      stats,
      turnLimit,
    });
  } catch (error: any) {
    console.error('[AI Chat] Error getting quota:', error);
    res.status(500).json({ error: 'Failed to get quota' });
  }
});

export default router;
