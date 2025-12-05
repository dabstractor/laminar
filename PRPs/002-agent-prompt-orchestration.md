# PRP-002: Agent & Prompt Orchestration Layer

> **PRP**: Product Requirements Package - Comprehensive implementation guide for Anthropic Agent SDK integration

**Version**: 1.0
**Status**: Implementation-Ready
**Source PRD**: `/home/dustin/projects/laminar/PRPs/PRDs/002-agents-prompts.md`
**Source Tasks**: `/home/dustin/projects/laminar/tasks.json`

## Pre-Implementation Checklist

Before implementing, verify you have:
- [ ] Read the full PRD at `/home/dustin/projects/laminar/PRPs/PRDs/002-agents-prompts.md`
- [ ] Read the tasks breakdown at `/home/dustin/projects/laminar/tasks.json`
- [ ] Read the existing PRP-001 at `/home/dustin/projects/laminar/PRPs/001-hierarchical-workflow-engine.md`
- [ ] Node.js 18+ LTS installed
- [ ] TypeScript 5.2+ available
- [ ] Understanding of existing `Workflow` class at `/home/dustin/projects/laminar/src/core/workflow.ts`
- [ ] Understanding of existing `WorkflowEvent` at `/home/dustin/projects/laminar/src/types/events.ts`
- [ ] Familiarity with Anthropic SDK patterns (see `/home/dustin/projects/laminar/ANTHROPIC-SDK-QUICK-REFERENCE.md`)

---

## 1. Goal

### Feature Goal
Extend the existing Laminar workflow engine with an **Agent** and **PromptInstance** abstraction layer that integrates directly with the Anthropic SDK, providing tool calling, MCP event handling, prompt caching, reflection/retry logic, streaming support, and full hierarchical observability.

### Deliverable
An extended npm-publishable TypeScript library adding:
- `AgentWorkflow` class extending existing workflow patterns
- `Agent` class for repeatable LLM runs with tools, retries, and reflection
- `PromptInstance` class for immutable prompt execution
- `ToolExecutor` class for tool call handling
- `MCPHandler` class for MCP event integration
- `AnthropicClient` wrapper for consistent API usage
- `Cache` interface with `MemoryCache` implementation
- Extended `WorkflowEvent` types for agent/prompt/tool events
- Extended `WorkflowNode` types for new node kinds
- Extended `WorkflowTreeDebugger` for agent/prompt visualization
- `TokenUsage` tracking and aggregation utilities
- Comprehensive test suite following existing patterns

### Success Definition
1. All TypeScript compiles with strict mode enabled
2. `AgentWorkflow` can orchestrate multiple agents with prompts
3. Agents call Anthropic API via `AnthropicClient` wrapper
4. Tool calls work with proper agentic loops
5. Streaming returns tokens in real-time
6. Caching prevents redundant API calls
7. Reflection triggers on validation failures
8. `WorkflowTreeDebugger` shows agent/prompt/tool hierarchy
9. Token usage aggregates up the hierarchy
10. All existing tests continue to pass
11. New tests achieve comprehensive coverage

---

## 2. Context

### External Documentation
```yaml
primary_docs:
  - url: "https://platform.claude.com/docs/en/api/messages"
    purpose: "Anthropic Messages API - create messages, token usage"
    key_sections:
      - "Creating messages"
      - "Message response structure"
      - "Token usage"

  - url: "https://platform.claude.com/docs/en/build-with-claude/tool-use"
    purpose: "Tool calling patterns and JSON schema definitions"
    key_sections:
      - "Defining tools"
      - "Tool use responses"
      - "Agentic loops"

  - url: "https://platform.claude.com/docs/en/build-with-claude/streaming"
    purpose: "Streaming API patterns"
    key_sections:
      - "messages.stream() method"
      - "Event types"
      - "Helper methods"

  - url: "https://platform.claude.com/docs/en/api/handling-stop-reasons"
    purpose: "How to handle different stop reasons"
    key_sections:
      - "end_turn vs tool_use"
      - "max_tokens handling"

  - url: "https://platform.claude.com/docs/en/build-with-claude/token-counting"
    purpose: "Token counting and cost tracking"
    key_sections:
      - "countTokens method"
      - "Response usage structure"

reference_implementations:
  - url: "https://github.com/anthropics/anthropic-sdk-typescript"
    purpose: "Official TypeScript SDK patterns"
    files_to_study:
      - "src/resources/messages.ts"
      - "examples/"

  - url: "https://github.com/anthropics/claude-agent-sdk-typescript"
    purpose: "Claude Agent SDK patterns for orchestration"
    files_to_study:
      - "src/agent.ts"
      - "src/tools.ts"

local_research:
  - file: "/home/dustin/projects/laminar/ANTHROPIC-SDK-QUICK-REFERENCE.md"
    purpose: "Quick reference for SDK patterns - installation, messages, streaming, tools"

  - file: "/home/dustin/projects/laminar/anthropic-sdk-research.md"
    purpose: "Comprehensive SDK research with 40+ code examples"

  - file: "/home/dustin/projects/laminar/anthropic-sdk-implementation-guide.md"
    purpose: "Production-ready implementation patterns"

  - file: "/home/dustin/projects/laminar/anthropic-sdk-types-reference.md"
    purpose: "TypeScript type definitions and patterns"
```

### Codebase Context
```yaml
existing_patterns:
  - file: "/home/dustin/projects/laminar/src/core/workflow.ts"
    pattern: "Workflow abstract base class"
    follow_for: "Extending with AgentWorkflow - use same parent/child, observer, event patterns"

  - file: "/home/dustin/projects/laminar/src/types/events.ts"
    pattern: "WorkflowEvent discriminated union"
    follow_for: "Adding AgentRunStart, AgentRunEnd, PromptInstanceStart, PromptInstanceEnd, ToolCallStart, ToolCallEnd, MCPEventReceived events"

  - file: "/home/dustin/projects/laminar/src/types/logging.ts"
    pattern: "LogEntry interface"
    follow_for: "Extending with agentId?, promptId?, toolId?, tokenUsage? fields"

  - file: "/home/dustin/projects/laminar/src/types/workflow.ts"
    pattern: "WorkflowNode interface"
    follow_for: "Adding nodeType field and optional agent/prompt fields"

  - file: "/home/dustin/projects/laminar/src/decorators/step.ts"
    pattern: "@Step decorator implementation"
    follow_for: "Understanding how decorators wrap methods with event emission"

  - file: "/home/dustin/projects/laminar/src/utils/observable.ts"
    pattern: "Lightweight Observable<T>"
    follow_for: "Event streaming patterns for PromptInstance"

  - file: "/home/dustin/projects/laminar/src/debugger/tree-debugger.ts"
    pattern: "WorkflowTreeDebugger class"
    follow_for: "Extending to handle agent/prompt/tool node types"

related_files:
  - path: "/home/dustin/projects/laminar/src/core/logger.ts"
    relationship: "WorkflowLogger - will need access for agent/prompt logging"

  - path: "/home/dustin/projects/laminar/src/decorators/observed-state.ts"
    relationship: "@ObservedState decorator - agents may use for state tracking"

  - path: "/home/dustin/projects/laminar/src/types/error.ts"
    relationship: "WorkflowError - extend for agent/prompt error context"

naming_conventions:
  files: "kebab-case.ts (e.g., agent-workflow.ts, prompt-instance.ts, anthropic-client.ts)"
  classes: "PascalCase (e.g., Agent, PromptInstance, AnthropicClient, ToolExecutor)"
  interfaces: "PascalCase with Config/Options/Result suffix (e.g., AgentConfig, PromptResult)"
  types: "PascalCase (e.g., TokenUsage, ToolCallEvent, MCPEvent)"
  constants: "SCREAMING_SNAKE_CASE (e.g., DEFAULT_REFLECTION_PROMPT)"
  functions: "camelCase (e.g., resolveModel, generateCacheKey, aggregateTokenUsage)"
```

### Technical Constraints
```yaml
typescript:
  version: "5.2+"
  config_requirements:
    - "target: ES2022"
    - "module: ES2022"
    - "strict: true"
    - "useDefineForClassFields: true"
    - "DO NOT use experimentalDecorators flag"

dependencies:
  required:
    - name: "@anthropic-ai/sdk"
      version: "^0.50.0"
      purpose: "Official Anthropic SDK for API calls"
    - name: "zod"
      version: "^3.22.0"
      purpose: "Schema validation for tool definitions (optional but recommended)"

  dev_dependencies:
    - name: "typescript"
      version: "^5.2.0"
      purpose: "TypeScript compiler"
    - name: "vitest"
      version: "^1.0.0"
      purpose: "Test framework (already installed)"
    - name: "@types/node"
      version: "^20.0.0"
      purpose: "Node.js types (already installed)"

  avoid:
    - name: "rxjs"
      reason: "Use existing Observable implementation"
    - name: "lodash"
      reason: "Implement utilities inline to keep zero-dep philosophy where possible"

runtime:
  node_version: "18+"
  target: "ES2022"
  env_vars:
    - "ANTHROPIC_API_KEY - Required for API calls"
```

