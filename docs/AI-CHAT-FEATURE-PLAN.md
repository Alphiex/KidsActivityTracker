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

### Phase 1: Guardrails & Limits
- [ ] Implement TopicClassifier node with gpt-4o-mini
- [ ] Add quota tracking to database (AIUsage model)
- [ ] Create AIQuotaService
- [ ] Add rate limiting middleware
- [ ] Update system prompts with restrictions

### Phase 2: Enhanced Child Context
- [ ] Extend ChildProfile type with favorites, calendar, computedPreferences
- [ ] Implement childContextLoaderNode
- [ ] Update contextBuilder.ts with loadChildrenWithHistory
- [ ] Add child name/age extraction to topic classifier
- [ ] Implement computePreferences function for preference analysis

### Phase 3: Chat Graph & Conversation Management
- [ ] Create chatGraph.ts with new node flow
- [ ] Implement conversationManagerNode
- [ ] Add AIConversation and AITurn models to Prisma schema
- [ ] Build /api/ai/chat endpoint
- [ ] Implement context compression for long conversations
- [ ] Add turn limits (5 per conversation for Pro)

### Phase 4: Response Formatting & Follow-ups
- [ ] Implement responseFormatterNode
- [ ] Generate dynamic follow-up prompts based on response
- [ ] Format activities with matched child names
- [ ] Create child selection API (specific/all/auto modes)

### Phase 5: UI Implementation
- [ ] Redesign AIRecommendationsScreen as AIChatScreen
- [ ] Add suggested prompts component
- [ ] Build chat message bubbles
- [ ] Implement follow-up suggestions (tappable pills)
- [ ] Add quota display with upgrade prompt
- [ ] Child selector UI (filter by child)
- [ ] Loading states and error handling

### Phase 6: Polish & Paywall Integration
- [ ] Connect to subscription system for quota enforcement
- [ ] Add upgrade prompts when quota exceeded
- [ ] Analytics tracking (queries, conversions, blocked topics)
- [ ] A/B test prompt suggestions
- [ ] Performance optimization (caching, prefetch)

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

## Part 9: Sub-Agent Architecture & Child Context

### Current LangGraph Architecture

The existing AI system uses LangGraph with these nodes (from `server/src/ai/graph/aiGraph.ts`):

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT GRAPH FLOW                        │
├─────────────────────────────────────────────────────────────┤
│  START → router → parse_query → fetch_candidates →          │
│          ↓                                                   │
│      ┌───┴───┐                                              │
│      ↓       ↓                                              │
│  recommend  planner → multi_child                           │
│      ↓       ↓                                              │
│  explain   END                                              │
│      ↓                                                       │
│     END                                                      │
└─────────────────────────────────────────────────────────────┘
```

### Existing State & Types

From `server/src/ai/graph/state.ts` and `server/src/ai/types/ai.types.ts`:

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

### New Sub-Agent Architecture

Extend the graph with new nodes for the chat feature:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     EXTENDED GRAPH FLOW (CHAT)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  START                                                                   │
│    ↓                                                                     │
│  ┌─────────────────┐                                                    │
│  │ topic_classifier │ ──(blocked)──→ BLOCKED_RESPONSE                   │
│  └────────┬────────┘                                                    │
│           ↓ (allowed)                                                    │
│  ┌─────────────────────┐                                                │
│  │ child_context_loader │  ← Loads enhanced child data                  │
│  └────────┬────────────┘                                                │
│           ↓                                                              │
│  ┌─────────────────────┐                                                │
│  │ conversation_manager │  ← Manages history & compression              │
│  └────────┬────────────┘                                                │
│           ↓                                                              │
│  ┌────────┴────────┐                                                    │
│  │     router      │ (existing)                                         │
│  └────────┬────────┘                                                    │
│           ↓                                                              │
│     [Existing flow: parse → fetch → recommend/planner → explain]        │
│           ↓                                                              │
│  ┌─────────────────────┐                                                │
│  │  response_formatter │  ← Formats chat-friendly responses             │
│  └────────┬────────────┘                                                │
│           ↓                                                              │
│         END                                                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### New Nodes Implementation

#### 1. Topic Classifier Node

```typescript
// server/src/ai/graph/nodes/topicClassifierNode.ts

const TOPIC_CLASSIFIER_PROMPT = `
You are a topic classifier for a kids activity finder app.
Classify the user's message into ALLOWED or BLOCKED categories.

ALLOWED categories:
- activity_search: Looking for activities
- activity_question: Questions about specific activities
- recommendation_request: Asking for suggestions
- schedule_help: Help planning activities
- child_specific: Questions about activities for a specific child
- comparison: Comparing activities or options
- cost_question: Questions about pricing

BLOCKED categories:
- off_topic: Unrelated to kids activities
- homework: Academic questions
- general_chat: Casual conversation
- competitor_info: Bulk data extraction

Return JSON: { "category": "...", "allowed": true/false, "confidence": 0.0-1.0 }
`;

