# Agents

Agents are the execution units that run prompts against LLM providers. They handle model routing, caching, tool execution, and lifecycle hooks.

## Overview

```typescript
import { Agent } from 'laminar';

const agent = new Agent({
  name: 'Coder',
  category: 'coding',
  enableCache: true,
});
```

Agents are leaf nodes in the workflow hierarchy. They:
- Execute prompts and validate responses
- Route to appropriate models via CCRRouter
- Cache responses based on deterministic keys
- Emit events for observability
- Execute tools when requested by the model

## Configuration

### AgentConfig

```typescript
interface AgentConfig {
  name?: string;              // Human-readable name (default: "Agent")
  category?: string;          // Model category for routing (e.g., "coding", "research")
  modelIndex?: number;        // Default index within category (0 = smartest)
  defaultModel?: CCRModel;    // Override category-based routing
  defaultProvider?: string;   // Override provider
  tools?: ToolConfig[];       // Available tools
  mcps?: McpConfig[];         // MCP server connections
  hooks?: AgentHooks;         // Lifecycle hooks
  enableCache?: boolean;      // Enable response caching (default: true)
}
```

### Basic Configuration

```typescript
const agent = new Agent({
  name: 'Analyst',
  category: 'research',
});
```

### With Tools

```typescript
const agent = new Agent({
  name: 'Coder',
  category: 'coding',
  tools: [
    {
      name: 'runTests',
      description: 'Run test suite',
      inputSchema: {
        type: 'object',
        properties: {
          testPath: { type: 'string' },
        },
        required: ['testPath'],
      },
      execute: async (input) => {
        const { testPath } = input as { testPath: string };
        // Run tests
        return { passed: true, count: 10 };
      },
    },
  ],
});
```

### With Lifecycle Hooks

```typescript
const agent = new Agent({
  name: 'Monitored',
  hooks: {
    beforePrompt: (ctx) => {
      console.log(`[${ctx.runId}] Starting prompt`);
    },
    afterPrompt: (ctx, result) => {
      console.log(`[${ctx.runId}] Completed`);
    },
    onError: (ctx, err) => {
      console.error(`[${ctx.runId}] Failed:`, err.message);
    },
  },
});
```

## Execution Context

Before executing prompts, agents need an execution context:

```typescript
interface AgentExecutionContext {
  router: CCRRouter;           // Required: model routing
  cache?: AgentCache;          // Optional: response caching
  eventBus?: RuntimeEventBus;  // Optional: event emission
  workflowNodeId?: string;     // Optional: workflow tree attachment
}
```

### Setting Context

```typescript
const router = new CCRRouter(ccrImplementation, modelConfig);
const cache = new LRUAgentCache(1000);
const eventBus = new RuntimeEventBus();

agent.setExecutionContext({ router, cache, eventBus });
```

### Context in Workflows

When agents run inside workflows, the workflow typically sets the context:

```typescript
class MyWorkflow extends Workflow {
  private agent: Agent;

  constructor(router: CCRRouter, cache: LRUAgentCache, eventBus: RuntimeEventBus) {
    super('MyWorkflow');
    this.agent = new Agent({ name: 'Worker', category: 'coding' });
    this.agent.setExecutionContext({
      router,
      cache,
      eventBus,
      workflowNodeId: this.id,
    });
  }
}
```

## Executing Prompts

### Basic Execution

```typescript
const result = await agent.prompt(
  new Prompt({
    userPrompt: 'Write a sorting function',
    responseFormat: z.object({
      code: z.string(),
      language: z.string(),
    }),
  })
);

console.log(result.code);     // Typed as string
console.log(result.language); // Typed as string
```

### With Runtime Overrides

Override agent configuration for a single call:

```typescript
interface AgentRuntimeOverrides {
  model?: CCRModel;           // Override model
  provider?: string;          // Override provider
  temperature?: number;       // Set temperature
  tools?: ToolConfig[];       // Add tools for this call
  mcps?: McpConfig[];         // Add MCP servers
  disableCache?: boolean;     // Skip cache
}
```

```typescript
// Use a specific model
const result = await agent.prompt(prompt, {
  model: 'anthropic,claude-3-opus',
});

// Disable caching
const fresh = await agent.prompt(prompt, {
  disableCache: true,
});

// Add runtime tools
const withTools = await agent.prompt(prompt, {
  tools: [additionalTool],
});
```

## Reflection

The `reflect` method wraps a prompt with reflection context, useful for error recovery:

```typescript
async reflect<T>(prompt: Prompt<T>, overrideModel?: CCRModel): Promise<T>
```

