/**
 * Explain Node
 * 
 * Generates personalized explanations of why an activity is good for specific children.
 * Explains benefits, age appropriateness, and skill development.
 */

import { AIGraphStateType, ActivityExplanation } from '../state';
import { getSmallModel } from '../../models/chatModels';
import { PrismaClient } from '../../../../generated/prisma';
import { z } from 'zod';

// Singleton prisma instance
let _prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

/**
 * Schema for explanation response
 */
const ExplanationSchema = z.object({
  summary: z.string().describe('Brief summary of why this activity is good'),
  benefits: z.array(z.object({
    category: z.enum(['Physical', 'Social', 'Cognitive', 'Creative', 'Emotional']),
    description: z.string(),
  })).describe('Specific benefits by category'),
  age_appropriateness: z.string().describe('Why this is good for the child\'s age'),
  match_score: z.number().min(0).max(100).describe('How well this matches the child'),
});

/**
 * System prompt for explanations
 */
const EXPLAIN_SYSTEM_PROMPT = `You are an enthusiastic child development expert who helps parents discover great activities for their kids.
Generate a personalized, positive explanation of why an activity would benefit a specific child.

SCORING GUIDELINES:
- 95-100: Perfect match - age is within range, activity aligns with interests
- 85-94: Great match - age is within range OR very close (within 1 year), solid benefits
- 75-84: Good match - age is within 2 years of range, meaningful benefits
- 65-74: Acceptable match - age is within 3 years, some benefits apply
- Below 65: Only if age is 4+ years outside range or activity is clearly inappropriate

BE GENEROUS with scores when:
- The child's age is within the activity's target range
- The activity offers clear developmental benefits
- The activity type generally suits children of this age

Focus on the POSITIVE aspects and real benefits. Parents are looking for reasons to try activities.

Return JSON only with this structure:
{
  "summary": "Enthusiastic 1-2 sentence summary highlighting the best aspects",
  "benefits": [
    { "category": "Physical", "description": "Specific benefit" }
  ],
  "age_appropriateness": "Why this suits the child's age",
  "match_score": 85
}`;

/**
 * Build context for explanation
 */
function buildExplainContext(activity: any, child: any): string {
  return `
Activity: ${activity.name}
Description: ${activity.description || 'No description'}
Category: ${activity.activityType?.name || 'General'}
Age Range: ${activity.ageMin || 0} - ${activity.ageMax || 18}
Schedule: ${activity.schedule || 'Not specified'}

Child: ${child.name || 'Child'}
Age: ${child.age || 'Not specified'}
Interests: ${child.interests?.join(', ') || 'Not specified'}

Generate an explanation of why this activity is good for this child.`;
}

/**
 * Explain node - generates activity explanations
 */
export async function explainNode(state: AIGraphStateType): Promise<Partial<AIGraphStateType>> {
  console.log('💡 [ExplainNode] Generating explanations...');
  
  const activityId = state.activity_id;
  
  if (!activityId) {
    console.log('💡 [ExplainNode] No activity_id provided');
    return {
      errors: ['No activity_id provided for explanation'],
    };
  }
  
  const prisma = getPrisma();
  
  try {
    // Fetch activity
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        activityType: true,
        location: true,
      },
    });
    
    if (!activity) {
      return {
        errors: [`Activity ${activityId} not found`],
      };
    }
    
    // Get children to explain for
    let children = state.family_context?.children || [];
    
    // Filter to selected children if specified
    if (state.selected_child_ids?.length) {
      children = children.filter(c => state.selected_child_ids!.includes(c.child_id));
    }
    
    // If no children, create a default with age matching the activity's target range
    if (children.length === 0) {
      // Use the middle of the activity's age range for the default child
      const activityAgeMin = activity.ageMin ?? 5;
      const activityAgeMax = activity.ageMax ?? 12;
      const defaultAge = Math.round((activityAgeMin + activityAgeMax) / 2);
      
      children = [{ 
        child_id: 'default', 
        name: 'Your child', 
        age: defaultAge, 
        age_range: { min: activityAgeMin, max: activityAgeMax },
        interests: [] 
      }];
      
      console.log(`💡 [ExplainNode] No children provided, using default age ${defaultAge} (activity range: ${activityAgeMin}-${activityAgeMax})`);
    }
    
    const model = getSmallModel();
    const explanations: Record<string, ActivityExplanation> = {};
    let totalTokens = 0;
    
    // Generate explanation for each child
    for (const child of children) {
      console.log(`💡 [ExplainNode] Generating explanation for ${child.name || child.child_id}...`);
      
      const context = buildExplainContext(activity, child);
      
      const result = await model.invoke([
        { role: 'system', content: EXPLAIN_SYSTEM_PROMPT },
        { role: 'user', content: context }
      ]);
      
      const content = typeof result.content === 'string' 
        ? result.content 
        : JSON.stringify(result.content);
      
      const parsed = ExplanationSchema.parse(JSON.parse(content));
      
      explanations[child.child_id] = parsed;
      totalTokens += (result as any).usage_metadata?.total_tokens || 0;
    }
    
    console.log(`💡 [ExplainNode] Generated ${Object.keys(explanations).length} explanations`);
    
    return {
      explanations,
      source: 'llm',
      tokens_used: totalTokens,
      model_used: 'gpt-4o-mini',
    };
    
  } catch (error) {
    console.error('💡 [ExplainNode] Error:', error);
    
    return {
      errors: [`Explanation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}
