import type { PromptConfig, PromptResult } from './prompt-config.js';
import type { ToolDefinition } from './tool.js';
import type { TokenUsage } from './token-usage.js';

/**
 * Hooks for agent execution
 */
export interface AgentHooks {
  /** Called before agent run */
  beforeRun?: (input: unknown) => Promise<unknown> | unknown;
  /** Called after agent run */
  afterRun?: (result: AgentRunResult) => Promise<AgentRunResult> | AgentRunResult;
  /** Called before each prompt */
  beforePrompt?: (prompt: PromptConfig, input: unknown) => Promise<unknown> | unknown;
  /** Called after each prompt */
  afterPrompt?: (prompt: PromptConfig, result: PromptResult) => Promise<PromptResult> | PromptResult;
  /** Called on error */
  onError?: (error: unknown) => Promise<void> | void;
  /** Called when reflection is triggered */
  onReflection?: (failedResult: PromptResult, reflectionResult: PromptResult) => Promise<void> | void;
}

/**
 * Configuration for an agent
 */
export interface AgentConfig {
  /** Optional unique ID */
  id?: string;
  /** Agent name (required) */
  name: string;
  /** Model to use (e.g., "claude-sonnet-4-5-20250929") */
  model?: string;
  /** Ordered list of prompts to execute */
  prompts: PromptConfig[];
  /** Tools available to the agent */
  tools?: ToolDefinition[];
  /** Enable reflection on failures */
  enableReflection?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Enable caching */
  enableCache?: boolean;
  /** Agent hooks */
  hooks?: AgentHooks;
}

/**
 * Result from an agent run
 */
export interface AgentRunResult {
  /** Results from each prompt */
  promptResults: PromptResult[];
  /** Aggregated token usage */
  tokenUsage: TokenUsage;
  /** Total duration in ms */
  totalDuration: number;
  /** Number of retries performed */
  retryCount: number;
  /** Error if failed */
  error?: unknown;
  /** Reflection metadata if reflection was used */
  reflectionMetadata?: {
    originalError: unknown;
    reflectionPromptId: string;
    reflectionResult: PromptResult;
  };
}
