# PRP-002: Unified Workflow + Agent + Prompt Architecture

> **PRP**: Product Requirements Package - Complete implementation guide for the unified orchestration architecture

**Version**: 1.0
**Status**: Implementation-Ready
**Source PRD**: `/home/dustin/projects/laminar/PRD-2.md`
**Task Backlog**: `/home/dustin/projects/laminar/tasks.json`

---

## Pre-Implementation Checklist

Before implementing, verify you have:
- [ ] Read PRD-2 at `/home/dustin/projects/laminar/PRD-2.md`
- [ ] Reviewed tasks.json at `/home/dustin/projects/laminar/tasks.json`
- [ ] Existing laminar codebase built successfully (`npm run build`)
- [ ] Understanding of existing Workflow, @Step, @Task, @ObservedState patterns
- [ ] Node.js 18+ and TypeScript 5.2+ installed
- [ ] Familiarity with Zod schema validation

---

## 1. Goal

### Feature Goal
Extend the existing Laminar workflow engine with a complete unified orchestration architecture that adds:
- **Agent System**: Configurable AI agents with hooks, caching, and model routing
- **Prompt System**: Immutable, schema-validated prompts with Zod
- **Model/Provider Routing**: Category-based CCR model strings with automatic fallback
- **Parameter-Level Caching**: Deterministic cache keys with LRU storage
- **Unified Event System**: Extended RuntimeEvent schema for full observability
- **Tool/MCP Integration**: Tool execution with event emission

### Deliverable
An extended npm-publishable TypeScript library adding to existing exports:
- `Agent` class with `prompt<T>()` and `reflect<T>()` methods
- `Prompt<T>` immutable class with Zod schema validation
- `CCRModel` type and `CategoryModelConfig` for model routing
- `ModelResolver` and `CCRRouter` for provider fallback
- `AgentCache` interface with `LRUAgentCache` implementation
- `RuntimeEvent`, `RuntimeEventBus` for unified telemetry
- `ToolExecutor` for tool integration
- `ReflectionStrategy` for error recovery
- All supporting TypeScript interfaces

### Success Definition
1. All TypeScript compiles with `strict: true`
2. Agent can execute prompts within workflow steps with automatic tree attachment
3. Zod schema validation works for all agent responses
4. Cache hits prevent duplicate LLM calls
5. Events stream correctly to RuntimeEventBus subscribers
6. Fallback routing works when primary models fail
7. End-to-end example from PRD Section 11 executes successfully
8. All unit and integration tests pass

---

## 2. Context

### External Documentation
```yaml
primary_docs:
  - url: "https://zod.dev/"
    purpose: "Zod schema validation fundamentals"
    key_sections:
      - "Basic usage"
      - "Primitives"
      - "Objects"
      - "Parse vs safeParse"
      - "Type inference with z.infer"

  - url: "https://nodejs.org/api/crypto.html#cryptocreatehashsha256"
    purpose: "SHA-256 hashing for cache keys"
    key_sections:
      - "crypto.createHash"
      - "hash.update"
      - "hash.digest"

  - url: "https://docs.anthropic.com/en/docs/build-with-claude/tool-use"
    purpose: "Tool/function calling schema patterns"
    key_sections:
      - "Tool definition"
      - "Input schema"
      - "Tool results"

reference_implementations:
  - url: "https://github.com/colinhacks/zod"
    purpose: "Zod source for advanced patterns"
    files_to_study:
      - "src/types.ts"
      - "src/ZodError.ts"

  - url: "https://github.com/anthropics/anthropic-sdk-typescript"
    purpose: "Anthropic SDK tool patterns"
    files_to_study:
      - "src/resources/messages.ts"
```

### Codebase Context
```yaml
existing_patterns:
  - file: "/home/dustin/projects/laminar/src/core/workflow.ts"
    pattern: "Abstract base class with event emission"
    follow_for: "Agent class construction, event emission via emitEvent()"

  - file: "/home/dustin/projects/laminar/src/decorators/step.ts"
    pattern: "Method decorator with WorkflowLike interface"
    follow_for: "Agent integration within steps"

  - file: "/home/dustin/projects/laminar/src/types/events.ts"
    pattern: "Discriminated union for events"
    follow_for: "RuntimeEvent type definition"

  - file: "/home/dustin/projects/laminar/src/utils/observable.ts"
    pattern: "Lightweight Observable class"
    follow_for: "RuntimeEventBus streaming"

  - file: "/home/dustin/projects/laminar/src/utils/id.ts"
    pattern: "UUID generation with fallback"
    follow_for: "Agent ID, run ID generation"

related_files:
  - path: "/home/dustin/projects/laminar/src/types/index.ts"
    relationship: "Central type exports - extend with new types"

  - path: "/home/dustin/projects/laminar/src/index.ts"
    relationship: "Main entry point - add new exports"

naming_conventions:
  files: "kebab-case.ts (e.g., model-resolver.ts, agent-cache.ts)"
  classes: "PascalCase (e.g., ModelResolver, AgentCache)"
  interfaces: "PascalCase (e.g., AgentConfig, PromptConfig)"
  types: "PascalCase (e.g., CCRModel, EventType)"
  constants: "SCREAMING_SNAKE_CASE (e.g., DEFAULT_CACHE_SIZE)"
  functions: "camelCase (e.g., generateCacheKey, parseCCRModel)"
```

### Technical Constraints
```yaml
typescript:
  version: "5.2+"
  config_requirements:
    - "target: ES2022"
    - "module: ES2022"
    - "strict: true"
    - "DO NOT use experimentalDecorators flag"

dependencies:
  required:
    - name: "zod"
      version: "^3.23.0"
      purpose: "Schema validation for prompts and responses"

  dev_dependencies:
    - name: "typescript"
      version: "^5.2.0"
      purpose: "TypeScript compiler"
    - name: "vitest"
      version: "^1.0.0"
      purpose: "Testing framework"
    - name: "@types/node"
      version: "^20.0.0"
      purpose: "Node.js types"

  avoid:
    - name: "rxjs"
      reason: "Too heavy - use existing Observable"
    - name: "lru-cache"
      reason: "Implement simple Map-based LRU for zero deps"
    - name: "uuid"
      reason: "Use existing generateId() utility"

runtime:
  node_version: "18+"
  target: "ES2022"
```

### Known Gotchas
```yaml
pitfalls:
  - issue: "JSON.stringify() key order is non-deterministic"
    solution: "Sort object keys recursively before stringifying for cache keys"
    example: |
      // WRONG - non-deterministic
      JSON.stringify({ b: 1, a: 2 })
      // CORRECT - sorted keys
      JSON.stringify(sortObjectKeys({ b: 1, a: 2 })) // {"a":2,"b":1}

  - issue: "Zod schema changes break cache hits"
    solution: "Include schema version hash in cache key"
    example: |
      const schemaHash = hashZodSchema(responseFormat);
      const cacheKey = generateCacheKey({ ...params, schemaVersion: schemaHash });

  - issue: "Agent events not appearing in workflow tree"
    solution: "Pass workflow node reference via WorkflowContext to agents"

  - issue: "Circular reference in AgentRunContext with Prompt"
    solution: "Use forward declaration: declare type Prompt<T> in agent.ts"

  - issue: "CCRRouter fallback not triggered"
    solution: "Catch specific error types (network, rate limit) vs validation errors"

  - issue: "Observable memory leak from unsubscribed handlers"
    solution: "Store subscription and call unsubscribe() in cleanup"

  - issue: "Tool execution errors not mapped to prompt errors"
    solution: "Wrap tool errors in ToolExecutionError with tool name context"

  - issue: "LRU cache eviction not happening"
    solution: "Check size on set(), not get() - evict oldest when at capacity"
```

---

## 3. Implementation Tasks

> Tasks are organized by milestone and ordered by dependency. Complete each task fully before moving to dependent tasks. Tasks within a milestone can often be parallelized.

---

## Milestone 1: Model/Provider Configuration System

### Task 1.1: Core Type Definitions for Models
**Depends on**: None

**Input**: Empty `src/types/model.ts`

**Steps**:

