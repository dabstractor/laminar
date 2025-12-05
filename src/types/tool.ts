/**
 * Tool definition following Anthropic tool spec
 */
export interface ToolDefinition {
  /** Unique tool name */
  name: string;
  /** Description for the model */
  description: string;
  /** JSON Schema for input validation */
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Event for a tool call execution
 */
export interface ToolCallEvent {
  /** Unique ID for this tool call */
  id: string;
  /** Name of the tool called */
  toolName: string;
  /** Input provided to the tool */
  input: unknown;
  /** Output from tool execution */
  output?: unknown;
  /** Error if tool failed */
  error?: unknown;
  /** Execution duration in ms */
  duration: number;
  /** ID of the parent prompt instance */
  parentPromptId: string;
}
