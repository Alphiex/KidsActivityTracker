/**
 * Clarification Engine
 *
 * Determines when to ask clarifying questions and generates appropriate questions.
 * Follows best practices: max 1 question per turn, provide suggested answers,
 * prefer smart defaults over questions.
 */

import { QueryAnalysis, QueryUnderstanding } from './queryUnderstanding';
import { TemporalResolution } from './temporalResolver';

// Types
export interface ClarifyingQuestion {
  question: string;
  suggestedAnswers: string[];
  allowFreeform: boolean;
  priority: 'required' | 'helpful';
  context: string; // What triggered this question
}

export interface ClarificationDecision {
  shouldAsk: boolean;
  question?: ClarifyingQuestion;
  canProceedWithDefaults: boolean;
  defaultsUsed?: string[];
}

export interface FamilyContext {
  children?: Array<{ id: string; name: string; age: number }>;
  location?: { city?: string; latitude?: number; longitude?: number };
  preferences?: {
    preferredActivityTypes?: string[];
    daysOfWeek?: string[];
    priceRange?: { min?: number; max?: number };
  };
}

/**
 * Determine if clarification is needed and generate appropriate question
 */
export function determineClarification(
  understanding: QueryUnderstanding,
  familyContext: FamilyContext,
  conversationHistory?: string[]
): ClarificationDecision {
  const defaultsUsed: string[] = [];

  // Priority 1: Temporal expressions that need clarification
  if (understanding.temporalResolution?.needsClarification) {
    return {
      shouldAsk: true,
      question: {
        question: understanding.temporalResolution.clarificationQuestion || 'When would you like to find activities?',
        suggestedAnswers: understanding.temporalResolution.suggestedDates?.map(d => d.label) || [
          'This weekend',
          'Next week',
          'Custom dates',
        ],
        allowFreeform: true,
        priority: 'required',
        context: `temporal_expression:${understanding.analysis.temporalExpression}`,
      },
      canProceedWithDefaults: false,
    };
  }

  // Priority 2: No location available at all
  if (
    !understanding.searchParams.city &&
    !familyContext.location?.city &&
    !familyContext.location?.latitude
  ) {
    return {
      shouldAsk: true,
      question: {
        question: 'Which city are you looking for activities in?',
        suggestedAnswers: ['Vancouver', 'North Vancouver', 'Burnaby', 'Other city'],
        allowFreeform: true,
        priority: 'required',
        context: 'missing_location',
      },
      canProceedWithDefaults: false,
    };
  }

  // Use location from profile as default
  if (!understanding.searchParams.city && familyContext.location?.city) {
    defaultsUsed.push(`location:${familyContext.location.city}`);
  }

  // Priority 3: No age and no children in profile for targeted search
  const isTargetedSearch = ['activity_search', 'schedule_planning'].includes(understanding.analysis.intent);
  if (
    isTargetedSearch &&
    !understanding.searchParams.minAge &&
    (!familyContext.children || familyContext.children.length === 0)
  ) {
    return {
      shouldAsk: true,
      question: {
        question: 'What age is your child?',
        suggestedAnswers: ['0-2 years (infant/toddler)', '3-5 years (preschool)', '6-8 years', '9-12 years', '13+ years (teen)'],
        allowFreeform: true,
        priority: 'required',
        context: 'missing_age',
      },
      canProceedWithDefaults: false,
    };
  }

  // Use first child's age as default
  if (!understanding.searchParams.minAge && familyContext.children?.length) {
    const firstChild = familyContext.children[0];
    defaultsUsed.push(`age:${firstChild.age} (${firstChild.name})`);
  }

  // Priority 4: Multiple children with significant age gap
  if (
    familyContext.children &&
    familyContext.children.length > 1 &&
    !understanding.analysis.childName &&
    isTargetedSearch
  ) {
    const ages = familyContext.children.map(c => c.age);
    const ageDiff = Math.max(...ages) - Math.min(...ages);

    if (ageDiff > 4) {
      // Significant age gap - might want to ask
      return {
        shouldAsk: true,
        question: {
          question: 'Which child are you looking for activities for?',
          suggestedAnswers: [
            ...familyContext.children.map(c => `${c.name} (age ${c.age})`),
            'Activities for all children',
          ],
          allowFreeform: false,
          priority: 'helpful',
          context: 'multiple_children',
        },
        canProceedWithDefaults: true, // Can proceed with all children
        defaultsUsed,
      };
    }
  }

  // Priority 5: Pure exploration with no direction
  if (
    understanding.analysis.intent === 'exploration' &&
    !understanding.analysis.activityTypes?.length &&
    !understanding.searchParams.searchTerm &&
    understanding.analysis.confidence < 0.6
  ) {
    return {
      shouldAsk: true,
      question: {
        question: 'What type of activities are you interested in?',
        suggestedAnswers: [
          'Sports & Fitness',
          'Arts & Music',
          'Swimming & Aquatics',
          'STEM & Learning',
          'Show me everything',
        ],
        allowFreeform: true,
        priority: 'helpful',
        context: 'undirected_exploration',
      },
      canProceedWithDefaults: true, // Can show diverse results
      defaultsUsed,
    };
  }

  // No clarification needed
  return {
    shouldAsk: false,
    canProceedWithDefaults: true,
    defaultsUsed,
  };
}

