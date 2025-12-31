/**
 * Planner Node
 * 
 * Generates optimal weekly activity schedules for families.
 * Considers multiple children, time conflicts, travel distance, and activity balance.
 */

import { AIGraphStateType, WeeklySchedule, ScheduleEntry } from '../state';
import { getLargeModel } from '../../models/chatModels';
import { PrismaClient } from '../../../../generated/prisma';
import { EnhancedActivityService } from '../../../services/activityService.enhanced';
import { compressActivities } from '../../utils/contextCompressor';
import { z } from 'zod';

// Singleton instances
let _prisma: PrismaClient | null = null;
let _activityService: EnhancedActivityService | null = null;

function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

function getActivityService(): EnhancedActivityService {
  if (!_activityService) {
    _activityService = new EnhancedActivityService(getPrisma());
  }
  return _activityService;
}

/**
 * Schema for schedule entry
 */
const ScheduleEntrySchema = z.object({
  child_id: z.string(),
  child_name: z.string().optional(),
  activity_id: z.string(),
  activity_name: z.string(),
  time: z.string(),
  location: z.string(),
  duration_minutes: z.number().optional(),
});

/**
 * Schema for conflict
 */
const ConflictSchema = z.object({
  type: z.enum(['time_overlap', 'travel_distance', 'back_to_back']),
  description: z.string(),
  affected_entries: z.array(z.string()),
});

/**
 * Schema for schedule response
 */
const ScheduleResponseSchema = z.object({
  schedule: z.record(z.string(), z.array(ScheduleEntrySchema)),
  conflicts: z.array(ConflictSchema).optional().default([]),
  suggestions: z.array(z.string()).optional().default([]),
  total_cost: z.number().optional(),
  total_activities: z.number(),
});

/**
 * System prompt for schedule planning
 */
const PLANNER_SYSTEM_PROMPT = `You are an expert family schedule planner.
Create an optimal weekly activity schedule for a family with multiple children.

Consider:
1. Each child's age and interests
2. Avoid time conflicts between children's activities
3. Minimize travel time between activities
4. Balance activity types (sports, arts, academics)
5. Respect budget constraints
6. Allow rest days / don't over-schedule

Return JSON with this structure:
{
  "schedule": {
    "Monday": [
      { "child_id": "...", "child_name": "...", "activity_id": "...", "activity_name": "...", "time": "16:00", "location": "...", "duration_minutes": 60 }
    ],
    "Tuesday": [...],
    ...
  },
  "conflicts": [
    { "type": "time_overlap", "description": "...", "affected_entries": ["activity_id1"] }
  ],
  "suggestions": ["Consider adding a creative activity for Sarah"],
  "total_cost": 250,
  "total_activities": 5
}`;

/**
 * Build context for planning
 */
function buildPlannerContext(state: AIGraphStateType, candidates: any[]): string {
  const parts: string[] = [];
  
  // Add family context
  if (state.family_context) {
    const fc = state.family_context;
    parts.push('Family:');
    fc.children.forEach(child => {
      parts.push(`- ${child.name || 'Child'} (age ${child.age}, interests: ${child.interests.join(', ') || 'various'})`);
    });
    
    if (fc.preferences.budget_monthly) {
      parts.push(`Monthly Budget: $${fc.preferences.budget_monthly}`);
    }
    if (fc.preferences.days_of_week?.length) {
      parts.push(`Available Days: ${fc.preferences.days_of_week.join(', ')}`);
    }
  }
  
  // Add parsed constraints
  if (state.parsed_filters) {
    const pf = state.parsed_filters;
    if (pf.costMax) {
      parts.push(`Max cost per activity: $${pf.costMax}`);
    }
  }
  
  // Add candidate activities
  parts.push(`\nAvailable Activities (${candidates.length}):`);
  candidates.forEach((act, idx) => {
    parts.push(`${idx + 1}. [${act.id}] ${act.name} - Ages ${act.age[0]}-${act.age[1]} - $${act.cost} - ${act.days.join(', ')}`);
  });
  
  parts.push('\nCreate an optimal weekly schedule. Return JSON only.');
  
  return parts.join('\n');
}

/**
 * Planner node - generates weekly schedule
 */
export async function plannerNode(state: AIGraphStateType): Promise<Partial<AIGraphStateType>> {
  console.log('📅 [PlannerNode] Generating weekly schedule...');
  
  const activityService = getActivityService();
  
  // Get children info
  const children = state.family_context?.children || [];
  
  if (children.length === 0) {
    console.log('📅 [PlannerNode] No children in family context');
    return {
      errors: ['No children found for scheduling'],
    };
  }
  
  try {
    // Fetch candidate activities for all children
    const allCandidates: any[] = [];
    
    for (const child of children) {
      const result = await activityService.searchActivities({
        ageMin: child.age - 1,
        ageMax: child.age + 1,
        limit: 30,
        hideClosedActivities: true,
      });
      
      const compressed = compressActivities(result.activities);
      allCandidates.push(...compressed);
    }
    
    // Deduplicate
    const uniqueCandidates = allCandidates.filter(
      (act, idx, arr) => arr.findIndex(a => a.id === act.id) === idx
    );
    
    console.log(`📅 [PlannerNode] Found ${uniqueCandidates.length} unique candidates`);
    
    // Use large model for complex planning
    const model = getLargeModel();
    const context = buildPlannerContext(state, uniqueCandidates);
    
    const result = await model.invoke([
      { role: 'system', content: PLANNER_SYSTEM_PROMPT },
      { role: 'user', content: context }
    ]);
    
    const content = typeof result.content === 'string' 
      ? result.content 
      : JSON.stringify(result.content);
    
    const parsed = ScheduleResponseSchema.parse(JSON.parse(content));
    
    console.log(`📅 [PlannerNode] Generated schedule with ${parsed.total_activities} activities`);
    
    // Convert to WeeklySchedule format
    const weeklySchedule: WeeklySchedule = {
      week_start: new Date().toISOString().split('T')[0],
      entries: parsed.schedule as Record<string, ScheduleEntry[]>,
      conflicts: parsed.conflicts,
      suggestions: parsed.suggestions,
      total_cost: parsed.total_cost,
      total_activities: parsed.total_activities,
    };
    
    return {
      weekly_schedule: weeklySchedule,
      source: 'llm',
      tokens_used: (result as any).usage_metadata?.total_tokens || 0,
      model_used: 'gpt-4o',
    };
    
  } catch (error) {
    console.error('📅 [PlannerNode] Error:', error);
    
    return {
      errors: [`Planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}
