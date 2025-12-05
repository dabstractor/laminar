import type { AgentConfig, AgentRunResult } from './agent-config.js';
import type { TokenUsage } from './token-usage.js';
import type { LogLevel } from './logging.js';

/**
 * Configuration for a workflow step
 */
export interface WorkflowStepConfig {
  /** Optional unique ID */
  id?: string;
  /** Step name */
  name?: string;
  /** Agents in this step */
  agents: AgentConfig[];
}

/**
 * Configuration for an agent workflow
 */
export interface AgentWorkflowConfig {
  /** Optional unique ID */
  id?: string;
  /** Workflow name */
  name?: string;
  /** Steps in execution order */
  steps: WorkflowStepConfig[];
  /** Default model for agents/prompts that don't specify one */
  defaultModel?: string;
  /** Enable caching at workflow level */
  enableCache?: boolean;
  /** Log level */
  logLevel?: LogLevel;
}

/**
 * State of a workflow run
 */
export interface WorkflowRunState {
  /** Run start timestamp */
  startTime: number;
  /** Run end timestamp (if completed) */
  endTime?: number;
  /** Current step index */
  currentStepIndex: number;
  /** Whether run is in progress */
  isRunning: boolean;
}

/**
 * Result from a workflow run
 */
export interface WorkflowRunResult {
  /** Results from each step */
  stepResults: StepRunResult[];
  /** Aggregated token usage */
  tokenUsage: TokenUsage;
  /** Total duration in ms */
  totalDuration: number;
  /** Error if failed */
  error?: unknown;
}

/**
 * Result from a step run
 */
export interface StepRunResult {
  /** Step name */
  stepName: string;
  /** Results from each agent in the step */
  agentResults: AgentRunResult[];
  /** Step duration in ms */
  duration: number;
}