/**
 * Activity type to related types mapping for "similar activities" suggestions
 */
const RELATED_ACTIVITY_TYPES: Record<string, string[]> = {
  swimming: ['diving', 'water polo', 'aqua fitness'],
  skating: ['hockey', 'figure skating', 'ringette'],
  hockey: ['skating', 'floor hockey', 'ball hockey'],
  soccer: ['futsal', 'indoor soccer', 'multi-sport'],
  basketball: ['volleyball', 'multi-sport', 'sports camps'],
  dance: ['ballet', 'hip hop', 'gymnastics', 'cheer'],
  ballet: ['dance', 'gymnastics', 'figure skating'],
  gymnastics: ['tumbling', 'dance', 'cheer', 'acrobatics'],
  'martial arts': ['karate', 'taekwondo', 'judo', 'self-defense'],
  karate: ['taekwondo', 'judo', 'martial arts'],
  art: ['pottery', 'painting', 'crafts', 'creative'],
  music: ['piano', 'guitar', 'singing', 'band'],
  piano: ['music', 'keyboard', 'guitar'],
  coding: ['robotics', 'STEM', 'technology', 'game design'],
  tennis: ['badminton', 'pickleball', 'racquet sports'],
};

/**
 * Generate targeted follow-up suggestions based on search results and context
 */