1. Create `/home/dustin/projects/laminar/src/types/model.ts`:
   ```typescript
   /**
    * CCR Model string format: "provider-slug,model-version"
    * Examples: "openai,gpt-4o", "anthropic,claude-3-opus"
    *
    * @remarks
    * - Provider slug is lowercase with hyphens
    * - Model version is the provider's model identifier
    * - Comma separates provider from model
    */
   export type CCRModel = string & { readonly __brand: unique symbol };

   /**
    * Category-based model configuration
    * Maps category names to ordered arrays of models
    *
    * @remarks
    * - Index 0 = smartest/most capable model
    * - Higher indices = faster/cheaper models
    * - Used for fallback routing on failures
    *
    * @example
    * ```typescript
    * const config: CategoryModelConfig = {
    *   coding: ["openai,gpt-4o", "openai,gpt-4o-mini"],
    *   research: ["anthropic,claude-3-opus", "anthropic,claude-3-sonnet"],
    * };
    * ```
    */
   export type CategoryModelConfig = Record<string, CCRModel[]>;

   /**
    * Request for model resolution
    * Used by ModelResolver to determine which model to use
    */
   export interface ModelResolutionRequest {
     /** Model override from prompt (highest priority) */
     promptOverride?: CCRModel;
     /** Default model from agent configuration */
     agentDefault?: CCRModel;
     /** Default model from workflow configuration */
     workflowDefault?: CCRModel;
     /** Category to select from */
     category: string;
     /** Index within category (0 = smartest, default: 0) */
     modelIndex?: number;
   }
   ```

2. Update `/home/dustin/projects/laminar/src/types/index.ts` to add export:
   ```typescript
   // Add at end of file
   export type { CCRModel, CategoryModelConfig, ModelResolutionRequest } from './model.js';
   ```

**Output**: `src/types/model.ts` with CCRModel and CategoryModelConfig types

**Validation**:
- `npm run lint` passes
- Types are exported from `src/types/index.ts`

---

### Task 1.2: CCRModel Parser and Validator
**Depends on**: Task 1.1

**Input**: CCRModel type from Task 1.1

**Steps**:

1. Create `/home/dustin/projects/laminar/src/models/parser.ts`:
   ```typescript
   import type { CCRModel } from '../types/model.js';

   /**
    * Error thrown when CCR model string is invalid
    */
   export class InvalidCCRModelError extends Error {
     constructor(model: string, reason: string) {
       super(`Invalid CCR model "${model}": ${reason}`);
       this.name = 'InvalidCCRModelError';
     }
   }

   /**
    * Parsed components of a CCR model string
    */
   export interface ParsedCCRModel {
     /** Provider slug (e.g., "openai", "anthropic") */
     provider: string;
     /** Model version (e.g., "gpt-4o", "claude-3-opus") */
     version: string;
   }

   /**
    * Parse a CCR model string into provider and version components
    *
    * @param model - CCR model string in format "provider,model-version"
    * @returns Parsed provider and version
    * @throws InvalidCCRModelError if format is invalid
    *
    * @example
    * ```typescript
    * const { provider, version } = parseCCRModel("openai,gpt-4o");
    * // provider = "openai", version = "gpt-4o"
    * ```
    */
   export function parseCCRModel(model: string): ParsedCCRModel {
     if (!model || typeof model !== 'string') {
       throw new InvalidCCRModelError(model, 'model must be a non-empty string');
     }

     const commaIndex = model.indexOf(',');
     if (commaIndex === -1) {
       throw new InvalidCCRModelError(model, 'must contain comma separator');
     }

     const provider = model.slice(0, commaIndex).trim();
     const version = model.slice(commaIndex + 1).trim();

     if (!provider) {
       throw new InvalidCCRModelError(model, 'provider cannot be empty');
     }
     if (!version) {
       throw new InvalidCCRModelError(model, 'version cannot be empty');
     }

     // Validate provider format (lowercase, alphanumeric with hyphens)
     if (!/^[a-z][a-z0-9-]*$/.test(provider)) {
       throw new InvalidCCRModelError(
         model,
         'provider must be lowercase alphanumeric with hyphens'
       );
     }

     return { provider, version };
   }

   /**
    * Create a valid CCR model string from components
    *
    * @param provider - Provider slug
    * @param version - Model version
    * @returns Branded CCRModel string
    *
    * @example
    * ```typescript
    * const model = formatCCRModel("openai", "gpt-4o");
    * // model = "openai,gpt-4o" as CCRModel
    * ```
    */
   export function formatCCRModel(provider: string, version: string): CCRModel {
     const model = `${provider},${version}`;
     // Validate by parsing
     parseCCRModel(model);
     return model as CCRModel;
   }

   /**
    * Type guard to check if a string is a valid CCR model
    *
    * @param model - String to validate
    * @returns True if valid CCR model format
    */
   export function validateCCRModel(model: string): model is CCRModel {
     try {
       parseCCRModel(model);
       return true;
     } catch {
       return false;
     }
   }
   ```

2. Create `/home/dustin/projects/laminar/src/models/index.ts`:
   ```typescript
   export {
     parseCCRModel,
     formatCCRModel,
     validateCCRModel,
     InvalidCCRModelError,
   } from './parser.js';
   export type { ParsedCCRModel } from './parser.js';
   ```

**Output**: `src/models/parser.ts` with CCR parsing utilities

**Validation**:
- `npm run lint` passes
- `parseCCRModel("openai,gpt-4o")` returns `{ provider: "openai", version: "gpt-4o" }`

---

### Task 1.3: ModelResolver with Precedence Logic
**Depends on**: Task 1.1, Task 1.2

**Input**: CCRModel, CategoryModelConfig, ModelResolutionRequest types

**Steps**:

1. Create `/home/dustin/projects/laminar/src/models/resolver.ts`:
   ```typescript
   import type { CCRModel, CategoryModelConfig, ModelResolutionRequest } from '../types/model.js';
   import { validateCCRModel } from './parser.js';

   /**
    * Error thrown when model resolution fails
    */
   export class ModelResolutionError extends Error {
     constructor(
       public readonly request: ModelResolutionRequest,
       public readonly reason: string
     ) {
       super(`Model resolution failed: ${reason}`);
       this.name = 'ModelResolutionError';
     }
   }

   /**
    * Resolves which model to use based on precedence rules
    *
    * Resolution precedence (per PRD Section 2.1):
    * 1. Prompt override
    * 2. Agent default model
    * 3. Workflow default model
    * 4. Category[0] (smartest)
    * 5. Fallback indices (1, 2, 3...)
    * 6. Error
    */
   export class ModelResolver {
     constructor(private readonly config: CategoryModelConfig) {}

     /**
      * Resolve which model to use for a request
      *
      * @param request - Resolution request with overrides and category
      * @returns Resolved CCR model string
      * @throws ModelResolutionError if no model can be resolved
      */
     resolve(request: ModelResolutionRequest): CCRModel {
       // 1. Prompt override (highest priority)
       if (request.promptOverride && validateCCRModel(request.promptOverride)) {
         return request.promptOverride;
       }

       // 2. Agent default model
       if (request.agentDefault && validateCCRModel(request.agentDefault)) {
         return request.agentDefault;
       }

       // 3. Workflow default model
       if (request.workflowDefault && validateCCRModel(request.workflowDefault)) {
         return request.workflowDefault;
       }

       // 4-5. Category-based resolution
       const categoryModels = this.config[request.category];
       if (!categoryModels || categoryModels.length === 0) {
         throw new ModelResolutionError(
           request,
           `Category "${request.category}" not found or empty`
         );
       }

       // Use specified index or default to 0
       const index = request.modelIndex ?? 0;
       if (index >= 0 && index < categoryModels.length) {
         return categoryModels[index];
       }

       // 5. Fallback to last available model
       if (index >= categoryModels.length) {
         return categoryModels[categoryModels.length - 1];
       }

       // 6. Error - should not reach here
       throw new ModelResolutionError(
         request,
         `Invalid model index ${index} for category "${request.category}"`
       );
     }

     /**
      * Get the next fallback model for a category
      * Used when primary model fails
      *
      * @param category - Category to get fallback from
      * @param currentIndex - Current model index
      * @returns Next model or undefined if no more fallbacks
      */
     getNextFallback(category: string, currentIndex: number): CCRModel | undefined {
       const categoryModels = this.config[category];
       if (!categoryModels) {
         return undefined;
       }

       const nextIndex = currentIndex + 1;
       if (nextIndex < categoryModels.length) {
         return categoryModels[nextIndex];
       }

       return undefined;
     }

     /**
      * Check if a category exists in configuration
      */
     hasCategory(category: string): boolean {
       return category in this.config && this.config[category].length > 0;
     }

     /**
      * Get all models for a category
      */
     getCategoryModels(category: string): readonly CCRModel[] {
       return this.config[category] ?? [];
     }
   }
   ```

