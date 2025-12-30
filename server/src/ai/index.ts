/**
 * AI Module - Main entry point
 * 
 * This module provides AI-powered features for the Kids Activity Tracker:
 * - Personalized activity recommendations
 * - Natural language search parsing (future)
 * - Weekly schedule planning (future)
 * - Activity explanations (future)
 */

import Redis from 'ioredis';
import { PrismaClient } from '../../generated/prisma';
import { AIOrchestrator } from './orchestrator/aiOrchestrator';

// Singleton orchestrator instance
let orchestrator: AIOrchestrator | null = null;

/**
 * Initialize the AI module with required dependencies
 * Redis is optional - caching will be disabled if not available
 */
export function initializeAI(redis: Redis | null, prisma: PrismaClient): AIOrchestrator {
  if (!orchestrator) {
    orchestrator = new AIOrchestrator(redis, prisma);
    console.log('[AI] Module initialized', redis ? 'with caching' : 'without caching');
  }
  return orchestrator;
}

/**
 * Get the AI orchestrator instance
 * Throws if not initialized
 */
export function getAIOrchestrator(): AIOrchestrator {
  if (!orchestrator) {
    throw new Error('[AI] Module not initialized. Call initializeAI first.');
  }
  return orchestrator;
}

/**
 * Check if AI module is initialized
 */
export function isAIInitialized(): boolean {
  return orchestrator !== null;
}

// Re-export types
export * from './types/ai.types';
export * from './schemas/recommendation.schema';
