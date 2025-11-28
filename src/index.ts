// Existing Types
export type {
  WorkflowStatus,
  WorkflowNode,
  LogLevel,
  LogEntry,
  SerializedWorkflowState,
  StateFieldMetadata,
  WorkflowError,
  WorkflowEvent,
  WorkflowObserver,
  StepOptions,
  TaskOptions,
  ErrorMergeStrategy,
} from './types/index.js';

// NEW: Model types
export type {
  CCRModel,
  CategoryModelConfig,
  ModelResolutionRequest,
} from './types/model.js';

// NEW: Agent types
export type {
  ToolConfig,
  McpConfig,
  AgentRunContext,
  AgentHooks,
  AgentConfig,
  AgentRuntimeOverrides,
} from './types/agent.js';

// NEW: Prompt types
export type { PromptConfig } from './types/prompt.js';

// NEW: Event types
export type {
  EventType,
  EventNodeType,
  RuntimeEventMetrics,
  RuntimeEvent,
} from './types/runtime-events.js';

// Core classes
export { Workflow } from './core/workflow.js';
export { WorkflowLogger } from './core/logger.js';

// Decorators
export { Step } from './decorators/step.js';
export { Task } from './decorators/task.js';
export { ObservedState, getObservedState } from './decorators/observed-state.js';

// Debugger
export { WorkflowTreeDebugger } from './debugger/tree-debugger.js';

// Utilities
export { Observable } from './utils/observable.js';
export type { Subscription, Observer } from './utils/observable.js';
export { generateId } from './utils/id.js';

// Examples (for reference)
export { TestCycleWorkflow } from './examples/test-cycle-workflow.js';
export { TDDOrchestrator } from './examples/tdd-orchestrator.js';

// NEW: Model/Router
export {
  parseCCRModel,
  formatCCRModel,
  validateCCRModel,
  InvalidCCRModelError,
  ModelResolver,
  ModelResolutionError,
  CCRRouter,
  CCRRoutingError,
} from './models/index.js';
export type {
  ParsedCCRModel,
  Message,
  CCRToolConfig,
  CCRRequest,
  CCRResponse,
  CCRUsage,
  CCR,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  RoutingAttemptEvent,
} from './models/index.js';

// NEW: Agent
export { Agent } from './agents/index.js';
export type { AgentExecutionContext } from './agents/agent.js';

// NEW: Prompt
export { Prompt, PromptValidationError } from './prompts/index.js';

// NEW: Cache
export { LRUAgentCache, generateCacheKey, getSchemaVersionHash } from './cache/index.js';
export type { AgentCache, CacheKeyParams } from './cache/index.js';

// NEW: Events
export { RuntimeEventBus, ChildEventBus } from './events/index.js';
export type { EventHandler, EventFilter } from './events/index.js';

// NEW: Tools
export { ToolExecutor, ToolExecutionError } from './tools/index.js';
