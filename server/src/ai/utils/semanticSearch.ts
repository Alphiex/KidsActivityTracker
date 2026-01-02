/**
 * Semantic Search Service
 *
 * Provides embedding-based semantic search for activities.
 * Uses OpenAI embeddings with a hybrid approach combining
 * structured filters with semantic similarity.
 */

import OpenAI from 'openai';
import { PrismaClient, Activity, Location } from '../../../generated/prisma';
import { ScoringContext, ConversationOverrides, scoreForChat, scoreForRecommendations } from './activityScorer';

// Singleton OpenAI client
let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

// Singleton Prisma client
let _prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

// Types
export interface ActivityEmbedding {
  activityId: string;
  embedding: number[];
  textHash: string;
  createdAt: Date;
}

export interface SemanticSearchResult {
  activity: Activity & { location?: Location | null };
  semanticScore: number;
  structuredScore: number;
  combinedScore: number;
  distance?: number;
}

export interface HybridSearchOptions {
  query: string;
  context: ScoringContext;
  mode: 'recommendations' | 'chat';
  overrides?: ConversationOverrides;
  limit?: number;
  semanticWeight?: number; // 0-1, default 0.3
  structuredWeight?: number; // 0-1, default 0.7
}

// Embedding model config
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// In-memory embedding cache (for development/small deployments)
// In production, this would be stored in pgvector or a vector database
const embeddingCache = new Map<string, number[]>();

/**
 * Generate embedding for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Check cache first
  const cacheKey = hashText(text);
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const openai = getOpenAI();

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const embedding = response.data[0].embedding;

    // Cache the result
    embeddingCache.set(cacheKey, embedding);

    return embedding;
  } catch (error) {
    console.error('[SemanticSearch] Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate embedding for an activity's searchable content
 */
export function getActivitySearchText(activity: Activity): string {
  const parts: string[] = [];

  if (activity.name) parts.push(activity.name);
  if (activity.category) parts.push(activity.category);
  if (activity.subcategory) parts.push(activity.subcategory);
  if (activity.description) {
    // Truncate description to avoid token limits
    const desc = activity.description.slice(0, 500);
    parts.push(desc);
  }

  return parts.join(' ').toLowerCase();
}

/**
 * Simple hash function for cache keys
 */
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Perform hybrid search combining semantic and structured scoring
 */
export async function hybridSearch(
  options: HybridSearchOptions
): Promise<SemanticSearchResult[]> {
  const {
    query,
    context,
    mode,
    overrides = { explicitRequirements: [] },
    limit = 15,
    semanticWeight = 0.3,
    structuredWeight = 0.7,
  } = options;

  const prisma = getPrisma();

  // Step 1: Apply hard filters to get candidate pool
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxDistance = overrides.locationOverride?.maxDistanceKm ||
    context.preferences.distanceRadiusKm || 50;

  // Build where clause for hard filters
  const where: any = {
    isActive: true,
    registrationStatus: {
      in: ['Open', 'Waitlist', 'Available', 'Register', 'Enroll'],
    },
    OR: [
      { dateEnd: null },
      { dateEnd: { gte: today } },
    ],
  };

  // Age filter
  const targetAge = overrides.ageOverride || context.children[0]?.age;
  if (targetAge) {
    where.AND = [
      {
        OR: [
          { ageMin: null },
          { ageMin: { lte: targetAge } },
        ],
      },
      {
        OR: [
          { ageMax: null },
          { ageMax: { gte: targetAge } },
        ],
      },
    ];
  }

  // Location filter (by city if no coordinates)
  const targetCity = overrides.locationOverride?.city || context.userLocation.city;
  if (targetCity && !context.userLocation.latitude) {
    where.location = {
      city: { contains: targetCity, mode: 'insensitive' },
    };
  }

  // Fetch candidates (more than we need for re-ranking)
  const candidateLimit = Math.min(limit * 10, 500);

  const candidates = await prisma.activity.findMany({
    where,
    include: {
      location: true,
      provider: { select: { id: true, name: true } },
    },
    take: candidateLimit,
    orderBy: [
      { registrationStatus: 'asc' },
      { name: 'asc' },
    ],
  });

  if (candidates.length === 0) {
    return [];
  }

  // Step 2: Generate query embedding
  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await generateEmbedding(query.toLowerCase());
  } catch (error) {
    console.warn('[SemanticSearch] Failed to generate query embedding, falling back to structured only');
  }

  // Step 3: Score each candidate
  const results: SemanticSearchResult[] = [];

  for (const activity of candidates) {
    // Calculate structured score
    let structuredResult;
    if (mode === 'chat') {
      structuredResult = scoreForChat(activity, context, overrides);
    } else {
      structuredResult = scoreForRecommendations(activity, context);
    }

    // Skip if hard filters rejected
    if (!structuredResult) continue;

    // Calculate semantic score (if embedding available)
    let semanticScore = 0;
    if (queryEmbedding) {
      try {
        const activityText = getActivitySearchText(activity);
        const activityEmbedding = await generateEmbedding(activityText);
        semanticScore = cosineSimilarity(queryEmbedding, activityEmbedding);

        // Normalize to 0-100 scale (cosine similarity is -1 to 1, usually 0 to 1 for similar texts)
        semanticScore = Math.max(0, semanticScore) * 100;
      } catch (error) {
        // Skip semantic scoring for this activity
        semanticScore = 0;
      }
    }

    // Normalize structured score to 0-100 scale
    const maxStructuredScore = 100; // Approximate max possible score
    const normalizedStructuredScore = Math.min(100, Math.max(0, structuredResult.score));

    // Combine scores
    const combinedScore =
      (semanticScore * semanticWeight) +
      (normalizedStructuredScore * structuredWeight);

    results.push({
      activity,
      semanticScore,
      structuredScore: normalizedStructuredScore,
      combinedScore,
      distance: structuredResult.distance,
    });
  }

  // Step 4: Sort by combined score and return top results
  results.sort((a, b) => b.combinedScore - a.combinedScore);

  return results.slice(0, limit);
}