2. Update `/home/dustin/projects/laminar/src/models/index.ts`:
   ```typescript
   export {
     parseCCRModel,
     formatCCRModel,
     validateCCRModel,
     InvalidCCRModelError,
   } from './parser.js';
   export type { ParsedCCRModel } from './parser.js';
   export { ModelResolver, ModelResolutionError } from './resolver.js';
   ```

**Output**: `src/models/resolver.ts` with ModelResolver class

**Validation**:
- ModelResolver correctly applies precedence rules
- `npm run lint` passes

---

### Task 1.4: CCR Interface and Request Types
**Depends on**: Task 1.2

**Input**: CCRModel type

**Steps**:

1. Create `/home/dustin/projects/laminar/src/models/ccr.ts`:
   ```typescript
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
   ```

2. Update `/home/dustin/projects/laminar/src/models/index.ts`:
   ```typescript
   export {
     parseCCRModel,
     formatCCRModel,
     validateCCRModel,
     InvalidCCRModelError,
   } from './parser.js';
   export type { ParsedCCRModel } from './parser.js';
   export { ModelResolver, ModelResolutionError } from './resolver.js';
   export type {
     Message,
     CCRToolConfig,
     McpConfig,
     CCRRequest,
     CCRResponse,
     CCRUsage,
     ContentBlock,
     TextBlock,
     ToolUseBlock,
     CCR,
   } from './ccr.js';
   ```

**Output**: `src/models/ccr.ts` with CCR interface

**Validation**: `npm run lint` passes

---

### Task 1.5: CCRRouter with Fallback Logic
**Depends on**: Task 1.3, Task 1.4

**Input**: CCR interface, ModelResolver

**Steps**:

1. Create `/home/dustin/projects/laminar/src/models/router.ts`:
   ```typescript
   import type { CCR, CCRRequest, CCRResponse } from './ccr.js';
   import type { CategoryModelConfig } from '../types/model.js';
   import { ModelResolver, ModelResolutionError } from './resolver.js';

   /**
    * Error thrown when all routing attempts fail
    */
   export class CCRRoutingError extends Error {
     constructor(
       public readonly category: string,
       public readonly attemptedModels: string[],
       public readonly lastError: Error
     ) {
       super(
         `All models failed for category "${category}". ` +
         `Attempted: ${attemptedModels.join(', ')}. ` +
         `Last error: ${lastError.message}`
       );
       this.name = 'CCRRoutingError';
     }
   }

   /**
    * Event emitted during routing attempts
    */
   export interface RoutingAttemptEvent {
     model: string;
     attempt: number;
     success: boolean;
     error?: Error;
     durationMs: number;
   }

   /**
    * Router that wraps CCR with automatic fallback
    *
    * @remarks
    * When a model fails, automatically tries the next model
    * in the category array until one succeeds or all fail.
    */
   export class CCRRouter {
     private readonly resolver: ModelResolver;

     constructor(
       private readonly ccr: CCR,
       config: CategoryModelConfig
     ) {
       this.resolver = new ModelResolver(config);
     }

     /**
      * Execute a CCR request with automatic fallback
      *
      * @param request - Base request (model will be overridden)
      * @param category - Category to select models from
      * @param onAttempt - Optional callback for attempt events
      * @returns Response from successful model
      * @throws CCRRoutingError if all models fail
      */
     async run(
       request: Omit<CCRRequest, 'model'>,
       category: string,
       onAttempt?: (event: RoutingAttemptEvent) => void
     ): Promise<CCRResponse> {
       const models = this.resolver.getCategoryModels(category);

       if (models.length === 0) {
         throw new ModelResolutionError(
           { category, modelIndex: 0 },
           `Category "${category}" not found or empty`
         );
       }

       const attemptedModels: string[] = [];
       let lastError: Error | undefined;

       for (let i = 0; i < models.length; i++) {
         const model = models[i];
         attemptedModels.push(model);

         const startTime = Date.now();

         try {
           const response = await this.ccr.run({
             ...request,
             model,
           });

           // Emit success event
           onAttempt?.({
             model,
             attempt: i + 1,
             success: true,
             durationMs: Date.now() - startTime,
           });

           return response;
         } catch (error) {
           lastError = error instanceof Error ? error : new Error(String(error));

           // Emit failure event
           onAttempt?.({
             model,
             attempt: i + 1,
             success: false,
             error: lastError,
             durationMs: Date.now() - startTime,
           });

           // Only continue if it's a retriable error (network, rate limit)
           // Validation errors should not trigger fallback
           if (this.isValidationError(lastError)) {
             throw lastError;
           }

           // Continue to next model
         }
       }

       // All models failed
       throw new CCRRoutingError(category, attemptedModels, lastError!);
     }

     /**
      * Check if an error is a validation error (should not retry)
      */
     private isValidationError(error: Error): boolean {
       // Zod validation errors
       if (error.name === 'ZodError') {
         return true;
       }
       // Check message for common validation patterns
       const msg = error.message.toLowerCase();
       return (
         msg.includes('invalid') ||
         msg.includes('validation') ||
         msg.includes('schema')
       );
     }

     /**
      * Get the underlying resolver for direct model resolution
      */
     getResolver(): ModelResolver {
       return this.resolver;
     }
   }
   ```

2. Update `/home/dustin/projects/laminar/src/models/index.ts`:
   ```typescript
   export {
     parseCCRModel,
     formatCCRModel,
     validateCCRModel,
     InvalidCCRModelError,
   } from './parser.js';
   export type { ParsedCCRModel } from './parser.js';
   export { ModelResolver, ModelResolutionError } from './resolver.js';
   export type {
     Message,
     CCRToolConfig,
     McpConfig,
     CCRRequest,
     CCRResponse,
     CCRUsage,
     ContentBlock,
     TextBlock,
     ToolUseBlock,
     CCR,
   } from './ccr.js';
   export { CCRRouter, CCRRoutingError } from './router.js';
   export type { RoutingAttemptEvent } from './router.js';
   ```

**Output**: `src/models/router.ts` with CCRRouter class

**Validation**: `npm run lint` passes

---

## Milestone 2: Agent System Implementation

### Task 2.1: Agent Configuration Types
**Depends on**: Task 1.1

**Input**: CCRModel type

**Steps**:

1. Create `/home/dustin/projects/laminar/src/types/agent.ts`:
   ```typescript
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
   ```

2. Update `/home/dustin/projects/laminar/src/types/index.ts`:
   ```typescript
   // Add at end of file
   export type {
     ToolConfig,
     McpConfig,
     AgentRunContext,
     AgentHooks,
     AgentConfig,
     AgentRuntimeOverrides,
     PromptType,
   } from './agent.js';
   ```

**Output**: `src/types/agent.ts` with agent configuration types

**Validation**: `npm run lint` passes

---

### Task 2.2: Agent Class Constructor and Configuration
**Depends on**: Task 2.1

**Input**: AgentConfig, AgentHooks types

**Steps**:

1. Create `/home/dustin/projects/laminar/src/agents/agent.ts`:
   ```typescript
   import type {
     AgentConfig,
     AgentHooks,
     AgentRuntimeOverrides,
     AgentRunContext,
     ToolConfig,
     McpConfig,
   } from '../types/agent.js';
   import type { CCRModel } from '../types/model.js';
   import { generateId } from '../utils/id.js';

   /**
    * Agent class for executing prompts with LLM models
    *
    * @remarks
    * Per PRD Section 3.2, agents:
    * - Execute prompts with schema validation
    * - Support tools and MCP servers
    * - Have lifecycle hooks
    * - Can reflect on errors
    */
   export class Agent {
     /** Unique agent identifier */
     public readonly id: string;

     /** Agent name */
     public readonly name: string;

     /** Model category */
     public readonly category: string | undefined;

     /** Available tools */
     public readonly tools: readonly ToolConfig[];

     /** Available MCP servers */
     public readonly mcps: readonly McpConfig[];

     /** Full configuration (private) */
     private readonly config: AgentConfig;

     /**
      * Create a new Agent instance
      *
      * @param config - Agent configuration
      */
     constructor(config: AgentConfig = {}) {
       this.id = generateId();
       this.config = config;
       this.name = config.name ?? 'Agent';
       this.category = config.category;
       this.tools = Object.freeze([...(config.tools ?? [])]);
       this.mcps = Object.freeze([...(config.mcps ?? [])]);
     }

     /**
      * Get the full agent configuration
      */
     getConfig(): AgentConfig {
       return { ...this.config };
     }

     /**
      * Get lifecycle hooks
      */
     getHooks(): AgentHooks {
       return this.config.hooks ?? {};
     }

     /**
      * Check if caching is enabled
      */
     isCacheEnabled(): boolean {
       return this.config.enableCache !== false;
     }

     /**
      * Get default model if set
      */
     getDefaultModel(): CCRModel | undefined {
       return this.config.defaultModel;
     }

     /**
      * Get default provider if set
      */
     getDefaultProvider(): string | undefined {
       return this.config.defaultProvider;
     }

     /**
      * Get model index within category
      */
     getModelIndex(): number {
       return this.config.modelIndex ?? 0;
     }

     /**
      * Merge runtime tools with config tools
      */
     getMergedTools(overrides?: AgentRuntimeOverrides): ToolConfig[] {
       const configTools = this.config.tools ?? [];
       const overrideTools = overrides?.tools ?? [];
       return [...configTools, ...overrideTools];
     }

     /**
      * Merge runtime MCPs with config MCPs
      */
     getMergedMcps(overrides?: AgentRuntimeOverrides): McpConfig[] {
       const configMcps = this.config.mcps ?? [];
       const overrideMcps = overrides?.mcps ?? [];
       return [...configMcps, ...overrideMcps];
     }

     // prompt() and reflect() methods will be added in Task 2.3
   }
   ```

