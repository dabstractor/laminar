# Laminar

Hierarchical workflow orchestration engine with LLM agents, structured prompts, and full observability.

## Install

```bash
npm install laminar
```

## Quick Start

### Basic Agent with Prompt

```typescript
import { z } from 'zod';
import { Agent, Prompt, CCRRouter, LRUAgentCache } from 'laminar';

// 1. Configure models by category
const models = {
  coding: ['openai,gpt-4o', 'openai,gpt-4o-mini'],
};

// 2. Create router and cache
const router = new CCRRouter(yourCCRImplementation, models);
const cache = new LRUAgentCache(1000);

// 3. Create agent
const agent = new Agent({
  name: 'Coder',
  category: 'coding',
});
agent.setExecutionContext({ router, cache });

// 4. Create prompt with schema validation
const prompt = new Prompt({
  userPrompt: 'Write a function that sorts an array',
  responseFormat: z.object({
    code: z.string(),
    language: z.string(),
  }),
});

// 5. Execute
const result = await agent.prompt(prompt);
console.log(result.code);
```

### Workflow with Agent

```typescript
import { Workflow, Step, ObservedState, Agent, Prompt } from 'laminar';
import { z } from 'zod';

class CodeWorkflow extends Workflow {
  @ObservedState()
  generatedCode: string = '';

  private agent: Agent;

  constructor(router: CCRRouter, cache: LRUAgentCache) {
    super('CodeWorkflow');
    this.agent = new Agent({ name: 'Coder', category: 'coding' });
    this.agent.setExecutionContext({ router, cache });
  }

  @Step({ snapshotState: true })
  async generateCode(): Promise<string> {
    const result = await this.agent.prompt(
      new Prompt({
        userPrompt: 'Write a sorting function',
        responseFormat: z.object({ code: z.string() }),
      })
    );
    this.generatedCode = result.code;
    return result.code;
  }

  async run(): Promise<string> {
    this.setStatus('running');
    const code = await this.generateCode();
    this.setStatus('completed');
    return code;
  }
}
```

## Core Concepts

### Model Configuration

Models use CCR format: `"provider,model-version"`

```typescript
const models: CategoryModelConfig = {
  coding: ['openai,gpt-4o', 'openai,gpt-4o-mini'],     // index 0 = smartest
  research: ['anthropic,claude-3-opus'],
  validation: ['openai,gpt-4o-mini'],                  // fast/cheap for validation
};
```

Resolution precedence:
1. Prompt override
2. Agent default
3. Category index 0
4. Fallback to next index on failure

### Agents

Agents execute prompts against LLM providers. See [AGENTS.md](./AGENTS.md).

```typescript
const agent = new Agent({
  name: 'Analyst',
  category: 'research',
  tools: [searchTool, readFileTool],
  enableCache: true,
  hooks: {
    beforePrompt: (ctx) => console.log('Starting:', ctx.runId),
    onError: (ctx, err) => console.error('Failed:', err),
  },
});
```

### Prompts

Immutable request objects with Zod validation. See [PROMPT.md](./PROMPT.md).

```typescript
const prompt = new Prompt({
  userPrompt: 'Analyze {topic} and provide insights',
  data: { topic: 'market trends' },
  responseFormat: z.object({
    summary: z.string(),
    insights: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }),
});

// Render with data substitution
console.log(prompt.render()); // "Analyze market trends and provide insights"
```

### Caching

Parameter-level caching with deterministic keys:

```typescript
const cache = new LRUAgentCache(1000);

// Cache key = hash of:
// - userPrompt + data
// - model + provider
// - temperature
// - tool names
// - schema version

// Disable for specific call
await agent.prompt(prompt, { disableCache: true });
```

### Events

Subscribe to runtime events for observability:

```typescript
import { RuntimeEventBus } from 'laminar';

const eventBus = new RuntimeEventBus();

eventBus.subscribeToTypes(['agent.start', 'agent.end'], (event) => {
  console.log(event.type, event.metrics?.durationMs);
});

eventBus.subscribeToTypes(['cache.hit', 'cache.miss'], (event) => {
  console.log(event.type, event.payload?.cacheKey);
});

agent.setExecutionContext({ router, cache, eventBus });
```

