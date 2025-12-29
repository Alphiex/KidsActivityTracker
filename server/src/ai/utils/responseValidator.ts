import { AIResponse, AIRecommendation, SponsorPolicy } from '../schemas/recommendation.schema';
import { SPONSOR_POLICY } from '../prompts/system';
import { CompressedActivity } from '../types/ai.types';

/**
 * Validate and enforce sponsor policy on AI response
 * This is a safety net - the LLM should follow these rules, but we enforce them here too
 */
export function enforceSponsorship(
  response: AIResponse,
  candidates: CompressedActivity[]
): AIResponse {
  const recommendations = [...response.recommendations];
  
  // Create a map of activity IDs to check validity
  const validIds = new Set(candidates.map(c => c.id));
  const sponsoredMap = new Map(candidates.map(c => [c.id, c.sponsored]));
  
  // Filter out invalid activity IDs
  const validRecs = recommendations.filter(rec => validIds.has(rec.activity_id));
  
  // Ensure is_sponsored flag matches our data
  validRecs.forEach(rec => {
    const isActuallySponsored = sponsoredMap.get(rec.activity_id) || false;
    if (isActuallySponsored && !rec.is_sponsored) {
      // Force sponsored flag if activity is actually sponsored
      rec.is_sponsored = true;
    }
  });
  
  // Sort by rank
  validRecs.sort((a, b) => a.rank - b.rank);
  
  // Enforce max 1 sponsored in top 3
  const enforcedRecs = enforceTop3Limit(validRecs, SPONSOR_POLICY.max_sponsored_in_top_3);
  
  // Enforce max 30% sponsored overall
  const finalRecs = enforceOverallLimit(enforcedRecs, SPONSOR_POLICY.max_sponsored_in_page);
  
  // Re-rank after enforcement
  finalRecs.forEach((rec, idx) => {
    rec.rank = idx + 1;
  });
  
  return {
    ...response,
    recommendations: finalRecs
  };
}

/**
 * Enforce maximum sponsored items in top N positions
 */
function enforceTop3Limit(
  recs: AIRecommendation[],
  maxInTop: number
): AIRecommendation[] {
  if (recs.length <= 3) return recs;
  
  const top3 = recs.slice(0, 3);
  const rest = recs.slice(3);
  
  let sponsoredCount = top3.filter(r => r.is_sponsored).length;
  
  if (sponsoredCount <= maxInTop) return recs;
  
  // Need to move some sponsored out of top 3
  const newTop3: AIRecommendation[] = [];
  const movedSponsored: AIRecommendation[] = [];
  let keptSponsored = 0;
  
  for (const rec of top3) {
    if (rec.is_sponsored && keptSponsored >= maxInTop) {
      movedSponsored.push(rec);
    } else {
      if (rec.is_sponsored) keptSponsored++;
      newTop3.push(rec);
    }
  }
  
  // Find non-sponsored from rest to fill top 3
  const nonSponsoredRest = rest.filter(r => !r.is_sponsored);
  const sponsoredRest = rest.filter(r => r.is_sponsored);
  
  while (newTop3.length < 3 && nonSponsoredRest.length > 0) {
    newTop3.push(nonSponsoredRest.shift()!);
  }
  
  // Rebuild the list
  return [
    ...newTop3,
    ...movedSponsored,
    ...sponsoredRest,
    ...nonSponsoredRest
  ];
}

/**
 * Enforce maximum percentage of sponsored items overall
 */
function enforceOverallLimit(
  recs: AIRecommendation[],
  maxRatio: number
): AIRecommendation[] {
  const maxSponsored = Math.floor(recs.length * maxRatio);
  
  let sponsoredCount = 0;
  const result: AIRecommendation[] = [];
  const droppedSponsored: AIRecommendation[] = [];
  
  for (const rec of recs) {
    if (rec.is_sponsored) {
      if (sponsoredCount < maxSponsored) {
        result.push(rec);
        sponsoredCount++;
      } else {
        droppedSponsored.push(rec);
      }
    } else {
      result.push(rec);
    }
  }
  
  // Log if we had to drop any
  if (droppedSponsored.length > 0) {
    console.log(`[Sponsor Policy] Dropped ${droppedSponsored.length} sponsored items to enforce ${maxRatio * 100}% limit`);
  }
  
  return result;
}

/**
 * Validate that all recommended activity IDs exist in candidates
 */
export function validateActivityIds(
  response: AIResponse,
  candidates: CompressedActivity[]
): { valid: boolean; invalidIds: string[] } {
  const validIds = new Set(candidates.map(c => c.id));
  const invalidIds = response.recommendations
    .filter(rec => !validIds.has(rec.activity_id))
    .map(rec => rec.activity_id);
  
  return {
    valid: invalidIds.length === 0,
    invalidIds
  };
}

/**
 * Check for PII patterns in explanations
 */
export function checkForPII(response: AIResponse): string[] {
  const piiPatterns = [
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone numbers
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b\d{3}[-]?\d{2}[-]?\d{4}\b/, // SSN pattern
  ];
  
  const warnings: string[] = [];
  
  for (const rec of response.recommendations) {
    for (const reason of rec.why || []) {
      for (const pattern of piiPatterns) {
        if (pattern.test(reason)) {
          warnings.push(`Potential PII detected in recommendation ${rec.activity_id}`);
          break;
        }
      }
    }
  }
  
  return warnings;
}

/**
 * Apply all validations and return sanitized response
 */
export function validateAndSanitize(
  response: AIResponse,
  candidates: CompressedActivity[]
): AIResponse {
  // Check for PII
  const piiWarnings = checkForPII(response);
  if (piiWarnings.length > 0) {
    console.warn('[Response Validator] PII warnings:', piiWarnings);
  }
  
  // Validate activity IDs
  const idValidation = validateActivityIds(response, candidates);
  if (!idValidation.valid) {
    console.warn('[Response Validator] Invalid activity IDs:', idValidation.invalidIds);
  }
  
  // Enforce sponsorship rules
  return enforceSponsorship(response, candidates);
}
