import type { CCRModel } from '../types/model.js';

/**
 * Message in a CCR conversation
 */
export interface Message {
  /** Role of the message sender */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
}

/**
 * Tool configuration for CCR requests
 */
export interface CCRToolConfig {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** JSON Schema for tool input */
  inputSchema: Record<string, unknown>;
}

/**
 * MCP server configuration
 */
export interface McpConfig {
  /** MCP server name */
  name: string;
  /** MCP server URL */
  url: string;
}

/**
 * Request to send to CCR (Claude Code Router)
 */
export interface CCRRequest {
  /** Model to use in CCR format */
  model: CCRModel;
  /** Conversation messages */
  messages: Message[];
  /** Optional tools available */
  tools?: CCRToolConfig[];
  /** Optional MCP servers */
  mcps?: McpConfig[];
  /** Optional temperature */
  temperature?: number;
  /** Optional max tokens */
  maxTokens?: number;
}

/**
 * Tool use block in response
 */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

/**
 * Text block in response
 */
export interface TextBlock {
  type: 'text';
  text: string;
}

/**
 * Response content block
 */
export type ContentBlock = TextBlock | ToolUseBlock;

/**
 * Usage metrics from CCR response
 */
export interface CCRUsage {
  /** Input tokens consumed */
  tokensIn: number;
  /** Output tokens generated */
  tokensOut: number;
}

/**
 * Response from CCR
 */
export interface CCRResponse {
  /** Response content blocks */
  content: ContentBlock[];
  /** Usage metrics */
  usage: CCRUsage;
  /** Stop reason */
  stopReason?: 'end_turn' | 'tool_use' | 'max_tokens';
}

/**
 * CCR interface - implemented by provider adapters
 *
 * @remarks
 * This is the main abstraction for LLM providers.
 * Implementations handle provider-specific API calls.
 */
export interface CCR {
  /**
   * Execute a CCR request
   *
   * @param request - The request to execute
   * @returns Response from the model
   * @throws Error on API failure
   */
  run(request: CCRRequest): Promise<CCRResponse>;
}
