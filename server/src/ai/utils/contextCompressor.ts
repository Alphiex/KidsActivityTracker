import { CompressedActivity } from '../types/ai.types';

/**
 * Strip HTML tags from a string
 */
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')  // Remove HTML tags
    .replace(/&nbsp;/g, ' ')   // Replace nbsp
    .replace(/&amp;/g, '&')    // Replace amp
    .replace(/&lt;/g, '<')     // Replace lt
    .replace(/&gt;/g, '>')     // Replace gt
    .replace(/&quot;/g, '"')   // Replace quotes
    .replace(/\s+/g, ' ')      // Collapse whitespace
    .trim();
}

/**
 * Truncate string to max length with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Get age bucket string for caching
 */
export function getAgeBucket(ageMin?: number, ageMax?: number): string {
  const min = ageMin ?? 0;
  const max = ageMax ?? 18;
  
  if (max <= 3) return 'infant';
  if (max <= 5) return 'toddler';
  if (max <= 8) return 'young-child';
  if (max <= 12) return 'child';
  if (max <= 15) return 'teen';
  return 'all-ages';
}

/**
 * Compress a single activity for LLM context
 * Minimizes token usage while preserving essential information
 */
export function compressActivity(activity: any): CompressedActivity {
  // Extract category code from activityType or fallback to category string
  const categoryCode = activity.activityType?.code 
    || activity.category?.toLowerCase().replace(/\s+/g, '-').slice(0, 20) 
    || 'other';

  // Get tags from various sources
  const tags: string[] = [];
  if (activity.subcategory) tags.push(activity.subcategory);
  if (activity.activitySubtype?.name) tags.push(activity.activitySubtype.name);
  
  // Extract days of week
  const days = activity.dayOfWeek || [];
  
  return {
    id: activity.id,
    name: truncate(activity.name || '', 100),
    desc: truncate(stripHtml(activity.description || activity.fullDescription || ''), 300),
    cat: categoryCode,
    tags: tags.slice(0, 5),
    age: [activity.ageMin ?? 0, activity.ageMax ?? 18],
    cost: activity.cost ?? 0,
    days: Array.isArray(days) ? days.slice(0, 7) : [],
    spots: activity.spotsAvailable ?? null,
    sponsored: activity.isFeatured ?? false
  };
}

/**
 * Compress multiple activities for LLM context
 * Limits to specified count to control token usage
 */
export function compressActivities(activities: any[], limit: number = 30): CompressedActivity[] {
  return activities
    .slice(0, limit)
    .map(compressActivity);
}

/**
 * Calculate approximate token count for compressed activities
 * Rough estimate: ~4 chars per token for JSON
 */
export function estimateTokens(compressed: CompressedActivity[]): number {
  const json = JSON.stringify(compressed);
  return Math.ceil(json.length / 4);
}

/**
 * Build a compact family context for LLM
 */
export function buildCompactFamilyContext(context: any): string {
  if (!context) return 'No family context provided.';
  
  const parts: string[] = [];
  
  // Children info
  if (context.children && context.children.length > 0) {
    const childrenSummary = context.children
      .map((c: any) => `${c.name || 'Child'} (age ${c.age})`)
      .join(', ');
    parts.push(`Children: ${childrenSummary}`);
  }
  
  // Preferences
  if (context.preferences) {
    const prefs = context.preferences;
    if (prefs.budget_monthly) parts.push(`Budget: $${prefs.budget_monthly}/month`);
    if (prefs.max_distance_km) parts.push(`Max distance: ${prefs.max_distance_km}km`);
    if (prefs.days_of_week?.length) parts.push(`Days: ${prefs.days_of_week.join(', ')}`);
    if (prefs.preferred_categories?.length) {
      parts.push(`Preferred: ${prefs.preferred_categories.slice(0, 5).join(', ')}`);
    }
  }
  
  // Location
  if (context.location?.city) {
    parts.push(`Location: ${context.location.city}`);
  }
  
  return parts.join('\n') || 'General family preferences.';
}
