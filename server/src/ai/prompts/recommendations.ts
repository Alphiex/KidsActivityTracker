/**
 * Prompt template for activity recommendations
 */
export const RECOMMENDATION_PROMPT = `## Task
Rank and recommend activities for this family based on their search intent.

## Search Intent
{search_intent}

## Family Context
{family_context}

## Available Activities (Pre-filtered)
These activities have already passed hard filters (age, location, price ceiling).
Your job is to rank them by relevance and explain why.

{activities}

## Sponsor Policy
{sponsor_policy}

## Ranking Guidelines
1. Rank by relevance to search intent + child interests + schedule fit
2. Sponsored items must be labeled. Max 1 sponsored in top 3, max 30% overall
3. Diversity: avoid repeating same provider/category in top results unless intent demands it
4. Return 10-15 results maximum
5. Include 1-3 "why" bullet points explaining how this activity benefits the child's development, interests, or wellbeing

## Response Format
Return ONLY valid JSON with this structure:
{{
  "recommendations": [
    {{
      "activity_id": "uuid-here",
      "rank": 1,
      "is_sponsored": false,
      "why": ["Builds confidence and teamwork skills", "Great for developing coordination at this age", "Fun way to stay active and make friends"],
      "fit_score": 92,
      "warnings": []
    }}
  ],
  "assumptions": ["Assumed weekday availability is flexible"],
  "questions": []
}}

{format_instructions}`;

/**
 * Get the recommendation prompt with format instructions
 */
export function getRecommendationPrompt(): string {
  return RECOMMENDATION_PROMPT;
}
