/**
 * LangGraph AI Graph
 * 
 * Main graph that orchestrates all AI agent nodes.
 * Provides conditional routing based on request type.
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { AIGraphState, AIGraphStateType, AIRequestType } from './state';

// Import nodes
import { routerNode } from './nodes/routerNode';
import { parseNode } from './nodes/parseNode';
import { fetchCandidatesNode } from './nodes/fetchCandidatesNode';
import { recommendNode } from './nodes/recommendNode';
import { explainNode } from './nodes/explainNode';
import { plannerNode } from './nodes/plannerNode';
import { multiChildNode } from './nodes/multiChildNode';

/**
 * Route from router to appropriate next node based on request_type
 */
function routeFromRouter(state: AIGraphStateType): string {
  switch (state.request_type) {
    case 'parse':
      return 'parse';
    case 'explain':
      return 'explain';
    case 'plan':
      return 'planner';
    case 'multi_child':
      return 'multi_child';
    case 'recommend':
    default:
      return 'fetch_candidates';
  }
}

/**
 * Create and compile the AI graph
 */
export function createAIGraph() {
  const graph = new StateGraph(AIGraphState)
    // === Add all nodes ===
    .addNode('router', routerNode)
    .addNode('parse', parseNode)
    .addNode('fetch_candidates', fetchCandidatesNode)
    .addNode('recommend', recommendNode)
    .addNode('explain', explainNode)
    .addNode('planner', plannerNode)
    .addNode('multi_child', multiChildNode)
    
    // === Entry point ===
    .addEdge(START, 'router')
    
    // === Router conditionally routes to appropriate node ===
    .addConditionalEdges('router', routeFromRouter, {
      parse: 'parse',
      explain: 'explain',
      planner: 'planner',
      multi_child: 'multi_child',
      fetch_candidates: 'fetch_candidates',
    })
    
    // === Parse extracts filters, then continues to fetch and recommend ===
    .addEdge('parse', 'fetch_candidates')
    
    // === Fetch candidates always leads to recommend ===
    .addEdge('fetch_candidates', 'recommend')
    
    // === Recommend is terminal ===
    .addEdge('recommend', END)
    
    // === Multi-child optimizes then fetches candidates ===
    .addEdge('multi_child', 'fetch_candidates')
    
    // === Terminal nodes ===
    .addEdge('explain', END)
    .addEdge('planner', END);
    
  return graph.compile();
}

/**
 * Singleton graph instance
 */
let _graphInstance: ReturnType<typeof createAIGraph> | null = null;

/**
 * Get or create the AI graph instance
 */
export function getAIGraph() {
  if (!_graphInstance) {
    _graphInstance = createAIGraph();
  }
  return _graphInstance;
}

/**
 * Reset graph instance (useful for testing)
 */
export function resetAIGraph() {
  _graphInstance = null;
}

/**
 * Execute the AI graph with given input
 */
export async function executeAIGraph(input: Partial<AIGraphStateType>): Promise<AIGraphStateType> {
  const graph = getAIGraph();
  
  const startTime = Date.now();
  
  // Provide defaults
  const initialState = {
    request_id: input.request_id || `req_${Date.now()}`,
    request_type: input.request_type || 'recommend',
    search_intent: input.search_intent || '',
    raw_query: input.raw_query,
    user_id: input.user_id,
    parsed_filters: input.parsed_filters,
    family_context: input.family_context,
    multi_child_mode: input.multi_child_mode,
    selected_child_ids: input.selected_child_ids,
    activity_id: input.activity_id,
    planner_constraints: input.planner_constraints,
  };
  
  try {
    const result = await graph.invoke(initialState);
    
    // Add latency
    result.latency_ms = Date.now() - startTime;
    
    return result;
  } catch (error) {
    console.error('❌ [AIGraph] Execution error:', error);
    throw error;
  }
}
