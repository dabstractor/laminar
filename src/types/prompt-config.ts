import type { TokenUsage } from './token-usage.js';
import type { ToolCallEvent } from './tool.js';
import type { MCPEvent } from './mcp.js';

/**
 * Hooks for prompt execution
 */
export interface PromptHooks {
  /** Called before API call */
  beforeCall?: (input: unknown) => Promise<unknown> | unknown;
  /** Called after API call */
  afterCall?: (result: PromptResult) => Promise<PromptResult> | PromptResult;
  /** Called for each tool call */
  onTool?: (toolCall: ToolCallEvent) => Promise<void> | void;
  /** Called for MCP events */
  onMCP?: (event: MCPEvent) => Promise<void> | void;
  /** Called on JSON schema validation error */
  onValidationError?: (error: unknown, result: PromptResult) => Promise<void> | void;
}

/**
 * Configuration for an immutable prompt
 */
export interface PromptConfig {
  /** Optional unique ID */
  id?: string;
  /** Prompt name */
  name: string;
  /** Optional system prompt */
  system?: string;
  /** User message template (supports {{variable}} interpolation) */
  user: string;
  /** Optional model override */
  model?: string;
  /** If true, result can be cached */
  cacheable?: boolean;
  /** Optional JSON Schema for output validation */
  jsonSchema?: object;
  /** Optional hooks */
  hooks?: PromptHooks;
}

/**
 * Result from executing a prompt
 */
export interface PromptResult {
  /** Response content */
  content: string;
  /** Token usage */
  tokenUsage: TokenUsage;
  /** Execution duration in ms */
  duration: number;
  /** Tool calls made during execution */
  toolCalls: ToolCallEvent[];
  /** MCP events received */
  mcpEvents: MCPEvent[];
  /** Error if failed */
  error?: unknown;
  /** Whether result was from cache */
  cacheHit?: boolean;
}
