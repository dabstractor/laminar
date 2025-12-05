/**
 * MCP (Model Context Protocol) event
 */
export interface MCPEvent {
  /** Unique event ID */
  id: string;
  /** Event type */
  type: string;
  /** Event payload */
  payload: unknown;
  /** Parent prompt ID */
  parentPromptId: string;
  /** Event timestamp */
  timestamp: number;
}

/**
 * MCP interrupt for pause/resume flow
 */
export interface MCPInterrupt {
  /** Interrupt type */
  type: string;
  /** Interrupt data */
  data: unknown;
}
