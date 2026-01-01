# AI Chat Feature Plan - Kids Activity Tracker

## Executive Summary

Transform the current single-query AI recommendations screen into a conversational AI assistant focused exclusively on helping parents find activities for their children. This plan addresses abuse prevention, cost management, UX best practices, and monetization strategy.

**Key Constraints:**
- $5.99/month subscription price
- Must remain profitable (AI costs < ~$2/user/month target)
- Must prevent off-topic abuse
- Must feel valuable and engaging

**Current Stack:** OpenAI API (gpt-4o-mini, gpt-4o)

---

## Part 1: Cost Analysis & Budget Strategy

### OpenAI Pricing (2025)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Best For |
|-------|----------------------|------------------------|----------|
| **gpt-4o-mini** | $0.15 | $0.60 | Classification, simple queries, most tasks |
| **gpt-4o** | $2.50 | $10.00 | Complex reasoning, multi-child planning |

Source: [OpenAI Pricing](https://openai.com/api/pricing/)

### Cost Per Query Estimate

Assuming average query:
- **Input**: ~2,000 tokens (system prompt + context + user query)
- **Output**: ~500 tokens (response)

| Model | Cost per Query | Monthly Budget ($2) Allows |
|-------|---------------|---------------------------|
| **gpt-4o-mini** | **~$0.0006** | **~3,300 queries/user/month** |
| gpt-4o | ~$0.01 | ~200 queries/user/month |

**Key Insight:** GPT-4o-mini is incredibly cheap - we can offer generous limits!

### Recommended Strategy: GPT-4o-mini First

```
┌─────────────────────────────────────────────────────────┐
│  Request Type          │  Model        │  Est. Cost    │
├─────────────────────────────────────────────────────────┤
│  Topic classification  │  gpt-4o-mini  │  $0.0003      │
│  Simple queries        │  gpt-4o-mini  │  $0.0006      │
│  Follow-up questions   │  gpt-4o-mini  │  $0.0004      │
│  Complex multi-child   │  gpt-4o       │  $0.01        │
└─────────────────────────────────────────────────────────┘
```

**Strategy:** Use gpt-4o-mini for 95%+ of requests. Only escalate to gpt-4o for:
- Multi-child schedule optimization
- Complex comparison requests
- When gpt-4o-mini response quality is poor

### Usage Limits by Tier

| Tier | AI Queries/Day | AI Queries/Month | Conversation Turns |
|------|---------------|------------------|-------------------|
| **Free** | 3 | 30 | 1 (single query) |
| **Pro ($5.99)** | 30 | Unlimited* | 10 per conversation |

*Fair use policy: 1,000 queries/month cap (still only ~$0.60 cost!)

### Monthly Cost Projection

| User Type | Queries/Month | Model Mix | Est. Cost |
|-----------|--------------|-----------|-----------|
| Light Pro user | 50 | 100% mini | $0.03 |
| Average Pro user | 150 | 95% mini, 5% 4o | $0.14 |
| Heavy Pro user | 500 | 90% mini, 10% 4o | $0.77 |
| Power user (cap) | 1,000 | 85% mini, 15% 4o | $2.01 |

**Conclusion:** Even heavy users cost < $1/month. Very profitable at $5.99!

---

## Part 2: Guardrails & Abuse Prevention

### The Problem
Users may try to use the AI assistant for:
- General questions unrelated to activities ("What's the weather?")
- Homework help ("Explain photosynthesis")
- Conversations ("Tell me a joke")
- Competitor research ("List all swim schools in Vancouver")

### Solution: Multi-Layer Guardrails

#### Layer 1: Topic Classification (Pre-Send)
Use gpt-4o-mini to classify every input before processing (~$0.0003/classification):

```typescript
const TOPIC_CLASSIFIER_PROMPT = `
You are a topic classifier for a kids activity finder app.
Classify the user's message into one of these categories:

ALLOWED:
- activity_search: Looking for activities (sports, arts, camps, etc.)
- activity_question: Questions about a specific activity
- recommendation_request: Asking for suggestions
- schedule_help: Help planning activities
- age_appropriate: Questions about age suitability
- cost_question: Questions about pricing/affordability

BLOCKED:
- off_topic: Unrelated to kids activities
- homework: Academic questions
- general_chat: Casual conversation
- competitor_info: Bulk data extraction requests

Return JSON: { "category": "...", "confidence": 0.0-1.0 }
`;
```

#### Layer 2: System Prompt Restrictions
Hardcode the AI's role and limitations:

```typescript
const SYSTEM_PROMPT = `
You are an AI assistant for KidsActivityTracker, helping parents find
activities for their children.

STRICT RULES:
1. ONLY discuss kids activities, classes, camps, and related topics
2. NEVER answer questions unrelated to finding activities for children
3. NEVER provide homework help, general knowledge, or casual chat
4. If asked off-topic questions, politely redirect:
   "I'm here to help you find great activities for your kids!
    Try asking me things like 'Find swimming lessons for my 5-year-old'
    or 'What art classes are available on weekends?'"
5. Always base recommendations on activities in our database
6. Never make up activities that don't exist

You have access to activities in: [CITY_LIST]
For children ages: 0-18 years
Activity types: Sports, Arts, Music, Dance, STEM, Camps, etc.
`;
```

#### Layer 3: Output Validation
Validate responses before sending to user:

```typescript
interface OutputValidation {
  containsActivityRecommendations: boolean;
  mentionsRealActivities: boolean;
  isOnTopic: boolean;
  wordCount: number;
}

// Reject responses that don't mention activities or seem off-topic
```

#### Layer 4: Rate Limiting
- Per-user daily limits (enforced server-side)
- Cooldown after rapid requests (30 second minimum between queries)
- Block users who repeatedly attempt off-topic queries

### Blocked Response Template

```
"I'm your activity finder assistant! I can help you with:

✓ Finding activities for your kids
✓ Recommendations based on age and interests
✓ Questions about schedules, costs, and locations
✓ Comparing different activity options

What activities are you looking for today?"
```

---

## Part 3: UI/UX Design

### Design Philosophy
Based on research from [NN/Group](https://www.nngroup.com/articles/prompt-controls-genai/) and [Sendbird](https://sendbird.com/blog/chatbot-ui):

1. **Guided Experience** - Don't leave users with blank input
2. **Suggested Prompts** - Reduce typing, increase engagement
3. **Clear Limitations** - Set expectations upfront
4. **Quick Actions** - One-tap common requests

### Screen Layout

```
┌──────────────────────────────────────────────┐
│  ← Back              AI Activity Finder   ⚙️  │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  🤖 Hi! I'm your activity assistant.  │  │
│  │  I can help you find perfect          │  │
│  │  activities for your kids!            │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ═══════════ Try asking about ═══════════   │
│                                              │
│  ┌──────────────┐  ┌──────────────────────┐  │
│  │ 🏊 Swimming  │  │ 🎨 Art classes      │  │
│  │   lessons    │  │    near me          │  │
│  └──────────────┘  └──────────────────────┘  │
│                                              │
│  ┌──────────────┐  ┌──────────────────────┐  │
│  │ ⚽ Weekend   │  │ 🏕️ Summer camps     │  │
│  │   sports    │  │    for [Child]       │  │
│  └──────────────┘  └──────────────────────┘  │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ 🎯 Activities for 5-year-olds       │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ════════════════════════════════════════   │
│                                              │
│  [ 🔍 Ask about activities...          📤 ]  │
│                                              │
│  💡 3 questions remaining today (Free)      │
│     Upgrade for unlimited AI searches →     │
│                                              │
└──────────────────────────────────────────────┘
```

### Suggested Prompts (Canned Responses)

Dynamic based on user's children and preferences:

```typescript
const SUGGESTED_PROMPTS = [
  // Personalized (if children exist)
  `Activities for ${childName} (age ${childAge})`,
  `Weekend activities near ${userCity}`,

  // Generic popular
  "Swimming lessons for beginners",
  "Art classes for toddlers",
  "Sports programs under $100/month",
  "Summer camps with early drop-off",
  "Music lessons for kids",
  "STEM activities for teens",

  // Seasonal
  "March break camps",
  "Summer programs with spots available",

  // Specific needs
  "Activities with sibling discounts",
  "Drop-in classes (no commitment)",
  "Indoor activities for rainy days",
];
```

### Follow-Up Suggestions

After each AI response, show 2-3 related prompts:

```typescript
const FOLLOW_UP_PROMPTS = {
  after_search: [
    "Show me more options",
    "Find cheaper alternatives",
    "What about weekends only?",
  ],
  after_recommendation: [
    "Tell me more about this one",
    "Any similar activities nearby?",
    "Is this good for beginners?",
  ],
  after_comparison: [
    "Which one do you recommend?",
    "Show me schedules",
    "What's the registration process?",
  ],
};
```

### Conversation Flow

```
User taps suggested prompt: "Swimming lessons for beginners"
         ↓
AI Response: "I found 8 swimming lessons for beginners near you!
             Here are the top 3 based on reviews and availability..."
             [Activity Card 1]
             [Activity Card 2]
             [Activity Card 3]
         ↓
Follow-up buttons appear:
  [Show all 8] [Different times] [Compare prices]
         ↓
User: "Compare prices"
         ↓
AI: "Here's a price comparison..."
         ↓
[Continue for up to 5 turns, then prompt to start new search]
```

---

## Part 4: Multi-Turn Conversations

### Conversation State Management

```typescript
interface ConversationState {
  id: string;
  userId: string;
  turns: ConversationTurn[];
  context: {
    lastSearchFilters: SearchFilters;
    mentionedActivities: string[];
    childContext: ChildInfo[];
  };
  createdAt: Date;
  expiresAt: Date; // 30 min inactivity timeout
}

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokensUsed?: number;
}
```

### Turn Limits

| Tier | Max Turns per Conversation | Reasoning |
|------|---------------------------|-----------|
| Free | 1 | Single query only |
| Pro | 5 | Enough for refinement without abuse |

After 5 turns:
```
"We've covered a lot! To keep our search focused,
let's start fresh. What else can I help you find?"
[Start New Search]
```

### Context Compression

To reduce token costs, compress conversation history:

```typescript
// Instead of full history, send compressed context
const compressedContext = {
  originalQuery: "swimming lessons",
  refinements: ["beginner level", "saturday mornings", "under $200"],
  shownActivities: ["act_123", "act_456"],
  userPreferences: { ageRange: [5, 7], location: "Vancouver" }
};
```

---

## Part 5: Backend Implementation

### New API Endpoints

```typescript
// Start or continue conversation
POST /api/ai/chat
{
  "message": "Find swimming lessons",
  "conversationId": null | "conv_xxx", // null = new conversation
}

// Response
{
  "conversationId": "conv_xxx",
  "response": {
    "text": "I found 8 swimming lessons...",
    "activities": [...],
    "followUpPrompts": ["Show more", "Filter by price"]
  },
  "turnsRemaining": 4,
  "quotaRemaining": 17 // daily queries left
}

// Get conversation history
GET /api/ai/chat/:conversationId

// Get user's AI quota
GET /api/ai/quota
{
  "daily": { "used": 3, "limit": 20 },
  "monthly": { "used": 45, "limit": 500 }
}
```

### Topic Classification Service

```typescript
// server/src/ai/services/topicClassifier.ts
export class TopicClassifier {
  private model = getSmallModel(); // gpt-4o-mini - extremely cheap

  async classify(message: string): Promise<TopicClassification> {
    const result = await this.model.invoke([
      { role: 'system', content: CLASSIFIER_PROMPT },
      { role: 'user', content: message }
    ]);

    return JSON.parse(result.content);
  }

  isAllowed(classification: TopicClassification): boolean {
    const allowedCategories = [
      'activity_search',
      'activity_question',
      'recommendation_request',
      'schedule_help',
      'age_appropriate',
      'cost_question'
    ];
    return allowedCategories.includes(classification.category)
           && classification.confidence > 0.7;
  }
}
```

### Quota Service

```typescript
// server/src/ai/services/quotaService.ts
export class AIQuotaService {
  async checkQuota(userId: string): Promise<QuotaStatus> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true }
    });

    const isPro = user?.subscription?.status === 'active';
    const limits = isPro
      ? { daily: 20, monthly: 500 }
      : { daily: 3, monthly: 30 };

    const usage = await this.getUsage(userId);

    return {
      allowed: usage.daily < limits.daily && usage.monthly < limits.monthly,
      daily: { used: usage.daily, limit: limits.daily },
      monthly: { used: usage.monthly, limit: limits.monthly },
      isPro
    };
  }

  async recordUsage(userId: string, tokens: number): Promise<void> {
    await prisma.aiUsage.create({
      data: { userId, tokens, timestamp: new Date() }
    });
  }
}
```

---

## Part 6: Database Schema Changes

```prisma
model AIConversation {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  turns         AITurn[]
  context       Json     // Compressed conversation context
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  expiresAt     DateTime

  @@index([userId, createdAt])
}

model AITurn {
  id             String         @id @default(uuid())
  conversationId String
  conversation   AIConversation @relation(fields: [conversationId], references: [id])
  role           String         // 'user' | 'assistant'
  content        String
  tokensUsed     Int?
  modelUsed      String?
  createdAt      DateTime       @default(now())

  @@index([conversationId])
}

model AIUsage {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  tokens    Int
  cost      Float?   // Calculated cost in USD
  modelUsed String?
  timestamp DateTime @default(now())

  @@index([userId, timestamp])
}
```

---

## Part 7: Implementation Phases

### Phase 1: Guardrails & Limits ✅ COMPLETE
- [x] Implement TopicClassifier node with gpt-4o-mini
- [x] Add quota tracking to database (AIUsage model)
- [x] Create AIQuotaService
- [x] Add rate limiting middleware
- [x] Update system prompts with restrictions

### Phase 2: Enhanced Child Context ✅ COMPLETE
- [x] Extend ChildProfile type with favorites, calendar, computedPreferences
- [x] Implement childContextLoaderNode
- [x] Update contextBuilder.ts with loadChildrenWithHistory
- [x] Add child name/age extraction to topic classifier
- [x] Implement computePreferences function for preference analysis
- [x] **NEW: Virtual child profiles** - Creates temporary profile when age mentioned but no children registered
- [x] **NEW: City extraction** - Extracts city/location from messages (e.g., "in Vancouver", "near Burnaby")
- [x] **NEW: Activity type extraction** - Extracts activity keywords (e.g., "skating", "swimming")

### Phase 3: Chat Graph & Conversation Management ✅ COMPLETE
- [x] Create chatGraph.ts with new node flow
- [x] Implement conversationManagerNode
- [x] Add AIConversation and AITurn models to Prisma schema
- [x] Build /api/ai/chat endpoint
- [x] Implement context compression for long conversations
- [x] Add turn limits (5 per conversation for Pro)
- [x] **NEW: ConversationParameters storage** - Remembers extracted age, city, activity type, and last search filters across turns
- [x] **NEW: Follow-up detection** - Recognizes "search again", "find more", "show similar" and reuses previous parameters
- [x] **NEW: Location fallback** - Defaults to Vancouver coordinates when location unavailable

### Phase 4: Response Formatting & Follow-ups ✅ COMPLETE
- [x] Implement responseFormatterNode
- [x] Generate dynamic follow-up prompts based on response
- [x] Format activities with matched child names
- [x] Create child selection API (specific/all/auto modes)
- [x] **NEW: Distance-based filtering** - Results within 100km sorted by proximity
- [x] **NEW: Smart location extraction** - Extracts location from activity description, provider name, or database fields

### Phase 5: UI Implementation ✅ COMPLETE
- [x] Redesign AIRecommendationsScreen as AIChatScreen
- [x] Add suggested prompts component
- [x] Build chat message bubbles
- [x] Implement follow-up suggestions (tappable pills)
- [x] Add quota display with upgrade prompt
- [x] Child selector UI (filter by child)
- [x] Loading states and error handling
- [x] **NEW: Activity mini-cards** - Display Name, Location, Dates, Spots, Cost, Distance

### Phase 6: Polish & Paywall Integration ✅ COMPLETE
- [x] Connect to subscription system for quota enforcement
- [x] Add upgrade prompts when quota exceeded
- [x] Analytics tracking (queries, conversions, blocked topics)
- [ ] A/B test prompt suggestions
- [ ] Performance optimization (caching, prefetch)

---

## Part 7.5: Context-Aware Conversation System (January 2026)

### Overview
The AI assistant now maintains conversation context across multiple turns, enabling more natural follow-up queries without requiring users to repeat information.

### ConversationParameters Interface
```typescript
interface ConversationParameters {
  extractedAge?: number;           // Age mentioned in conversation
  extractedCity?: string;          // City/location mentioned
  extractedActivityType?: string;  // "skating", "swimming", etc.
  lastSearchFilters?: {            // Filters from most recent search
    searchTerm?: string;
    minAge?: number;
    maxAge?: number;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
}
```

### Context Priority System
The AI uses this priority order when determining search parameters:

| Priority | Source | Example |
|----------|--------|---------|
| 1 (Highest) | Current message | User says "for my 5 year old" now |
| 2 | Conversation Parameters | Age mentioned earlier in conversation |
| 3 (Lowest) | Family Context | Default from user's database profile |

### Key Features

#### 1. Virtual Child Profiles
When a user mentions an age but hasn't registered children:
```
User: "skating for my 3-year-old"
System: Creates virtual child profile { name: "Your child", age: 3 }
Result: AI can search with age filters even without registration
```

#### 2. Follow-Up Detection
The topic guard chain detects follow-up phrases:
- "search again", "find more", "show me more"
- "what about...", "any other...", "similar to..."
- "try again", "different options"

When detected, previous search parameters are automatically reused.

#### 3. Smart Extraction
Each message is analyzed to extract:
- **Age**: "5 year old", "my 8yo", "3-year-old"
- **City**: "in Vancouver", "near Burnaby", "North Van"
- **Activity Type**: "skating", "swimming lessons", "hockey"

#### 4. Location Fallback Chain
```
Priority 1: City extracted from current message
Priority 2: City from conversation parameters
Priority 3: Location from family context (database)
Priority 4: Default to Vancouver (lat: 49.2827, lng: -123.1207)
```

#### 5. Distance-Based Filtering
- All search results filtered to within 100km
- Results sorted by distance (closest first)
- Uses Haversine formula for accurate distance calculation

### Example Conversation Flow

```
Turn 1:
  User: "skating for my 3-year-old near me"
  System: Extracts age=3, activityType="skating"
  AI: Searches with minAge=3, maxAge=3, searchTerm="skating", coordinates from profile
  Stored: { extractedAge: 3, extractedActivityType: "skating", lastSearchFilters: {...} }

Turn 2:
  User: "search again"
  System: Detects follow-up, loads lastSearchFilters
  AI: Reuses all previous parameters
  Result: Fresh search with same age=3, "skating", same location

Turn 3:
  User: "what about swimming?"
  System: Extracts new activityType="swimming", keeps age=3
  AI: Searches with minAge=3, maxAge=3, searchTerm="swimming"
  Result: Swimming activities for 3-year-old
```

### Files Modified
| File | Changes |
|------|---------|
| `server/src/ai/agents/activityAssistantAgent.ts` | ConversationParameters, formatConversationParams(), location fallback |
| `server/src/ai/routes/chat.ts` | Virtual child creation, parameter extraction and passing |
| `server/src/ai/chains/topicGuardChain.ts` | City, activity type, and follow-up detection |
| `server/src/ai/tools/activityTools.ts` | Distance calculation, location extraction |

---

## Part 8: Success Metrics

### Cost Metrics
- Average cost per user per month: Target < $0.50 (very achievable with gpt-4o-mini!)
- % of queries using gpt-4o-mini: Target > 95%
- Cache hit rate: Target > 30%

### Engagement Metrics
- AI feature usage rate (Pro users)
- Average conversation length
- Suggested prompt tap rate
- Conversion from AI to activity view

### Quality Metrics
- Off-topic rejection rate
- User satisfaction (thumbs up/down)
- Activity booking rate from AI recommendations

---

## Part 9: LangChain Agent Architecture & Child Context

### Why LangChain over LangGraph

LangChain provides a more flexible architecture for conversational AI:
- **Tools-based approach**: Agent can dynamically choose which tools to use
- **Built-in memory**: ConversationBufferMemory, ConversationSummaryMemory
- **Chains**: Composable processing pipelines
- **Output parsers**: Structured response formatting
- **Callbacks**: Easy logging, monitoring, and streaming

### Current Architecture (to be migrated)

The existing system uses LangGraph. We'll migrate to LangChain's Agent pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                 LANGCHAIN AGENT ARCHITECTURE                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   User Query                                                 │
│       ↓                                                      │
│   ┌──────────────────┐                                      │
│   │ TopicGuardChain  │ → Block off-topic → BLOCKED_RESPONSE │
│   └────────┬─────────┘                                      │
│            ↓ (allowed)                                       │
│   ┌──────────────────────────────────────────────────┐      │
│   │           ActivityAssistantAgent                  │      │
│   │  ┌─────────────────────────────────────────────┐ │      │
│   │  │              TOOLS                          │ │      │
│   │  │  • search_activities                        │ │      │
│   │  │  • get_child_context                        │ │      │
│   │  │  • get_activity_details                     │ │      │
│   │  │  • compare_activities                       │ │      │
│   │  │  • get_favorites                            │ │      │
│   │  │  • get_calendar                             │ │      │
│   │  └─────────────────────────────────────────────┘ │      │
│   │  ┌─────────────────────────────────────────────┐ │      │
│   │  │       ConversationSummaryMemory             │ │      │
│   │  │  (maintains context across turns)           │ │      │
│   │  └─────────────────────────────────────────────┘ │      │
│   └──────────────────────────────────────────────────┘      │
│            ↓                                                 │
│   ┌──────────────────┐                                      │
│   │ ResponseFormatter │ → Chat response + follow-ups        │
│   └──────────────────┘                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Existing Types to Extend

From `server/src/ai/types/ai.types.ts`:

```typescript
// Current ChildProfile (limited)
interface ChildProfile {
  child_id: string;
  name: string;
  age: number;
  interests?: string[];
  constraints?: {
    days_available?: string[];
    max_distance_km?: number;
  };
}

// Current FamilyContext
interface FamilyContext {
  children: ChildProfile[];
  planning_mode: 'together' | 'parallel' | 'any';
  location?: { lat: number; lng: number };
}
```

### Enhanced Child Profile

Extend `ChildProfile` to include favorites, calendar history, and more:

```typescript
// Enhanced ChildProfile (NEW)
interface EnhancedChildProfile extends ChildProfile {
  // Existing fields
  child_id: string;
  name: string;
  age: number;
  interests?: string[];
  constraints?: {
    days_available?: string[];
    max_distance_km?: number;
  };

  // NEW: Activity history
  favorites: {
    activityId: string;
    activityName: string;
    category: string;
    favoritedAt: Date;
  }[];

  // NEW: Calendar/assigned activities
  calendarActivities: {
    activityId: string;
    activityName: string;
    status: 'planned' | 'in_progress' | 'completed';
    assignedAt: Date;
  }[];

  // NEW: Location preference
  location?: {
    city: string;
    province: string;
    lat: number;
    lng: number;
  };

  // NEW: Computed preferences
  computedPreferences?: {
    preferredCategories: string[];      // From favorites analysis
    preferredDays: string[];            // From calendar analysis
    preferredTimeSlots: string[];       // morning/afternoon/evening
    averagePriceRange: { min: number; max: number };
    completedActivityTypes: string[];   // What they've done before
  };
}
```

### LangChain Agent Implementation

#### 1. Topic Guard Chain (Pre-filter)

```typescript
// server/src/ai/chains/topicGuardChain.ts

import { ChatOpenAI } from '@langchain/openai';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { z } from 'zod';

const TopicClassificationSchema = z.object({
  category: z.string(),
  allowed: z.boolean(),
  confidence: z.number(),
  extractedChildName: z.string().optional(),
});

const parser = StructuredOutputParser.fromZodSchema(TopicClassificationSchema);

const TOPIC_GUARD_PROMPT = ChatPromptTemplate.fromMessages([
  ['system', `You are a topic classifier for a kids activity finder app.
Classify the user's message into ALLOWED or BLOCKED categories.

ALLOWED: activity_search, activity_question, recommendation_request,
         schedule_help, child_specific, comparison, cost_question

BLOCKED: off_topic, homework, general_chat, competitor_info

Also extract any child name mentioned in the query.

{format_instructions}`],
  ['human', '{query}']
]);

export function createTopicGuardChain(model: ChatOpenAI) {
  return RunnableSequence.from([
    async (input: { query: string }) => ({
      query: input.query,
      format_instructions: parser.getFormatInstructions()
    }),
    TOPIC_GUARD_PROMPT,
    model,
    parser
  ]);
}

export async function checkTopicAllowed(
  model: ChatOpenAI,
  query: string
): Promise<{ allowed: boolean; childName?: string; reason?: string }> {
  const chain = createTopicGuardChain(model);

  try {
    const result = await chain.invoke({ query });
    return {
      allowed: result.allowed && result.confidence > 0.7,
      childName: result.extractedChildName,
      reason: result.allowed ? undefined : `Query classified as: ${result.category}`
    };
  } catch {
    // Default to allowed if classification fails
    return { allowed: true };
  }
}
```

#### 2. Agent Tools Definition

```typescript
// server/src/ai/tools/activityTools.ts

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { prisma } from '../../utils/prismaClient';
import { calculateAge } from '../../utils/helpers';

/**
 * Tool: Search Activities
 * Searches the activity database with filters
 */
export const searchActivitiesTool = new DynamicStructuredTool({
  name: 'search_activities',
  description: 'Search for kids activities with filters like category, age range, location, price, and schedule',
  schema: z.object({
    category: z.string().optional().describe('Activity category (sports, arts, music, dance, stem, camps)'),
    minAge: z.number().optional().describe('Minimum age'),
    maxAge: z.number().optional().describe('Maximum age'),
    city: z.string().optional().describe('City name'),
    maxPrice: z.number().optional().describe('Maximum price'),
    daysOfWeek: z.array(z.string()).optional().describe('Preferred days'),
    limit: z.number().optional().default(10).describe('Number of results'),
  }),
  func: async ({ category, minAge, maxAge, city, maxPrice, daysOfWeek, limit }) => {
    const activities = await prisma.activity.findMany({
      where: {
        ...(category && { category: { contains: category, mode: 'insensitive' } }),
        ...(city && { location: { city: { contains: city, mode: 'insensitive' } } }),
        ...(maxPrice && { price: { lte: maxPrice } }),
        ...(minAge && { ageRange: { path: ['min'], lte: minAge } }),
        ...(maxAge && { ageRange: { path: ['max'], gte: maxAge } }),
        isActive: true,
      },
      include: { location: true, provider: true },
      take: limit || 10,
      orderBy: { name: 'asc' },
    });

    return JSON.stringify(activities.map(a => ({
      id: a.id,
      name: a.name,
      category: a.category,
      price: a.price,
      ageRange: a.ageRange,
      location: a.location?.name,
      city: a.location?.city,
      provider: a.provider?.name,
      schedule: a.schedule,
    })));
  },
});

/**
 * Tool: Get Child Context
 * Retrieves detailed context for a specific child or all children
 */
export const getChildContextTool = new DynamicStructuredTool({
  name: 'get_child_context',
  description: 'Get detailed information about a child including favorites, calendar activities, and preferences',
  schema: z.object({
    userId: z.string().describe('User ID'),
    childName: z.string().optional().describe('Specific child name to look up'),
    childId: z.string().optional().describe('Specific child ID'),
  }),
  func: async ({ userId, childName, childId }) => {
    const children = await prisma.child.findMany({
      where: {
        userId,
        ...(childId && { id: childId }),
        ...(childName && { name: { contains: childName, mode: 'insensitive' } }),
      },
      include: {
        activities: {
          include: { activity: { include: { location: true } } },
          orderBy: { assignedAt: 'desc' },
          take: 15,
        },
      },
    });

    // Load user favorites
    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: { activity: true },
      take: 30,
    });

    const result = children.map(child => {
      const age = calculateAge(child.dateOfBirth);

      // Filter favorites by age match
      const childFavorites = favorites.filter(f => {
        const range = f.activity.ageRange as any;
        return !range || (age >= range.min && age <= range.max);
      });

      // Compute preferences
      const categoryCount: Record<string, number> = {};
      [...childFavorites.map(f => f.activity), ...child.activities.map(a => a.activity)]
        .forEach(a => { categoryCount[a.category] = (categoryCount[a.category] || 0) + 1; });

      return {
        id: child.id,
        name: child.name,
        age,
        interests: child.interests,
        recentFavorites: childFavorites.slice(0, 5).map(f => ({
          name: f.activity.name,
          category: f.activity.category,
        })),
        calendarActivities: child.activities.map(ca => ({
          name: ca.activity.name,
          category: ca.activity.category,
          status: ca.status,
        })),
        preferredCategories: Object.entries(categoryCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([cat]) => cat),
        completedCount: child.activities.filter(a => a.status === 'completed').length,
        plannedCount: child.activities.filter(a => a.status === 'planned').length,
      };
    });

    return JSON.stringify(result);
  },
});

/**
 * Tool: Get Activity Details
 * Gets detailed information about a specific activity
 */
export const getActivityDetailsTool = new DynamicStructuredTool({
  name: 'get_activity_details',
  description: 'Get detailed information about a specific activity by ID or name',
  schema: z.object({
    activityId: z.string().optional().describe('Activity ID'),
    activityName: z.string().optional().describe('Activity name to search'),
  }),
  func: async ({ activityId, activityName }) => {
    const activity = await prisma.activity.findFirst({
      where: {
        ...(activityId && { id: activityId }),
        ...(activityName && { name: { contains: activityName, mode: 'insensitive' } }),
      },
      include: { location: true, provider: true },
    });

    if (!activity) return JSON.stringify({ error: 'Activity not found' });

    return JSON.stringify({
      id: activity.id,
      name: activity.name,
      description: activity.description,
      category: activity.category,
      price: activity.price,
      ageRange: activity.ageRange,
      schedule: activity.schedule,
      location: {
        name: activity.location?.name,
        address: activity.location?.address,
        city: activity.location?.city,
      },
      provider: activity.provider?.name,
      registrationUrl: activity.registrationUrl,
      registrationStatus: activity.registrationStatus,
    });
  },
});

/**
 * Tool: Compare Activities
 * Compares multiple activities side by side
 */
export const compareActivitiesTool = new DynamicStructuredTool({
  name: 'compare_activities',
  description: 'Compare multiple activities by their IDs',
  schema: z.object({
    activityIds: z.array(z.string()).describe('Array of activity IDs to compare'),
  }),
  func: async ({ activityIds }) => {
    const activities = await prisma.activity.findMany({
      where: { id: { in: activityIds } },
      include: { location: true, provider: true },
    });

    const comparison = activities.map(a => ({
      id: a.id,
      name: a.name,
      category: a.category,
      price: a.price || 'Not specified',
      ageRange: a.ageRange || 'All ages',
      schedule: a.schedule,
      location: a.location?.city,
      provider: a.provider?.name,
    }));

    return JSON.stringify({ comparison, count: comparison.length });
  },
});

/**
 * All activity tools
 */
export const activityTools = [
  searchActivitiesTool,
  getChildContextTool,
  getActivityDetailsTool,
  compareActivitiesTool,
];
```

#### 3. Activity Assistant Agent

```typescript
// server/src/ai/agents/activityAssistantAgent.ts

import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ConversationSummaryMemory } from 'langchain/memory';
import { activityTools } from '../tools/activityTools';
import { getSmallModel, getLargeModel } from '../models/chatModels';
import { EnhancedFamilyContext } from '../types/ai.types';

const AGENT_SYSTEM_PROMPT = `You are an AI assistant for KidsActivityTracker, helping parents find activities for their children.

FAMILY CONTEXT:
{family_context}

RULES:
1. ONLY discuss kids activities, classes, camps, and related topics
2. Use the tools to search for activities and get child context
3. Personalize recommendations based on child preferences and history
4. When asked about a specific child, use get_child_context first
5. Always provide specific activity recommendations from our database
6. Never make up activities - only recommend what you find via search
7. Consider age appropriateness, location, and schedule preferences

RESPONSE STYLE:
- Be friendly and helpful
- Provide 3-5 activity recommendations when asked
- Explain why each activity is a good match
- Suggest follow-up questions the user might have`;

/**
 * Create the Activity Assistant Agent
 */
export async function createActivityAssistantAgent(
  model: ChatOpenAI,
  memory?: ConversationSummaryMemory
): Promise<AgentExecutor> {
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', AGENT_SYSTEM_PROMPT],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  const agent = await createOpenAIToolsAgent({
    llm: model,
    tools: activityTools,
    prompt,
  });

  return new AgentExecutor({
    agent,
    tools: activityTools,
    memory,
    verbose: process.env.NODE_ENV !== 'production',
    maxIterations: 5,
    returnIntermediateSteps: true,
  });
}

/**
 * Chat service using the agent
 */
export class ActivityChatService {
  private conversations: Map<string, {
    executor: AgentExecutor;
    memory: ConversationSummaryMemory;
    turnsUsed: number;
  }> = new Map();

  async chat(
    userId: string,
    conversationId: string | null,
    message: string,
    familyContext?: EnhancedFamilyContext
  ): Promise<ChatResponse> {
    let conversation = conversationId ? this.conversations.get(conversationId) : null;

    // Create new conversation if needed
    if (!conversation) {
      const model = getSmallModel();
      const memory = new ConversationSummaryMemory({
        llm: model,
        memoryKey: 'chat_history',
        returnMessages: true,
      });

      const executor = await createActivityAssistantAgent(model, memory);

      conversationId = `conv_${Date.now()}_${userId}`;
      conversation = { executor, memory, turnsUsed: 0 };
      this.conversations.set(conversationId, conversation);
    }

    // Check turn limits (5 for Pro users)
    if (conversation.turnsUsed >= 5) {
      return {
        conversationId,
        text: "We've covered a lot! Let's start fresh to keep our search focused.",
        activities: [],
        followUpPrompts: ['Start new search'],
        turnsRemaining: 0,
        shouldStartNew: true,
      };
    }

    // Build family context string
    const familyContextStr = familyContext
      ? formatFamilyContext(familyContext)
      : 'No family profile set up yet.';

    // Execute agent
    const result = await conversation.executor.invoke({
      input: message,
      family_context: familyContextStr,
    });

    conversation.turnsUsed++;

    // Parse activities from agent output
    const activities = extractActivitiesFromResponse(result.output);
    const followUpPrompts = generateFollowUpPrompts(result.output, familyContext);

    return {
      conversationId,
      text: result.output,
      activities,
      followUpPrompts,
      turnsRemaining: 5 - conversation.turnsUsed,
      shouldStartNew: false,
    };
  }

  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }
}

interface ChatResponse {
  conversationId: string;
  text: string;
  activities: any[];
  followUpPrompts: string[];
  turnsRemaining: number;
  shouldStartNew: boolean;
}

function formatFamilyContext(ctx: EnhancedFamilyContext): string {
  if (!ctx.children?.length) return 'No children registered.';

  return ctx.children.map(child => `
- ${child.name} (age ${child.age})
  Interests: ${child.interests?.join(', ') || 'Not specified'}
  Favorites: ${child.favorites?.slice(0, 3).map(f => f.activityName).join(', ') || 'None'}
  Preferred categories: ${child.computedPreferences?.preferredCategories?.join(', ') || 'Unknown'}
  Completed activities: ${child.calendarActivities?.filter(a => a.status === 'completed').length || 0}
`).join('\n');
}

function extractActivitiesFromResponse(output: string): any[] {
  // Try to extract activity IDs mentioned in the response
  const activityIdPattern = /act_[a-zA-Z0-9-]+/g;
  const matches = output.match(activityIdPattern) || [];
  return matches.map(id => ({ id }));
}

function generateFollowUpPrompts(output: string, ctx?: EnhancedFamilyContext): string[] {
  const prompts: string[] = [];

  // Generic follow-ups
  if (output.includes('activity') || output.includes('activities')) {
    prompts.push('Tell me more about the first option');
    prompts.push('Show me cheaper alternatives');
  }

  // Child-specific follow-ups
  if (ctx?.children && ctx.children.length > 1) {
    prompts.push(`What about activities for ${ctx.children[0].name}?`);
  }

  // Schedule follow-ups
  prompts.push('Any weekend options?');

  return prompts.slice(0, 3);
}

// Singleton instance
let _chatService: ActivityChatService | null = null;

export function getChatService(): ActivityChatService {
  if (!_chatService) {
    _chatService = new ActivityChatService();
  }
  return _chatService;
}
```

#### 4. Chat API Route

```typescript
// server/src/ai/routes/chat.ts

import express from 'express';
import { getChatService } from '../agents/activityAssistantAgent';
import { checkTopicAllowed } from '../chains/topicGuardChain';
import { getSmallModel } from '../models/chatModels';
import { buildEnhancedFamilyContext } from '../utils/contextBuilder';
import { checkAIQuota, recordAIUsage } from '../services/quotaService';

const router = express.Router();

/**
 * POST /api/ai/chat
 * Main conversational AI endpoint
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationId, childIds, childSelectionMode } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check quota
    const quota = await checkAIQuota(userId);
    if (!quota.allowed) {
      return res.status(429).json({
        error: 'AI quota exceeded',
        quota,
        upgradeRequired: !quota.isPro,
      });
    }

    // Topic guard - block off-topic queries
    const model = getSmallModel();
    const topicCheck = await checkTopicAllowed(model, message);

    if (!topicCheck.allowed) {
      return res.json({
        conversationId: null,
        text: `I'm here to help you find activities for your kids! Try asking about:\n\n` +
              `• Swimming lessons, art classes, sports programs\n` +
              `• Activities for specific ages\n` +
              `• Weekend or after-school options\n` +
              `• Camps and seasonal programs`,
        activities: [],
        followUpPrompts: [
          'Swimming lessons near me',
          'Art classes for kids',
          'Weekend sports programs',
        ],
        blocked: true,
        reason: topicCheck.reason,
      });
    }

    // Load family context
    const familyContext = await buildEnhancedFamilyContext(
      userId,
      childIds,
      childSelectionMode || 'auto'
    );

    // If child name was extracted, filter to that child
    if (topicCheck.childName && !childIds?.length) {
      const matchedChild = familyContext.children.find(
        c => c.name.toLowerCase().includes(topicCheck.childName!.toLowerCase())
      );
      if (matchedChild) {
        familyContext.children = [matchedChild];
      }
    }

    // Execute chat
    const chatService = getChatService();
    const response = await chatService.chat(
      userId,
      conversationId,
      message,
      familyContext
    );

    // Record usage
    await recordAIUsage(userId, 1);

    res.json({
      ...response,
      quota: {
        daily: { used: quota.daily.used + 1, limit: quota.daily.limit },
        monthly: { used: quota.monthly.used + 1, limit: quota.monthly.limit },
      },
    });

  } catch (error: any) {
    console.error('[AI Chat] Error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

/**
 * DELETE /api/ai/chat/:conversationId
 * End a conversation
 */
router.delete('/chat/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  getChatService().clearConversation(conversationId);
  res.json({ success: true });
});

export default router;
```

### Child Selection API

Allow users to query for specific children or all children:

```typescript
// API request format
POST /api/ai/chat
{
  "message": "Find swimming lessons",
  "conversationId": null,
  "childIds": ["child_1", "child_2"] | null, // null = all children
  "childSelectionMode": "specific" | "all" | "auto"
}

// Auto mode: AI determines which children based on query
// "Find something for Emma" → auto-selects Emma
// "Weekend activities" → includes all children
```

### Context Builder Enhancement

Update `server/src/ai/utils/contextBuilder.ts`:

```typescript
// Enhanced context builder
export const buildEnhancedFamilyContext = async (
  userId: string,
  selectedChildIds?: string[],
  mode: 'specific' | 'all' | 'auto' = 'all'
): Promise<EnhancedFamilyContext> => {

  // Load children with full history
  const children = await loadChildrenWithHistory(userId, selectedChildIds);

  // Load user location
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { city: true, province: true, latitude: true, longitude: true }
  });

  return {
    children: children.map(buildEnhancedChildProfile),
    planning_mode: determinePlanningMode(children, mode),
    location: user?.latitude && user?.longitude ? {
      city: user.city,
      province: user.province,
      lat: user.latitude,
      lng: user.longitude
    } : undefined,
    userPreferences: await loadUserPreferences(userId)
  };
};