Event types:
- `workflow.start`, `workflow.end`
- `step.start`, `step.end`
- `agent.start`, `agent.end`, `agent.retry`
- `tool.start`, `tool.end`
- `cache.hit`, `cache.miss`
- `error`

### Tools

Define tools for agents:

```typescript
import { ToolExecutor } from 'laminar';
import type { ToolConfig } from 'laminar';

const searchTool: ToolConfig = {
  name: 'search',
  description: 'Search the web',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
    },
    required: ['query'],
  },
  execute: async (input) => {
    const { query } = input as { query: string };
    return { results: [`Result for: ${query}`] };
  },
};

const agent = new Agent({
  name: 'Researcher',
  tools: [searchTool],
});
```

### Workflows

Hierarchical orchestration with decorators:

```typescript
import { Workflow, Step, Task, ObservedState } from 'laminar';

class Pipeline extends Workflow {
  @ObservedState()
  status: string = 'pending';

  @Step({ snapshotState: true })
  async analyze(): Promise<void> {
    this.status = 'analyzing';
    // ... agent calls
  }

  @Step({ snapshotState: true })
  async generate(): Promise<void> {
    this.status = 'generating';
    // ... agent calls
  }

  async run(): Promise<void> {
    this.setStatus('running');
    await this.analyze();
    await this.generate();
    this.status = 'complete';
    this.setStatus('completed');
  }
}
```

## Examples

Run examples with:

```bash
npx tsx examples/01-basic-agent-prompt.ts
```

| Example | Description |
|---------|-------------|
| `01-basic-agent-prompt.ts` | Agent creation, prompts with Zod, data templating |
| `02-model-routing.ts` | CCR parsing, category config, fallback behavior |
| `03-caching.ts` | Cache keys, LRU eviction, schema hashing |
| `04-event-streaming.ts` | RuntimeEventBus, filtering, metrics collection |
| `05-tool-integration.ts` | Tool definitions, ToolExecutor, error handling |
| `06-workflow-agent-integration.ts` | Workflows with agents, @Step decorator |
| `07-end-to-end-demo.ts` | Complete TDD workflow with all features |

## API Reference

### Agent

```typescript
class Agent {
  constructor(config?: AgentConfig);

  // Execute a prompt
  prompt<T>(prompt: Prompt<T>, overrides?: AgentRuntimeOverrides): Promise<T>;

  // Execute with reflection context
  reflect<T>(prompt: Prompt<T>, overrideModel?: CCRModel): Promise<T>;

  // Set execution context (router, cache, eventBus)
  setExecutionContext(context: AgentExecutionContext): void;
}
```

### Prompt

```typescript
class Prompt<T> {
  constructor(config: PromptConfig<T>);

  // Render prompt with data substitution
  render(): string;

  // Validate raw response against schema
  validate(raw: unknown): T;

  // Create new prompt with updates (immutable)
  with(updates: Partial<PromptConfig<T>>): Prompt<T>;
}
```

### CCRRouter

```typescript
class CCRRouter {
  constructor(ccr: CCR, config: CategoryModelConfig);

  // Execute with automatic fallback
  run(
    request: Omit<CCRRequest, 'model'>,
    category: string,
    onAttempt?: (event: RoutingAttemptEvent) => void
  ): Promise<CCRResponse>;
}
```

### RuntimeEventBus

```typescript
class RuntimeEventBus {
  // Subscribe to all events
  subscribe(handler: EventHandler): Subscription;

  // Subscribe to specific types
  subscribeToTypes(types: EventType | EventType[], handler: EventHandler): Subscription;

  // Subscribe with filter
  subscribeFiltered(filter: EventFilter, handler: EventHandler): Subscription;

  // Emit event
  emit(event: Omit<RuntimeEvent, 'id' | 'timestamp'>): void;
}
```

## Documentation

- [AGENTS.md](./AGENTS.md) - Agent system details
- [PROMPT.md](./PROMPT.md) - Prompt system details
- [examples/README.md](./examples/README.md) - Example documentation

## Requirements

- Node.js 18+
- TypeScript 5.2+

## License

MIT
