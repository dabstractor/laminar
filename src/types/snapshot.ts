/**
 * Serialized workflow state as key-value pairs
 */
export type SerializedWorkflowState = Record<string, unknown>;

/**
 * Metadata for observed state fields
 */
export interface StateFieldMetadata {
  /** If true, field is not included in snapshots */
  hidden?: boolean;
  /** If true, value is shown as '***' in snapshots */
  redact?: boolean;
}
