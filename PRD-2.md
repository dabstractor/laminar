# 📘 **PRD — DELTA SPECIFICATION**

## Unified Workflow + Agent + Prompt Architecture

**Source of Truth Version 1.0**

---

# 1. Overview

This PRD defines all additions to the Workflow, Agent, and Prompt subsystems required to produce a fully unified orchestration architecture with:

* hierarchical workflows
* reflection and recovery
* model/provider category-based routing
* CCR-compatible provider/model strings
* full event streaming and observability
* parameter-level caching
* tool/MCP integration
* schema-validated agent outputs
* deterministic logging and traceability

Workflows remain the backbone of orchestration.
Agents remain leaf nodes executed within Workflow steps.
Prompts remain immutable declarative request objects.

This PRD defines the **delta on top of the existing workflow spec**.

---

# 2. Unified Model/Provider Configuration

## 2.1 Category-Based Model Configuration

Users provide a configuration mapping **category → ordered array of model descriptors**.

Example:

```ts
interface CategoryModelConfig {
  [category: string]: CCRModel[];   // e.g. ["research"] → ["openai,gpt-5", "openai,gpt-4o-mini"]
}

type CCRModel = string;             // "provider-slug,model-version"
```

### Category Rules

* Array index 0 = **smartest**
* Higher indices = **faster/dumber**
* One-dimensional only (no swarm arrays)
* Missing categories → error
* Missing index → fallback to next available model
* If all models fail → propagate final error

### Model selection precedence:

1. **Prompt override**
2. **Agent default model**
3. **Workflow default model**
4. **Category default (index 0)**
5. **Fallback indices (1,2,3…)**
6. **Error**

---

# 3. Agent System Specification

## 3.1 AgentConfig

```ts
interface AgentConfig {
  name?: string;
  category?: string;          // e.g. "coding", "research", "validate"
  modelIndex?: number;        // default index within category
  defaultModel?: CCRModel;    // optional CCR override
  defaultProvider?: string;   // optional provider slug override
  tools?: ToolConfig[];
  mcps?: McpConfig[];
  hooks?: AgentHooks;
  enableCache?: boolean;      // default true
}
```

## 3.2 Agent Instance

```ts
class Agent {
  constructor(cfg: AgentConfig);

  prompt<T>(prompt: Prompt<T>, opts?: AgentRuntimeOverrides): Promise<T>;

  reflect<T>(prompt: Prompt<T>, overrideModel?: CCRModel): Promise<T>;
}
```

## 3.3 Runtime Overrides

```ts
interface AgentRuntimeOverrides {
  model?: CCRModel;
  provider?: string;
  temperature?: number;
  tools?: ToolConfig[];
  mcps?: McpConfig[];
  disableCache?: boolean;
}
```

## 3.4 Agent Hook Points

```ts
interface AgentHooks {
  beforePrompt?: (ctx: AgentRunContext) => void;
  afterPrompt?: (ctx: AgentRunContext, result: any) => void;
  beforeValidation?: (ctx: AgentRunContext, raw: any) => void;
  afterValidation?: (ctx: AgentRunContext, validated: any) => void;
  beforeCacheCheck?: (ctx: AgentRunContext) => void;
  afterCacheWrite?: (ctx: AgentRunContext) => void;
  onError?: (ctx: AgentRunContext, err: Error) => void;
}
```

## 3.5 AgentRunContext

```ts
interface AgentRunContext {
  agentId: string;
  runId: string;
  prompt: Prompt<any>;
  model: CCRModel;
  provider: string;
  workflowNodeId?: string;
  timestamp: number;
  params: Record<string, any>;
}
```

---

# 4. Prompt System Specification

## 4.1 Prompt<T>

Prompts are immutable.

```ts
class Prompt<T> {
  readonly userPrompt: string;
  readonly data: Record<string, any>;
  readonly responseFormat: ZodSchema<T>;
  readonly modelOverride?: CCRModel;
  readonly onError?: (err: Error) => void;

  constructor(cfg: PromptConfig<T>);
}
```