async function loadChildrenWithHistory(userId: string, selectedChildIds?: string[]) {
  return prisma.child.findMany({
    where: {
      userId,
      ...(selectedChildIds?.length ? { id: { in: selectedChildIds } } : {})
    },
    include: {
      activities: {
        include: {
          activity: {
            select: {
              id: true,
              name: true,
              category: true,
              price: true,
              ageRange: true,
              schedule: true
            }
          }
        },
        orderBy: { assignedAt: 'desc' },
        take: 20
      }
    }
  });
}
```

### Example System Prompt with Child Context

```typescript
const buildSystemPrompt = (context: EnhancedFamilyContext) => `
You are an AI assistant for KidsActivityTracker, helping parents find activities.

FAMILY CONTEXT:
${context.children.map(child => `
- ${child.name} (age ${child.age})
  Location: ${child.location?.city || 'Not set'}
  Interests: ${child.interests?.join(', ') || 'Not specified'}
  Recent favorites: ${child.favorites.slice(0, 3).map(f => f.activityName).join(', ') || 'None'}
  Scheduled activities: ${child.calendarActivities.filter(a => a.status === 'planned').length} planned
  Completed activities: ${child.calendarActivities.filter(a => a.status === 'completed').length} completed
  Preferred categories: ${child.computedPreferences?.preferredCategories.join(', ') || 'Unknown'}
  Preferred days: ${child.computedPreferences?.preferredDays.join(', ') || 'Any day'}
