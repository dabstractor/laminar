import type { CCRModel } from './model.js';
import type { z } from 'zod';

/**
 * Tool configuration for agents
 */
export interface ToolConfig {
  /** Tool name (must be unique within agent) */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** JSON Schema for tool input */
  inputSchema: Record<string, unknown>;
  /** Function to execute the tool */
  execute: (input: unknown) => Promise<unknown>;
}

/**
 * MCP server configuration for agents
 */
export interface McpConfig {
  /** MCP server name */
  name: string;
  /** MCP server URL */
  url: string;
}

// Forward declaration for Prompt type (circular reference)
export type PromptType<T> = {
  readonly userPrompt: string;
  readonly data: Record<string, unknown>;
  readonly responseFormat: z.ZodType<T>;
  readonly modelOverride?: CCRModel;
};

/**
 * Context available during agent execution
 */
export interface AgentRunContext {
  /** Unique agent identifier */
  agentId: string;
  /** Unique run identifier */
  runId: string;
  /** The prompt being executed */
  prompt: PromptType<unknown>;
  /** Resolved model for this run */
  model: CCRModel;
  /** Provider extracted from model */
  provider: string;
  /** Workflow node ID if running within workflow */
  workflowNodeId?: string;
  /** Timestamp when run started */
  timestamp: number;
  /** Additional parameters */
  params: Record<string, unknown>;
}

/**
 * Hook points for agent execution lifecycle
 *
 * @remarks
 * All hooks are optional and receive context about the current run.
 * Hooks should not throw - errors are caught and logged.
 */
export interface AgentHooks {
  /** Called before prompt execution starts */
  beforePrompt?: (ctx: AgentRunContext) => void | Promise<void>;
  /** Called after prompt execution completes */
  afterPrompt?: (ctx: AgentRunContext, result: unknown) => void | Promise<void>;
  /** Called before response validation */
  beforeValidation?: (ctx: AgentRunContext, raw: unknown) => void | Promise<void>;
  /** Called after successful validation */
  afterValidation?: (ctx: AgentRunContext, validated: unknown) => void | Promise<void>;
  /** Called before checking cache */
  beforeCacheCheck?: (ctx: AgentRunContext) => void | Promise<void>;
  /** Called after writing to cache */
  afterCacheWrite?: (ctx: AgentRunContext) => void | Promise<void>;
  /** Called when an error occurs */
  onError?: (ctx: AgentRunContext, err: Error) => void | Promise<void>;
}

/**
 * Agent configuration
 *
 * @remarks
 * Per PRD Section 3.1, agents belong to categories and can have
 * default models, tools, MCP servers, and lifecycle hooks.
 */
export interface AgentConfig {
  /** Human-readable agent name */
  name?: string;
  /** Model category (e.g., "coding", "research") */
  category?: string;
  /** Default index within category (0 = smartest) */
  modelIndex?: number;
  /** Override default model (bypasses category) */
  defaultModel?: CCRModel;
  /** Override provider */
  defaultProvider?: string;
  /** Tools available to this agent */
  tools?: ToolConfig[];
  /** MCP servers available to this agent */
  mcps?: McpConfig[];
  /** Lifecycle hooks */
  hooks?: AgentHooks;
  /** Enable response caching (default: true) */
  enableCache?: boolean;
}

/**
 * Runtime overrides for individual prompt calls
 *
 * @remarks
 * Per PRD Section 3.3, these override agent config for a single call.
 */
export interface AgentRuntimeOverrides {
  /** Override model for this call */
  model?: CCRModel;
  /** Override provider for this call */
  provider?: string;
  /** Override temperature */
  temperature?: number;
  /** Additional tools for this call */
  tools?: ToolConfig[];
  /** Additional MCP servers for this call */
  mcps?: McpConfig[];
  /** Disable cache for this call */
  disableCache?: boolean;
}
