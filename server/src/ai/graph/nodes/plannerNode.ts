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
7. IMPORTANT: Only schedule activities during each child's available time slots
8. If siblings should be together, try to find activities they can do together

Time slot definitions:
- Morning: 6am-12pm
- Afternoon: 12pm-5pm
- Evening: 5pm-9pm

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
function buildPlannerContext(state: AIGraphStateType, candidates: any[], constraints?: any): string {
  const parts: string[] = [];

  // Add family context
  if (state.family_context) {
    const fc = state.family_context;
    parts.push('Family:');
    fc.children.forEach(child => {
      parts.push(`- ${child.name || 'Child'} (ID: ${child.child_id}, age ${child.age}, interests: ${child.interests.join(', ') || 'various'})`);
    });

    if (fc.preferences.budget_monthly) {
      parts.push(`Monthly Budget: $${fc.preferences.budget_monthly}`);
    }
  }

  // Add scheduling constraints
  if (constraints) {
    parts.push('\nScheduling Constraints:');
    if (constraints.max_activities_per_child) {
      parts.push(`- Maximum ${constraints.max_activities_per_child} activities per child`);
    }
    if (constraints.avoid_back_to_back) {
      parts.push('- Avoid scheduling back-to-back activities');
    }
    if (constraints.schedule_siblings_together) {
      parts.push('- IMPORTANT: Try to schedule siblings in the same activities when age-appropriate');
    }

    // Add per-child availability
    if (constraints.child_availability && Array.isArray(constraints.child_availability)) {
      parts.push('\nChild Availability (ONLY schedule during available slots):');
      constraints.child_availability.forEach((ca: any) => {
        const childName = state.family_context?.children.find(c => c.child_id === ca.child_id)?.name || ca.child_id;
        parts.push(`\n${childName}:`);
        if (ca.available_slots) {
          Object.entries(ca.available_slots).forEach(([day, slots]: [string, any]) => {
            const availableSlots: string[] = [];
            if (slots.morning) availableSlots.push('Morning (6am-12pm)');
            if (slots.afternoon) availableSlots.push('Afternoon (12pm-5pm)');
            if (slots.evening) availableSlots.push('Evening (5pm-9pm)');
            if (availableSlots.length > 0) {
              parts.push(`  ${day}: ${availableSlots.join(', ')}`);
            } else {
              parts.push(`  ${day}: NOT AVAILABLE`);
            }
          });
        }
      });
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

  parts.push('\nCreate an optimal weekly schedule respecting all constraints. Return JSON only.');

  return parts.join('\n');
}

/**
 * Determine time slot from hour string (e.g., "09:00" -> "morning")
 */
function getTimeSlot(time: string): 'morning' | 'afternoon' | 'evening' {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Validate and enforce schedule constraints
 * Returns filtered schedule that respects all constraints
 */
function validateAndEnforceConstraints(
  schedule: Record<string, ScheduleEntry[]>,
  constraints: any,
  familyChildren: Array<{ child_id: string; name?: string }>
): { entries: Record<string, ScheduleEntry[]>; violations: string[]; removedCount: number } {
  const violations: string[] = [];
  let removedCount = 0;
  const result: Record<string, ScheduleEntry[]> = {};

  // Track activities per child for max_activities_per_child constraint
  const activitiesPerChild: Record<string, number> = {};

  // Process each day
  for (const [day, entries] of Object.entries(schedule)) {
    result[day] = [];

    for (const entry of entries) {
      let shouldInclude = true;

      // 1. Validate max_activities_per_child
      if (constraints?.max_activities_per_child) {
        const currentCount = activitiesPerChild[entry.child_id] || 0;
        if (currentCount >= constraints.max_activities_per_child) {
          const childName = familyChildren.find(c => c.child_id === entry.child_id)?.name || entry.child_id;
          violations.push(`Removed "${entry.activity_name}" for ${childName}: exceeds max ${constraints.max_activities_per_child} activities`);
          shouldInclude = false;
          removedCount++;
        }
      }

      // 2. Validate child availability
      if (shouldInclude && constraints?.child_availability) {
        const childAvail = constraints.child_availability.find(
          (ca: any) => ca.child_id === entry.child_id
        );
        if (childAvail?.available_slots?.[day]) {
          const timeSlot = getTimeSlot(entry.time);
          if (!childAvail.available_slots[day][timeSlot]) {
            const childName = familyChildren.find(c => c.child_id === entry.child_id)?.name || entry.child_id;
            violations.push(`Removed "${entry.activity_name}" for ${childName}: ${day} ${timeSlot} not available`);
            shouldInclude = false;
            removedCount++;
          }
        }
      }

      if (shouldInclude) {
        result[day].push(entry);
        activitiesPerChild[entry.child_id] = (activitiesPerChild[entry.child_id] || 0) + 1;
      }
    }
  }

  // Log validation results
  if (violations.length > 0) {
    console.log(`📅 [PlannerNode] Constraint validation removed ${removedCount} entries:`);
    violations.forEach(v => console.log(`  - ${v}`));
  } else {
    console.log('📅 [PlannerNode] All entries passed constraint validation');
  }

  return { entries: result, violations, removedCount };
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
    const context = buildPlannerContext(state, uniqueCandidates, state.planner_constraints);
    
    const result = await model.invoke([
      { role: 'system', content: PLANNER_SYSTEM_PROMPT },
      { role: 'user', content: context }
    ]);
    
    const content = typeof result.content === 'string' 
      ? result.content 
      : JSON.stringify(result.content);
    
    const parsed = ScheduleResponseSchema.parse(JSON.parse(content));

    console.log(`📅 [PlannerNode] Generated schedule with ${parsed.total_activities} activities`);

    // Validate and enforce constraints on the generated schedule
    const validationResult = validateAndEnforceConstraints(
      parsed.schedule as Record<string, ScheduleEntry[]>,
      state.planner_constraints,
      children.map(c => ({ child_id: c.child_id, name: c.name }))
    );

    // Recalculate total after validation
    const validatedTotalActivities = Object.values(validationResult.entries)
      .reduce((sum, entries) => sum + entries.length, 0);

    // Convert to WeeklySchedule format
    const weeklySchedule: WeeklySchedule = {
      week_start: new Date().toISOString().split('T')[0],
      entries: validationResult.entries,
      conflicts: parsed.conflicts,
      suggestions: [
        ...parsed.suggestions,
        ...(validationResult.violations.length > 0
          ? [`${validationResult.removedCount} activities were removed to match your constraints`]
          : []),
      ],
      total_cost: parsed.total_cost,
      total_activities: validatedTotalActivities,
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
