/**
 * Workflow status representing the current execution state
 */
export type WorkflowStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

// Forward declarations - import from their respective files
import type { LogEntry } from './logging.js';
import type { WorkflowEvent } from './events.js';
import type { SerializedWorkflowState } from './snapshot.js';

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
}
