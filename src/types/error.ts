import type { LogEntry } from './logging.js';
import type { SerializedWorkflowState } from './snapshot.js';

/**
 * Rich error object containing workflow context
 */
export interface WorkflowError {
  /** Error message */
  message: string;
  /** Original thrown error */
  original: unknown;
  /** ID of workflow where error occurred */
  workflowId: string;
  /** Stack trace if available */
  stack?: string;
  /** State snapshot at time of error */
  state: SerializedWorkflowState;
  /** Logs from the failing workflow node */
  logs: LogEntry[];
}