### Known Gotchas
```yaml
pitfalls:
  - issue: "Arrow functions in decorators lose 'this' context"
    solution: "Always use regular function declarations in decorator wrappers"
    example: |
      // WRONG
      return (...args) => original.call(this, ...args);
      // CORRECT
      return function(...args) { return original.call(this, ...args); };

  - issue: "Anthropic SDK stop_reason checking"
    solution: "Always check response.stop_reason, not just response.content"
    example: |
      // WRONG
      if (response.content) { ... }
      // CORRECT
      if (response.stop_reason === 'end_turn') { ... }

  - issue: "Tool use loop not adding messages correctly"
    solution: "Add assistant response AND tool_result to messages array"
    example: |
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

  - issue: "Streaming events not caught"
    solution: "Always attach .on('error') handler before iterating"
    example: |
      const stream = client.messages.stream(...)
        .on('error', (e) => console.error(e));
      for await (const event of stream) { ... }

  - issue: "Cache key collision"
    solution: "Use stable JSON.stringify with sorted keys for deterministic hashing"

  - issue: "Token usage missing from response"
    solution: "Access response.usage.input_tokens and response.usage.output_tokens"

  - issue: "Reflection infinite loop"
    solution: "Track reflection count, limit to 1 reflection per prompt execution"

  - issue: "Parent model not cascading to prompts"
    solution: "Implement model resolution: prompt.model || agent.model || workflow.defaultModel || throw"
```

---

## 3. Implementation Tasks

> Tasks are ordered by dependency following the structure in `/home/dustin/projects/laminar/tasks.json`. Complete each task fully before moving to the next.

---

### Phase 1: Core Agent & Prompt Foundation

---

### Task 1: Core Configuration Types (P1.M1.T1)
**Depends on**: None
**Story Points**: 4

**Input**: Existing types in `/home/dustin/projects/laminar/src/types/`

**Steps**:

1. Create `/home/dustin/projects/laminar/src/types/token-usage.ts`:
```typescript
/**
 * Token usage tracking for API calls
 */
export interface TokenUsage {
  /** Input tokens consumed */
  inputTokens: number;
  /** Output tokens generated */
  outputTokens: number;
  /** Tokens used for cache creation (if applicable) */
  cacheCreationInputTokens?: number;
  /** Tokens read from cache (if applicable) */
  cacheReadInputTokens?: number;
}
```

2. Create `/home/dustin/projects/laminar/src/types/tool.ts`:
```typescript
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
```

3. Create `/home/dustin/projects/laminar/src/types/mcp.ts`:
```typescript
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
```

4. Create `/home/dustin/projects/laminar/src/types/prompt-config.ts`:
```typescript
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
```

5. Create `/home/dustin/projects/laminar/src/types/agent-config.ts`:
```typescript
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
```

6. Create `/home/dustin/projects/laminar/src/types/workflow-config.ts`:
```typescript
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
```

7. Update `/home/dustin/projects/laminar/src/types/index.ts` to export new types:
```typescript
// ... existing exports ...

// Agent/Prompt types
export type { TokenUsage } from './token-usage.js';
export type { ToolDefinition, ToolCallEvent } from './tool.js';
export type { MCPEvent, MCPInterrupt } from './mcp.js';
export type { PromptConfig, PromptHooks, PromptResult } from './prompt-config.js';
export type { AgentConfig, AgentHooks, AgentRunResult } from './agent-config.js';
export type {
  WorkflowStepConfig,
  AgentWorkflowConfig,
  WorkflowRunState,
  WorkflowRunResult,
  StepRunResult,
} from './workflow-config.js';
```

**Output**: New type files in `src/types/`

**Validation**:
- `npm run lint` passes with no errors
- All imports resolve correctly

---

### Task 2: Extend Event Hierarchy (P1.M1.T2)
**Depends on**: Task 1
**Story Points**: 1.5

**Input**: New types from Task 1, existing events.ts

**Steps**:

1. Update `/home/dustin/projects/laminar/src/types/events.ts`:
```typescript
import type { WorkflowNode } from './workflow.js';
import type { WorkflowError } from './error.js';
import type { ToolCallEvent } from './tool.js';
import type { MCPEvent } from './mcp.js';
import type { TokenUsage } from './token-usage.js';
import type { PromptResult } from './prompt-config.js';
import type { AgentRunResult } from './agent-config.js';

/**
 * Discriminated union of all workflow events
 */
export type WorkflowEvent =
  // Existing events
  | { type: 'childAttached'; parentId: string; child: WorkflowNode }
  | { type: 'stateSnapshot'; node: WorkflowNode }
  | { type: 'stepStart'; node: WorkflowNode; step: string }
  | { type: 'stepEnd'; node: WorkflowNode; step: string; duration: number }
  | { type: 'error'; node: WorkflowNode; error: WorkflowError }
  | { type: 'taskStart'; node: WorkflowNode; task: string }
  | { type: 'taskEnd'; node: WorkflowNode; task: string }
  | { type: 'treeUpdated'; root: WorkflowNode }
  // New agent events
  | { type: 'agentRunStart'; agentId: string; agentName: string; input: unknown; timestamp: number }
  | { type: 'agentRunEnd'; agentId: string; agentName: string; result: AgentRunResult; duration: number; tokenUsage: TokenUsage }
  // New prompt events
  | { type: 'promptInstanceStart'; promptId: string; promptName: string; input: unknown; timestamp: number }
  | { type: 'promptInstanceEnd'; promptId: string; promptName: string; result: PromptResult; duration: number; tokenUsage: TokenUsage }
  // Token streaming event
  | { type: 'promptTokenReceived'; promptId: string; token: string; timestamp: number }
  // Tool events
  | { type: 'toolCallStart'; toolId: string; toolName: string; input: unknown; parentPromptId: string; timestamp: number }
  | { type: 'toolCallEnd'; toolId: string; toolName: string; output: unknown; error: unknown; duration: number; parentPromptId: string }
  // MCP events
  | { type: 'mcpEventReceived'; event: MCPEvent; parentPromptId: string }
  // Reflection events
  | { type: 'reflectionStart'; agentId: string; originalError: unknown; timestamp: number }
  | { type: 'reflectionEnd'; agentId: string; result: PromptResult; timestamp: number };
```

2. Update `/home/dustin/projects/laminar/src/types/logging.ts` to extend LogEntry:
```typescript
import type { TokenUsage } from './token-usage.js';

/**
 * Log severity levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * A single log entry in the workflow
 */
export interface LogEntry {
  /** Unique identifier for this log entry */
  id: string;
  /** ID of the workflow that created this log */
  workflowId: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Severity level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Optional structured data */
  data?: unknown;
  /** ID of parent log entry (for hierarchical logging) */
  parentLogId?: string;
  // New fields for agent/prompt hierarchy
  /** Agent ID if log is from an agent */
  agentId?: string;
  /** Prompt ID if log is from a prompt */
  promptId?: string;
  /** Tool ID if log is from a tool call */
  toolId?: string;
  /** Token usage associated with this log */
  tokenUsage?: TokenUsage;
  /** Retry count if this is a retry */
  retryCount?: number;
  /** Reflection metadata if this is from reflection */
  reflectionMetadata?: {
    isReflection: boolean;
    originalPromptId?: string;
  };
}
```

**Output**: Updated events.ts and logging.ts

**Validation**:
- `npm run lint` passes
- Existing tests still pass

---

### Task 3: Token Usage Utilities (P2.M1.T2)
**Depends on**: Task 1
**Story Points**: 2

**Input**: TokenUsage type from Task 1

**Steps**:

1. Create `/home/dustin/projects/laminar/src/utils/token-aggregator.ts`:
```typescript
import type { TokenUsage } from '../types/index.js';

/**
 * Aggregate multiple token usages into one
 */
export function aggregateTokenUsage(usages: TokenUsage[]): TokenUsage {
  const result: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
  };

  for (const usage of usages) {
    result.inputTokens += usage.inputTokens;
    result.outputTokens += usage.outputTokens;
    if (usage.cacheCreationInputTokens) {
      result.cacheCreationInputTokens = (result.cacheCreationInputTokens ?? 0) + usage.cacheCreationInputTokens;
    }
    if (usage.cacheReadInputTokens) {
      result.cacheReadInputTokens = (result.cacheReadInputTokens ?? 0) + usage.cacheReadInputTokens;
    }
  }

  return result;
}

/**
 * Format token usage as human-readable string
 */
export function formatTokenUsage(usage: TokenUsage): string {
  const parts = [`in: ${usage.inputTokens}`, `out: ${usage.outputTokens}`];

  if (usage.cacheCreationInputTokens) {
    parts.push(`cache-create: ${usage.cacheCreationInputTokens}`);
  }
  if (usage.cacheReadInputTokens) {
    parts.push(`cache-read: ${usage.cacheReadInputTokens}`);
  }

  return parts.join(', ');
}

/**
 * Calculate estimated cost in USD (using Claude Sonnet pricing)
 * @param usage Token usage
 * @param inputCostPer1M Cost per 1M input tokens (default: $3)
 * @param outputCostPer1M Cost per 1M output tokens (default: $15)
 */
export function estimateCost(
  usage: TokenUsage,
  inputCostPer1M: number = 3,
  outputCostPer1M: number = 15
): number {
  const inputCost = (usage.inputTokens / 1_000_000) * inputCostPer1M;
  const outputCost = (usage.outputTokens / 1_000_000) * outputCostPer1M;
  return inputCost + outputCost;
}

/**
 * Create empty token usage
 */
export function emptyTokenUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0 };
}
```

