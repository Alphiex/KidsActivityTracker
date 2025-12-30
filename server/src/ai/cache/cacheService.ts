import Redis from 'ioredis';
import crypto from 'crypto';
import { AIResponseWithMeta, AIRecommendationRequest } from '../types/ai.types';

/**
 * Cache service for AI responses
 * Implements multi-layer caching for query results and explanations
 * Gracefully handles missing or unavailable Redis
 */
export class AICacheService {
  private redis: Redis | null;
  private queryTTL: number;
  private explainTTL: number;
  private redisAvailable: boolean = true;

  constructor(redis: Redis | null) {
    this.redis = redis;
    this.queryTTL = parseInt(process.env.AI_CACHE_TTL_QUERY || '3600'); // 1 hour
    this.explainTTL = parseInt(process.env.AI_CACHE_TTL_EXPLAIN || '86400'); // 24 hours
  }

  /**
   * Check if Redis is available for caching
   */
  private isRedisAvailable(): boolean {
    return this.redis !== null && this.redisAvailable;
  }

  /**
   * Generate a cache key from request parameters
   */
  generateCacheKey(request: AIRecommendationRequest): string {
    const keyData = {
      intent: request.search_intent?.toLowerCase().trim() || '',
      filters: this.normalizeFilters(request.filters),
      user_id: request.user_id || 'anonymous'
    };
    
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16);
    
    return `ai:rec:${hash}`;
  }

  /**
   * Normalize filters for consistent cache keys
   */
  private normalizeFilters(filters: any): any {
    if (!filters) return {};
    
    // Sort arrays and remove undefined values
    const normalized: any = {};
    const sortedKeys = Object.keys(filters).sort();
    
    for (const key of sortedKeys) {
      const value = filters[key];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          normalized[key] = [...value].sort();
        } else {
          normalized[key] = value;
        }
      }
    }
    
    return normalized;
  }

  /**
   * Get cached recommendations
   */
  async getCachedRecommendations(key: string): Promise<AIResponseWithMeta | null> {
    if (!this.isRedisAvailable()) {
      console.log('[AI Cache] Redis unavailable, skipping cache lookup');
      return null;
    }

    try {
      const cached = await this.redis!.get(key);
      if (cached) {
        console.log('[AI Cache] HIT:', key);
        return JSON.parse(cached);
      }
      console.log('[AI Cache] MISS:', key);
      return null;
    } catch (error: any) {
      console.warn('[AI Cache] Error reading cache, disabling Redis:', error.message);
      this.redisAvailable = false; // Disable Redis after first failure
      return null;
    }
  }

  /**
   * Cache recommendations
   */
  async setCachedRecommendations(key: string, response: AIResponseWithMeta): Promise<void> {
    if (!this.isRedisAvailable()) {
      return;
    }

    try {
      await this.redis!.setex(key, this.queryTTL, JSON.stringify(response));
      console.log('[AI Cache] SET:', key, `TTL: ${this.queryTTL}s`);
    } catch (error: any) {
      console.warn('[AI Cache] Error writing cache, disabling Redis:', error.message);
      this.redisAvailable = false;
    }
  }

  /**
   * Generate explanation cache key
   */
  generateExplainKey(activityId: string, ageBucket: string): string {
    return `ai:explain:${activityId}:${ageBucket}`;
  }

  /**
   * Get cached explanation
   */
  async getCachedExplanation(activityId: string, ageBucket: string): Promise<string[] | null> {
    if (!this.isRedisAvailable()) {
      return null;
    }

    try {
      const key = this.generateExplainKey(activityId, ageBucket);
      const cached = await this.redis!.get(key);
      if (cached) {
        console.log('[AI Cache] Explanation HIT:', key);
        return JSON.parse(cached);
      }
      return null;
    } catch (error: any) {
      console.warn('[AI Cache] Error reading explanation cache:', error.message);
      this.redisAvailable = false;
      return null;
    }
  }

  /**
   * Cache explanation
   */
  async setCachedExplanation(activityId: string, ageBucket: string, why: string[]): Promise<void> {
    if (!this.isRedisAvailable()) {
      return;
    }

    try {
      const key = this.generateExplainKey(activityId, ageBucket);
      await this.redis!.setex(key, this.explainTTL, JSON.stringify(why));
      console.log('[AI Cache] Explanation SET:', key);
    } catch (error: any) {
      console.warn('[AI Cache] Error writing explanation cache:', error.message);
      this.redisAvailable = false;
    }
  }

  /**
   * Invalidate cache for a specific pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.isRedisAvailable()) {
      return 0;
    }

    try {
      const keys = await this.redis!.keys(pattern);
      if (keys.length > 0) {
        await this.redis!.del(...keys);
        console.log('[AI Cache] Invalidated', keys.length, 'keys matching:', pattern);
      }
      return keys.length;
    } catch (error: any) {
      console.warn('[AI Cache] Error invalidating cache:', error.message);
      this.redisAvailable = false;
      return 0;
    }
  }

  /**
   * Get cache stats
   */
  async getStats(): Promise<{ keys: number; memoryUsed: string }> {
    if (!this.isRedisAvailable()) {
      return { keys: 0, memoryUsed: 'unavailable' };
    }

    try {
      const keys = await this.redis!.keys('ai:*');
      const info = await this.redis!.info('memory');
      const memoryMatch = info.match(/used_memory_human:(\S+)/);

      return {
        keys: keys.length,
        memoryUsed: memoryMatch ? memoryMatch[1] : 'unknown'
      };
    } catch (error: any) {
      console.warn('[AI Cache] Error getting stats:', error.message);
      this.redisAvailable = false;
      return { keys: 0, memoryUsed: 'unavailable' };
    }
  }
}