/**
 * Search activities using semantic similarity only (for simple queries)
 */
export async function semanticOnlySearch(
  query: string,
  activities: Array<Activity & { location?: Location | null }>,
  topK: number = 10
): Promise<Array<{ activity: Activity & { location?: Location | null }; similarity: number }>> {
  try {
    const queryEmbedding = await generateEmbedding(query.toLowerCase());

    const scored: Array<{ activity: Activity & { location?: Location | null }; similarity: number }> = [];

    for (const activity of activities) {
      const activityText = getActivitySearchText(activity);
      const activityEmbedding = await generateEmbedding(activityText);
      const similarity = cosineSimilarity(queryEmbedding, activityEmbedding);

      scored.push({ activity, similarity });
    }

    scored.sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, topK);
  } catch (error) {
    console.error('[SemanticSearch] Semantic only search error:', error);
    return [];
  }
}

/**
 * Pre-compute embeddings for activities (batch processing)
 * Call this in a background job to pre-populate embeddings
 */
export async function precomputeEmbeddings(
  activityIds?: string[],
  batchSize: number = 100
): Promise<{ processed: number; failed: number }> {
  const prisma = getPrisma();

  let processed = 0;
  let failed = 0;

  // Get activities to process
  const where: any = {
    isActive: true,
  };

  if (activityIds?.length) {
    where.id = { in: activityIds };
  }

  const activities = await prisma.activity.findMany({
    where,
    select: {
      id: true,
      name: true,
      category: true,
      subcategory: true,
      description: true,
    },
    take: batchSize,
  });

  for (const activity of activities) {
    try {
      const text = getActivitySearchText(activity as Activity);
      await generateEmbedding(text);
      processed++;
    } catch (error) {
      console.error(`[SemanticSearch] Failed to embed activity ${activity.id}:`, error);
      failed++;
    }

    // Rate limiting - avoid hitting API limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[SemanticSearch] Pre-computed embeddings: ${processed} processed, ${failed} failed`);

  return { processed, failed };
}

/**
 * Clear embedding cache (for testing/memory management)
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

/**
 * Get cache stats
 */
export function getEmbeddingCacheStats(): { size: number } {
  return { size: embeddingCache.size };
}

/**
 * Expand query with synonyms for better semantic matching
 */
export function expandQueryWithSynonyms(query: string): string {
  const synonyms: Record<string, string[]> = {
    swimming: ['swim', 'aquatics', 'pool', 'water'],
    skating: ['skate', 'ice skating', 'figure skating'],
    soccer: ['football', 'futsal'],
    art: ['arts', 'crafts', 'painting', 'drawing', 'creative'],
    music: ['musical', 'instrument', 'piano', 'guitar', 'violin'],
    dance: ['dancing', 'ballet', 'hip hop', 'jazz'],
    coding: ['programming', 'computer science', 'robotics', 'tech'],
    martial: ['karate', 'taekwondo', 'judo', 'martial arts'],
  };

  let expandedQuery = query.toLowerCase();

  for (const [key, values] of Object.entries(synonyms)) {
    if (expandedQuery.includes(key)) {
      // Add synonyms to the query
      expandedQuery = `${expandedQuery} ${values.join(' ')}`;
    }
  }

  return expandedQuery;
}

export default {
  generateEmbedding,
  cosineSimilarity,
  hybridSearch,
  semanticOnlySearch,
  precomputeEmbeddings,
  clearEmbeddingCache,
  getEmbeddingCacheStats,
  expandQueryWithSynonyms,
  getActivitySearchText,
};