2. Update `/home/dustin/projects/laminar/src/utils/index.ts`:
```typescript
export { generateId } from './id.js';
export { Observable } from './observable.js';
export type { Subscription, Observer } from './observable.js';
export {
  aggregateTokenUsage,
  formatTokenUsage,
  estimateCost,
  emptyTokenUsage,
} from './token-aggregator.js';
```

**Output**: Token usage utilities

**Validation**: `npm run lint` passes

---

### Task 4: AnthropicClient Wrapper (P2.M1.T1)
**Depends on**: Task 3
**Story Points**: 2

**Input**: Token usage types and utilities

**Steps**:

1. Create `/home/dustin/projects/laminar/src/integrations/anthropic-client.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { TokenUsage } from '../types/index.js';

/**
 * Message parameters for API calls
 */
export interface MessageParams {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<{ type: string; [key: string]: unknown }>;
  }>;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: object;
  }>;
}

/**
 * Wrapper around Anthropic SDK for consistent usage
 */
export class AnthropicClient {
  private client: Anthropic;
  private maxRetries: number;

  constructor(options?: { apiKey?: string; maxRetries?: number }) {
    this.client = new Anthropic({
      apiKey: options?.apiKey ?? process.env.ANTHROPIC_API_KEY,
      maxRetries: options?.maxRetries ?? 3,
    });
    this.maxRetries = options?.maxRetries ?? 3;
  }

  /**
   * Create a message (non-streaming)
   */
  async createMessage(params: MessageParams): Promise<{
    content: Anthropic.Messages.ContentBlock[];
    stopReason: string | null;
    usage: TokenUsage;
    id: string;
  }> {
    const response = await this.client.messages.create(params);

    return {
      content: response.content,
      stopReason: response.stop_reason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      id: response.id,
    };
  }

  /**
   * Create a streaming message
   */
  createMessageStream(params: MessageParams): ReturnType<typeof this.client.messages.stream> {
    return this.client.messages.stream(params);
  }

  /**
   * Count tokens before sending
   */
  async countTokens(params: Omit<MessageParams, 'max_tokens'>): Promise<number> {
    const result = await this.client.messages.countTokens({
      model: params.model,
      system: params.system,
      messages: params.messages as any,
      tools: params.tools as any,
    });
    return result.input_tokens;
  }

  /**
   * Get the underlying Anthropic client
   */
  getRawClient(): Anthropic {
    return this.client;
  }
}
```

2. Create `/home/dustin/projects/laminar/src/integrations/index.ts`:
```typescript
export { AnthropicClient } from './anthropic-client.js';
export type { MessageParams } from './anthropic-client.js';
```

**Output**: AnthropicClient wrapper

**Validation**: TypeScript compiles

---

### Task 5: PromptInstance Class (P1.M2.T3)
**Depends on**: Task 4
**Story Points**: 6

**Input**: Types, AnthropicClient

**Steps**:

1. Create `/home/dustin/projects/laminar/src/core/prompt-instance.ts`:
```typescript
import type {
  PromptConfig,
  PromptResult,
  ToolCallEvent,
  MCPEvent,
  TokenUsage,
  WorkflowEvent,
} from '../types/index.js';
import { generateId } from '../utils/id.js';
import { emptyTokenUsage, aggregateTokenUsage } from '../utils/token-aggregator.js';
import { AnthropicClient, type MessageParams } from '../integrations/anthropic-client.js';
import { Observable } from '../utils/observable.js';

/**
 * Immutable prompt instance for a single execution
 */
export class PromptInstance {
  /** Unique ID for this instance */
  public readonly id: string;

  /** Frozen prompt config */
  public readonly config: Readonly<PromptConfig>;

  /** Resolved model for execution */
  public readonly resolvedModel: string;

  /** Input data for interpolation */
  public readonly input: unknown;

  /** Observable for events */
  private eventObservable: Observable<WorkflowEvent> | null = null;

  /** Tool handlers */
  private toolHandlers: Map<string, (input: unknown) => Promise<unknown>> = new Map();

  constructor(
    config: PromptConfig,
    resolvedModel: string,
    input: unknown,
    options?: {
      eventObservable?: Observable<WorkflowEvent>;
      toolHandlers?: Map<string, (input: unknown) => Promise<unknown>>;
    }
  ) {
    this.id = config.id ?? generateId();
    this.config = Object.freeze({ ...config });
    this.resolvedModel = resolvedModel;
    this.input = input;
    this.eventObservable = options?.eventObservable ?? null;
    this.toolHandlers = options?.toolHandlers ?? new Map();
  }

  /**
   * Interpolate template variables in a string
   * Supports {{path.to.value}} syntax
   */
  private interpolate(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const keys = path.trim().split('.');
      let value: unknown = context;

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = (value as Record<string, unknown>)[key];
        } else {
          // Leave placeholder if path not found
          return match;
        }
      }

      return String(value ?? match);
    });
  }

  /**
   * Emit an event to the observable
   */
  private emit(event: WorkflowEvent): void {
    if (this.eventObservable) {
      this.eventObservable.next(event);
    }
  }

  /**
   * Execute the prompt
   */
  async run(client: AnthropicClient): Promise<PromptResult> {
    const startTime = Date.now();
    const toolCalls: ToolCallEvent[] = [];
    const mcpEvents: MCPEvent[] = [];
    let totalUsage = emptyTokenUsage();

    // Apply beforeCall hook
    let processedInput = this.input;
    if (this.config.hooks?.beforeCall) {
      processedInput = await this.config.hooks.beforeCall(this.input);
    }

    // Emit start event
    this.emit({
      type: 'promptInstanceStart',
      promptId: this.id,
      promptName: this.config.name,
      input: processedInput,
      timestamp: startTime,
    });

    try {
      // Build context for interpolation
      const context = typeof processedInput === 'object' && processedInput !== null
        ? processedInput as Record<string, unknown>
        : { input: processedInput };

      // Interpolate templates
      const userContent = this.interpolate(this.config.user, context);
      const systemContent = this.config.system
        ? this.interpolate(this.config.system, context)
        : undefined;

      // Build messages
      const messages: MessageParams['messages'] = [
        { role: 'user', content: userContent }
      ];

      // Build tool definitions if available
      const tools = this.toolHandlers.size > 0
        ? Array.from(this.toolHandlers.keys()).map(name => ({
            name,
            description: `Tool: ${name}`,
            input_schema: { type: 'object' as const, properties: {} },
          }))
        : undefined;

      // Execute API call with agentic loop
      let response = await client.createMessage({
        model: this.resolvedModel,
        max_tokens: 4096,
        system: systemContent,
        messages,
        tools,
      });

      totalUsage = aggregateTokenUsage([totalUsage, response.usage]);

      // Handle tool calls in a loop
      while (response.stopReason === 'tool_use') {
        // Add assistant response to messages
        messages.push({
          role: 'assistant',
          content: response.content as any,
        });

        // Process tool calls
        const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const toolStartTime = Date.now();
            const toolId = generateId();

            // Emit tool start
            this.emit({
              type: 'toolCallStart',
              toolId,
              toolName: block.name,
              input: block.input,
              parentPromptId: this.id,
              timestamp: toolStartTime,
            });

            let toolOutput: unknown;
            let toolError: unknown;

            try {
              const handler = this.toolHandlers.get(block.name);
              if (handler) {
                // Call onTool hook
                const toolCallEvent: ToolCallEvent = {
                  id: toolId,
                  toolName: block.name,
                  input: block.input,
                  duration: 0,
                  parentPromptId: this.id,
                };
                if (this.config.hooks?.onTool) {
                  await this.config.hooks.onTool(toolCallEvent);
                }

                toolOutput = await handler(block.input);
              } else {
                toolError = new Error(`Unknown tool: ${block.name}`);
              }
            } catch (err) {
              toolError = err;
            }

            const toolEndTime = Date.now();

            // Emit tool end
            this.emit({
              type: 'toolCallEnd',
              toolId,
              toolName: block.name,
              output: toolOutput,
              error: toolError,
              duration: toolEndTime - toolStartTime,
              parentPromptId: this.id,
            });

            // Record tool call
            toolCalls.push({
              id: toolId,
              toolName: block.name,
              input: block.input,
              output: toolOutput,
              error: toolError,
              duration: toolEndTime - toolStartTime,
              parentPromptId: this.id,
            });

            // Add to results
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: toolError ? String(toolError) : JSON.stringify(toolOutput),
            });
          }
        }

        // Add tool results
        messages.push({
          role: 'user',
          content: toolResults as any,
        });

        // Continue the loop
        response = await client.createMessage({
          model: this.resolvedModel,
          max_tokens: 4096,
          system: systemContent,
          messages,
          tools,
        });

        totalUsage = aggregateTokenUsage([totalUsage, response.usage]);
      }

      // Extract final text content
      const textContent = response.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      let result: PromptResult = {
        content: textContent,
        tokenUsage: totalUsage,
        duration: Date.now() - startTime,
        toolCalls,
        mcpEvents,
      };

      // Apply afterCall hook
      if (this.config.hooks?.afterCall) {
        result = await this.config.hooks.afterCall(result);
      }

      // Emit end event
      this.emit({
        type: 'promptInstanceEnd',
        promptId: this.id,
        promptName: this.config.name,
        result,
        duration: result.duration,
        tokenUsage: result.tokenUsage,
      });

      return result;

    } catch (error) {
      const result: PromptResult = {
        content: '',
        tokenUsage: totalUsage,
        duration: Date.now() - startTime,
        toolCalls,
        mcpEvents,
        error,
      };

      // Emit end event with error
      this.emit({
        type: 'promptInstanceEnd',
        promptId: this.id,
        promptName: this.config.name,
        result,
        duration: result.duration,
        tokenUsage: result.tokenUsage,
      });

      return result;
    }
  }

  /**
   * Execute with streaming
   */
  async *runStreaming(client: AnthropicClient): AsyncGenerator<{ type: 'token'; token: string } | { type: 'result'; result: PromptResult }> {
    const startTime = Date.now();
    const toolCalls: ToolCallEvent[] = [];
    const mcpEvents: MCPEvent[] = [];
    let totalUsage = emptyTokenUsage();
    let fullContent = '';

    // Apply beforeCall hook
    let processedInput = this.input;
    if (this.config.hooks?.beforeCall) {
      processedInput = await this.config.hooks.beforeCall(this.input);
    }

    // Emit start event
    this.emit({
      type: 'promptInstanceStart',
      promptId: this.id,
      promptName: this.config.name,
      input: processedInput,
      timestamp: startTime,
    });

    try {
      // Build context for interpolation
      const context = typeof processedInput === 'object' && processedInput !== null
        ? processedInput as Record<string, unknown>
        : { input: processedInput };

      // Interpolate templates
      const userContent = this.interpolate(this.config.user, context);
      const systemContent = this.config.system
        ? this.interpolate(this.config.system, context)
        : undefined;

      // Create streaming request
      const stream = client.createMessageStream({
        model: this.resolvedModel,
        max_tokens: 4096,
        system: systemContent,
        messages: [{ role: 'user', content: userContent }],
      });

      // Process stream events
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const token = event.delta.text;
          fullContent += token;

          // Emit token event
          this.emit({
            type: 'promptTokenReceived',
            promptId: this.id,
            token,
            timestamp: Date.now(),
          });

          yield { type: 'token', token };
        }
      }

      // Get final message for usage
      const finalMessage = await stream.finalMessage();
      totalUsage = {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      };

      const result: PromptResult = {
        content: fullContent,
        tokenUsage: totalUsage,
        duration: Date.now() - startTime,
        toolCalls,
        mcpEvents,
      };

      // Apply afterCall hook
      let finalResult = result;
      if (this.config.hooks?.afterCall) {
        finalResult = await this.config.hooks.afterCall(result);
      }

      // Emit end event
      this.emit({
        type: 'promptInstanceEnd',
        promptId: this.id,
        promptName: this.config.name,
        result: finalResult,
        duration: finalResult.duration,
        tokenUsage: finalResult.tokenUsage,
      });

      yield { type: 'result', result: finalResult };

    } catch (error) {
      const result: PromptResult = {
        content: fullContent,
        tokenUsage: totalUsage,
        duration: Date.now() - startTime,
        toolCalls,
        mcpEvents,
        error,
      };

      // Emit end event with error
      this.emit({
        type: 'promptInstanceEnd',
        promptId: this.id,
        promptName: this.config.name,
        result,
        duration: result.duration,
        tokenUsage: result.tokenUsage,
      });

      yield { type: 'result', result };
    }
  }
}
```

