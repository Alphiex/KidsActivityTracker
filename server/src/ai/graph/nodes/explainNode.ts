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
const EXPLAIN_SYSTEM_PROMPT = `You are a child development expert explaining activity benefits.
Generate a personalized explanation of why an activity is suitable for a specific child.

Consider:
- The child's age and developmental stage
- Physical, social, cognitive, creative, and emotional benefits
- How the activity matches their interests
- Any developmental milestones it supports

Return JSON only with this structure:
{
  "summary": "Brief 1-2 sentence summary",
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
    
    // If no children, create a default
    if (children.length === 0) {
      children = [{ 
        child_id: 'default', 
        name: 'Your child', 
        age: 8, 
        age_range: { min: 5, max: 12 },
        interests: [] 
      }];
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
