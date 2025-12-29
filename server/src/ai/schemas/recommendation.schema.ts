import { z } from 'zod';

/**
 * Schema for a single AI recommendation
 */
export const AIRecommendationSchema = z.object({
  activity_id: z.string().describe('The ID of the recommended activity'),
  rank: z.number().int().min(1).describe('Ranking position (1 = best)'),
  is_sponsored: z.boolean().describe('Whether this is a sponsored/featured activity'),
  why: z.array(z.string()).max(3).describe('1-3 reasons why this activity matches'),
  fit_score: z.number().min(0).max(100).describe('How well this fits the request (0-100)'),
  warnings: z.array(z.string()).optional().default([]).describe('Any concerns or caveats')
});

/**
 * Schema for the full AI response
 */
export const AIResponseSchema = z.object({
  recommendations: z.array(AIRecommendationSchema).max(20).describe('Ranked list of recommendations'),
  assumptions: z.array(z.string()).optional().default([]).describe('Assumptions made due to missing info'),
  questions: z.array(z.string()).optional().default([]).describe('Clarifying questions if needed')
});

/**
 * Schema for sponsor policy configuration
 */
export const SponsorPolicySchema = z.object({
  label_required: z.boolean().default(true),
  max_sponsored_in_top_3: z.number().int().default(1),
  max_sponsored_in_page: z.number().min(0).max(1).default(0.3),
  must_meet_min_relevance_score: z.number().min(0).max(100).default(65),
  never_override_hard_filters: z.boolean().default(true)
});

// Export types derived from schemas
export type AIRecommendation = z.infer<typeof AIRecommendationSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>;
export type SponsorPolicy = z.infer<typeof SponsorPolicySchema>;