`).join('\n')}

USER LOCATION: ${context.location?.city}, ${context.location?.province}

RULES:
1. ONLY discuss kids activities, classes, camps, and related topics
2. Use the child context to personalize recommendations
3. If asked about a specific child, focus on that child's preferences
4. When recommending, consider activities they've already favorited or completed
5. Avoid recommending activities they've already completed recently
6. Match age ranges appropriately
`;
```

---

## Part 10: Child-Specific Query Patterns

### Natural Language Child Selection

The AI should recognize when users ask about specific children:

```typescript
// Query patterns that trigger child-specific context
const CHILD_QUERY_PATTERNS = [
  // Direct name mention
  /for\s+(\w+)/i,                    // "for Emma"
  /(\w+)['']?s?\s+(activities|classes)/i,  // "Emma's activities"

  // Age-based
  /my\s+(\d+)\s*year\s*old/i,       // "my 5 year old"
  /my\s+(toddler|teen|preteen)/i,   // "my toddler"

  // Pronouns
  /for\s+(him|her|them)/i,          // "for her"
  /my\s+(son|daughter|kid|child)/i, // "my daughter"

  // Both/all children
  /for\s+(both|all)\s*(of them|kids|children)?/i,
  /something\s+they\s+can\s+do\s+together/i,
  /sibling\s+activities/i
];