```ts
interface PromptConfig<T> {
  userPrompt: string;
  data?: Record<string, any>;
  responseFormat: ZodSchema<T>;
  modelOverride?: CCRModel;
  onError?: (err: Error) => void;
}
```

Prompts do **not** store provider or category—only model override.

---

# 5. Workflow Integration

All agent runs occur within workflow steps:

```ts
await ctx.step("Analyze", async () => {
  return agent.prompt(
    new Prompt({
      userPrompt: "...",
      responseFormat: ResultSchema
    })
  );
});
```

Workflow logging automatically:

* attaches the AgentRun node under the current Workflow step
* includes all tool/MCP sub-events
* streams model output tokens
* records retries, failures, duration, model used, token counts

No additional config required.

---

# 6. Parameter-Level Caching

## 6.1 Cache Keys

Cache key = hash of:

```
{
  prompt.userPrompt,
  prompt.data,
  model,
  provider,
  temperature,
  tool list,
  MCP list,
  schema version hash
}
```

Hashing uses a stable deterministic JSON encoder + SHA-256.

## 6.2 API

```ts
interface AgentCache {
  get(key: string): Promise<any | undefined>;
  set(key: string, value: any): Promise<void>;
  bust(key: string): Promise<void>;
  bustByPrefix(prefix: string): Promise<void>; // for templates
}
```

Default implementation: in-memory LRU.

---

# 7. Event & Telemetry System

A unified event schema powers streaming observability.

### 7.1 Event Shape

```ts
interface RuntimeEvent {
  id: string;
  parentId?: string;
  type: EventType;
  timestamp: number;
  nodeType: "workflow" | "agent" | "prompt" | "tool" | "mcp";
  name?: string;
  payload?: Record<string, any>;
  metrics?: {
    tokensIn?: number;
    tokensOut?: number;
    durationMs?: number;
  };
}
```

### 7.2 Event Types

```
workflow.start
workflow.end
step.start
step.end
agent.start
agent.stream
agent.end
agent.retry
prompt.start
prompt.end
tool.start
tool.end
mcp.start
mcp.event
mcp.end
error
cache.hit
cache.miss
```

Events are:

* emitted to an internal event bus
* written into the workflow log tree
* optionally streamed to UI consumers

---

# 8. Provider Routing (CCR Spec)

### Model string format:

```
"provider-slug,model-version"
```

Agents and workflows always resolve to this string.

Using Claude Code Router (CCR):

```ts
const result = await CCR.run({
  model: resolvedCCRString,
  messages,
  tools,
  mcps
});
```

Failures automatically fallback to the next model in the category array.

---

# 9. Reflection System

Reflection is triggered **top-down**.

```ts
await agent.reflect(
  new Prompt({...}),
  overrideModel?       // optional CCR model override
);
```

Reflection rules:

* Workflow step initiates reflection after agent failure
* Reflection uses model override if supplied
* Otherwise inherited model
* Reflection nodes appear as children of the failed step

---

# 10. Tool & MCP Integration

* Tools follow Anthropic agent SDK tool schema
* MCP events follow Anthropic MCP spec
* Tools belong to Prompt → AgentRun → WorkflowStep hierarchy
* Tool errors map to Prompt errors
* MCP events appear under the same agent run's event chain

Nested workflows inside tools: **deferred to post-MVP**.

---

# 11. Code Example (End-to-End)

```ts
const models = {
  coding: [
    "openai,gpt-5",
    "openai,gpt-4o",
    "openai,gpt-4o-mini"
  ]
};

const agent = new Agent({
  name: "coder",
  category: "coding",
  tools: [runCommandTool],
});

const wf = new Workflow({}, async (ctx) => {
  await ctx.step("Generate Code", async () => {
    return agent.prompt(
      new Prompt({
        userPrompt: "Write a TypeScript function for sorting",
        responseFormat: z.object({ code: z.string() })
      })
    );
  });
});
```