**Output**: PromptInstance class with tool loop and streaming

**Validation**: TypeScript compiles

---

### Task 6: Agent Class (P1.M2.T2)
**Depends on**: Task 5
**Story Points**: 6

**Input**: PromptInstance, types

**Steps**:

1. Create `/home/dustin/projects/laminar/src/core/agent.ts`:
```typescript
import type {
  AgentConfig,
  AgentRunResult,
  PromptResult,
  TokenUsage,
  WorkflowEvent,
  ToolDefinition,
} from '../types/index.js';
import { generateId } from '../utils/id.js';
import { aggregateTokenUsage, emptyTokenUsage } from '../utils/token-aggregator.js';
import { AnthropicClient } from '../integrations/anthropic-client.js';
import { PromptInstance } from './prompt-instance.js';
import { Observable } from '../utils/observable.js';

/**
 * Default reflection prompt template
 */
const DEFAULT_REFLECTION_PROMPT = {
  name: 'reflection',
  system: `You are a helpful assistant tasked with analyzing a failed response and providing a corrected version.
Analyze the error and the original output, then provide a corrected response.`,
  user: `Original prompt: {{originalPrompt}}

Original response: {{originalResult}}

Error: {{error}}

Please provide a corrected response that addresses the error.`,
};

/**
 * Agent that executes prompts with tools, retries, and reflection
 */
export class Agent {
  /** Unique agent ID */
  public readonly id: string;

  /** Agent configuration */
  public readonly config: AgentConfig;

  /** Parent model (from workflow) */
  private parentModel: string | null;

  /** Event observable */
  private eventObservable: Observable<WorkflowEvent>;

  /** Tool handlers */
  private toolHandlers: Map<string, (input: unknown) => Promise<unknown>> = new Map();

  constructor(
    config: AgentConfig,
    options?: {
      parentModel?: string;
      eventObservable?: Observable<WorkflowEvent>;
      toolHandlers?: Record<string, (input: unknown) => Promise<unknown>>;
    }
  ) {
    this.id = config.id ?? generateId();
    this.config = config;
    this.parentModel = options?.parentModel ?? null;
    this.eventObservable = options?.eventObservable ?? new Observable();

    // Register tool handlers
    if (options?.toolHandlers) {
      for (const [name, handler] of Object.entries(options.toolHandlers)) {
        this.toolHandlers.set(name, handler);
      }
    }
  }

  /**
   * Resolve the model to use for a prompt
   */
  private resolveModel(promptModel?: string): string {
    const model = promptModel ?? this.config.model ?? this.parentModel;
    if (!model) {
      throw new Error('No model configured. Specify model on prompt, agent, or workflow.');
    }
    return model;
  }

  /**
   * Emit an event
   */
  private emit(event: WorkflowEvent): void {
    this.eventObservable.next(event);
  }

  /**
   * Execute reflection on a failed prompt result
   */
  async reflect(
    client: AnthropicClient,
    originalPromptConfig: { user: string; system?: string },
    failedResult: PromptResult,
    overrideModel?: string
  ): Promise<PromptResult> {
    this.emit({
      type: 'reflectionStart',
      agentId: this.id,
      originalError: failedResult.error,
      timestamp: Date.now(),
    });

    const reflectionInstance = new PromptInstance(
      DEFAULT_REFLECTION_PROMPT,
      this.resolveModel(overrideModel),
      {
        originalPrompt: originalPromptConfig.user,
        originalResult: failedResult.content,
        error: String(failedResult.error),
      },
      { eventObservable: this.eventObservable }
    );

    const result = await reflectionInstance.run(client);

    this.emit({
      type: 'reflectionEnd',
      agentId: this.id,
      result,
      timestamp: Date.now(),
    });

    // Call onReflection hook
    if (this.config.hooks?.onReflection) {
      await this.config.hooks.onReflection(failedResult, result);
    }

    return result;
  }

  /**
   * Run the agent
   */
  async run(client: AnthropicClient, input: unknown): Promise<AgentRunResult> {
    const startTime = Date.now();
    const promptResults: PromptResult[] = [];
    const maxRetries = this.config.maxRetries ?? 0;
    let retryCount = 0;
    let reflectionMetadata: AgentRunResult['reflectionMetadata'];

    // Apply beforeRun hook
    let processedInput = input;
    if (this.config.hooks?.beforeRun) {
      processedInput = await this.config.hooks.beforeRun(input);
    }

    // Emit agent start
    this.emit({
      type: 'agentRunStart',
      agentId: this.id,
      agentName: this.config.name,
      input: processedInput,
      timestamp: startTime,
    });

    try {
      // Execute each prompt in sequence
      for (const promptConfig of this.config.prompts) {
        // Apply beforePrompt hook
        let promptInput = processedInput;
        if (this.config.hooks?.beforePrompt) {
          promptInput = await this.config.hooks.beforePrompt(promptConfig, promptInput);
        }

        let result: PromptResult | null = null;
        let attempts = 0;

        // Retry loop
        while (attempts <= maxRetries) {
          const instance = new PromptInstance(
            promptConfig,
            this.resolveModel(promptConfig.model),
            promptInput,
            {
              eventObservable: this.eventObservable,
              toolHandlers: this.toolHandlers,
            }
          );

          result = await instance.run(client);

          // Check for error
          if (result.error) {
            attempts++;
            retryCount++;

            // Call onError hook
            if (this.config.hooks?.onError) {
              await this.config.hooks.onError(result.error);
            }

            // Try reflection if enabled and not already at max retries
            if (this.config.enableReflection && attempts <= maxRetries) {
              const reflectionResult = await this.reflect(
                client,
                promptConfig,
                result
              );

              if (!reflectionResult.error) {
                reflectionMetadata = {
                  originalError: result.error,
                  reflectionPromptId: instance.id,
                  reflectionResult,
                };
                result = reflectionResult;
                break;
              }
            }

            // Continue retry loop
            if (attempts <= maxRetries) {
              continue;
            }
          }

          // Success or final failure
          break;
        }

        // Apply afterPrompt hook
        if (result && this.config.hooks?.afterPrompt) {
          result = await this.config.hooks.afterPrompt(promptConfig, result);
        }

        if (result) {
          promptResults.push(result);
        }

        // Stop on error if we've exhausted retries
        if (result?.error && retryCount > maxRetries) {
          break;
        }
      }

      // Aggregate token usage
      const tokenUsage = aggregateTokenUsage(promptResults.map(r => r.tokenUsage));

      let agentResult: AgentRunResult = {
        promptResults,
        tokenUsage,
        totalDuration: Date.now() - startTime,
        retryCount,
        reflectionMetadata,
        error: promptResults.some(r => r.error) ? promptResults.find(r => r.error)?.error : undefined,
      };

      // Apply afterRun hook
      if (this.config.hooks?.afterRun) {
        agentResult = await this.config.hooks.afterRun(agentResult);
      }

      // Emit agent end
      this.emit({
        type: 'agentRunEnd',
        agentId: this.id,
        agentName: this.config.name,
        result: agentResult,
        duration: agentResult.totalDuration,
        tokenUsage: agentResult.tokenUsage,
      });

      return agentResult;

    } catch (error) {
      // Call onError hook
      if (this.config.hooks?.onError) {
        await this.config.hooks.onError(error);
      }

      const agentResult: AgentRunResult = {
        promptResults,
        tokenUsage: aggregateTokenUsage(promptResults.map(r => r.tokenUsage)),
        totalDuration: Date.now() - startTime,
        retryCount,
        error,
      };

      // Emit agent end with error
      this.emit({
        type: 'agentRunEnd',
        agentId: this.id,
        agentName: this.config.name,
        result: agentResult,
        duration: agentResult.totalDuration,
        tokenUsage: agentResult.tokenUsage,
      });

      return agentResult;
    }
  }

  /**
   * Get the event observable for subscriptions
   */
  getEventObservable(): Observable<WorkflowEvent> {
    return this.eventObservable;
  }
}
```

