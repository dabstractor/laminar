/**
 * Tool Calling Agent Example
 *
 * Demonstrates agent tool integration with:
 * - Tool registration and execution
 * - Agentic loops with tool results
 * - Tool call event tracking
 *
 * Run with: ANTHROPIC_API_KEY=your-key npx tsx examples/tool-calling-agent.ts
 */

import {
  AgentWorkflow,
  WorkflowTreeDebugger,
  formatTokenUsage,
  type WorkflowEvent,
} from '../src/index.js';

// Simulated tool implementations
const tools = {
  get_weather: async (input: { location: string }) => {
    // Simulate weather API
    const conditions = ['sunny', 'cloudy', 'rainy', 'partly cloudy'];
    const temp = Math.floor(Math.random() * 30) + 50; // 50-80°F
    return {
      location: input.location,
      temperature: temp,
      conditions: conditions[Math.floor(Math.random() * conditions.length)],
      humidity: Math.floor(Math.random() * 50) + 30,
    };
  },

  search_database: async (input: { query: string; limit?: number }) => {
    // Simulate database search
    return {
      query: input.query,
      results: [
        { id: 1, title: `Result for "${input.query}" - Item 1`, relevance: 0.95 },
        { id: 2, title: `Result for "${input.query}" - Item 2`, relevance: 0.82 },
        { id: 3, title: `Result for "${input.query}" - Item 3`, relevance: 0.71 },
      ].slice(0, input.limit || 3),
      totalFound: 42,
    };
  },

  calculate: async (input: { expression: string }) => {
    // Simulate calculator
    try {
      // Simple safe eval for basic math
      const sanitized = input.expression.replace(/[^0-9+\-*/().]/g, '');
      const result = Function(`"use strict"; return (${sanitized})`)();
      return { expression: input.expression, result };
    } catch {
      return { expression: input.expression, error: 'Invalid expression' };
    }
  },

  get_time: async (input: { timezone?: string }) => {
    const now = new Date();
    return {
      timezone: input.timezone || 'UTC',
      time: now.toISOString(),
      formatted: now.toLocaleString('en-US', {
        timeZone: input.timezone || 'UTC',
      }),
    };
  },
};

async function main() {
  // Create workflow with tools
  const workflow = new AgentWorkflow({
    name: 'ToolCallingAgent',
    defaultModel: 'claude-sonnet-4-5-20250929',
    steps: [
      {
        name: 'task-execution',
        agents: [
          {
            name: 'assistant',
            prompts: [
              {
                name: 'execute-task',
                system: `You are a helpful assistant with access to tools.

Available tools:
- get_weather: Get weather for a location. Input: { location: string }
- search_database: Search the database. Input: { query: string, limit?: number }
- calculate: Perform calculations. Input: { expression: string }
- get_time: Get current time. Input: { timezone?: string }

Use tools when appropriate to answer questions accurately.`,
                user: '{{task}}',
              },
            ],
          },
        ],
      },
    ],
  });

  // Register all tools
  Object.entries(tools).forEach(([name, handler]) => {
    workflow.registerTool(name, handler as (input: unknown) => Promise<unknown>);
  });

  // Attach debugger
  const debugger_ = new WorkflowTreeDebugger(workflow);

  // Track tool calls
  const toolCallsLog: string[] = [];
  workflow.addObserver({
    onLog: () => {},
    onEvent: (event: WorkflowEvent) => {
      if (event.type === 'toolCallStart') {
        toolCallsLog.push(`  → Calling ${event.toolName} with ${JSON.stringify(event.input)}`);
        console.log(toolCallsLog[toolCallsLog.length - 1]);
      } else if (event.type === 'toolCallEnd') {
        if (event.error) {
          toolCallsLog.push(`  ← ${event.toolName} error: ${event.error}`);
        } else {
          toolCallsLog.push(`  ← ${event.toolName} returned in ${event.duration}ms`);
        }
        console.log(toolCallsLog[toolCallsLog.length - 1]);
      }
    },
    onStateUpdated: () => {},
    onTreeChanged: () => {},
  });

  console.log('Tool Calling Agent Demo');
  console.log('='.repeat(50));

  // Example 1: Weather query
  console.log('\n1. Weather Query:');
  console.log('   Task: "What is the weather in Tokyo?"');
  const result1 = await workflow.run({ task: 'What is the weather in Tokyo?' });
  console.log(`   Response: ${result1.stepResults[0]?.agentResults[0]?.promptResults[0]?.content.substring(0, 200)}...`);

  // Example 2: Database search
  console.log('\n2. Database Search:');
  console.log('   Task: "Search for documents about machine learning"');
  const result2 = await workflow.run({ task: 'Search for documents about machine learning' });
  console.log(`   Response: ${result2.stepResults[0]?.agentResults[0]?.promptResults[0]?.content.substring(0, 200)}...`);

  // Example 3: Calculation
  console.log('\n3. Calculation:');
  console.log('   Task: "Calculate 15 * 7 + 23"');
  const result3 = await workflow.run({ task: 'Calculate 15 * 7 + 23' });
  console.log(`   Response: ${result3.stepResults[0]?.agentResults[0]?.promptResults[0]?.content.substring(0, 200)}...`);

  // Display final tree and metrics
  console.log('\n' + '='.repeat(50));
  console.log('Final Tree:');
  console.log(debugger_.toTreeString());

  console.log('\nTool Call Summary:');
  console.log(`  Total tool calls logged: ${toolCallsLog.length / 2}`); // Divide by 2 for start/end pairs
}

// Multi-tool example with complex task
async function complexTaskExample() {
  const workflow = new AgentWorkflow({
    name: 'MultiToolAgent',
    defaultModel: 'claude-sonnet-4-5-20250929',
    steps: [
      {
        name: 'complex-task',
        agents: [
          {
            name: 'assistant',
            prompts: [
              {
                name: 'multi-tool-task',
                system: `You are a helpful assistant with access to multiple tools.
Use them as needed to complete the task thoroughly.

Available tools:
- get_weather: Get weather for a location
- get_time: Get current time
- calculate: Perform calculations`,
                user: '{{task}}',
              },
            ],
          },
        ],
      },
    ],
  });

  // Register tools
  workflow.registerTool('get_weather', tools.get_weather as (input: unknown) => Promise<unknown>);
  workflow.registerTool('get_time', tools.get_time as (input: unknown) => Promise<unknown>);
  workflow.registerTool('calculate', tools.calculate as (input: unknown) => Promise<unknown>);

  console.log('\n\nComplex Multi-Tool Task:');
  console.log('='.repeat(50));
  console.log('Task: "What time is it in London, and what is the weather there?"');

  const result = await workflow.run({
    task: 'What time is it in London, and what is the weather there?',
  });

  console.log('\nResponse:');
  console.log(result.stepResults[0]?.agentResults[0]?.promptResults[0]?.content);
  console.log(`\nTokens used: ${formatTokenUsage(result.tokenUsage)}`);
}

// Run examples
main()
  .then(() => complexTaskExample())
  .catch(console.error);