2. Create `/home/dustin/projects/laminar/src/agents/index.ts`:
   ```typescript
   export { Agent } from './agent.js';
   ```

**Output**: `src/agents/agent.ts` with Agent class constructor

**Validation**: Agent can be instantiated with config

---

## Milestone 3: Prompt System Implementation

### Task 3.1: PromptConfig Interface
**Depends on**: Task 1.1

**Input**: CCRModel type

**Steps**:

1. Create `/home/dustin/projects/laminar/src/types/prompt.ts`:
   ```typescript
   import type { z } from 'zod';
   import type { CCRModel } from './model.js';

   /**
    * Configuration for creating a Prompt
    *
    * @typeParam T - The validated response type
    */
   export interface PromptConfig<T> {
     /** The prompt text to send to the model */
     userPrompt: string;
     /** Optional data to include (for templating) */
     data?: Record<string, unknown>;
     /** Zod schema for response validation */
     responseFormat: z.ZodType<T>;
     /** Optional model override (highest priority) */
     modelOverride?: CCRModel;
     /** Optional error handler */
     onError?: (err: Error) => void;
   }
   ```

2. Update `/home/dustin/projects/laminar/src/types/index.ts`:
   ```typescript
   // Add at end
   export type { PromptConfig } from './prompt.js';
   ```

**Output**: `src/types/prompt.ts` with PromptConfig

**Validation**: `npm run lint` passes

---

### Task 3.2: Immutable Prompt Class
**Depends on**: Task 3.1

**Input**: PromptConfig type

**Steps**:

1. Create `/home/dustin/projects/laminar/src/prompts/prompt.ts`:
   ```typescript
   import type { z } from 'zod';
   import type { PromptConfig } from '../types/prompt.js';
   import type { CCRModel } from '../types/model.js';

   /**
    * Error thrown during prompt validation
    */
   export class PromptValidationError extends Error {
     constructor(
       message: string,
       public readonly zodError: z.ZodError
     ) {
       super(message);
       this.name = 'PromptValidationError';
     }
   }

   /**
    * Immutable Prompt class
    *
    * @typeParam T - The validated response type
    *
    * @remarks
    * Per PRD Section 4.1, prompts are immutable and contain:
    * - User prompt text
    * - Optional data for templating
    * - Zod schema for response validation
    * - Optional model override
    * - Optional error handler
    *
    * @example
    * ```typescript
    * const prompt = new Prompt({
    *   userPrompt: "Generate a greeting for {name}",
    *   data: { name: "Alice" },
    *   responseFormat: z.object({ greeting: z.string() }),
    * });
    * ```
    */
   export class Prompt<T> {
     /** The prompt text */
     public readonly userPrompt: string;

     /** Data for templating */
     public readonly data: Record<string, unknown>;

     /** Response validation schema */
     public readonly responseFormat: z.ZodType<T>;

     /** Optional model override */
     public readonly modelOverride: CCRModel | undefined;

     /** Optional error handler */
     public readonly onError: ((err: Error) => void) | undefined;

     /**
      * Create an immutable Prompt
      *
      * @param config - Prompt configuration
      */
     constructor(config: PromptConfig<T>) {
       this.userPrompt = config.userPrompt;
       this.data = Object.freeze({ ...(config.data ?? {}) });
       this.responseFormat = config.responseFormat;
       this.modelOverride = config.modelOverride;
       this.onError = config.onError;

       // Freeze the instance to ensure immutability
       Object.freeze(this);
     }

     /**
      * Validate raw response data against the schema
      *
      * @param raw - Raw response to validate
      * @returns Validated and typed response
      * @throws PromptValidationError on validation failure
      */
     validate(raw: unknown): T {
       const result = this.responseFormat.safeParse(raw);

       if (!result.success) {
         const error = new PromptValidationError(
           `Response validation failed: ${result.error.message}`,
           result.error
         );

         // Call error handler if provided
         this.onError?.(error);

         throw error;
       }

       return result.data;
     }

     /**
      * Render the prompt with data substitution
      *
      * @returns Prompt text with {key} placeholders replaced by data values
      */
     render(): string {
       let rendered = this.userPrompt;

       for (const [key, value] of Object.entries(this.data)) {
         const placeholder = `{${key}}`;
         rendered = rendered.split(placeholder).join(String(value));
       }

       return rendered;
     }

     /**
      * Create a new Prompt with updated configuration
      * (Since Prompt is immutable, this returns a new instance)
      *
      * @param updates - Partial configuration updates
      * @returns New Prompt instance with updates applied
      */
     with(updates: Partial<PromptConfig<T>>): Prompt<T> {
       return new Prompt({
         userPrompt: updates.userPrompt ?? this.userPrompt,
         data: updates.data ?? { ...this.data },
         responseFormat: updates.responseFormat ?? this.responseFormat,
         modelOverride: updates.modelOverride ?? this.modelOverride,
         onError: updates.onError ?? this.onError,
       });
     }
   }
   ```

2. Create `/home/dustin/projects/laminar/src/prompts/index.ts`:
   ```typescript
   export { Prompt, PromptValidationError } from './prompt.js';
   ```

**Output**: `src/prompts/prompt.ts` with immutable Prompt class

**Validation**:
- Prompt instances are frozen
- `validate()` correctly uses Zod safeParse

---

## Milestone 4: Parameter-Level Caching System

### Task 4.1: Cache Key Hash Generator
**Depends on**: Task 3.2, Task 1.1

**Input**: Prompt class, CCRModel, ToolConfig, McpConfig

**Steps**:

1. Create `/home/dustin/projects/laminar/src/cache/key-generator.ts`:
   ```typescript
   import { createHash } from 'node:crypto';
   import type { CCRModel } from '../types/model.js';
   import type { ToolConfig, McpConfig } from '../types/agent.js';
   import type { z } from 'zod';

   /**
    * Parameters used to generate cache key
    */
   export interface CacheKeyParams {
     /** User prompt text */
     userPrompt: string;
     /** Prompt data */
     data: Record<string, unknown>;
     /** Model used */
     model: CCRModel;
     /** Provider */
     provider: string;
     /** Temperature (affects output) */
     temperature?: number;
     /** Tools (tool names affect caching) */
     tools: ToolConfig[];
     /** MCP servers */
     mcps: McpConfig[];
     /** Schema version hash */
     schemaVersion: string;
   }

   /**
    * Sort object keys recursively for deterministic JSON
    */
   function sortObjectKeys(obj: unknown): unknown {
     if (obj === null || typeof obj !== 'object') {
       return obj;
     }

     if (Array.isArray(obj)) {
       return obj.map(sortObjectKeys);
     }

     const sorted: Record<string, unknown> = {};
     const keys = Object.keys(obj as Record<string, unknown>).sort();

     for (const key of keys) {
       sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
     }

     return sorted;
   }

   /**
    * Create a stable JSON string with sorted keys
    */
   function stableStringify(obj: unknown): string {
     return JSON.stringify(sortObjectKeys(obj));
   }

   /**
    * Generate SHA-256 hash of data
    */
   function sha256(data: string): string {
     return createHash('sha256').update(data).digest('hex');
   }

   /**
    * Generate a deterministic cache key from parameters
    *
    * @remarks
    * Per PRD Section 6.1, cache key is hash of:
    * - prompt.userPrompt
    * - prompt.data
    * - model
    * - provider
    * - temperature
    * - tool list (names only)
    * - MCP list (names only)
    * - schema version hash
    *
    * @param params - Cache key parameters
    * @returns Hex SHA-256 hash string
    */
   export function generateCacheKey(params: CacheKeyParams): string {
     // Extract only tool names (not implementations)
     const toolNames = params.tools.map(t => t.name).sort();

     // Extract only MCP names
     const mcpNames = params.mcps.map(m => m.name).sort();

     const keyData = {
       userPrompt: params.userPrompt,
       data: params.data,
       model: params.model,
       provider: params.provider,
       temperature: params.temperature,
       tools: toolNames,
       mcps: mcpNames,
       schemaVersion: params.schemaVersion,
     };

     const stableJson = stableStringify(keyData);
     return sha256(stableJson);
   }

   /**
    * Generate a version hash for a Zod schema
    *
    * @remarks
    * Uses schema description and shape to create fingerprint.
    * Changes to schema structure will produce different hash.
    *
    * @param schema - Zod schema
    * @returns Hex SHA-256 hash string
    */
   export function getSchemaVersionHash(schema: z.ZodType<unknown>): string {
     // Get schema description for hashing
     const schemaInfo = {
       description: schema.description,
       // Use JSON representation of schema shape
       shape: getSchemaShape(schema),
     };

     return sha256(stableStringify(schemaInfo));
   }

   /**
    * Extract shape information from a Zod schema
    */
   function getSchemaShape(schema: z.ZodType<unknown>): unknown {
     // Access internal Zod structure
     const def = (schema as unknown as { _def: unknown })._def;

     if (!def) {
       return { type: 'unknown' };
     }

     // Get type name from _def
     const typeName = (def as { typeName?: string }).typeName;

     if (typeName === 'ZodObject') {
       const shape = (def as { shape?: () => Record<string, unknown> }).shape?.();
       if (shape) {
         const shapeInfo: Record<string, unknown> = {};
         for (const [key, value] of Object.entries(shape)) {
           shapeInfo[key] = getSchemaShape(value as z.ZodType<unknown>);
         }
         return { type: 'object', shape: shapeInfo };
       }
     }

     return { type: typeName ?? 'unknown' };
   }

   /**
    * Generate a cache key prefix for busting related entries
    *
    * @param agentId - Agent identifier
    * @param promptPrefix - Prompt prefix to match
    * @returns Prefix string for cache key matching
    */
   export function getCacheKeyPrefix(agentId: string, promptPrefix?: string): string {
     if (promptPrefix) {
       return sha256(`${agentId}:${promptPrefix}`).slice(0, 16);
     }
     return sha256(agentId).slice(0, 16);
   }
   ```

2. Create `/home/dustin/projects/laminar/src/cache/index.ts`:
   ```typescript
   export {
     generateCacheKey,
     getSchemaVersionHash,
     getCacheKeyPrefix,
   } from './key-generator.js';
   export type { CacheKeyParams } from './key-generator.js';
   ```

**Output**: `src/cache/key-generator.ts` with deterministic cache key generation

**Validation**: Same inputs produce same cache key

---

### Task 4.2: AgentCache Interface and LRU Implementation
**Depends on**: Task 4.1

**Input**: Cache key generation utilities

**Steps**:

1. Create `/home/dustin/projects/laminar/src/cache/agent-cache.ts`:
   ```typescript
   /**
    * Default maximum cache size
    */
   const DEFAULT_MAX_SIZE = 1000;

   /**
    * Cache entry with value and metadata
    */
   interface CacheEntry<T> {
     value: T;
     createdAt: number;
   }

   /**
    * AgentCache interface per PRD Section 6.2
    */
   export interface AgentCache {
     /**
      * Get a cached value by key
      * @returns Cached value or undefined if not found
      */
     get(key: string): Promise<unknown | undefined>;

     /**
      * Set a cached value
      * @param key - Cache key
      * @param value - Value to cache
      */
     set(key: string, value: unknown): Promise<void>;

     /**
      * Remove a specific cache entry
      * @param key - Cache key to remove
      */
     bust(key: string): Promise<void>;

     /**
      * Remove all entries matching a prefix
      * @param prefix - Prefix to match
      */
     bustByPrefix(prefix: string): Promise<void>;
   }

   /**
    * In-memory LRU cache implementation
    *
    * @remarks
    * Uses Map's insertion order preservation for LRU behavior.
    * When capacity is reached, oldest entries are evicted.
    */
   export class LRUAgentCache implements AgentCache {
     private readonly cache: Map<string, CacheEntry<unknown>> = new Map();
     private readonly maxSize: number;

     /**
      * Create a new LRU cache
      * @param maxSize - Maximum number of entries (default: 1000)
      */
     constructor(maxSize: number = DEFAULT_MAX_SIZE) {
       this.maxSize = maxSize;
     }

     async get(key: string): Promise<unknown | undefined> {
       const entry = this.cache.get(key);

       if (!entry) {
         return undefined;
       }

       // Move to end (most recently used)
       this.cache.delete(key);
       this.cache.set(key, entry);

       return entry.value;
     }

     async set(key: string, value: unknown): Promise<void> {
       // Delete existing entry if present (will be re-added at end)
       this.cache.delete(key);

       // Evict oldest entries if at capacity
       while (this.cache.size >= this.maxSize) {
         const oldestKey = this.cache.keys().next().value;
         if (oldestKey !== undefined) {
           this.cache.delete(oldestKey);
         }
       }

       // Add new entry
       this.cache.set(key, {
         value,
         createdAt: Date.now(),
       });
     }

     async bust(key: string): Promise<void> {
       this.cache.delete(key);
     }

     async bustByPrefix(prefix: string): Promise<void> {
       const keysToDelete: string[] = [];

       for (const key of this.cache.keys()) {
         if (key.startsWith(prefix)) {
           keysToDelete.push(key);
         }
       }

       for (const key of keysToDelete) {
         this.cache.delete(key);
       }
     }

     /**
      * Get current cache size
      */
     get size(): number {
       return this.cache.size;
     }

     /**
      * Clear entire cache
      */
     clear(): void {
       this.cache.clear();
     }

     /**
      * Get cache statistics
      */
     getStats(): { size: number; maxSize: number } {
       return {
         size: this.cache.size,
         maxSize: this.maxSize,
       };
     }
   }
   ```

2. Update `/home/dustin/projects/laminar/src/cache/index.ts`:
   ```typescript
   export {
     generateCacheKey,
     getSchemaVersionHash,
     getCacheKeyPrefix,
   } from './key-generator.js';
   export type { CacheKeyParams } from './key-generator.js';
   export { LRUAgentCache } from './agent-cache.js';
   export type { AgentCache } from './agent-cache.js';
   ```

**Output**: `src/cache/agent-cache.ts` with LRUAgentCache

**Validation**: LRU eviction works correctly

---

## Milestone 5: Event and Telemetry System

### Task 5.1: RuntimeEvent Interface
**Depends on**: None (can run in parallel with earlier tasks)

**Input**: Existing WorkflowEvent type

**Steps**:

