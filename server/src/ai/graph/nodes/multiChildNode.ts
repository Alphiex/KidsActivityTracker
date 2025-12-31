/**
 * Multi-Child Node
 * 
 * Optimizes activity search for multiple children.
 * Finds activities suitable for siblings and optimizes parent logistics.
 */

import { AIGraphStateType, MultiChildMode } from '../state';
import { ActivitySearchParams, ChildProfile } from '../../types/ai.types';

/**
 * Find overlapping age range for multiple children
 */
function findOverlappingAgeRange(children: ChildProfile[]): { min: number; max: number } | null {
  if (children.length === 0) return null;
  if (children.length === 1) {
    return { min: children[0].age - 1, max: children[0].age + 1 };
  }
  
  // Find the highest minimum age and lowest maximum age
  let minAge = Math.max(...children.map(c => c.age - 1));
  let maxAge = Math.min(...children.map(c => c.age + 1));
  
  // If there's an overlap, return it
  if (minAge <= maxAge) {
    return { min: minAge, max: maxAge };
  }
  
  // No overlap - expand to include all
  return {
    min: Math.min(...children.map(c => c.age - 1)),
    max: Math.max(...children.map(c => c.age + 1)),
  };
}

/**
 * Merge interests from multiple children
 */
function mergeInterests(children: ChildProfile[]): string[] {
  const allInterests = new Set<string>();
  children.forEach(child => {
    child.interests.forEach(interest => allInterests.add(interest));
  });
  return Array.from(allInterests);
}

/**
 * Multi-child optimization node
 */
export async function multiChildNode(state: AIGraphStateType): Promise<Partial<AIGraphStateType>> {
  console.log('👨‍👩‍👧‍👦 [MultiChildNode] Optimizing for multiple children...');
  
  const mode = state.multi_child_mode || 'any';
  const selectedIds = state.selected_child_ids;
  
  // Get children from family context
  let children = state.family_context?.children || [];
  
  // Filter to selected children if specified
  if (selectedIds?.length) {
    children = children.filter(c => selectedIds.includes(c.child_id));
  }
  
  console.log(`👨‍👩‍👧‍👦 [MultiChildNode] Mode: ${mode}, Children: ${children.length}`);
  
  if (children.length === 0) {
    console.log('👨‍👩‍👧‍👦 [MultiChildNode] No children found');
    return {
      errors: ['No children found for multi-child optimization'],
    };
  }
  
  if (children.length === 1) {
    console.log('👨‍👩‍👧‍👦 [MultiChildNode] Only one child, no optimization needed');
    // Just set age filter for single child
    return {
      parsed_filters: {
        ...state.parsed_filters,
        ageMin: children[0].age - 1,
        ageMax: children[0].age + 1,
      },
    };
  }
  
  // Build optimized filters based on mode
  const filters: ActivitySearchParams = { ...state.parsed_filters };
  
  switch (mode) {
    case 'together': {
      // Find activities that ALL children can do together
      const overlap = findOverlappingAgeRange(children);
      if (overlap) {
        filters.ageMin = overlap.min;
        filters.ageMax = overlap.max;
      }
      
      // Merge interests for search
      const interests = mergeInterests(children);
      if (interests.length > 0 && !filters.search) {
        // Don't override explicit search
        filters.search = interests.slice(0, 3).join(' ');
      }
      
      console.log(`👨‍👩‍👧‍👦 [MultiChildNode] Together mode: ages ${filters.ageMin}-${filters.ageMax}`);
      break;
    }
    
    case 'parallel': {
      // Find activities at same location/time but different age groups
      // Expand age range to include all children
      filters.ageMin = Math.min(...children.map(c => c.age - 1));
      filters.ageMax = Math.max(...children.map(c => c.age + 1));
      
      // For parallel, we want more results to find matching locations
      filters.limit = Math.max(filters.limit || 50, 100);
      
      console.log(`👨‍👩‍👧‍👦 [MultiChildNode] Parallel mode: ages ${filters.ageMin}-${filters.ageMax}`);
      break;
    }
    
    case 'any':
    default: {
      // Independent optimization - just expand to include all ages
      filters.ageMin = Math.min(...children.map(c => c.age - 1));
      filters.ageMax = Math.max(...children.map(c => c.age + 1));
      
      console.log(`👨‍👩‍👧‍👦 [MultiChildNode] Any mode: ages ${filters.ageMin}-${filters.ageMax}`);
      break;
    }
  }
  
  // Update model tier for complex multi-child scenarios
  let modelTier = state.model_tier;
  if (children.length >= 3 || mode === 'parallel') {
    modelTier = 'large';
    console.log('👨‍👩‍👧‍👦 [MultiChildNode] Using large model for complex scenario');
  }
  
  return {
    parsed_filters: filters,
    model_tier: modelTier,
    // Continue to fetch_candidates
  };
}
