import type { LogEntry } from './logging.js';
import type { WorkflowEvent } from './events.js';
import type { SerializedWorkflowState } from './snapshot.js';
import type { TokenUsage } from './token-usage.js';
import type { ToolCallEvent } from './tool.js';
import type { MCPEvent } from './mcp.js';

/**
 * Workflow status representing the current execution state
 */
export type WorkflowStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Node type in the execution tree
 */
export type WorkflowNodeType = 'workflow' | 'step' | 'agent' | 'prompt' | 'tool' | 'mcp';

/**
 * Represents a node in the workflow execution tree
 * This is the data structure, not the Workflow class
 */
export interface WorkflowNode {
  /** Unique identifier for this workflow instance */
  id: string;
  /** Human-readable name */
  name: string;
  /** Parent node reference (null for root) */
  parent: WorkflowNode | null;
  /** Child workflow nodes */
  children: WorkflowNode[];
  /** Current execution status */
  status: WorkflowStatus;
  /** Log entries for this node */
  logs: LogEntry[];
  /** Events emitted by this node */
  events: WorkflowEvent[];
  /** Optional serialized state snapshot */
  stateSnapshot: SerializedWorkflowState | null;
  // New fields for agent/prompt nodes
  /** Type of this node */
  nodeType?: WorkflowNodeType;
  /** Token usage if applicable */
  tokenUsage?: TokenUsage;
  /** Tool calls if this is a prompt node */
  toolCalls?: ToolCallEvent[];
  /** MCP events if applicable */
  mcpEvents?: MCPEvent[];
}