export function generateFollowUpSuggestions(
  resultCount: number,
  understanding: QueryUnderstanding,
  familyContext: FamilyContext,
  searchResults?: Array<{
    category?: string;
    price?: number;
    daysOfWeek?: string[];
    skillLevel?: string;
    distance?: number;
  }>
): string[] {
  const suggestions: string[] = [];
  const searchedType = understanding.analysis.activityTypes?.[0]?.toLowerCase();
  const childName = understanding.analysis.childName || familyContext.children?.[0]?.name;
  const childAge = understanding.analysis.ageExplicit || familyContext.children?.[0]?.age;

  if (resultCount === 0) {
    // NO RESULTS - Suggest broadening search with specific guidance

    // Suggest removing specific filters that were applied
    if (understanding.searchParams.daysOfWeek?.length === 1) {
      suggestions.push(`Try any day, not just ${understanding.searchParams.daysOfWeek[0]}`);
    } else if (understanding.searchParams.daysOfWeek?.length) {
      suggestions.push('Search all days of the week');
    }

    if (understanding.searchParams.maxPrice && understanding.searchParams.maxPrice < 100) {
      suggestions.push(`Show options up to $${understanding.searchParams.maxPrice + 50}`);
    }

    // Suggest related activities
    if (searchedType && RELATED_ACTIVITY_TYPES[searchedType]) {
      const related = RELATED_ACTIVITY_TYPES[searchedType][0];
      suggestions.push(`How about ${related} instead?`);
    }

    // Suggest expanding location
    if (understanding.searchParams.city) {
      suggestions.push('Search nearby cities too');
    } else {
      suggestions.push("I don't mind driving further");
    }

    // If skill level was specified, suggest other levels
    if (understanding.analysis.skillLevel) {
      const otherLevel = understanding.analysis.skillLevel === 'beginner' ? 'all levels' : 'beginner';
      suggestions.push(`Show ${otherLevel} classes`);
    }

  } else if (resultCount < 5) {
    // FEW RESULTS - Suggest alternatives and expansions

    if (searchedType && RELATED_ACTIVITY_TYPES[searchedType]) {
      const related = RELATED_ACTIVITY_TYPES[searchedType].slice(0, 2).join(' or ');
      suggestions.push(`Also show ${related}`);
    }

    if (!understanding.searchParams.daysOfWeek?.includes('Saturday') &&
        !understanding.searchParams.daysOfWeek?.includes('Sunday')) {
      suggestions.push('Include weekend options');
    }

    suggestions.push('Search a wider area');

    if (familyContext.children && familyContext.children.length > 1) {
      const otherChild = familyContext.children.find(c => c.name !== childName);
      if (otherChild) {
        suggestions.push(`Also show options for ${otherChild.name} (${otherChild.age})`);
      }
    }

  } else {
    // GOOD RESULTS - Suggest refinements based on actual results

    // Analyze results to make smart suggestions
    if (searchResults && searchResults.length > 0) {
      // Price-based suggestions
      const prices = searchResults.map(r => r.price).filter(p => p !== undefined && p > 0) as number[];
      if (prices.length > 0) {
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        if (avgPrice > 100) {
          suggestions.push('Show budget-friendly options under $75');
        } else if (!understanding.searchParams.maxPrice) {
          const cheapest = Math.min(...prices);
          if (cheapest > 30) {
            suggestions.push(`Any free or low-cost options?`);
          }
        }
      }

      // Day-based suggestions
      const allDays = searchResults.flatMap(r => r.daysOfWeek || []);
      const hasWeekendOptions = allDays.some(d => d === 'Saturday' || d === 'Sunday');
      const hasWeekdayOptions = allDays.some(d => !['Saturday', 'Sunday'].includes(d));

      if (!understanding.searchParams.daysOfWeek?.length) {
        if (hasWeekendOptions && hasWeekdayOptions) {
          suggestions.push('Only show weekend classes');
        } else if (!hasWeekendOptions) {
          suggestions.push('Any weekend options available?');
        }
      }

      // Distance-based suggestions
      const distances = searchResults.map(r => r.distance).filter(d => d !== undefined) as number[];
      if (distances.length > 0) {
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        if (avgDistance > 15) {
          suggestions.push('Only show activities within 10km');
        }
      }
    } else {
      // Generic refinements when no result details available
      if (!understanding.searchParams.daysOfWeek?.length) {
        suggestions.push('Only weekend classes');
      }
      suggestions.push('Closer to home');
    }

    // Skill level suggestions
    if (!understanding.analysis.skillLevel && searchedType) {
      suggestions.push(`Beginner ${searchedType} classes`);
    }

    // Multi-child family suggestions
    if (familyContext.children && familyContext.children.length > 1) {
      const otherChild = familyContext.children.find(c => c.name !== childName);
      if (otherChild) {
        suggestions.push(`What about ${otherChild.name}?`);
      }
      // Check if ages are close enough for shared activities
      const ages = familyContext.children.map(c => c.age);
      const ageDiff = Math.max(...ages) - Math.min(...ages);
      if (ageDiff <= 3) {
        suggestions.push('Activities they can do together');
      }
    }

    // Activity-specific follow-ups
    if (searchedType) {
      const relatedTypes = RELATED_ACTIVITY_TYPES[searchedType];
      if (relatedTypes && relatedTypes.length > 0) {
        suggestions.push(`Also interested in ${relatedTypes[0]}?`);
      }
    }
  }

  // If no activity type was searched, suggest based on child's age
  if (!searchedType && suggestions.length < 4) {
    if (childAge !== undefined) {
      if (childAge <= 4) {
        suggestions.push('Parent & tot swimming');
        suggestions.push('Music & movement classes');
      } else if (childAge <= 7) {
        suggestions.push('Learn to skate programs');
        suggestions.push('Art & crafts classes');
      } else if (childAge <= 12) {
        suggestions.push('Coding & robotics camps');
        suggestions.push('Team sports leagues');
      } else {
        suggestions.push('Teen fitness programs');
        suggestions.push('Leadership & volunteering');
      }
    }
  }

  // Ensure we have at least some suggestions
  if (suggestions.length === 0) {
    suggestions.push('Show me popular activities');
    suggestions.push('What\'s starting soon?');
  }

  // Deduplicate and return max 4
  return [...new Set(suggestions)].slice(0, 4);
}

