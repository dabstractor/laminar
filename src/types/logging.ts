/**
 * Log severity levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * A single log entry in the workflow
 */
export interface LogEntry {
  /** Unique identifier for this log entry */
  id: string;
  /** ID of the workflow that created this log */
  workflowId: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Severity level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Optional structured data */
  data?: unknown;
  /** ID of parent log entry (for hierarchical logging) */
  parentLogId?: string;
}