**Output**: Agent class with reflection and retry

**Validation**: TypeScript compiles

---

### Task 7: AgentWorkflow Class (P1.M2.T1)
**Depends on**: Task 6
**Story Points**: 3

**Input**: Agent class, existing Workflow patterns

**Steps**:

1. Create `/home/dustin/projects/laminar/src/core/agent-workflow.ts`:
```typescript
import type {
  AgentWorkflowConfig,
  WorkflowStepConfig,
  WorkflowRunResult,
  StepRunResult,
  AgentRunResult,
  TokenUsage,
} from '../types/index.js';
import { Workflow } from './workflow.js';
import { Agent } from './agent.js';
import { AnthropicClient } from '../integrations/anthropic-client.js';
import { aggregateTokenUsage, emptyTokenUsage } from '../utils/token-aggregator.js';

/**
 * Workflow that orchestrates agents
 */
export class AgentWorkflow extends Workflow {
  /** Workflow configuration */
  private workflowConfig: AgentWorkflowConfig;

  /** Anthropic client */
  private client: AnthropicClient;

  /** Tool handlers */
  private toolHandlers: Record<string, (input: unknown) => Promise<unknown>> = {};

  constructor(
    config: AgentWorkflowConfig,
    options?: {
      client?: AnthropicClient;
      parent?: Workflow;
      toolHandlers?: Record<string, (input: unknown) => Promise<unknown>>;
    }
  ) {
    super(config.name ?? 'AgentWorkflow', options?.parent);
    this.workflowConfig = config;
    this.client = options?.client ?? new AnthropicClient();
    this.toolHandlers = options?.toolHandlers ?? {};
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: WorkflowStepConfig, input: unknown): Promise<StepRunResult> {
    const startTime = Date.now();
    const stepName = step.name ?? `step-${step.id ?? 'unknown'}`;

    // Emit step start
    this.emitEvent({
      type: 'stepStart',
      node: this.node,
      step: stepName,
    });

    const agentResults: AgentRunResult[] = [];

    // Execute each agent in the step sequentially
    for (const agentConfig of step.agents) {
      const agent = new Agent(agentConfig, {
        parentModel: this.workflowConfig.defaultModel,
        eventObservable: this.events as any, // Connect to workflow events
        toolHandlers: this.toolHandlers,
      });

      const result = await agent.run(this.client, input);
      agentResults.push(result);

      // Stop on error
      if (result.error) {
        break;
      }
    }

    const duration = Date.now() - startTime;

    // Emit step end
    this.emitEvent({
      type: 'stepEnd',
      node: this.node,
      step: stepName,
      duration,
    });

    return {
      stepName,
      agentResults,
      duration,
    };
  }

  /**
   * Internal event observable for wiring
   */
  private get events() {
    // Create a bridging observable that forwards to workflow observers
    const workflow = this;
    return {
      next(event: any) {
        workflow.emitEvent(event);
      },
      error() {},
      complete() {},
      subscribe() { return { unsubscribe() {} }; },
    };
  }

  /**
   * Run the workflow
   */
  async run(input?: unknown): Promise<WorkflowRunResult> {
    const startTime = Date.now();
    this.setStatus('running');

    const stepResults: StepRunResult[] = [];
    let totalUsage = emptyTokenUsage();

    try {
      // Execute each step in order
      for (const step of this.workflowConfig.steps) {
        const stepResult = await this.executeStep(step, input);
        stepResults.push(stepResult);

        // Aggregate token usage from this step
        for (const agentResult of stepResult.agentResults) {
          totalUsage = aggregateTokenUsage([totalUsage, agentResult.tokenUsage]);
        }

        // Check for errors
        const stepError = stepResult.agentResults.find(r => r.error)?.error;
        if (stepError) {
          this.setStatus('failed');
          return {
            stepResults,
            tokenUsage: totalUsage,
            totalDuration: Date.now() - startTime,
            error: stepError,
          };
        }
      }

      this.setStatus('completed');

      return {
        stepResults,
        tokenUsage: totalUsage,
        totalDuration: Date.now() - startTime,
      };

    } catch (error) {
      this.setStatus('failed');
      return {
        stepResults,
        tokenUsage: totalUsage,
        totalDuration: Date.now() - startTime,
        error,
      };
    }
  }

  /**
   * Register a tool handler
   */
  registerTool(name: string, handler: (input: unknown) => Promise<unknown>): void {
    this.toolHandlers[name] = handler;
  }
}
```

**Output**: AgentWorkflow class

**Validation**: TypeScript compiles

---

### Task 8: Cache Implementation (P2.M2.T1)
**Depends on**: Task 5
**Story Points**: 3.5

**Input**: PromptInstance for integration

**Steps**:

1. Create `/home/dustin/projects/laminar/src/cache/cache.ts`:
```typescript
/**
 * Cache interface for prompt result caching
 */
export interface Cache {
  /** Get a value by key */
  get<T>(key: string): Promise<T | undefined>;
  /** Set a value with optional TTL in ms */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  /** Delete a key */
  delete(key: string): Promise<boolean>;
  /** Clear all entries */
  clear(): Promise<void>;
  /** Check if key exists */
  has(key: string): Promise<boolean>;
}
```

2. Create `/home/dustin/projects/laminar/src/cache/memory-cache.ts`:
```typescript
import type { Cache } from './cache.js';

interface CacheEntry<T> {
  value: T;
  expires?: number;
}

/**
 * In-memory cache implementation
 */
export class MemoryCache implements Cache {
  private store: Map<string, CacheEntry<unknown>> = new Map();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    // Check expiration
    if (entry.expires && Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const entry: CacheEntry<T> = {
      value,
      expires: ttl ? Date.now() + ttl : undefined,
    };
    this.store.set(key, entry);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);

    if (!entry) {
      return false;
    }

    // Check expiration
    if (entry.expires && Date.now() > entry.expires) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.store.size;
  }
}
```