```typescript
try {
  const result = await agent.prompt(originalPrompt);
} catch (error) {
  // Try again with reflection
  const reflected = await agent.reflect(originalPrompt, 'openai,gpt-4o');
}
```

The reflection prepends "REFLECTION REQUEST:" to the prompt, indicating the model should review and correct its response.

## Lifecycle Hooks

### Hook Points

```typescript
interface AgentHooks {
  beforePrompt?: (ctx: AgentRunContext) => void | Promise<void>;
  afterPrompt?: (ctx: AgentRunContext, result: unknown) => void | Promise<void>;
  beforeValidation?: (ctx: AgentRunContext, raw: unknown) => void | Promise<void>;
  afterValidation?: (ctx: AgentRunContext, validated: unknown) => void | Promise<void>;
  beforeCacheCheck?: (ctx: AgentRunContext) => void | Promise<void>;
  afterCacheWrite?: (ctx: AgentRunContext) => void | Promise<void>;
  onError?: (ctx: AgentRunContext, err: Error) => void | Promise<void>;
}
```

### AgentRunContext

Context passed to hooks:

```typescript
interface AgentRunContext {
  agentId: string;            // Agent instance ID
  runId: string;              // Unique run ID
  prompt: Prompt<unknown>;    // The prompt being executed
  model: CCRModel;            // Resolved model
  provider: string;           // Provider from model string
  workflowNodeId?: string;    // Parent workflow node
  timestamp: number;          // Run start time
  params: Record<string, unknown>;  // Runtime overrides
}
```

### Hook Execution Order

1. `beforePrompt`
2. `beforeCacheCheck` (if caching enabled)
3. Cache check
   - If hit: `afterValidation` -> return
4. LLM call
5. `beforeValidation`
6. Schema validation
7. `afterValidation`
8. `afterCacheWrite` (if caching enabled)
9. `afterPrompt`

On error: `onError`

### Example: Logging Hook

```typescript
const agent = new Agent({
  name: 'Logged',
  hooks: {
    beforePrompt: (ctx) => {
      console.log(`[${new Date(ctx.timestamp).toISOString()}] Run ${ctx.runId}`);
      console.log(`  Model: ${ctx.model}`);
      console.log(`  Prompt: ${ctx.prompt.userPrompt.slice(0, 50)}...`);
    },
    afterPrompt: (ctx, result) => {
      const duration = Date.now() - ctx.timestamp;
      console.log(`  Completed in ${duration}ms`);
    },
    onError: (ctx, err) => {
      console.error(`  ERROR: ${err.message}`);
    },
  },
});
```

### Example: Metrics Hook

```typescript
const metrics = { calls: 0, errors: 0, totalMs: 0 };

const agent = new Agent({
  hooks: {
    beforePrompt: () => {
      metrics.calls++;
    },
    afterPrompt: (ctx) => {
      metrics.totalMs += Date.now() - ctx.timestamp;
    },
    onError: () => {
      metrics.errors++;
    },
  },
});
```

## Model Resolution

Models are resolved in this order:

1. **Runtime override** (`agent.prompt(prompt, { model: '...' })`)
2. **Prompt override** (`prompt.modelOverride`)
3. **Agent default** (`config.defaultModel`)
4. **Category routing** via CCRRouter

```typescript
// Runtime override - highest priority
await agent.prompt(prompt, { model: 'openai,gpt-4o' });

// Prompt override
const prompt = new Prompt({
  userPrompt: '...',
  responseFormat: schema,
  modelOverride: 'anthropic,claude-3-opus',
});

// Agent default
const agent = new Agent({
  defaultModel: 'openai,gpt-4o',
});

// Category-based (falls through to router)
const agent = new Agent({
  category: 'coding',
  modelIndex: 1,  // Use second model in category
});
```

## Caching

### How Caching Works

Cache keys are SHA-256 hashes of:
- `userPrompt`
- `data`
- `model`
- `provider`
- `temperature`
- Tool names (not implementations)
- MCP names
- Schema version hash

### Cache Configuration

```typescript
// Enable (default)
const agent = new Agent({ enableCache: true });

// Disable globally
const agent = new Agent({ enableCache: false });

// Disable per-call
await agent.prompt(prompt, { disableCache: true });
```

### Cache Events

```typescript
eventBus.subscribeToTypes(['cache.hit', 'cache.miss'], (event) => {
  console.log(event.type, event.payload?.cacheKey);
});
```

## Events

Agents emit events when an eventBus is in the execution context:

| Event | When |
|-------|------|
| `agent.start` | Before prompt execution |
| `agent.end` | After successful completion |
| `agent.retry` | When retrying with fallback model |
| `cache.hit` | When returning cached response |
| `cache.miss` | When cache lookup fails |
| `error` | On execution failure |

### Event Payloads

```typescript
// agent.start, agent.end
{
  agentId: string;
  runId: string;
  model: string;
  category?: string;
}

// agent.end includes metrics
{
  metrics: {
    tokensIn: number;
    tokensOut: number;
  }
}

// cache.hit, cache.miss
{
  cacheKey: string;
  hit: boolean;
}
```

## Tools

### Tool Configuration

```typescript
interface ToolConfig {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;  // JSON Schema
  execute: (input: unknown) => Promise<unknown>;
}
```

### Defining Tools

```typescript
const readFileTool: ToolConfig = {
  name: 'readFile',
  description: 'Read contents of a file',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path' },
    },
    required: ['path'],
  },
  execute: async (input) => {
    const { path } = input as { path: string };
    const content = await fs.readFile(path, 'utf-8');
    return { content };
  },
};
```

### Agent with Tools

```typescript
const agent = new Agent({
  name: 'FileWorker',
  tools: [readFileTool, writeFileTool],
});
```

### Runtime Tool Addition

```typescript
await agent.prompt(prompt, {
  tools: [additionalTool],
});
```

Tool lists are merged: agent tools + runtime tools.

## Properties

```typescript
const agent = new Agent(config);

agent.id          // Unique identifier (UUID)
agent.name        // Agent name
agent.category    // Model category
agent.tools       // Readonly tool array
agent.mcps        // Readonly MCP array

agent.isCacheEnabled()      // Check cache status
agent.getDefaultModel()     // Get default model if set
agent.getDefaultProvider()  // Get default provider if set
agent.getModelIndex()       // Get category index (default 0)
agent.getConfig()           // Get full config copy
agent.getHooks()            // Get hooks

agent.getMergedTools(overrides)  // Get tools + override tools
agent.getMergedMcps(overrides)   // Get MCPs + override MCPs
```

## Error Handling

Errors during execution:
1. Trigger `onError` hook
2. Emit `error` event
3. Propagate to caller

```typescript
try {
  await agent.prompt(prompt);
} catch (error) {
  if (error instanceof PromptValidationError) {
    // Response didn't match schema
    console.error('Validation failed:', error.zodError);
  } else {
    // Network, rate limit, or other error
    console.error('Execution failed:', error.message);
  }
}
```

## Use Cases

### Code Generation Agent

```typescript
const codeAgent = new Agent({
  name: 'CodeGen',
  category: 'coding',
  tools: [
    { name: 'runTests', ... },
    { name: 'formatCode', ... },
  ],
  hooks: {
    afterPrompt: (ctx, result) => {
      // Log generated code
    },
  },
});
```

### Research Agent

```typescript
const researchAgent = new Agent({
  name: 'Researcher',
  category: 'research',
  modelIndex: 0,  // Use smartest model
  tools: [
    { name: 'webSearch', ... },
    { name: 'readUrl', ... },
  ],
});
```

### Validation Agent

```typescript
const validationAgent = new Agent({
  name: 'Validator',
  category: 'validation',
  enableCache: false,  // Always validate fresh
});
```

### Multi-Agent Workflow

```typescript
class ReviewWorkflow extends Workflow {
  private coder: Agent;
  private reviewer: Agent;

  constructor(router: CCRRouter, cache: LRUAgentCache, eventBus: RuntimeEventBus) {
    super('ReviewWorkflow');

    this.coder = new Agent({ name: 'Coder', category: 'coding' });
    this.reviewer = new Agent({ name: 'Reviewer', category: 'validation' });

    const ctx = { router, cache, eventBus, workflowNodeId: this.id };
    this.coder.setExecutionContext(ctx);
    this.reviewer.setExecutionContext(ctx);
  }

  @Step()
  async generateCode(): Promise<string> {
    const result = await this.coder.prompt(codePrompt);
    return result.code;
  }

  @Step()
  async reviewCode(code: string): Promise<boolean> {
    const result = await this.reviewer.prompt(
      reviewPrompt.with({ data: { code } })
    );
    return result.approved;
  }

  async run(): Promise<{ code: string; approved: boolean }> {
    this.setStatus('running');
    const code = await this.generateCode();
    const approved = await this.reviewCode(code);
    this.setStatus('completed');
    return { code, approved };
  }
}
```