// In topic classifier, extract child reference
interface QueryAnalysis {
  childReference: {
    type: 'specific_name' | 'age' | 'all' | 'together' | 'none';
    value?: string;
    matchedChildIds?: string[];
  };
}
```

### Example Queries and Responses

| User Query | Child Selection | Response Focus |
|------------|-----------------|----------------|
| "Swimming for Emma" | Emma only | Emma's age, preferences |
| "Art classes for my 5 year old" | Age-matched child | That child's interests |
| "Weekend activities" | All children | Age-appropriate for each |
| "Something they can do together" | All children | Activities matching ALL ages |
| "What has Liam done before?" | Liam only | Liam's calendar history |
| "More like the soccer class Emma loved" | Emma only | Similar to her favorites |

### Multi-Child Planning Modes

Extend the existing `planning_mode` in `multiChildNode.ts`:

```typescript
type PlanningMode =
  | 'together'    // All children in same activity (age overlap required)
  | 'parallel'    // Different activities at same time
  | 'any'         // Best fit for any child
  | 'specific'    // Focus on one named child
  | 'sequential'; // Activities one after another (drop-off friendly)

// Enhanced multi-child node
export const multiChildNode = async (state: AIGraphState) => {
  const { familyContext, planningMode } = state;
  const children = familyContext?.children || [];

  switch (planningMode) {
    case 'together':
      return findTogetherActivities(children, state);

    case 'specific':
      const targetChild = children.find(c => c.child_id === state.targetChildId);
      return findActivitiesForChild(targetChild!, state);

    case 'sequential':
      return planSequentialActivities(children, state);

    default:
      return findBestFitActivities(children, state);
  }
};
```

---

## Sources

- [OpenAI API Pricing](https://openai.com/api/pricing/)
- [GPT-4o mini Announcement](https://openai.com/index/gpt-4o-mini-advancing-cost-efficient-intelligence/)
- [OpenAI UI Guidelines](https://developers.openai.com/apps-sdk/concepts/ui-guidelines/)
- [Sendbird Chatbot UI Examples](https://sendbird.com/blog/chatbot-ui)
- [NN/Group Prompt Controls](https://www.nngroup.com/articles/prompt-controls-genai/)
- [AI Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [AWS Bedrock Guardrails](https://aws.amazon.com/blogs/machine-learning/build-safe-and-responsible-generative-ai-applications-with-guardrails/)
- [NeMo Guardrails](https://medium.com/bigdatarepublic/building-safer-ai-chatbots-a-practical-guide-to-llm-guardrails-using-nemo-b6f9c8c4c216)
- [Kinde AI Token Pricing](https://kinde.com/learn/billing/billing-for-ai/ai-token-pricing-optimization-dynamic-cost-management-for-llm-powered-saas/)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