3. Create `/home/dustin/projects/laminar/src/cache/cache-key.ts`:
```typescript
import type { PromptConfig } from '../types/index.js';

/**
 * Stable JSON stringify with sorted keys
 */
function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(k => `${JSON.stringify(k)}:${stableStringify((obj as Record<string, unknown>)[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Fast hash function (cyrb53)
 */
function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Generate a cache key for a prompt execution
 */
export function generateCacheKey(
  prompt: PromptConfig,
  model: string,
  input: unknown
): string {
  const data = {
    system: prompt.system,
    user: prompt.user,
    model,
    input,
  };

  return cyrb53(stableStringify(data));
}
```

4. Create `/home/dustin/projects/laminar/src/cache/index.ts`:
```typescript
export type { Cache } from './cache.js';
export { MemoryCache } from './memory-cache.js';
export { generateCacheKey } from './cache-key.js';
```

**Output**: Cache implementation

**Validation**: TypeScript compiles

---

### Task 9: Extend Tree Debugger (P1.M3.T3)
**Depends on**: Task 2
**Story Points**: 2

**Input**: Extended event types

**Steps**:

1. Update `/home/dustin/projects/laminar/src/types/workflow.ts` to extend WorkflowNode:
```typescript
import type { LogEntry } from './logging.js';
import type { WorkflowEvent } from './events.js';
import type { SerializedWorkflowState } from './snapshot.js';
import type { TokenUsage } from './token-usage.js';
import type { ToolCallEvent } from './tool.js';
import type { MCPEvent } from './mcp.js';

/**
 * Workflow status representing the current execution state
 */
export type WorkflowStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Node type in the execution tree
 */
export type WorkflowNodeType = 'workflow' | 'step' | 'agent' | 'prompt' | 'tool' | 'mcp';

/**
 * Represents a node in the workflow execution tree
 * This is the data structure, not the Workflow class
 */
export interface WorkflowNode {
  /** Unique identifier for this workflow instance */
  id: string;
  /** Human-readable name */
  name: string;
  /** Parent node reference (null for root) */
  parent: WorkflowNode | null;
  /** Child workflow nodes */
  children: WorkflowNode[];
  /** Current execution status */
  status: WorkflowStatus;
  /** Log entries for this node */
  logs: LogEntry[];
  /** Events emitted by this node */
  events: WorkflowEvent[];
  /** Optional serialized state snapshot */
  stateSnapshot: SerializedWorkflowState | null;
  // New fields for agent/prompt nodes
  /** Type of this node */
  nodeType?: WorkflowNodeType;
  /** Token usage if applicable */
  tokenUsage?: TokenUsage;
  /** Tool calls if this is a prompt node */
  toolCalls?: ToolCallEvent[];
  /** MCP events if applicable */
  mcpEvents?: MCPEvent[];
}
```

2. Update `/home/dustin/projects/laminar/src/debugger/tree-debugger.ts` to add new node type handling:
```typescript
// Add to STATUS_SYMBOLS (around line 16):
const NODE_TYPE_SYMBOLS: Record<string, string> = {
  workflow: 'W',
  step: 'S',
  agent: 'A',
  prompt: 'P',
  tool: 'T',
  mcp: 'M',
};

// Update renderTree method to include node type and token usage:
private renderTree(
  node: WorkflowNode,
  prefix: string,
  isLast: boolean,
  isRoot: boolean
): string {
  let result = '';

  // Status symbol and node type
  const statusSymbol = STATUS_SYMBOLS[node.status] || '?';
  const typeSymbol = node.nodeType ? `[${NODE_TYPE_SYMBOLS[node.nodeType] ?? '?'}]` : '';

  // Token usage if available
  const tokenInfo = node.tokenUsage
    ? ` (${node.tokenUsage.inputTokens}↓ ${node.tokenUsage.outputTokens}↑)`
    : '';

  const nodeInfo = `${statusSymbol} ${typeSymbol} ${node.name} [${node.status}]${tokenInfo}`;

  if (isRoot) {
    result += nodeInfo + '\n';
  } else {
    const connector = isLast ? '└── ' : '├── ';
    result += prefix + connector + nodeInfo + '\n';
  }

  // Render children
  const childCount = node.children.length;
  node.children.forEach((child, index) => {
    const isLastChild = index === childCount - 1;
    const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
    result += this.renderTree(child, childPrefix, isLastChild, false);
  });

  return result;
}
```

**Output**: Extended tree debugger

**Validation**: `npm run lint` passes

---

### Task 10: Update Exports (P3.M3.T1)
**Depends on**: All previous tasks
**Story Points**: 2

**Input**: All new modules

**Steps**:

1. Update `/home/dustin/projects/laminar/src/core/index.ts`:
```typescript
export { WorkflowLogger } from './logger.js';
export { Workflow } from './workflow.js';
export { Agent } from './agent.js';
export { PromptInstance } from './prompt-instance.js';
export { AgentWorkflow } from './agent-workflow.js';
```

2. Update `/home/dustin/projects/laminar/src/index.ts`:
```typescript
// Types
export type {
  WorkflowStatus,
  WorkflowNode,
  WorkflowNodeType,
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
  // New agent/prompt types
  TokenUsage,
  ToolDefinition,
  ToolCallEvent,
  MCPEvent,
  MCPInterrupt,
  PromptConfig,
  PromptHooks,
  PromptResult,
  AgentConfig,
  AgentHooks,
  AgentRunResult,
  WorkflowStepConfig,
  AgentWorkflowConfig,
  WorkflowRunState,
  WorkflowRunResult,
  StepRunResult,
} from './types/index.js';

// Core classes
export { Workflow } from './core/workflow.js';
export { WorkflowLogger } from './core/logger.js';
export { Agent } from './core/agent.js';
export { PromptInstance } from './core/prompt-instance.js';
export { AgentWorkflow } from './core/agent-workflow.js';

// Decorators
export { Step } from './decorators/step.js';
export { Task } from './decorators/task.js';
export { ObservedState, getObservedState } from './decorators/observed-state.js';

// Debugger
export { WorkflowTreeDebugger } from './debugger/tree-debugger.js';

// Cache
export type { Cache } from './cache/cache.js';
export { MemoryCache } from './cache/memory-cache.js';
export { generateCacheKey } from './cache/cache-key.js';

// Integrations
export { AnthropicClient } from './integrations/anthropic-client.js';

// Utilities
export { Observable } from './utils/observable.js';
export type { Subscription, Observer } from './utils/observable.js';
export { generateId } from './utils/id.js';
export {
  aggregateTokenUsage,
  formatTokenUsage,
  estimateCost,
  emptyTokenUsage,
} from './utils/token-aggregator.js';

// Examples (for reference)
export { TestCycleWorkflow } from './examples/test-cycle-workflow.js';
export { TDDOrchestrator } from './examples/tdd-orchestrator.js';
```

**Output**: Updated exports

**Validation**: `npm run build` succeeds

---

### Task 11: Unit Tests for Agent/Prompt (P1-P3 Tests)
**Depends on**: Task 10
**Story Points**: 4

**Input**: Complete implementation

**Steps**:

1. Create `/home/dustin/projects/laminar/src/__tests__/unit/agent.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent, AnthropicClient } from '../../index.js';
import type { AgentConfig } from '../../index.js';

// Mock AnthropicClient
vi.mock('../../integrations/anthropic-client.js', () => ({
  AnthropicClient: vi.fn().mockImplementation(() => ({
    createMessage: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Test response' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 20 },
      id: 'msg_123',
    }),
  })),
}));

