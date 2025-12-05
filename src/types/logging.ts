import type { TokenUsage } from './token-usage.js';

/**
 * Log severity levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

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
  // New fields for agent/prompt hierarchy
  /** Agent ID if log is from an agent */
  agentId?: string;
  /** Prompt ID if log is from a prompt */
  promptId?: string;
  /** Tool ID if log is from a tool call */
  toolId?: string;
  /** Token usage associated with this log */
  tokenUsage?: TokenUsage;
  /** Retry count if this is a retry */
  retryCount?: number;
  /** Reflection metadata if this is from reflection */
  reflectionMetadata?: {
    isReflection: boolean;
    originalPromptId?: string;
  };
}
