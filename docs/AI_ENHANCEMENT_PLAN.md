# AI Output Enhancement Plan

## Overview

Improve the quality of AI outputs across three existing screens by implementing industry-standard techniques for LLM-powered recommendation systems. The screens themselves don't change - only the backend logic that produces results.

---

## Three AI Features & Their Input Priorities

### 1. AI Recommendations Screen
**Purpose**: Proactively suggest best activities for the user's children
**Primary Inputs**: Child profiles + User preferences (location, age ranges, activity types)
**Goal**: "Here are the best activities for YOUR kids based on everything we know about them"

### 2. AI Assistant (Chat) Screen
**Purpose**: Conversational search driven by user's natural language
**Primary Inputs**: User's text message + conversation history
**Secondary Inputs**: Child profiles + User preferences (as context, not primary filter)
**Goal**: "Answer what the user is asking, personalized to their family"

### 3. AI Scheduler Screen
**Purpose**: Generate optimized weekly schedule per child
**Primary Inputs**: Child's current calendar + Child profiles + User preferences
**Goal**: "Fill gaps in the schedule with complementary activities"

---

## Industry Research: Best Practices for LLM-Powered Search

Based on research from [AWS RAG Guide](https://aws.amazon.com/what-is/retrieval-augmented-generation/), [RecSys 2025 Trends](https://www.taboola.com/engineering/recsys-2025-ai-recommendation-trends/), [Amazon Science Query Rewriting](https://www.amazon.science/publications/search-based-self-learning-query-rewrite-system-in-conversational-ai), and [Elastic Hybrid Search](https://www.elastic.co/what-is/hybrid-search):

### 1. Hybrid Search Architecture (Filter-Then-Rank)

The industry standard approach combines:
- **Hard Filters (Keyword/Structured)**: Eliminate impossible results first (location, age, registration status)
- **Semantic Scoring (Dense Vectors)**: Rank remaining results by meaning/intent match
- **Reciprocal Rank Fusion**: Merge multiple ranking signals into final order

```
User Query → Hard Filters → Candidate Pool → Semantic Scoring → Re-ranking → Results
```

**Why this matters**: Pure semantic search returns "relevant but impossible" results (too far away, wrong age). Pure keyword search misses "swimming" when user says "water activities". Hybrid catches both.

### 2. Query Understanding & Rewriting

From [Amazon Science research](https://www.amazon.science/publications/improving-contextual-query-rewrite-for-conversational-ai-agents-through-user-preference-feedback-learning):

- **Contextual Query Rewriting (CQR)**: Transform ambiguous queries into clear, searchable forms
- **Intent Classification**: Categorize query type to route appropriately
- **Entity Extraction**: Pull out key entities (age, location, activity type) for structured filtering

**Example**:
```
User: "spring break stuff for Emma"
→ Rewritten: "activities for age 7 in Vancouver, date range March 10-21"
→ Intent: schedule_search
→ Entities: {child: "Emma", age: 7, dateRange: "spring break"}
```

### 3. When to Ask Clarifying Questions

From [ACM Survey on Conversational Search](https://dl.acm.org/doi/10.1145/3759453):

**DO ask when**:
- Query contains ambiguous entities (which "Emma"? which location?)
- Missing critical information that can't be inferred
- Multiple valid interpretations exist

**DON'T ask when**:
- Information can be inferred from profile
- Low-quality questions that disturb users
- Overwhelming users with multiple questions

**Best Practice**: Maximum 1 clarifying question per turn. Provide suggested answer options. Only ask when commitment to meaning is relevant for the answer.

### 4. Multi-Stage Recommendation Pipeline

From [LFAI LLM Recommender Architecture](https://lfaidata.foundation/communityblog/2025/08/25/leverage-llm-for-next-gen-recommender-systems-technical-deep-dive-into-llm-enhanced-recommender-architectures/):

```
Stage 1: Candidate Generation (1000s → 100s)
  - Hard filters: location, age, registration status
  - Keyword matching: activity type, category

Stage 2: Scoring (100s → 10s)
  - Preference matching: days, times, budget
  - Interest alignment: child interests, favorites
  - Behavioral signals: past activities, skill levels

Stage 3: Re-ranking (10s → final order)
  - Diversity injection: avoid all same category
  - Recency boost: newer activities
  - Business rules: featured activities, sponsor policy
```

### 5. Semantic Search with Embeddings

From [Pinecone RAG Guide](https://www.pinecone.io/learn/retrieval-augmented-generation/):

- Store activity descriptions as vector embeddings
- User query → embedding → cosine similarity with activities
- Captures meaning: "water activities" matches "swimming", "aquatics", "pool"

**Implementation Options**:
- Add vector column to activities table (pgvector)
- Use external vector database (Pinecone, Qdrant)
- Hybrid: structured filters + vector similarity

### 6. Function Calling Best Practices

From [Prompt Engineering Guide](https://www.promptingguide.ai/applications/function_calling) and [Scalifi AI](https://www.scalifiai.com/blog/function-calling-tool-call-best%20practices):

- **Clear Schema**: Define exactly what each tool does and its parameters
- **Limit Context**: Only pass relevant data to avoid token overflow
- **Input Validation**: Sanitize all inputs before database queries
- **Observability**: Log all tool calls for debugging

---

## Input Scoring System (Our Implementation)

### The Problem Today
All inputs are treated equally. A search might return activities 200km away that don't match the child's age because the system doesn't prioritize correctly.

### The Solution: Tiered Input System

#### Tier 1: HARD FILTERS (Must Match - Eliminates Results)
These are non-negotiable. If an activity fails these, it's excluded entirely.

| Input | Why Critical | Default Threshold |
|-------|--------------|-------------------|
| **Location/Distance** | Can't attend if too far | 50km from user location |
| **Age Compatibility** | Can't register if age doesn't fit | Child's age within activity's min-max |
| **Registration Status** | Can't sign up if closed | Open or Waitlist |

#### Tier 2: STRONG PREFERENCES (High Weight in Scoring)
These significantly impact ranking but don't eliminate results.

| Input | Weight | Source |
|-------|--------|--------|
| Activity Type Match | 25 points | User's preferred activity types |
| Day of Week Match | 20 points | User's available days |
| Price Within Budget | 15 points | User's price range preference |
| Child's Interests Match | 15 points | Child profile interests |

#### Tier 3: SOFT PREFERENCES (Lower Weight in Scoring)
Nice-to-have that improve ranking.

| Input | Weight | Source |
|-------|--------|--------|
| Provider Previously Used | 10 points | Activity history |
| Category Diversity | 5 points | Avoid all same type |
| Time of Day Preference | 5 points | Morning/afternoon/evening pref |
| Indoor/Outdoor Preference | 5 points | Environment preference |

#### Tier 4: CONTEXTUAL SIGNALS (Boost/Penalty)
Derived signals that adjust scores.

| Signal | Adjustment | Logic |
|--------|------------|-------|
| Skill Level Match | +10 / -10 | Match child's skill progress |
| Spots Available | +5 if many, -5 if few | Availability urgency |
| Distance (within threshold) | -1 per 5km | Closer is better |
| Favorited Provider | +10 | User has favorites from this provider or favorites the type of activity|

---

## Conversation Override System

When a user explicitly mentions something in chat, it should override default weights.

### Override Detection Examples

| User Says | Override Action |
|-----------|-----------------|
| "I don't mind driving" | Expand distance to 100km+ |
| "budget isn't an issue" | Remove price filter |
| "only on weekends" | Hard filter to Sat/Sun only |
| "beginner level" | Filter to beginner activities |
| "something different" | Penalize categories child has done before |
| "near [city]" | Override location to that city |
| "for my 5 year old" | Override age to 5 (even if profile says 6) |

### Implementation: Extract & Apply Overrides

```typescript
interface ConversationOverrides {
  // Hard filter overrides
  locationOverride?: { city?: string; maxDistanceKm?: number };
  ageOverride?: number;
  daysOverride?: string[];

  // Weight overrides
  ignoreBudget?: boolean;
  preferNewCategories?: boolean;
  skillLevelRequired?: 'beginner' | 'intermediate' | 'advanced';

  // Explicit requirements from user's words
  explicitRequirements: string[]; // ["weekend", "outdoor", "team sport"]
}
```

---

## Enhanced Architecture

### Current Flow (Simple)
```
User Query → LLM Tool Call → Database Query → Return Results
```

### Proposed Flow (Industry Standard)
```
User Query
    ↓
┌─────────────────────────────────────────────┐
│ STAGE 1: Query Understanding                │
│  - Intent classification                    │
│  - Entity extraction (age, location, type)  │
│  - Temporal expression resolution           │
│  - Query rewriting for clarity              │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ STAGE 2: Need Clarification?                │
│  - Missing critical info?                   │
│  - Ambiguous entities?                      │
│  - Multiple valid interpretations?          │
│  → If yes: Return clarifying question       │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ STAGE 3: Candidate Generation (Hard Filter) │
│  - Location within threshold                │
│  - Age compatible                           │
│  - Registration open                        │
│  - Explicit user requirements               │
│  Result: ~100-500 candidates                │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ STAGE 4: Scoring & Ranking                  │
│  - Apply tier weights                       │
│  - Profile preference matching              │
│  - Behavioral signal boosts                 │
│  - Conversation override adjustments        │
│  Result: Scored candidates                  │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ STAGE 5: Re-ranking & Diversity             │
│  - Ensure category diversity                │
│  - Apply business rules (featured, etc)     │
│  - Final top-N selection                    │
│  Result: 10-15 best activities              │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ STAGE 6: Response Generation                │
│  - LLM generates explanations               │
│  - "Why" reasons for each activity          │
│  - Personalized to child/family             │
└─────────────────────────────────────────────┘
    ↓
Final Results with Explanations
```

---

## Query Understanding Layer (NEW)

### Intent Classification

| Intent | Example Query | Handling |
|--------|---------------|----------|
| `activity_search` | "swimming lessons" | Search with type filter |
| `schedule_planning` | "spring break activities" | Resolve dates, then search |
| `comparison` | "which is better for..." | Fetch both, compare |
| `specific_query` | "is X activity good for Y?" | Fetch specific activity |
| `exploration` | "what's available?" | Broad search with diversity |

### Entity Extraction

```typescript
interface ExtractedEntities {
  // From user's message
  activityTypes?: string[];      // ["skating", "hockey"]
  ageExplicit?: number;          // 5 (from "5 year old")
  locationExplicit?: string;     // "North Vancouver"
  daysExplicit?: string[];       // ["Saturday", "Sunday"]
  budgetExplicit?: number;       // 100 (from "under $100")

  // Temporal expressions
  temporalExpression?: string;   // "spring break"
  resolvedDateRange?: {
    start: Date;
    end: Date;
    needsConfirmation: boolean;
  };

  // Derived from profile (fallback)
  childFromProfile?: Child;
  locationFromProfile?: Location;
}
```

### Temporal Expression Resolution

| Expression | Resolution Strategy |
|------------|---------------------|
| "this weekend" | Calculate from current date |
| "next week" | Calculate from current date |
| "spring break" | Ask user OR use regional default |
| "summer" | June 15 - August 31 |
| "after school" | Filter for 3pm-6pm activities |
| "March break" | Regional default (varies by province) |

---

## Semantic Search Enhancement (FUTURE)

### Option A: Add Vector Embeddings to Activities

```sql
-- Add vector column to activities
ALTER TABLE activities ADD COLUMN description_embedding vector(1536);

-- Query with hybrid approach
SELECT * FROM activities
WHERE
  -- Hard filters first
  ST_DWithin(location, user_location, 50000) AND
  age_min <= 5 AND age_max >= 5 AND
  registration_status IN ('Open', 'Waitlist')
ORDER BY
  -- Semantic similarity + structured scoring
  (description_embedding <=> query_embedding) * 0.3 +
  structured_score * 0.7
LIMIT 20;
```

### Option B: Two-Phase Retrieval

```typescript
// Phase 1: Hard filter to candidates
const candidates = await db.activities.findMany({
  where: {
    // Hard filters
    distance: { lte: 50 },
    ageMin: { lte: childAge },
    ageMax: { gte: childAge },
  },
  take: 500, // Get more candidates
});

// Phase 2: Semantic re-rank
const queryEmbedding = await embedQuery(userQuery);
const scoredCandidates = candidates.map(activity => ({
  ...activity,
  semanticScore: cosineSimilarity(queryEmbedding, activity.embedding),
  structuredScore: calculateStructuredScore(activity, preferences),
  finalScore: semanticScore * 0.3 + structuredScore * 0.7,
}));

return scoredCandidates.sort((a, b) => b.finalScore - a.finalScore).slice(0, 15);
```

---

## Per-Screen Implementation

### AI Recommendations: Profile-Driven Scoring

```typescript
function scoreForRecommendations(
  activity: Activity,
  children: Child[],
  preferences: UserPreferences
): number {
  let score = 0;

  // HARD FILTERS - return -1 to exclude
  if (!isWithinDistance(activity, preferences.location, 50)) return -1;
  if (!isAgeCompatible(activity, children)) return -1;
  if (activity.registrationStatus === 'Closed') return -1;

  // STRONG PREFERENCES
  if (matchesPreferredTypes(activity, preferences.preferredActivityTypes)) {
    score += 25;
  }
  if (matchesAvailableDays(activity, preferences.daysOfWeek)) {
    score += 20;
  }
  if (isWithinBudget(activity, preferences.priceRange)) {
    score += 15;
  }
  if (matchesChildInterests(activity, children)) {
    score += 15;
  }

  // SOFT PREFERENCES
  score += getProviderFamiliarityBonus(activity, children); // 0-10
  score += getDiversityBonus(activity, recentRecommendations); // 0-5
  score += getTimePreferenceBonus(activity, preferences.timePreferences); // 0-5

  // CONTEXTUAL
  score += getSkillLevelBonus(activity, children); // -10 to +10
  score += getAvailabilityBonus(activity); // -5 to +5
  score -= getDistancePenalty(activity, preferences.location); // 0 to -10

  return score;
}
```

### AI Assistant: Conversation-Driven with Profile Context

```typescript
async function processChat(
  message: string,
  history: Message[],
  familyContext: FamilyContext
): Promise<ChatResponse> {

  // STAGE 1: Query Understanding
  const understanding = await analyzeQuery(message, history);

  // STAGE 2: Check if clarification needed
  if (understanding.needsClarification) {
    return {
      text: understanding.clarifyingQuestion,
      activities: [],
      awaitingClarification: true,
    };
  }

  // STAGE 3: Build search parameters
  const searchParams = buildSearchParams(
    understanding.entities,
    understanding.overrides,
    familyContext
  );

  // STAGE 4: Execute search with scoring
  const results = await searchWithScoring(searchParams, {
    // Chat uses conversation-driven weights
    explicitRequirementWeight: 30,  // What user asked for
    profilePreferenceWeight: 10,    // Secondary to explicit
  });

  // STAGE 5: Generate response
  return generateChatResponse(message, results, familyContext);
}

function scoreForChat(
  activity: Activity,
  overrides: ConversationOverrides,
  familyContext: FamilyContext
): number {
  let score = 0;

  // HARD FILTERS - with override support
  const maxDistance = overrides.locationOverride?.maxDistanceKm || 50;
  if (!isWithinDistance(activity, familyContext.location, maxDistance)) return -1;

  const targetAge = overrides.ageOverride || familyContext.children[0]?.age;
  if (targetAge && !isAgeCompatible(activity, targetAge)) return -1;

  // CONVERSATION-DRIVEN SCORING (highest priority)
  for (const requirement of overrides.explicitRequirements) {
    if (activityMatches(activity, requirement)) {
      score += 30; // User explicitly asked for this
    }
  }

  // PROFILE-BASED SCORING (secondary)
  if (matchesChildInterests(activity, familyContext.children)) {
    score += 10;
  }

  return score;
}
```

### AI Scheduler: Calendar-Aware Scoring

```typescript
function scoreForScheduler(
  activity: Activity,
  child: Child,
  existingCalendar: CalendarActivity[],
  preferences: UserPreferences
): number {
  let score = 0;

  // HARD FILTERS
  if (!isWithinDistance(activity, preferences.location, 50)) return -1;
  if (!isAgeCompatible(activity, child.age)) return -1;
  if (hasTimeConflict(activity, existingCalendar)) return -1;

  // SCHEDULE-SPECIFIC SCORING

  // Prefer activities that fill gaps
  if (hasBufferTime(activity, existingCalendar, 60)) {
    score += 20;
  }

  // Balance across the week
  const dayLoad = getDayActivityCount(activity.dayOfWeek, existingCalendar);
  if (dayLoad === 0) score += 15;
  if (dayLoad >= 2) score -= 10;

  // Category diversity across the week
  const existingCategories = existingCalendar.map(a => a.category);
  if (!existingCategories.includes(activity.category)) {
    score += 15;
  }

  // Skill progression
  if (matchesSkillLevel(activity, child.skillProgress)) {
    score += 10;
  }

  return score;
}
```

---

## Clarifying Questions Strategy

### When to Ask (Decision Tree)

```
Is location available?
├── Yes → Continue
└── No → Can infer from profile?
    ├── Yes → Use profile location
    └── No → ASK: "Which city are you looking in?"

Is age available?
├── Yes → Continue
└── No → Are children in profile?
    ├── Yes → Use first child's age
    └── No → ASK: "What age is your child?"

Is temporal expression ambiguous?
├── No → Continue
└── Yes (e.g., "spring break") → ASK: "When is your spring break?"

Is activity type specified?
├── Yes → Continue
└── No → Is this a general exploration?
    ├── Yes → Return diverse results
    └── No → ASK: "What type of activity are you looking for?"
```

### Question Format Best Practices

```typescript
interface ClarifyingQuestion {
  question: string;
  suggestedAnswers: string[];  // Quick reply options
  allowFreeform: boolean;
  priority: 'required' | 'helpful';
}

// Example
{
  question: "When is your spring break?",
  suggestedAnswers: [
    "March 10-14",
    "March 17-21",
    "March 24-28"
  ],
  allowFreeform: true,
  priority: 'required'
}
```

### Rules
- Maximum 1 question per turn
- Provide 2-4 suggested answers
- Always allow freeform input
- Only ask for truly required information

---

## Scoring Weight Summary

| Input | Recommendations | Chat | Scheduler |
|-------|-----------------|------|-----------|
| Location (hard) | 50km max | Override-able | 50km max |
| Age (hard) | Must match | Override-able | Must match |
| User's explicit words | N/A | **+30** | N/A |
| Activity type pref | +25 | +10 (secondary) | +10 |
| Day of week match | +20 | Hard if explicit | +15 (gap filling) |
| Budget match | +15 | +10 (unless override) | +10 |
| Child interests | +15 | +10 | +10 |
| Skill level match | +10 | +10 | +10 |
| Category diversity | +5 | +5 | **+15** (important) |
| Distance (closer) | -1 per 5km | -1 per 5km | -1 per 5km |

---

## Files to Modify

### New Files
1. **`server/src/ai/utils/activityScorer.ts`** - Tiered scoring logic
2. **`server/src/ai/utils/queryUnderstanding.ts`** - Intent, entity extraction
3. **`server/src/ai/utils/temporalResolver.ts`** - Date expression handling
4. **`server/src/ai/utils/clarificationEngine.ts`** - When/what to ask
5. **`server/src/ai/utils/conversationOverrides.ts`** - Extract overrides from chat

### Modified Files
1. **`server/src/ai/tools/activityTools.ts`** - Use scoring after search
2. **`server/src/ai/utils/contextBuilder.ts`** - Include more profile data
3. **`server/src/ai/agents/activityAssistantAgent.ts`** - Add query understanding stage
4. **`server/src/ai/orchestrator/aiOrchestrator.ts`** - Apply scoring for recommendations
5. **`server/src/ai/chains/topicGuardChain.ts`** - Enhanced entity extraction

### No Frontend Changes
The screens stay the same - only the quality of results improves.

---

## Example: Before vs After

### Before
```
User: "plan my kids activities during spring break"
System: Returns random activities OR zero results
- No date filtering
- Doesn't know when spring break is
- Returns activities too far away
```

### After
```
User: "plan my kids activities during spring break"

Stage 1 - Query Understanding:
  Intent: schedule_planning
  Temporal: "spring break" → needs clarification

Stage 2 - Clarification:
  "When is your spring break? (March 10-14, March 17-21, other)"

User: "March 10-14"

Stage 3 - Search with filters:
  - Location: Vancouver (from profile)
  - Age: 7 (Emma from profile)
  - Date range: March 10-14
  - Registration: Open

Stage 4 - Score & rank:
  - +25 for matching preferred activity types
  - +15 for matching Emma's interests
  - -distance penalty for further locations

Result: 12 activities during March 10-14, within 50km,
        for age 7, ranked by preference match
```

### Chat Override Example
```
User: "skating for my 5 year old, I don't mind driving far"

Query Understanding:
  - Activity type: "skating"
  - Age override: 5
  - Distance override: expand to 150km

Search:
  - Hard filter: age 5 compatible
  - Hard filter: 150km radius (overridden from default 50km)
  - Keyword: "skating", "skate"

Score & rank:
  - +30 for explicit "skating" match
  - -distance penalty (but more lenient)

Result: More skating options across wider area
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Results with wrong age range | ~20% | 0% |
| Results too far away | ~15% | 0% |
| Top 5 relevance score | Unknown | 80%+ match user intent |
| Zero-result queries | ~10% | <3% |
| Clarification rate (when needed) | 0% | 15-20% |

---

## Implementation Priority

1. **Week 1**: Create `activityScorer.ts` with tiered scoring system
2. **Week 2**: Add query understanding layer (intent + entity extraction)
3. **Week 3**: Implement conversation override detection
4. **Week 4**: Add clarification engine for ambiguous queries
5. **Week 5**: Add temporal expression resolver
6. **Week 6**: Tune weights based on user feedback
7. **Future**: Semantic embeddings for better matching

---

## References

- [AWS - What is RAG?](https://aws.amazon.com/what-is/retrieval-augmented-generation/)
- [RecSys 2025 - LLM Recommendation Trends](https://www.taboola.com/engineering/recsys-2025-ai-recommendation-trends/)
- [Eugene Yan - Improving RecSys with LLMs](https://eugeneyan.com/writing/recsys-llm/)
- [Elastic - Hybrid Search Guide](https://www.elastic.co/what-is/hybrid-search)
- [Amazon Science - Query Rewriting](https://www.amazon.science/publications/search-based-self-learning-query-rewrite-system-in-conversational-ai)
- [ACM - Survey of Conversational Search](https://dl.acm.org/doi/10.1145/3759453)
- [Prompt Engineering Guide - Function Calling](https://www.promptingguide.ai/applications/function_calling)
- [Pinecone - RAG Guide](https://www.pinecone.io/learn/retrieval-augmented-generation/)
- [LFAI - LLM Recommender Architectures](https://lfaidata.foundation/communityblog/2025/08/25/leverage-llm-for-next-gen-recommender-systems-technical-deep-dive-into-llm-enhanced-recommender-architectures/)
