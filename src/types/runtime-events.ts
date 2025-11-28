/**
 * Event types for the unified runtime event system
 * Per PRD Section 7.2
 */
export type EventType =
  // Workflow events
  | 'workflow.start'
  | 'workflow.end'
  | 'step.start'
  | 'step.end'
  // Agent events
  | 'agent.start'
  | 'agent.stream'
  | 'agent.end'
  | 'agent.retry'
  // Prompt events
  | 'prompt.start'
  | 'prompt.end'
  // Tool events
  | 'tool.start'
  | 'tool.end'
  // MCP events
  | 'mcp.start'
  | 'mcp.event'
  | 'mcp.end'
  // Other events
  | 'error'
  | 'cache.hit'
  | 'cache.miss';

/**
 * Node type in the event hierarchy
 */
export type EventNodeType = 'workflow' | 'agent' | 'prompt' | 'tool' | 'mcp';

/**
 * Metrics attached to runtime events
 */
export interface RuntimeEventMetrics {
  /** Input tokens consumed */
  tokensIn?: number;
  /** Output tokens generated */
  tokensOut?: number;
  /** Duration in milliseconds */
  durationMs?: number;
}

/**
 * Unified runtime event schema
 * Per PRD Section 7.1
 *
 * @remarks
 * This is a superset of WorkflowEvent, unifying all event types
 * for streaming observability.
 */
export interface RuntimeEvent {
  /** Unique event identifier */
  id: string;
  /** Parent event ID (for hierarchical events) */
  parentId?: string;
  /** Event type */
  type: EventType;
  /** When the event occurred */
  timestamp: number;
  /** Type of node that emitted the event */
  nodeType: EventNodeType;
  /** Optional name (agent name, tool name, etc.) */
  name?: string;
  /** Event-specific payload */
  payload?: Record<string, unknown>;
  /** Performance metrics */
  metrics?: RuntimeEventMetrics;
}

/**
 * Agent-specific event payload
 */
export interface AgentEventPayload {
  agentId: string;
  runId: string;
  model: string;
  category?: string;
}

/**
 * Tool-specific event payload
 */
export interface ToolEventPayload {
  toolName: string;
  input?: unknown;
  output?: unknown;
  error?: string;
}

/**
 * Cache-specific event payload
 */
export interface CacheEventPayload {
  cacheKey: string;
  hit: boolean;
}