1. Create `/home/dustin/projects/laminar/src/types/runtime-events.ts`:
   ```typescript
   /**
    * Event types for the unified runtime event system
    * Per PRD Section 7.2
    */
   export type EventType =
     // Workflow events
     | 'workflow.start'
     | 'workflow.end'
     | 'step.start'
     | 'step.end'
     // Agent events
     | 'agent.start'
     | 'agent.stream'
     | 'agent.end'
     | 'agent.retry'
     // Prompt events
     | 'prompt.start'
     | 'prompt.end'
     // Tool events
     | 'tool.start'
     | 'tool.end'
     // MCP events
     | 'mcp.start'
     | 'mcp.event'
     | 'mcp.end'
     // Other events
     | 'error'
     | 'cache.hit'
     | 'cache.miss';

   /**
    * Node type in the event hierarchy
    */
   export type EventNodeType = 'workflow' | 'agent' | 'prompt' | 'tool' | 'mcp';

   /**
    * Metrics attached to runtime events
    */
   export interface RuntimeEventMetrics {
     /** Input tokens consumed */
     tokensIn?: number;
     /** Output tokens generated */
     tokensOut?: number;
     /** Duration in milliseconds */
     durationMs?: number;
   }

   /**
    * Unified runtime event schema
    * Per PRD Section 7.1
    *
    * @remarks
    * This is a superset of WorkflowEvent, unifying all event types
    * for streaming observability.
    */
   export interface RuntimeEvent {
     /** Unique event identifier */
     id: string;
     /** Parent event ID (for hierarchical events) */
     parentId?: string;
     /** Event type */
     type: EventType;
     /** When the event occurred */
     timestamp: number;
     /** Type of node that emitted the event */
     nodeType: EventNodeType;
     /** Optional name (agent name, tool name, etc.) */
     name?: string;
     /** Event-specific payload */
     payload?: Record<string, unknown>;
     /** Performance metrics */
     metrics?: RuntimeEventMetrics;
   }

   /**
    * Agent-specific event payload
    */
   export interface AgentEventPayload {
     agentId: string;
     runId: string;
     model: string;
     category?: string;
   }

   /**
    * Tool-specific event payload
    */
   export interface ToolEventPayload {
     toolName: string;
     input?: unknown;
     output?: unknown;
     error?: string;
   }

   /**
    * Cache-specific event payload
    */
   export interface CacheEventPayload {
     cacheKey: string;
     hit: boolean;
   }
   ```

2. Update `/home/dustin/projects/laminar/src/types/index.ts`:
   ```typescript
   // Add at end
   export type {
     EventType,
     EventNodeType,
     RuntimeEventMetrics,
     RuntimeEvent,
     AgentEventPayload,
     ToolEventPayload,
     CacheEventPayload,
   } from './runtime-events.js';
   ```

**Output**: `src/types/runtime-events.ts` with RuntimeEvent

**Validation**: `npm run lint` passes

---

### Task 5.2: RuntimeEventBus Implementation
**Depends on**: Task 5.1

**Input**: RuntimeEvent type, Observable utility

**Steps**:

1. Create `/home/dustin/projects/laminar/src/events/event-bus.ts`:
   ```typescript
   import type { RuntimeEvent, EventType } from '../types/runtime-events.js';
   import { Observable } from '../utils/observable.js';
   import type { Subscription } from '../utils/observable.js';
   import { generateId } from '../utils/id.js';

   /**
    * Event handler function type
    */
   export type EventHandler = (event: RuntimeEvent) => void;

   /**
    * Event filter predicate
    */
   export type EventFilter = (event: RuntimeEvent) => boolean;

   /**
    * Centralized event bus for runtime events
    *
    * @remarks
    * Provides pub/sub for runtime events with:
    * - Type-safe event emission
    * - Observable streaming
    * - Event filtering
    */
   export class RuntimeEventBus {
     private readonly observable: Observable<RuntimeEvent>;
     private readonly handlers: Set<EventHandler> = new Set();

     constructor() {
       this.observable = new Observable<RuntimeEvent>();
     }

     /**
      * Emit a runtime event
      *
      * @param event - Partial event (id and timestamp auto-assigned)
      */
     emit(event: Omit<RuntimeEvent, 'id' | 'timestamp'>): void {
       const fullEvent: RuntimeEvent = {
         ...event,
         id: generateId(),
         timestamp: Date.now(),
       };

       // Notify Observable subscribers
       this.observable.next(fullEvent);

       // Notify direct handlers
       for (const handler of this.handlers) {
         try {
           handler(fullEvent);
         } catch (err) {
           console.error('Event handler error:', err);
         }
       }
     }

     /**
      * Subscribe to all events
      *
      * @param handler - Handler called for each event
      * @returns Subscription for cleanup
      */
     subscribe(handler: EventHandler): Subscription {
       this.handlers.add(handler);
       return {
         unsubscribe: () => {
           this.handlers.delete(handler);
         },
       };
     }

     /**
      * Subscribe to events matching a filter
      *
      * @param filter - Predicate to filter events
      * @param handler - Handler called for matching events
      * @returns Subscription for cleanup
      */
     subscribeFiltered(filter: EventFilter, handler: EventHandler): Subscription {
       const wrappedHandler: EventHandler = (event) => {
         if (filter(event)) {
           handler(event);
         }
       };

       return this.subscribe(wrappedHandler);
     }

     /**
      * Subscribe to events of specific type(s)
      *
      * @param types - Event type(s) to subscribe to
      * @param handler - Handler called for matching events
      * @returns Subscription for cleanup
      */
     subscribeToTypes(
       types: EventType | EventType[],
       handler: EventHandler
     ): Subscription {
       const typeSet = new Set(Array.isArray(types) ? types : [types]);
       return this.subscribeFiltered(
         (event) => typeSet.has(event.type),
         handler
       );
     }

     /**
      * Get the underlying Observable for advanced streaming
      */
     asObservable(): Observable<RuntimeEvent> {
       return this.observable;
     }

     /**
      * Create a child event bus that forwards to this one
      * Useful for scoped event emission
      *
      * @param parentId - Parent event ID to set on forwarded events
      */
     createChild(parentId: string): ChildEventBus {
       return new ChildEventBus(this, parentId);
     }
   }

   /**
    * Child event bus that auto-sets parentId
    */
   export class ChildEventBus {
     constructor(
       private readonly parent: RuntimeEventBus,
       private readonly parentId: string
     ) {}

     emit(event: Omit<RuntimeEvent, 'id' | 'timestamp' | 'parentId'>): void {
       this.parent.emit({
         ...event,
         parentId: this.parentId,
       });
     }
   }
   ```

2. Create `/home/dustin/projects/laminar/src/events/index.ts`:
   ```typescript
   export { RuntimeEventBus, ChildEventBus } from './event-bus.js';
   export type { EventHandler, EventFilter } from './event-bus.js';
   ```

**Output**: `src/events/event-bus.ts` with RuntimeEventBus

**Validation**: Events emit to subscribers correctly

---

## Milestone 6: Agent.prompt and Agent.reflect Methods

### Task 6.1: Implement Agent.prompt Method
**Depends on**: Task 2.2, Task 3.2, Task 4.2, Task 5.2, Task 1.5

**Input**: Agent class, Prompt class, LRUAgentCache, RuntimeEventBus, CCRRouter

**Steps**:

1. Update `/home/dustin/projects/laminar/src/agents/agent.ts` to add prompt method:
   ```typescript
   import type {
     AgentConfig,
     AgentHooks,
     AgentRuntimeOverrides,
     AgentRunContext,
     ToolConfig,
     McpConfig,
   } from '../types/agent.js';
   import type { CCRModel } from '../types/model.js';
   import type { RuntimeEvent } from '../types/runtime-events.js';
   import { generateId } from '../utils/id.js';
   import { parseCCRModel } from '../models/parser.js';
   import type { CCRRouter } from '../models/router.js';
   import type { Prompt } from '../prompts/prompt.js';
   import type { AgentCache } from '../cache/agent-cache.js';
   import { generateCacheKey, getSchemaVersionHash } from '../cache/key-generator.js';
   import type { RuntimeEventBus } from '../events/event-bus.js';

   /**
    * Execution context for agent runs
    */
   export interface AgentExecutionContext {
     /** CCR Router for model execution */
     router: CCRRouter;
     /** Cache instance */
     cache?: AgentCache;
     /** Event bus for emitting events */
     eventBus?: RuntimeEventBus;
     /** Workflow node ID for tree attachment */
     workflowNodeId?: string;
   }

   /**
    * Agent class for executing prompts with LLM models
    */
   export class Agent {
     /** Unique agent identifier */
     public readonly id: string;

     /** Agent name */
     public readonly name: string;

     /** Model category */
     public readonly category: string | undefined;

     /** Available tools */
     public readonly tools: readonly ToolConfig[];

     /** Available MCP servers */
     public readonly mcps: readonly McpConfig[];

     /** Full configuration (private) */
     private readonly config: AgentConfig;

     /** Execution context (set when running in workflow) */
     private executionContext?: AgentExecutionContext;

     constructor(config: AgentConfig = {}) {
       this.id = generateId();
       this.config = config;
       this.name = config.name ?? 'Agent';
       this.category = config.category;
       this.tools = Object.freeze([...(config.tools ?? [])]);
       this.mcps = Object.freeze([...(config.mcps ?? [])]);
     }

     /**
      * Set execution context (called by workflow integration)
      */
     setExecutionContext(context: AgentExecutionContext): void {
       this.executionContext = context;
     }

     /**
      * Execute a prompt and return validated result
      *
      * @typeParam T - Expected response type
      * @param prompt - Prompt to execute
      * @param overrides - Optional runtime overrides
      * @returns Validated response
      */
     async prompt<T>(
       prompt: Prompt<T>,
       overrides?: AgentRuntimeOverrides
     ): Promise<T> {
       if (!this.executionContext) {
         throw new Error('Agent must have execution context set before calling prompt()');
       }

       const { router, cache, eventBus, workflowNodeId } = this.executionContext;
       const hooks = this.config.hooks ?? {};
       const runId = generateId();

       // Resolve model
       const model = this.resolveModel(prompt, overrides);
       const { provider } = parseCCRModel(model);

       // Create run context
       const ctx: AgentRunContext = {
         agentId: this.id,
         runId,
         prompt: prompt as any,
         model,
         provider,
         workflowNodeId,
         timestamp: Date.now(),
         params: overrides ?? {},
       };

       // Emit agent.start event
       eventBus?.emit({
         type: 'agent.start',
         nodeType: 'agent',
         name: this.name,
         payload: { agentId: this.id, runId, model, category: this.category },
       });

       try {
         // Call beforePrompt hook
         await this.callHook(hooks.beforePrompt, ctx);

         // Check cache
         const cacheEnabled = this.isCacheEnabled() && !overrides?.disableCache;
         let cacheKey: string | undefined;

         if (cacheEnabled && cache) {
           await this.callHook(hooks.beforeCacheCheck, ctx);

           cacheKey = this.generateCacheKey(prompt, model, provider, overrides);
           const cached = await cache.get(cacheKey);

           if (cached !== undefined) {
             eventBus?.emit({
               type: 'cache.hit',
               nodeType: 'agent',
               payload: { cacheKey, hit: true },
             });

             // Validate cached result
             const validated = prompt.validate(cached);
             await this.callHook(hooks.afterValidation, ctx, validated);

             eventBus?.emit({
               type: 'agent.end',
               nodeType: 'agent',
               name: this.name,
               payload: { agentId: this.id, runId, cached: true },
             });

             return validated;
           }

           eventBus?.emit({
             type: 'cache.miss',
             nodeType: 'agent',
             payload: { cacheKey, hit: false },
           });
         }

         // Build messages
         const messages = [{ role: 'user' as const, content: prompt.render() }];

         // Merge tools
         const tools = this.getMergedTools(overrides);
         const toolConfigs = tools.map(t => ({
           name: t.name,
           description: t.description,
           inputSchema: t.inputSchema,
         }));

         // Execute via router
         const response = await router.run(
           {
             messages,
             tools: toolConfigs.length > 0 ? toolConfigs : undefined,
             temperature: overrides?.temperature,
           },
           this.category ?? 'default',
           (attempt) => {
             if (!attempt.success) {
               eventBus?.emit({
                 type: 'agent.retry',
                 nodeType: 'agent',
                 name: this.name,
                 payload: { model: attempt.model, attempt: attempt.attempt, error: attempt.error?.message },
               });
             }
           }
         );

         // Extract text content
         const textContent = response.content
           .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
           .map(c => c.text)
           .join('');

         // Parse JSON response
         let rawResult: unknown;
         try {
           rawResult = JSON.parse(textContent);
         } catch {
           rawResult = textContent;
         }

         // Call beforeValidation hook
         await this.callHook(hooks.beforeValidation, ctx, rawResult);

         // Validate response
         const validated = prompt.validate(rawResult);

         // Call afterValidation hook
         await this.callHook(hooks.afterValidation, ctx, validated);

         // Cache result
         if (cacheEnabled && cache && cacheKey) {
           await cache.set(cacheKey, validated);
           await this.callHook(hooks.afterCacheWrite, ctx);
         }

         // Call afterPrompt hook
         await this.callHook(hooks.afterPrompt, ctx, validated);

         // Emit agent.end event
         eventBus?.emit({
           type: 'agent.end',
           nodeType: 'agent',
           name: this.name,
           metrics: {
             tokensIn: response.usage.tokensIn,
             tokensOut: response.usage.tokensOut,
           },
           payload: { agentId: this.id, runId, cached: false },
         });

         return validated;
       } catch (error) {
         // Call onError hook
         const err = error instanceof Error ? error : new Error(String(error));
         await this.callHook(hooks.onError, ctx, err);

         // Emit error event
         eventBus?.emit({
           type: 'error',
           nodeType: 'agent',
           name: this.name,
           payload: { agentId: this.id, runId, error: err.message },
         });

         throw error;
       }
     }

     /**
      * Execute reflection on error
      */
     async reflect<T>(
       prompt: Prompt<T>,
       overrideModel?: CCRModel
     ): Promise<T> {
       // Create modified prompt with reflection context
       const reflectionPrompt = prompt.with({
         userPrompt: `REFLECTION REQUEST:\n\n${prompt.userPrompt}\n\nPlease review and provide a corrected response.`,
         modelOverride: overrideModel ?? prompt.modelOverride,
       });

       return this.prompt(reflectionPrompt);
     }

     /**
      * Resolve which model to use
      */
     private resolveModel(prompt: Prompt<unknown>, overrides?: AgentRuntimeOverrides): CCRModel {
       // Precedence: override > prompt > agent default > category default
       if (overrides?.model) return overrides.model;
       if (prompt.modelOverride) return prompt.modelOverride;
       if (this.config.defaultModel) return this.config.defaultModel;

       // Category-based resolution happens in router
       // Return a placeholder that router will resolve
       return `${this.category ?? 'default'},default` as CCRModel;
     }

     /**
      * Generate cache key for this prompt execution
      */
     private generateCacheKey(
       prompt: Prompt<unknown>,
       model: CCRModel,
       provider: string,
       overrides?: AgentRuntimeOverrides
     ): string {
       return generateCacheKey({
         userPrompt: prompt.userPrompt,
         data: prompt.data as Record<string, unknown>,
         model,
         provider,
         temperature: overrides?.temperature,
         tools: this.getMergedTools(overrides),
         mcps: this.getMergedMcps(overrides),
         schemaVersion: getSchemaVersionHash(prompt.responseFormat),
       });
     }

     /**
      * Safely call a hook function
      */
     private async callHook<T extends unknown[]>(
       hook: ((...args: T) => void | Promise<void>) | undefined,
       ...args: T
     ): Promise<void> {
       if (hook) {
         try {
           await hook(...args);
         } catch (err) {
           console.error('Hook error:', err);
         }
       }
     }

     // Configuration getters
     getConfig(): AgentConfig { return { ...this.config }; }
     getHooks(): AgentHooks { return this.config.hooks ?? {}; }
     isCacheEnabled(): boolean { return this.config.enableCache !== false; }
     getDefaultModel(): CCRModel | undefined { return this.config.defaultModel; }
     getDefaultProvider(): string | undefined { return this.config.defaultProvider; }
     getModelIndex(): number { return this.config.modelIndex ?? 0; }

     getMergedTools(overrides?: AgentRuntimeOverrides): ToolConfig[] {
       return [...(this.config.tools ?? []), ...(overrides?.tools ?? [])];
     }

     getMergedMcps(overrides?: AgentRuntimeOverrides): McpConfig[] {
       return [...(this.config.mcps ?? []), ...(overrides?.mcps ?? [])];
     }
   }
   ```

**Output**: Complete Agent class with prompt() and reflect() methods

**Validation**: Agent can execute prompts with validation

---

## Milestone 7: Tool Execution Framework

### Task 7.1: ToolExecutor Implementation
**Depends on**: Task 5.2, Task 2.1

**Input**: ToolConfig type, RuntimeEventBus

**Steps**:

