import type { WorkflowError } from './error.js';

/**
 * Strategy for merging multiple errors from concurrent operations
 */
export interface ErrorMergeStrategy {
  /** Enable error merging (default: false, first error wins) */
  enabled: boolean;
  /** Maximum depth to merge errors */
  maxMergeDepth?: number;
  /** Custom function to combine multiple errors */
  combine?(errors: WorkflowError[]): WorkflowError;
}
