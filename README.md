# Laminar

Hierarchical workflow orchestration engine with full observability, built for AI agent orchestration with the Anthropic SDK.

## Features

- **Hierarchical Workflows** - Parent/child workflow composition with automatic event propagation
- **Agent Orchestration** - Execute sequences of prompts with tools, retries, and reflection
- **Prompt Management** - Immutable prompt instances with variable interpolation and streaming
- **Tool Calling** - Full agentic loop support with tool execution and result handling
- **Caching** - Prompt result caching with TTL support
- **Full Observability** - Real-time tree debugging, event streaming, and token usage tracking
- **Type Safety** - Complete TypeScript types with strict mode

## Install

```bash
npm install laminar @anthropic-ai/sdk
```

## Quick Start

### Basic Prompt Execution

```typescript
import { PromptInstance, AnthropicClient } from 'laminar';

const client = new AnthropicClient();

const prompt = new PromptInstance(
  {
    name: 'greeting',
    system: 'You are a friendly assistant.',
    user: 'Say hello to {{name}}!',
  },
  'claude-sonnet-4-5-20250929',
  { name: 'World' }
);

const result = await prompt.run(client);
console.log(result.content);
console.log(`Tokens: ${result.tokenUsage.inputTokens} in, ${result.tokenUsage.outputTokens} out`);
```

### Agent with Multiple Prompts

```typescript
import { Agent, AnthropicClient } from 'laminar';

const client = new AnthropicClient();

const agent = new Agent({
  name: 'ResearchAgent',
  model: 'claude-sonnet-4-5-20250929',
  prompts: [
    {
      name: 'research',
      system: 'You are a research assistant.',
      user: 'Research the topic: {{topic}}',
    },
    {
      name: 'summarize',
      system: 'You are a summarization expert.',
      user: 'Summarize the following research:\n\n{{research}}',
    },
  ],
});

const result = await agent.run(client, { topic: 'quantum computing' });
console.log(`Completed ${result.promptResults.length} prompts`);
console.log(`Total tokens: ${result.tokenUsage.inputTokens + result.tokenUsage.outputTokens}`);
```

### AgentWorkflow Orchestration

```typescript
import { AgentWorkflow, WorkflowTreeDebugger } from 'laminar';

const workflow = new AgentWorkflow({
  name: 'ContentPipeline',
  defaultModel: 'claude-sonnet-4-5-20250929',
  steps: [
    {
      name: 'research',
      agents: [
        {
          name: 'researcher',
          prompts: [{ name: 'research', user: 'Research: {{topic}}' }],
        },
      ],
    },
    {
      name: 'writing',
      agents: [
        {
          name: 'writer',
          prompts: [{ name: 'write', user: 'Write an article about: {{topic}}' }],
        },
      ],
    },
  ],
});

// Attach debugger for visualization
const debugger_ = new WorkflowTreeDebugger(workflow);

const result = await workflow.run({ topic: 'AI safety' });
console.log(debugger_.toTreeString());
```

## Core Concepts

### Workflows

Workflows are the foundation for organizing complex tasks. They support:

- Hierarchical parent/child composition
- Decorator-based step definition (`@Step`, `@Task`)
- Observable state with `@ObservedState`
- Event propagation to observers

```typescript
import { Workflow, Step, ObservedState } from 'laminar';

class MyWorkflow extends Workflow {
  @ObservedState()
  progress = 0;

  @Step({ trackTiming: true, logStart: true })
  async processData(): Promise<void> {
    this.progress = 50;
    // ... processing logic
    this.progress = 100;
  }

  async run(): Promise<void> {
    this.setStatus('running');
    await this.processData();
    this.setStatus('completed');
  }
}
```

### Agents

Agents orchestrate multiple prompts with support for:

- Sequential prompt execution
- Automatic retry with configurable attempts
- Reflection on failures (self-correction)
- Tool calling with agentic loops
- Lifecycle hooks (beforeRun, afterRun, beforePrompt, afterPrompt, onError, onReflection)