1. Create `/home/dustin/projects/laminar/src/tools/executor.ts`:
   ```typescript
   import type { ToolConfig } from '../types/agent.js';
   import type { RuntimeEventBus } from '../events/event-bus.js';
   import { generateId } from '../utils/id.js';

   /**
    * Error thrown during tool execution
    */
   export class ToolExecutionError extends Error {
     constructor(
       public readonly toolName: string,
       public readonly originalError: Error
     ) {
       super(`Tool "${toolName}" failed: ${originalError.message}`);
       this.name = 'ToolExecutionError';
     }
   }

   /**
    * Executor for agent tools
    *
    * @remarks
    * Handles tool execution with event emission per PRD Section 10.
    * Tool results attach to the AgentRunNode.toolCalls array.
    */
   export class ToolExecutor {
     private readonly toolMap: Map<string, ToolConfig>;

     constructor(
       tools: ToolConfig[],
       private readonly eventBus?: RuntimeEventBus
     ) {
       this.toolMap = new Map(tools.map(t => [t.name, t]));
     }

     /**
      * Execute a tool by name
      *
      * @param toolName - Name of the tool to execute
      * @param input - Input data for the tool
      * @param parentRunId - Parent agent run ID
      * @returns Tool execution result
      */
     async execute(
       toolName: string,
       input: unknown,
       parentRunId: string
     ): Promise<unknown> {
       const tool = this.toolMap.get(toolName);

       if (!tool) {
         throw new ToolExecutionError(
           toolName,
           new Error(`Tool "${toolName}" not found`)
         );
       }

       const toolEventId = generateId();
       const startTime = Date.now();

       // Emit tool.start event
       this.eventBus?.emit({
         type: 'tool.start',
         nodeType: 'tool',
         name: toolName,
         parentId: parentRunId,
         payload: { input },
       });

       try {
         const result = await tool.execute(input);

         // Emit tool.end event
         this.eventBus?.emit({
           type: 'tool.end',
           nodeType: 'tool',
           name: toolName,
           parentId: parentRunId,
           metrics: { durationMs: Date.now() - startTime },
           payload: { output: result },
         });

         return result;
       } catch (error) {
         const err = error instanceof Error ? error : new Error(String(error));

         // Emit error event
         this.eventBus?.emit({
           type: 'error',
           nodeType: 'tool',
           name: toolName,
           parentId: parentRunId,
           payload: { error: err.message },
         });

         throw new ToolExecutionError(toolName, err);
       }
     }

     /**
      * Check if a tool exists
      */
     hasTool(name: string): boolean {
       return this.toolMap.has(name);
     }

     /**
      * Get all tool names
      */
     getToolNames(): string[] {
       return Array.from(this.toolMap.keys());
     }
   }
   ```

2. Create `/home/dustin/projects/laminar/src/tools/index.ts`:
   ```typescript
   export { ToolExecutor, ToolExecutionError } from './executor.js';
   ```

**Output**: `src/tools/executor.ts` with ToolExecutor

**Validation**: Tools execute with events emitted

---

## Milestone 8: Main Entry Point Updates

### Task 8.1: Update Package Exports
**Depends on**: All previous tasks

**Input**: All new modules

**Steps**:

1. Update `/home/dustin/projects/laminar/package.json` to add zod dependency:
   ```json
   {
     "dependencies": {
       "zod": "^3.23.0"
     }
   }
   ```

2. Update `/home/dustin/projects/laminar/src/index.ts` with all new exports:
   ```typescript
   // Existing types
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

   // Existing core classes
   export { Workflow } from './core/workflow.js';
   export { WorkflowLogger } from './core/logger.js';

   // Existing decorators
   export { Step } from './decorators/step.js';
   export { Task } from './decorators/task.js';
   export { ObservedState, getObservedState } from './decorators/observed-state.js';

   // Existing debugger
   export { WorkflowTreeDebugger } from './debugger/tree-debugger.js';

   // Existing utilities
   export { Observable } from './utils/observable.js';
   export type { Subscription, Observer } from './utils/observable.js';
   export { generateId } from './utils/id.js';

   // Existing examples
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
   ```

**Output**: Updated `src/index.ts` with all exports

**Validation**: `npm run build` succeeds

---

## 4. Implementation Details

### Code Patterns to Follow

**Model string parsing**:
```typescript
// Always validate CCR model strings
const { provider, version } = parseCCRModel("openai,gpt-4o");
```

**Cache key generation**:
```typescript
// Sort keys before hashing for determinism
const key = generateCacheKey({
  userPrompt: prompt.render(),
  data: prompt.data,
  model, provider, temperature,
  tools: agent.getMergedTools(overrides),
  mcps: agent.getMergedMcps(overrides),
  schemaVersion: getSchemaVersionHash(prompt.responseFormat),
});
```

**Agent execution within workflow**:
```typescript
// In workflow step
@Step({ snapshotState: true })
async generateCode(): Promise<CodeResult> {
  // Agent receives context automatically
  return this.agent.prompt(
    new Prompt({
      userPrompt: "Generate code for...",
      responseFormat: CodeResultSchema,
    })
  );
}
```

### File Structure
```
src/
├── types/
│   ├── model.ts          # CCRModel, CategoryModelConfig
│   ├── agent.ts          # AgentConfig, AgentHooks, etc.
│   ├── prompt.ts         # PromptConfig
│   ├── runtime-events.ts # RuntimeEvent, EventType
│   └── index.ts          # Barrel exports
├── models/
│   ├── parser.ts         # CCR parsing utilities
│   ├── resolver.ts       # ModelResolver
│   ├── ccr.ts            # CCR interface
│   ├── router.ts         # CCRRouter with fallback
│   └── index.ts
├── agents/
│   ├── agent.ts          # Agent class
│   └── index.ts
├── prompts/
│   ├── prompt.ts         # Prompt class
│   └── index.ts
├── cache/
│   ├── key-generator.ts  # Cache key utilities
│   ├── agent-cache.ts    # LRUAgentCache
│   └── index.ts
├── events/
│   ├── event-bus.ts      # RuntimeEventBus
│   └── index.ts
├── tools/
│   ├── executor.ts       # ToolExecutor
│   └── index.ts
└── index.ts              # Main exports
```

---

## 5. Testing Strategy

### Unit Tests

Create test files in `src/__tests__/unit/`:

```yaml
test_files:
  - path: "src/__tests__/unit/models.test.ts"
    covers:
      - CCR model parsing
      - Model resolution precedence
      - Router fallback logic

  - path: "src/__tests__/unit/agent.test.ts"
    covers:
      - Agent instantiation
      - Configuration merging
      - Hook calling order

  - path: "src/__tests__/unit/prompt.test.ts"
    covers:
      - Prompt immutability
      - Zod validation
      - Data rendering

  - path: "src/__tests__/unit/cache.test.ts"
    covers:
      - Cache key determinism
      - LRU eviction
      - Prefix-based busting

  - path: "src/__tests__/unit/events.test.ts"
    covers:
      - Event emission
      - Subscription management
      - Type filtering
```

### Integration Tests

```yaml
scenarios:
  - name: "Agent executes prompt with caching"
    validates: "Full prompt execution flow with cache"

  - name: "Router falls back on model failure"
    validates: "Automatic fallback routing"

  - name: "Events stream to subscribers"
    validates: "Event bus integration"
```

---

## 6. Final Validation Checklist

### Code Quality
- [ ] All TypeScript compiles with `strict: true`
- [ ] No linting warnings (`npm run lint`)
- [ ] Follows existing naming conventions
- [ ] Proper error handling throughout

### Functionality
- [ ] CCR model parsing works correctly
- [ ] Model resolution follows precedence rules
- [ ] Agent executes prompts with Zod validation
- [ ] Cache prevents duplicate calls
- [ ] Router falls back on failures
- [ ] Events emit to RuntimeEventBus subscribers
- [ ] Tools execute with event emission

### Testing
- [ ] Unit tests pass for all new modules
- [ ] Integration tests verify end-to-end flow
- [ ] Manual validation with example workflow

---

## 7. "No Prior Knowledge" Test

- [x] All file paths are absolute and specific
- [x] All patterns have concrete code examples
- [x] All dependencies explicitly listed (zod)
- [x] All validation steps are executable commands
- [x] Existing codebase patterns documented
- [x] Technical constraints specified
- [x] Known gotchas documented with solutions

---

## Confidence Score: 8/10

**Rationale**:
- Complete PRD specification provides clear interfaces
- Existing codebase patterns well-documented
- Research completed on Zod, caching, events
- Zero new runtime dependencies (except zod)
- Tasks ordered by dependency

**Remaining uncertainties**:
- CCR implementation is interface-only (actual provider adapters deferred)
- Tool calling loop (multiple tool calls) not fully specified
- MCP integration is skeleton only (per PRD: post-MVP)
- Schema hashing may need refinement for complex Zod schemas
- Workflow integration (@Step with agent context) needs testing

---

## Quick Start Commands

```bash
# 1. Install new dependency
cd /home/dustin/projects/laminar
npm install zod

# 2. Build
npm run build

# 3. Test
npm test

# 4. Verify exports
node -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"
```
