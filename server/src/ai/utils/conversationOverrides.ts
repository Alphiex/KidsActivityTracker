/**
 * Conversation Overrides Extractor
 *
 * Extracts explicit user preferences from conversation that should
 * override default profile-based settings.
 */

import { ConversationOverrides } from './activityScorer';

// Patterns for detecting overrides
const OVERRIDE_PATTERNS = {
  // Distance overrides
  distanceRelax: [
    /don'?t\s+mind\s+(driving|distance|travel)/i,
    /willing\s+to\s+(drive|travel)/i,
    /can\s+(drive|travel)\s+far/i,
    /distance\s+(isn'?t|not)\s+(a\s+)?(problem|issue|concern)/i,
    /anywhere\s+in/i,
    /doesn'?t\s+matter\s+how\s+far/i,
  ],

  // Budget overrides
  budgetRelax: [
    /budget\s+(isn'?t|not|doesn'?t)\s+(a\s+)?(issue|problem|concern|matter)/i,
    /price\s+(isn'?t|not|doesn'?t)\s+(a\s+)?(issue|problem|concern|matter)/i,
    /cost\s+(isn'?t|not|doesn'?t)\s+(a\s+)?(issue|problem|concern|matter)/i,
    /money\s+(isn'?t|not|doesn'?t)\s+(a\s+)?(issue|problem|concern|matter)/i,
    /don'?t\s+care\s+about\s+(the\s+)?(price|cost|budget)/i,
    /any\s+price/i,
    /regardless\s+of\s+(price|cost)/i,
  ],

  // Prefer new/different categories
  preferNew: [
    /something\s+(new|different|else)/i,
    /try\s+something\s+(new|different|else)/i,
    /haven'?t\s+done\s+before/i,
    /change\s+(it\s+)?up/i,
    /variety/i,
    /mix\s+it\s+up/i,
    /different\s+from\s+(what|their)\s+usual/i,
  ],

  // Skill level indicators
  skillBeginner: [
    /beginner/i,
    /just\s+starting/i,
    /first\s+time/i,
    /learn\s+to/i,
    /intro(duction)?/i,
    /novice/i,
    /never\s+(done|tried)/i,
    /new\s+to/i,
    /level\s*1/i,
  ],
  skillIntermediate: [
    /intermediate/i,
    /some\s+experience/i,
    /continuing/i,
    /level\s*[23]/i,
    /knows?\s+(the\s+)?basics/i,
    /has\s+(done|tried)/i,
  ],
  skillAdvanced: [
    /advanced/i,
    /competitive/i,
    /experienced/i,
    /level\s*[45]/i,
    /elite/i,
    /rep(resentative)?/i,
    /tournament/i,
    /varsity/i,
  ],
};

// City name patterns (Canadian cities we support)
const CITY_PATTERNS: Array<{ pattern: RegExp; city: string }> = [
  { pattern: /\b(north\s+van(couver)?|north\s+van)\b/i, city: 'North Vancouver' },
  { pattern: /\b(west\s+van(couver)?|west\s+van)\b/i, city: 'West Vancouver' },
  { pattern: /\bvancouver\b/i, city: 'Vancouver' },
  { pattern: /\bburnaby\b/i, city: 'Burnaby' },
  { pattern: /\brichmond\b/i, city: 'Richmond' },
  { pattern: /\bsurrey\b/i, city: 'Surrey' },
  { pattern: /\bcoquitlam\b/i, city: 'Coquitlam' },
  { pattern: /\bport\s+coquitlam\b/i, city: 'Port Coquitlam' },
  { pattern: /\bport\s+moody\b/i, city: 'Port Moody' },
  { pattern: /\bnew\s+west(minster)?\b/i, city: 'New Westminster' },
  { pattern: /\bdelta\b/i, city: 'Delta' },
  { pattern: /\blangley\b/i, city: 'Langley' },
  { pattern: /\bmaple\s+ridge\b/i, city: 'Maple Ridge' },
  { pattern: /\bwhite\s+rock\b/i, city: 'White Rock' },
  { pattern: /\bsquamish\b/i, city: 'Squamish' },
  { pattern: /\bwhistler\b/i, city: 'Whistler' },
  { pattern: /\bvictoria\b/i, city: 'Victoria' },
  { pattern: /\bkelowna\b/i, city: 'Kelowna' },
  { pattern: /\btoronto\b/i, city: 'Toronto' },
  { pattern: /\bottawa\b/i, city: 'Ottawa' },
  { pattern: /\bcalgary\b/i, city: 'Calgary' },
  { pattern: /\bedmonton\b/i, city: 'Edmonton' },
  { pattern: /\bmontreal\b/i, city: 'Montreal' },
];

// Day of week patterns
const DAY_PATTERNS: Array<{ pattern: RegExp; days: string[] }> = [
  { pattern: /\bweekend(s)?\b/i, days: ['Saturday', 'Sunday'] },
  { pattern: /\bweekday(s)?\b/i, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
  { pattern: /\bmonday(s)?\b/i, days: ['Monday'] },
  { pattern: /\btuesday(s)?\b/i, days: ['Tuesday'] },
  { pattern: /\bwednesday(s)?\b/i, days: ['Wednesday'] },
  { pattern: /\bthursday(s)?\b/i, days: ['Thursday'] },
  { pattern: /\bfriday(s)?\b/i, days: ['Friday'] },
  { pattern: /\bsaturday(s)?\b/i, days: ['Saturday'] },
  { pattern: /\bsunday(s)?\b/i, days: ['Sunday'] },
];

// Activity type keywords
const ACTIVITY_KEYWORDS = [
  'swimming', 'swim', 'aquatics', 'pool',
  'skating', 'skate', 'ice skating', 'figure skating',
  'hockey', 'ice hockey',
  'soccer', 'football',
  'basketball', 'hoops',
  'baseball', 'softball',
  'volleyball',
  'tennis', 'badminton', 'racquet',
  'golf', 'mini golf',
  'dance', 'dancing', 'ballet', 'hip hop', 'jazz',
  'gymnastics', 'tumbling',
  'martial arts', 'karate', 'taekwondo', 'judo', 'jiu jitsu',
  'art', 'arts', 'crafts', 'painting', 'drawing', 'pottery',
  'music', 'piano', 'guitar', 'violin', 'drums', 'singing', 'choir',
  'drama', 'theater', 'theatre', 'acting',
  'coding', 'programming', 'computer', 'robotics', 'stem',
  'cooking', 'baking', 'culinary',
  'yoga', 'pilates', 'fitness',
  'rock climbing', 'climbing',
  'archery',
  'fencing',
  'bowling',
  'lacrosse',
  'rugby',
  'track', 'running',
  'cross country', 'skiing', 'snowboarding',
  'camp', 'camps', 'day camp', 'summer camp',
];

/**
 * Extract conversation overrides from user message
 */
export function extractOverrides(
  message: string,
  existingOverrides?: Partial<ConversationOverrides>
): ConversationOverrides {
  const overrides: ConversationOverrides = {
    explicitRequirements: [],
    ...existingOverrides,
  };

  // Check distance override
  if (OVERRIDE_PATTERNS.distanceRelax.some(p => p.test(message))) {
    overrides.locationOverride = {
      ...overrides.locationOverride,
      maxDistanceKm: 150, // Expand to 150km
    };
  }

  // Check budget override
  if (OVERRIDE_PATTERNS.budgetRelax.some(p => p.test(message))) {
    overrides.ignoreBudget = true;
  }

  // Check for new/different preference
  if (OVERRIDE_PATTERNS.preferNew.some(p => p.test(message))) {
    overrides.preferNewCategories = true;
  }

  // Check skill level
  if (OVERRIDE_PATTERNS.skillBeginner.some(p => p.test(message))) {
    overrides.skillLevelRequired = 'beginner';
  } else if (OVERRIDE_PATTERNS.skillAdvanced.some(p => p.test(message))) {
    overrides.skillLevelRequired = 'advanced';
  } else if (OVERRIDE_PATTERNS.skillIntermediate.some(p => p.test(message))) {
    overrides.skillLevelRequired = 'intermediate';
  }

  // Extract city override
  for (const { pattern, city } of CITY_PATTERNS) {
    if (pattern.test(message)) {
      overrides.locationOverride = {
        ...overrides.locationOverride,
        city,
      };
      break;
    }
  }

  // Extract age override
  const ageMatch = message.match(/\b(\d{1,2})\s*(year|yr|yo|years?\s*old)\b/i);
  if (ageMatch) {
    const age = parseInt(ageMatch[1], 10);
    if (age >= 0 && age <= 18) {
      overrides.ageOverride = age;
    }
  }

  // Also check for "X-year-old" pattern
  const ageMatch2 = message.match(/\b(\d{1,2})[\s-]*(year|yr)[\s-]*old\b/i);
  if (ageMatch2 && !overrides.ageOverride) {
    const age = parseInt(ageMatch2[1], 10);
    if (age >= 0 && age <= 18) {
      overrides.ageOverride = age;
    }
  }

  // Extract days override
  const daysFound: string[] = [];
  for (const { pattern, days } of DAY_PATTERNS) {
    if (pattern.test(message)) {
      daysFound.push(...days);
    }
  }
  if (daysFound.length > 0) {
    overrides.daysOverride = [...new Set(daysFound)]; // Dedupe
  }

  // Check for "only" keyword to make days a hard filter
  const onlyDays = message.match(/only\s+(on\s+)?(weekend|weekday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (onlyDays) {
    // Days are already extracted above, the "only" makes them a hard filter
    // which is handled by the scoring system
  }

  // Extract explicit activity requirements
  const messageLower = message.toLowerCase();
  for (const keyword of ACTIVITY_KEYWORDS) {
    if (messageLower.includes(keyword)) {
      overrides.explicitRequirements.push(keyword);
    }
  }

  // Dedupe explicit requirements
  overrides.explicitRequirements = [...new Set(overrides.explicitRequirements)];

  return overrides;
}

/**
 * Merge new overrides with existing ones
 * New values take precedence
 */
export function mergeOverrides(
  existing: ConversationOverrides,
  newOverrides: Partial<ConversationOverrides>
): ConversationOverrides {
  const merged: ConversationOverrides = { ...existing };

  // Location override - merge city and distance
  if (newOverrides.locationOverride) {
    merged.locationOverride = {
      ...existing.locationOverride,
      ...newOverrides.locationOverride,
    };
  }

  // Simple overwrites
  if (newOverrides.ageOverride !== undefined) {
    merged.ageOverride = newOverrides.ageOverride;
  }
  if (newOverrides.daysOverride !== undefined) {
    merged.daysOverride = newOverrides.daysOverride;
  }
  if (newOverrides.ignoreBudget !== undefined) {
    merged.ignoreBudget = newOverrides.ignoreBudget;
  }
  if (newOverrides.preferNewCategories !== undefined) {
    merged.preferNewCategories = newOverrides.preferNewCategories;
  }
  if (newOverrides.skillLevelRequired !== undefined) {
    merged.skillLevelRequired = newOverrides.skillLevelRequired;
  }

  // Merge explicit requirements (accumulate)
  if (newOverrides.explicitRequirements?.length) {
    merged.explicitRequirements = [
      ...new Set([...existing.explicitRequirements, ...newOverrides.explicitRequirements]),
    ];
  }

  return merged;
}

/**
 * Generate a summary of active overrides for debugging/logging
 */
export function summarizeOverrides(overrides: ConversationOverrides): string {
  const parts: string[] = [];

  if (overrides.locationOverride?.city) {
    parts.push(`city=${overrides.locationOverride.city}`);
  }
  if (overrides.locationOverride?.maxDistanceKm) {
    parts.push(`maxDistance=${overrides.locationOverride.maxDistanceKm}km`);
  }
  if (overrides.ageOverride !== undefined) {
    parts.push(`age=${overrides.ageOverride}`);
  }
  if (overrides.daysOverride?.length) {
    parts.push(`days=[${overrides.daysOverride.join(',')}]`);
  }
  if (overrides.ignoreBudget) {
    parts.push('ignoreBudget=true');
  }
  if (overrides.preferNewCategories) {
    parts.push('preferNew=true');
  }
  if (overrides.skillLevelRequired) {
    parts.push(`skill=${overrides.skillLevelRequired}`);
  }
  if (overrides.explicitRequirements.length) {
    parts.push(`requirements=[${overrides.explicitRequirements.join(',')}]`);
  }

  return parts.length > 0 ? parts.join(', ') : 'none';
}

/**
 * Check if a user message is likely answering a clarification question
 */
export function isClarificationResponse(
  message: string,
  previousQuestion?: string
): boolean {
  // Short responses are often answers
  if (message.split(' ').length <= 5) {
    return true;
  }

  // Contains a date pattern
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2})/i.test(message)) {
    return true;
  }

  // Contains an age pattern
  if (/\b\d{1,2}\s*(year|yr|yo)/i.test(message)) {
    return true;
  }

  // Contains only a city name
  if (CITY_PATTERNS.some(({ pattern }) => pattern.test(message)) && message.split(' ').length <= 3) {
    return true;
  }

  // Starts with common answer phrases
  if (/^(yes|no|maybe|sure|okay|ok|right|correct|exactly|that'?s|it'?s|the|my|our|we)/i.test(message)) {
    return true;
  }

  return false;
}

export default {
  extractOverrides,
  mergeOverrides,
  summarizeOverrides,
  isClarificationResponse,
};