export const topicClassifierNode = async (state: AIGraphState): Promise<Partial<AIGraphState>> => {
  const model = getSmallModel(); // gpt-4o-mini

  const result = await model.invoke([
    { role: 'system', content: TOPIC_CLASSIFIER_PROMPT },
    { role: 'user', content: state.userQuery }
  ]);

  const classification = JSON.parse(result.content);

  return {
    ...state,
    topicClassification: classification,
    isBlocked: !classification.allowed || classification.confidence < 0.7
  };
};
```

#### 2. Child Context Loader Node

```typescript
// server/src/ai/graph/nodes/childContextLoaderNode.ts

export const childContextLoaderNode = async (state: AIGraphState): Promise<Partial<AIGraphState>> => {
  const { userId, selectedChildIds } = state;

  // Load all children or specific children
  const children = await prisma.child.findMany({
    where: {
      userId,
      ...(selectedChildIds?.length ? { id: { in: selectedChildIds } } : {})
    },
    include: {
      activities: {
        include: { activity: true },
        orderBy: { assignedAt: 'desc' },
        take: 20 // Recent 20 activities
      }
    }
  });

  // Load favorites for each child (favorites are user-level, map to children by age match)
  const userFavorites = await prisma.favorite.findMany({
    where: { userId },
    include: { activity: true },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  // Build enhanced profiles
  const enhancedProfiles: EnhancedChildProfile[] = children.map(child => {
    const age = calculateAge(child.dateOfBirth);

    // Filter favorites relevant to this child's age
    const childFavorites = userFavorites.filter(f => {
      const ageRange = f.activity.ageRange;
      return !ageRange || (age >= ageRange.min && age <= ageRange.max);
    });

    return {
      child_id: child.id,
      name: child.name,
      age,
      interests: child.interests || [],

      favorites: childFavorites.map(f => ({
        activityId: f.activityId,
        activityName: f.activity.name,
        category: f.activity.category,
        favoritedAt: f.createdAt
      })),

      calendarActivities: child.activities.map(ca => ({
        activityId: ca.activityId,
        activityName: ca.activity.name,
        status: ca.status,
        assignedAt: ca.assignedAt
      })),

      location: state.userLocation,

      computedPreferences: computePreferences(childFavorites, child.activities)
    };
  });

  return {
    ...state,
    familyContext: {
      ...state.familyContext,
      children: enhancedProfiles
    }
  };
};

// Compute preferences from activity history
function computePreferences(favorites: any[], calendarActivities: any[]) {
  const allActivities = [
    ...favorites.map(f => f.activity),
    ...calendarActivities.map(ca => ca.activity)
  ];

  // Category frequency
  const categoryCount: Record<string, number> = {};
  allActivities.forEach(a => {
    categoryCount[a.category] = (categoryCount[a.category] || 0) + 1;
  });

  const preferredCategories = Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cat]) => cat);

  // Day frequency from calendar
  const dayCount: Record<string, number> = {};
  calendarActivities.forEach(ca => {
    const days = ca.activity.schedule?.daysOfWeek || [];
    days.forEach((d: string) => {
      dayCount[d] = (dayCount[d] || 0) + 1;
    });
  });

  const preferredDays = Object.entries(dayCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([day]) => day);

  // Price range
  const prices = allActivities
    .map(a => a.price)
    .filter(p => p != null);

  return {
    preferredCategories,
    preferredDays,
    preferredTimeSlots: [], // Could analyze startTime
    averagePriceRange: prices.length ? {
      min: Math.min(...prices) * 0.8,
      max: Math.max(...prices) * 1.2
    } : { min: 0, max: 500 },
    completedActivityTypes: calendarActivities
      .filter(ca => ca.status === 'completed')
      .map(ca => ca.activity.category)
  };
}
```

#### 3. Conversation Manager Node

```typescript
// server/src/ai/graph/nodes/conversationManagerNode.ts

export const conversationManagerNode = async (state: AIGraphState): Promise<Partial<AIGraphState>> => {
  const { conversationId, userId, userQuery } = state;

  if (!conversationId) {
    // New conversation
    const conversation = await prisma.aIConversation.create({
      data: {
        userId,
        context: {},
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 min
      }
    });

    return {
      ...state,
      conversationId: conversation.id,
      conversationHistory: [],
      turnsRemaining: 5
    };
  }

  // Load existing conversation
  const conversation = await prisma.aIConversation.findUnique({
    where: { id: conversationId },
    include: {
      turns: { orderBy: { createdAt: 'asc' } }
    }
  });

  if (!conversation || conversation.expiresAt < new Date()) {
    throw new Error('Conversation expired or not found');
  }

  // Compress history for token efficiency
  const compressedHistory = compressConversationHistory(conversation.turns);

  return {
    ...state,
    conversationId: conversation.id,
    conversationHistory: compressedHistory,
    turnsRemaining: Math.max(0, 5 - conversation.turns.length / 2),
    previousContext: conversation.context as any
  };
};