```typescript
import { Agent, AnthropicClient } from 'laminar';

const agent = new Agent({
  name: 'SmartAgent',
  model: 'claude-sonnet-4-5-20250929',
  maxRetries: 2,
  enableReflection: true,
  prompts: [
    { name: 'analyze', user: 'Analyze: {{input}}' },
    { name: 'respond', user: 'Based on analysis, respond to: {{input}}' },
  ],
  hooks: {
    beforeRun: (input) => {
      console.log('Starting agent with:', input);
      return input;
    },
    onError: (error) => {
      console.error('Agent error:', error);
    },
    onReflection: (failed, reflection) => {
      console.log('Reflection triggered:', reflection.content);
    },
  },
});
```

### Prompts

PromptInstance provides immutable prompt execution with:

- Variable interpolation using `{{variable}}` syntax
- Nested path support: `{{user.name}}`, `{{data.items.0}}`
- Streaming support for real-time token delivery
- Tool calling with automatic agentic loop
- Lifecycle hooks (beforeCall, afterCall, onTool, onMCP)

```typescript
import { PromptInstance, AnthropicClient } from 'laminar';

const prompt = new PromptInstance(
  {
    name: 'structured-output',
    system: 'You are a data extraction assistant. Output valid JSON.',
    user: 'Extract entities from: {{text}}',
    hooks: {
      afterCall: (result) => {
        // Parse JSON from response
        try {
          const parsed = JSON.parse(result.content);
          return { ...result, content: JSON.stringify(parsed, null, 2) };
        } catch {
          return result;
        }
      },
    },
  },
  'claude-sonnet-4-5-20250929',
  { text: 'John works at Acme Corp in New York.' }
);
```

### Tool Calling

Register tools with AgentWorkflow for full agentic capabilities:

```typescript
import { AgentWorkflow } from 'laminar';

const workflow = new AgentWorkflow({
  name: 'ToolAgent',
  defaultModel: 'claude-sonnet-4-5-20250929',
  steps: [
    {
      name: 'task',
      agents: [
        {
          name: 'assistant',
          prompts: [
            {
              name: 'work',
              user: 'Use the available tools to: {{task}}',
            },
          ],
        },
      ],
    },
  ],
});

// Register tools
workflow.registerTool('get_weather', async (input: any) => {
  return { temperature: 72, conditions: 'sunny', location: input.location };
});

workflow.registerTool('search_web', async (input: any) => {
  return { results: [`Result for: ${input.query}`] };
});

const result = await workflow.run({ task: 'What is the weather in Tokyo?' });
```

### Streaming

Stream tokens in real-time for responsive UIs:

```typescript
import { PromptInstance, AnthropicClient } from 'laminar';

const client = new AnthropicClient();
const prompt = new PromptInstance(
  { name: 'story', user: 'Write a short story about {{topic}}' },
  'claude-sonnet-4-5-20250929',
  { topic: 'a brave robot' }
);

for await (const event of prompt.runStreaming(client)) {
  if (event.type === 'token') {
    process.stdout.write(event.token);
  } else if (event.type === 'result') {
    console.log('\n\nTotal tokens:', event.result.tokenUsage);
  }
}
```

### Caching

Cache prompt results to avoid redundant API calls:

```typescript
import { MemoryCache, generateCacheKey, PromptInstance, AnthropicClient } from 'laminar';

const cache = new MemoryCache();
const client = new AnthropicClient();

const config = { name: 'cached', user: 'Explain: {{topic}}' };
const input = { topic: 'caching' };
const model = 'claude-sonnet-4-5-20250929';

const cacheKey = generateCacheKey(config, model, input);

// Check cache first
let result = await cache.get(cacheKey);
if (!result) {
  const prompt = new PromptInstance(config, model, input);
  result = await prompt.run(client);
  await cache.set(cacheKey, result, 60000); // Cache for 1 minute
}

console.log(result.content);
```

### Observability

Full visibility into workflow execution:

```typescript
import { AgentWorkflow, WorkflowTreeDebugger, formatTokenUsage } from 'laminar';

const workflow = new AgentWorkflow({
  name: 'ObservableWorkflow',
  defaultModel: 'claude-sonnet-4-5-20250929',
  steps: [/* ... */],
});

// Attach tree debugger
const debugger_ = new WorkflowTreeDebugger(workflow);

// Listen to events
workflow.addObserver({
  onLog: (entry) => console.log(`[${entry.level}] ${entry.message}`),
  onEvent: (event) => {
    if (event.type === 'agentRunEnd') {
      console.log(`Agent ${event.agentName} completed: ${formatTokenUsage(event.tokenUsage)}`);
    }
  },
  onStateUpdated: (node) => console.log(`State updated: ${node.name}`),
  onTreeChanged: (root) => console.log(debugger_.toTreeString()),
});

await workflow.run({});

// Print final tree
console.log(debugger_.toTreeString());
// Output:
// ✓ [W] ObservableWorkflow [completed] (150↓ 300↑)
// └── ✓ [S] step1 [completed]
//     └── ✓ [A] agent1 [completed] (150↓ 300↑)
```

### Token Usage Tracking

Track and aggregate token usage across the hierarchy:

```typescript
import { aggregateTokenUsage, formatTokenUsage, estimateCost } from 'laminar';

const result = await workflow.run({});

// Access aggregated usage
console.log(formatTokenUsage(result.tokenUsage));
// Output: "in: 500, out: 1200"

// Estimate cost
const cost = estimateCost(result.tokenUsage);
console.log(`Estimated cost: $${cost.toFixed(4)}`);

// Aggregate from multiple sources
const totalUsage = aggregateTokenUsage([
  result.tokenUsage,
  anotherResult.tokenUsage,
]);
```

## API Reference

### Core Classes

| Class | Description |
|-------|-------------|
| `Workflow` | Abstract base class for hierarchical workflows |
| `AgentWorkflow` | Workflow that orchestrates agents and steps |
| `Agent` | Executes prompts with tools, retries, and reflection |
| `PromptInstance` | Immutable prompt execution with interpolation |
| `AnthropicClient` | Wrapper for Anthropic SDK |
| `WorkflowTreeDebugger` | Real-time tree visualization |
| `MemoryCache` | In-memory cache with TTL |

### Decorators

| Decorator | Description |
|-----------|-------------|
| `@Step(options)` | Mark a method as a workflow step |
| `@Task()` | Mark a method as a task that creates child workflows |
| `@ObservedState(options)` | Mark a property as observable state |

### Types

| Type | Description |
|------|-------------|
| `AgentConfig` | Configuration for an agent |
| `PromptConfig` | Configuration for a prompt |
| `AgentWorkflowConfig` | Configuration for an agent workflow |
| `TokenUsage` | Token usage tracking |
| `PromptResult` | Result from prompt execution |
| `AgentRunResult` | Result from agent execution |
| `WorkflowRunResult` | Result from workflow execution |

### Utilities

| Function | Description |
|----------|-------------|
| `aggregateTokenUsage(usages)` | Combine multiple token usages |
| `formatTokenUsage(usage)` | Format as human-readable string |
| `estimateCost(usage, inputRate?, outputRate?)` | Estimate API cost |
| `generateCacheKey(prompt, model, input)` | Generate stable cache key |
| `generateId()` | Generate unique identifier |

## Examples

See the [examples/](./examples/) directory for complete working examples:

- **Basic Examples**
  - `basic-prompt.ts` - Simple prompt execution
  - `basic-agent.ts` - Agent with multiple prompts
  - `basic-workflow.ts` - AgentWorkflow with steps
  - `cache-usage.ts` - Prompt result caching

- **Advanced Examples**
  - `tool-calling-agent.ts` - Agent with tool integration
  - `streaming-example.ts` - Real-time token streaming
  - `reflection-retry.ts` - Self-correcting agents
  - `multi-step-orchestration.ts` - Complex multi-step workflows
  - `observability-demo.ts` - Full observability features

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

## Requirements

- Node.js 18+
- TypeScript 5.2+

## License

MIT
