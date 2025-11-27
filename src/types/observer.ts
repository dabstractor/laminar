import type { LogEntry } from './logging.js';
import type { WorkflowEvent } from './events.js';
import type { WorkflowNode } from './workflow.js';

/**
 * Observer interface for subscribing to workflow events
 * Observers attach to the root workflow and receive all events
 */
export interface WorkflowObserver {
  /** Called when a log entry is created */
  onLog(entry: LogEntry): void;
  /** Called when any workflow event occurs */
  onEvent(event: WorkflowEvent): void;
  /** Called when a node's state is updated */
  onStateUpdated(node: WorkflowNode): void;
  /** Called when the tree structure changes */
  onTreeChanged(root: WorkflowNode): void;
}