function compressConversationHistory(turns: any[]): ConversationTurn[] {
  // Keep last 4 turns fully, summarize earlier ones
  if (turns.length <= 4) {
    return turns;
  }

  const recentTurns = turns.slice(-4);
  const olderTurns = turns.slice(0, -4);

  // Summarize older turns into context
  const summary = {
    role: 'system' as const,
    content: `Previous discussion summary: ${
      olderTurns.map(t => t.content.substring(0, 50)).join('; ')
    }...`
  };

  return [summary, ...recentTurns];
}
```

#### 4. Response Formatter Node

```typescript
// server/src/ai/graph/nodes/responseFormatterNode.ts

export const responseFormatterNode = async (state: AIGraphState): Promise<Partial<AIGraphState>> => {
  const { recommendations, explanation, familyContext } = state;

  // Generate follow-up prompts based on response type
  const followUpPrompts = generateFollowUpPrompts(state);

  // Format activities for chat display
  const formattedActivities = recommendations?.map(rec => ({
    id: rec.id,
    name: rec.name,
    category: rec.category,
    price: rec.price,
    ageRange: rec.ageRange,
    location: rec.location?.name,
    matchedChild: rec.matched_child_id
      ? familyContext?.children.find(c => c.child_id === rec.matched_child_id)?.name
      : undefined,
    matchReason: rec.explanation
  }));

  // Save turn to conversation
  if (state.conversationId) {
    await prisma.aITurn.createMany({
      data: [
        { conversationId: state.conversationId, role: 'user', content: state.userQuery },
        { conversationId: state.conversationId, role: 'assistant', content: explanation || '' }
      ]
    });
  }

  return {
    ...state,
    chatResponse: {
      text: explanation || '',
      activities: formattedActivities,
      followUpPrompts,
      childrenIncluded: familyContext?.children.map(c => ({
        id: c.child_id,
        name: c.name,
        age: c.age
      }))
    }
  };
};

function generateFollowUpPrompts(state: AIGraphState): string[] {
  const { recommendations, familyContext } = state;

  const prompts: string[] = [];

  if (recommendations?.length) {
    prompts.push('Tell me more about the first option');
    prompts.push('Show me more options');

    if (recommendations.length > 3) {
      prompts.push('Compare the top 3');
    }
  }

  // Child-specific follow-ups
  if (familyContext?.children && familyContext.children.length > 1) {
    const childNames = familyContext.children.map(c => c.name);
    prompts.push(`Find something just for ${childNames[0]}`);
  }

  // Category-based follow-ups
  const categories = [...new Set(recommendations?.map(r => r.category) || [])];
  if (categories.length > 0) {
    prompts.push(`More ${categories[0]} options`);
  }

  return prompts.slice(0, 3);
}
```

### Updated Graph Definition

```typescript
// server/src/ai/graph/chatGraph.ts

import { StateGraph, END } from '@langchain/langgraph';
import { topicClassifierNode } from './nodes/topicClassifierNode';
import { childContextLoaderNode } from './nodes/childContextLoaderNode';
import { conversationManagerNode } from './nodes/conversationManagerNode';
import { responseFormatterNode } from './nodes/responseFormatterNode';
// ... existing node imports

export const createChatGraph = () => {
  const graph = new StateGraph<ChatGraphState>({
    channels: chatGraphChannels
  });

  // Add new nodes
  graph.addNode('topic_classifier', topicClassifierNode);
  graph.addNode('child_context_loader', childContextLoaderNode);
  graph.addNode('conversation_manager', conversationManagerNode);
  graph.addNode('response_formatter', responseFormatterNode);

  // Add existing nodes
  graph.addNode('router', routerNode);
  graph.addNode('parse_query', parseQueryNode);
  graph.addNode('fetch_candidates', fetchCandidatesNode);
  graph.addNode('recommend', recommendNode);
  graph.addNode('multi_child', multiChildNode);
  graph.addNode('explain', explainNode);

  // Define edges
  graph.setEntryPoint('topic_classifier');

  // Topic classifier branches
  graph.addConditionalEdges('topic_classifier', (state) => {
    if (state.isBlocked) return 'blocked';
    return 'continue';
  }, {
    blocked: END, // Return blocked response
    continue: 'child_context_loader'
  });

  graph.addEdge('child_context_loader', 'conversation_manager');
  graph.addEdge('conversation_manager', 'router');

  // Router branches (existing logic)
  graph.addConditionalEdges('router', routerCondition, {
    search: 'parse_query',
    recommend: 'parse_query',
    explain: 'explain',
    multi_child: 'multi_child'
  });

  graph.addEdge('parse_query', 'fetch_candidates');
  graph.addEdge('fetch_candidates', 'recommend');
  graph.addEdge('recommend', 'response_formatter');
  graph.addEdge('multi_child', 'response_formatter');
  graph.addEdge('explain', 'response_formatter');
  graph.addEdge('response_formatter', END);

  return graph.compile();
};
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