/**
 * Parse a clarification response to extract the answer
 */
export function parseClarificationResponse(
  response: string,
  originalQuestion: ClarifyingQuestion
): {
  understood: boolean;
  extractedValue?: any;
  originalOption?: string;
} {
  const responseLower = response.toLowerCase().trim();

  // Check if response matches a suggested answer
  for (const answer of originalQuestion.suggestedAnswers) {
    if (responseLower.includes(answer.toLowerCase()) ||
        answer.toLowerCase().includes(responseLower)) {
      return {
        understood: true,
        extractedValue: answer,
        originalOption: answer,
      };
    }
  }

  // Try to extract based on question context
  const context = originalQuestion.context;

  if (context.startsWith('temporal_expression')) {
    // Try to parse as date range
    const dateMatch = response.match(/(\w+\s+\d{1,2})[\s-]+(\d{1,2}|\w+\s+\d{1,2})/);
    if (dateMatch) {
      return {
        understood: true,
        extractedValue: response,
      };
    }
  }

  if (context === 'missing_age') {
    // Try to extract age number
    const ageMatch = response.match(/(\d{1,2})/);
    if (ageMatch) {
      return {
        understood: true,
        extractedValue: parseInt(ageMatch[1], 10),
      };
    }
  }

  if (context === 'missing_location') {
    // Accept any location response
    if (responseLower.length > 2) {
      return {
        understood: true,
        extractedValue: response.trim(),
      };
    }
  }

  if (context === 'multiple_children') {
    // Try to match child name
    return {
      understood: true,
      extractedValue: response.trim(),
    };
  }

  if (context === 'undirected_exploration') {
    // Accept any activity type
    return {
      understood: true,
      extractedValue: response.trim(),
    };
  }

  // Couldn't parse the response
  return {
    understood: responseLower.length > 2, // Accept if it's a reasonable response
    extractedValue: response.trim(),
  };
}

/**
 * Generate a friendly message when using defaults
 */
export function formatDefaultsMessage(defaultsUsed: string[]): string {
  if (defaultsUsed.length === 0) return '';

  const formatted = defaultsUsed.map(d => {
    const [key, value] = d.split(':');
    switch (key) {
      case 'location':
        return `searching in ${value}`;
      case 'age':
        return `for ${value}`;
      default:
        return value;
    }
  });

  return `I'm ${formatted.join(' and ')} based on your profile.`;
}

export default {
  determineClarification,
  generateFollowUpSuggestions,
  parseClarificationResponse,
  formatDefaultsMessage,
};