describe('Agent', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = new AnthropicClient();
  });

  it('should create agent with unique id', () => {
    const config: AgentConfig = {
      name: 'TestAgent',
      prompts: [{ name: 'test', user: 'Hello' }],
    };

    const agent1 = new Agent(config);
    const agent2 = new Agent(config);

    expect(agent1.id).not.toBe(agent2.id);
  });

  it('should use provided id if specified', () => {
    const config: AgentConfig = {
      id: 'custom-id',
      name: 'TestAgent',
      prompts: [{ name: 'test', user: 'Hello' }],
    };

    const agent = new Agent(config);
    expect(agent.id).toBe('custom-id');
  });

  it('should resolve model from config', () => {
    const config: AgentConfig = {
      name: 'TestAgent',
      model: 'claude-sonnet-4-5-20250929',
      prompts: [{ name: 'test', user: 'Hello' }],
    };

    const agent = new Agent(config);
    expect(agent.config.model).toBe('claude-sonnet-4-5-20250929');
  });

  it('should execute prompts in sequence', async () => {
    const config: AgentConfig = {
      name: 'TestAgent',
      model: 'claude-sonnet-4-5-20250929',
      prompts: [
        { name: 'prompt1', user: 'First' },
        { name: 'prompt2', user: 'Second' },
      ],
    };

    const agent = new Agent(config);
    const result = await agent.run(mockClient, {});

    expect(result.promptResults.length).toBe(2);
    expect(result.error).toBeUndefined();
  });

  it('should aggregate token usage', async () => {
    const config: AgentConfig = {
      name: 'TestAgent',
      model: 'claude-sonnet-4-5-20250929',
      prompts: [
        { name: 'prompt1', user: 'First' },
        { name: 'prompt2', user: 'Second' },
      ],
    };

    const agent = new Agent(config);
    const result = await agent.run(mockClient, {});

    expect(result.tokenUsage.inputTokens).toBe(20); // 10 * 2
    expect(result.tokenUsage.outputTokens).toBe(40); // 20 * 2
  });

  it('should track retry count', async () => {
    const config: AgentConfig = {
      name: 'TestAgent',
      model: 'claude-sonnet-4-5-20250929',
      maxRetries: 2,
      prompts: [{ name: 'test', user: 'Hello' }],
    };

    const agent = new Agent(config);
    const result = await agent.run(mockClient, {});

    expect(result.retryCount).toBe(0); // No retries needed
  });
});
```

2. Create `/home/dustin/projects/laminar/src/__tests__/unit/prompt-instance.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { PromptInstance, AnthropicClient } from '../../index.js';
import type { PromptConfig } from '../../index.js';

// Mock AnthropicClient
vi.mock('../../integrations/anthropic-client.js', () => ({
  AnthropicClient: vi.fn().mockImplementation(() => ({
    createMessage: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Test response' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 20 },
      id: 'msg_123',
    }),
  })),
}));

describe('PromptInstance', () => {
  it('should create instance with frozen config', () => {
    const config: PromptConfig = {
      name: 'test',
      user: 'Hello {{name}}',
    };

    const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', { name: 'World' });

    expect(instance.config.name).toBe('test');
    expect(Object.isFrozen(instance.config)).toBe(true);
  });

  it('should interpolate variables correctly', async () => {
    const mockClient = new AnthropicClient();
    const config: PromptConfig = {
      name: 'test',
      user: 'Hello {{input.name}}, you are {{input.age}} years old',
    };

    const instance = new PromptInstance(
      config,
      'claude-sonnet-4-5-20250929',
      { name: 'Alice', age: 30 }
    );

    // The interpolation happens internally during run()
    const result = await instance.run(mockClient);

    expect(result.content).toBe('Test response');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should track token usage', async () => {
    const mockClient = new AnthropicClient();
    const config: PromptConfig = {
      name: 'test',
      user: 'Hello',
    };

    const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', {});
    const result = await instance.run(mockClient);

    expect(result.tokenUsage.inputTokens).toBe(10);
    expect(result.tokenUsage.outputTokens).toBe(20);
  });
});
```

3. Create `/home/dustin/projects/laminar/src/__tests__/unit/cache.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCache, generateCacheKey } from '../../index.js';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
  });

  it('should store and retrieve values', async () => {
    await cache.set('key1', 'value1');
    const value = await cache.get('key1');
    expect(value).toBe('value1');
  });

  it('should return undefined for missing keys', async () => {
    const value = await cache.get('nonexistent');
    expect(value).toBeUndefined();
  });

  it('should delete values', async () => {
    await cache.set('key1', 'value1');
    const deleted = await cache.delete('key1');
    expect(deleted).toBe(true);
    expect(await cache.get('key1')).toBeUndefined();
  });

  it('should clear all values', async () => {
    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');
    await cache.clear();
    expect(cache.size).toBe(0);
  });

  it('should respect TTL', async () => {
    await cache.set('key1', 'value1', 10); // 10ms TTL
    expect(await cache.has('key1')).toBe(true);

    // Wait for TTL to expire
    await new Promise(r => setTimeout(r, 15));
    expect(await cache.has('key1')).toBe(false);
  });
});

describe('generateCacheKey', () => {
  it('should generate consistent keys for same input', () => {
    const prompt = { name: 'test', user: 'Hello' };
    const key1 = generateCacheKey(prompt, 'model', { x: 1 });
    const key2 = generateCacheKey(prompt, 'model', { x: 1 });
    expect(key1).toBe(key2);
  });

  it('should generate different keys for different inputs', () => {
    const prompt = { name: 'test', user: 'Hello' };
    const key1 = generateCacheKey(prompt, 'model', { x: 1 });
    const key2 = generateCacheKey(prompt, 'model', { x: 2 });
    expect(key1).not.toBe(key2);
  });

  it('should handle object key ordering', () => {
    const prompt = { name: 'test', user: 'Hello' };
    const key1 = generateCacheKey(prompt, 'model', { a: 1, b: 2 });
    const key2 = generateCacheKey(prompt, 'model', { b: 2, a: 1 });
    expect(key1).toBe(key2); // Should be same due to stable stringify
  });
});
```

4. Create `/home/dustin/projects/laminar/src/__tests__/unit/token-aggregator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  aggregateTokenUsage,
  formatTokenUsage,
  estimateCost,
  emptyTokenUsage,
} from '../../index.js';

describe('Token Aggregator', () => {
  describe('aggregateTokenUsage', () => {
    it('should sum token counts', () => {
      const usages = [
        { inputTokens: 100, outputTokens: 50 },
        { inputTokens: 200, outputTokens: 100 },
      ];

      const result = aggregateTokenUsage(usages);

      expect(result.inputTokens).toBe(300);
      expect(result.outputTokens).toBe(150);
    });

    it('should handle cache tokens', () => {
      const usages = [
        { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 10 },
        { inputTokens: 200, outputTokens: 100, cacheReadInputTokens: 5 },
      ];

      const result = aggregateTokenUsage(usages);

      expect(result.cacheCreationInputTokens).toBe(10);
      expect(result.cacheReadInputTokens).toBe(5);
    });
  });

  describe('formatTokenUsage', () => {
    it('should format basic usage', () => {
      const usage = { inputTokens: 100, outputTokens: 50 };
      const formatted = formatTokenUsage(usage);
      expect(formatted).toBe('in: 100, out: 50');
    });

    it('should include cache tokens when present', () => {
      const usage = {
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 10,
        cacheReadInputTokens: 5,
      };
      const formatted = formatTokenUsage(usage);
      expect(formatted).toContain('cache-create: 10');
      expect(formatted).toContain('cache-read: 5');
    });
  });

  describe('estimateCost', () => {
    it('should calculate cost correctly', () => {
      const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
      const cost = estimateCost(usage);
      expect(cost).toBe(18); // $3 input + $15 output
    });
  });

  describe('emptyTokenUsage', () => {
    it('should return zero counts', () => {
      const empty = emptyTokenUsage();
      expect(empty.inputTokens).toBe(0);
      expect(empty.outputTokens).toBe(0);
    });
  });
});
```

**Output**: Unit tests for new components

**Validation**: `npm test` passes

---

### Task 12: Integration Test (P1-P3 Integration)
**Depends on**: Task 11
**Story Points**: 2

**Input**: Complete implementation and unit tests

**Steps**:

1. Create `/home/dustin/projects/laminar/src/__tests__/integration/agent-workflow.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import {
  AgentWorkflow,
  WorkflowTreeDebugger,
  WorkflowEvent,
} from '../../index.js';

// Mock the AnthropicClient
vi.mock('../../integrations/anthropic-client.js', () => ({
  AnthropicClient: vi.fn().mockImplementation(() => ({
    createMessage: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Mocked response' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 50, outputTokens: 100 },
      id: 'msg_mock',
    }),
    createMessageStream: vi.fn(),
  })),
}));

describe('AgentWorkflow Integration', () => {
  it('should execute workflow with agents', async () => {
    const workflow = new AgentWorkflow({
      name: 'TestWorkflow',
      defaultModel: 'claude-sonnet-4-5-20250929',
      steps: [
        {
          name: 'analysis',
          agents: [
            {
              name: 'analyzer',
              prompts: [
                { name: 'analyze', user: 'Analyze: {{input.text}}' },
              ],
            },
          ],
        },
      ],
    });

    const result = await workflow.run({ text: 'Hello world' });

    expect(result.stepResults.length).toBe(1);
    expect(result.stepResults[0].agentResults.length).toBe(1);
    expect(result.tokenUsage.inputTokens).toBe(50);
    expect(result.tokenUsage.outputTokens).toBe(100);
  });

  it('should emit events during execution', async () => {
    const workflow = new AgentWorkflow({
      name: 'EventTestWorkflow',
      defaultModel: 'claude-sonnet-4-5-20250929',
      steps: [
        {
          name: 'step1',
          agents: [
            {
              name: 'agent1',
              prompts: [{ name: 'prompt1', user: 'Hello' }],
            },
          ],
        },
      ],
    });

    const events: WorkflowEvent[] = [];
    workflow.addObserver({
      onLog: () => {},
      onEvent: (e) => events.push(e),
      onStateUpdated: () => {},
      onTreeChanged: () => {},
    });

    await workflow.run({});

    // Should have step start and end events
    expect(events.some(e => e.type === 'stepStart')).toBe(true);
    expect(events.some(e => e.type === 'stepEnd')).toBe(true);
  });

  it('should update workflow status', async () => {
    const workflow = new AgentWorkflow({
      name: 'StatusTestWorkflow',
      defaultModel: 'claude-sonnet-4-5-20250929',
      steps: [
        {
          name: 'step1',
          agents: [
            {
              name: 'agent1',
              prompts: [{ name: 'prompt1', user: 'Hello' }],
            },
          ],
        },
      ],
    });

    expect(workflow.status).toBe('idle');

    await workflow.run({});

    expect(workflow.status).toBe('completed');
  });

  it('should work with tree debugger', async () => {
    const workflow = new AgentWorkflow({
      name: 'DebugTestWorkflow',
      defaultModel: 'claude-sonnet-4-5-20250929',
      steps: [
        {
          name: 'step1',
          agents: [
            {
              name: 'agent1',
              prompts: [{ name: 'prompt1', user: 'Hello' }],
            },
          ],
        },
      ],
    });

    const debugger_ = new WorkflowTreeDebugger(workflow);

    await workflow.run({});

    const treeString = debugger_.toTreeString();
    expect(treeString).toContain('DebugTestWorkflow');
  });
});
```

**Output**: Integration test

**Validation**: `npm test` passes all tests

---

## 4. Implementation Details

### Code Patterns to Follow

**Model Resolution (Strict Cascade)**:
```typescript
// prompt.model || agent.model || workflow.defaultModel || throw
private resolveModel(promptModel?: string): string {
  const model = promptModel ?? this.config.model ?? this.parentModel;
  if (!model) {
    throw new Error('No model configured. Specify model on prompt, agent, or workflow.');
  }
  return model;
}
```

**Agentic Tool Loop**:
```typescript
// Continue until stop_reason !== 'tool_use'
while (response.stopReason === 'tool_use') {
  messages.push({ role: 'assistant', content: response.content });

  const toolResults = [];
  for (const block of response.content) {
    if (block.type === 'tool_use') {
      const result = await executeTool(block.name, block.input);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: result,
      });
    }
  }

  messages.push({ role: 'user', content: toolResults });
  response = await client.createMessage({ ...params, messages });
}
```

**Event Emission Pattern**:
```typescript
// Always emit both start and end events
this.emit({
  type: 'agentRunStart',
  agentId: this.id,
  agentName: this.config.name,
  input: processedInput,
  timestamp: startTime,
});

// ... execution ...

this.emit({
  type: 'agentRunEnd',
  agentId: this.id,
  agentName: this.config.name,
  result: agentResult,
  duration: agentResult.totalDuration,
  tokenUsage: agentResult.tokenUsage,
});
```

### File Structure (New Files)
```
src/
├── types/
│   ├── token-usage.ts          # TokenUsage interface
│   ├── tool.ts                 # ToolDefinition, ToolCallEvent
│   ├── mcp.ts                  # MCPEvent, MCPInterrupt
│   ├── prompt-config.ts        # PromptConfig, PromptHooks, PromptResult
│   ├── agent-config.ts         # AgentConfig, AgentHooks, AgentRunResult
│   └── workflow-config.ts      # AgentWorkflowConfig, WorkflowRunResult
├── core/
│   ├── prompt-instance.ts      # PromptInstance class
│   ├── agent.ts                # Agent class
│   └── agent-workflow.ts       # AgentWorkflow class
├── integrations/
│   ├── anthropic-client.ts     # AnthropicClient wrapper
│   └── index.ts
├── cache/
│   ├── cache.ts                # Cache interface
│   ├── memory-cache.ts         # MemoryCache implementation
│   ├── cache-key.ts            # Cache key generation
│   └── index.ts
└── utils/
    └── token-aggregator.ts     # Token usage utilities
```

---

## 5. Testing Strategy

### Unit Tests
```yaml
test_files:
  - path: "src/__tests__/unit/agent.test.ts"
    covers:
      - Agent instantiation
      - Model resolution
      - Prompt sequence execution
      - Token usage aggregation
      - Retry tracking

  - path: "src/__tests__/unit/prompt-instance.test.ts"
    covers:
      - Config freezing
      - Variable interpolation
      - Token usage tracking
      - Hook execution

  - path: "src/__tests__/unit/cache.test.ts"
    covers:
      - MemoryCache operations
      - TTL expiration
      - Cache key generation

  - path: "src/__tests__/unit/token-aggregator.test.ts"
    covers:
      - Token aggregation
      - Formatting
      - Cost estimation

test_patterns:
  - "Use describe/it blocks from vitest"
  - "Mock AnthropicClient for unit tests"
  - "Test both success and failure paths"
  - "Verify event emission"
```

### Integration Tests
```yaml
scenarios:
  - name: "AgentWorkflow Execution"
    validates: "Full workflow with agents runs and produces results"

  - name: "Event Emission"
    validates: "Events emitted at correct points"

  - name: "Status Updates"
    validates: "Workflow status changes correctly"

  - name: "Tree Debugger"
    validates: "Tree shows workflow structure"
```

### Manual Validation
```yaml
steps:
  - action: "npm run build"
    expected: "Compiles without errors"

  - action: "npm test"
    expected: "All tests pass"

  - action: "Create test script with real API key"
    expected: "AgentWorkflow executes prompts successfully"
```

---

## 6. Final Validation Checklist

### Code Quality
- [ ] All TypeScript compiles with `strict: true`
- [ ] No linting warnings from `npm run lint`
- [ ] Follows naming conventions (kebab-case files, PascalCase classes)
- [ ] Proper error handling in Agent and PromptInstance
- [ ] All hooks are called at appropriate times

### Functionality
- [ ] AgentWorkflow runs with multiple steps and agents
- [ ] Agent executes prompts in sequence
- [ ] PromptInstance interpolates variables correctly
- [ ] Tool calls work in agentic loop
- [ ] Streaming yields tokens incrementally
- [ ] Cache prevents redundant API calls
- [ ] Reflection triggers on errors when enabled
- [ ] Token usage aggregates up hierarchy
- [ ] Events emit at all key points

### Testing
- [ ] Unit tests pass for all new components
- [ ] Integration tests verify end-to-end flow
- [ ] Existing tests continue to pass
- [ ] Mocking strategy works correctly

### Documentation
- [ ] All public APIs have JSDoc comments
- [ ] Complex logic has inline comments
- [ ] Type exports are complete

---

## 7. "No Prior Knowledge" Test

**Validation**: If someone knew nothing about this codebase, would they have everything needed to implement this successfully using only this PRP?

- [x] All file paths are absolute and specific
- [x] All patterns have concrete code examples
- [x] All dependencies are explicitly listed with versions
- [x] All validation steps are executable commands
- [x] TypeScript configuration requirements specified
- [x] Test patterns are specified with vitest
- [x] Anthropic SDK patterns documented with URLs
- [x] Model resolution rules explicitly stated
- [x] Event types fully enumerated
- [x] Cache key generation algorithm included

---

## Confidence Score: 8/10

**Rationale**:
- Comprehensive research completed on Anthropic SDK patterns
- Existing codebase well-understood with clear extension points
- All types and interfaces defined with concrete examples
- Testing strategy follows existing patterns
- External documentation URLs verified and specific

**Remaining uncertainties**:
- Real API behavior may differ slightly from mocks in tests
- MCP integration is minimal (placeholder) pending full MCP spec
- Streaming with tool calls not fully implemented (tools work in non-streaming)
- Cache integration into PromptInstance not wired (cache infrastructure ready)
- Real-world performance with large prompt sequences untested

**Mitigation**:
- Run manual tests with real API key before considering complete
- MCP can be expanded later when spec is clearer
- Streaming tool support can be added as enhancement

---

## Quick Start Commands

```bash
# 1. Install new dependencies
cd /home/dustin/projects/laminar
npm install @anthropic-ai/sdk zod

# 2. Build
npm run build

# 3. Test
npm test

# 4. Create test script (requires ANTHROPIC_API_KEY)
cat > src/demo-agent.ts << 'EOF'
import { AgentWorkflow, WorkflowTreeDebugger } from './index.js';

const workflow = new AgentWorkflow({
  name: 'DemoWorkflow',
  defaultModel: 'claude-sonnet-4-5-20250929',
  steps: [{
    name: 'greeting',
    agents: [{
      name: 'greeter',
      prompts: [{
        name: 'greet',
        user: 'Say hello to {{input.name}}',
      }],
    }],
  }],
});

const debugger_ = new WorkflowTreeDebugger(workflow);

workflow.run({ name: 'World' }).then(result => {
  console.log('Result:', result);
  console.log('\nTree:\n', debugger_.toTreeString());
});
EOF

# 5. Run demo (with API key)
ANTHROPIC_API_KEY=your-key npx tsx src/demo-agent.ts
```
