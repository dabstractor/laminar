/**
 * Combined Features Example
 *
 * Demonstrates all major Laminar features working together:
 * - AgentWorkflow with multiple steps
 * - Agents with prompts, retries, and reflection
 * - Tool calling with agentic loops
 * - Caching for repeated prompts
 * - Streaming for real-time output
 * - Full observability with tree debugging
 * - Token usage tracking and cost estimation
 * - Lifecycle hooks throughout
 *
 * Run with: ANTHROPIC_API_KEY=your-key npx tsx examples/combined-features.ts
 */

import {
  AgentWorkflow,
  Agent,
  PromptInstance,
  AnthropicClient,
  WorkflowTreeDebugger,
  MemoryCache,
  generateCacheKey,
  formatTokenUsage,
  estimateCost,
  aggregateTokenUsage,
  type WorkflowEvent,
  type WorkflowObserver,
  type LogEntry,
  type WorkflowNode,
  type TokenUsage,
  type PromptResult,
} from '../src/index.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MODEL = 'claude-sonnet-4-5-20250929';

// ============================================================================
// CUSTOM OBSERVER
// ============================================================================

class ComprehensiveObserver implements WorkflowObserver {
  private events: WorkflowEvent[] = [];
  private logs: LogEntry[] = [];
  private tokenUsage: TokenUsage[] = [];
  private startTime = Date.now();

  onLog(entry: LogEntry): void {
    this.logs.push(entry);
    const elapsed = Date.now() - this.startTime;
    if (entry.level !== 'debug') {
      console.log(`  [${elapsed}ms] [${entry.level.toUpperCase()}] ${entry.message}`);
    }
  }

  onEvent(event: WorkflowEvent): void {
    this.events.push(event);
    const elapsed = Date.now() - this.startTime;

    switch (event.type) {
      case 'stepStart':
        console.log(`\n  [${elapsed}ms] Step "${event.step}" starting...`);
        break;
      case 'stepEnd':
        console.log(`  [${elapsed}ms] Step "${event.step}" completed (${event.duration}ms)`);
        break;
      case 'agentRunStart':
        console.log(`    [${elapsed}ms] Agent "${event.agentName}" starting...`);
        break;
      case 'agentRunEnd':
        this.tokenUsage.push(event.tokenUsage);
        console.log(`    [${elapsed}ms] Agent "${event.agentName}" completed - ${formatTokenUsage(event.tokenUsage)}`);
        break;
      case 'toolCallStart':
        console.log(`      [${elapsed}ms] Tool "${event.toolName}" called`);
        break;
      case 'toolCallEnd':
        const status = event.error ? 'FAILED' : 'SUCCESS';
        console.log(`      [${elapsed}ms] Tool "${event.toolName}" ${status} (${event.duration}ms)`);
        break;
      case 'reflectionStart':
        console.log(`    [${elapsed}ms] Reflection triggered...`);
        break;
      case 'reflectionEnd':
        console.log(`    [${elapsed}ms] Reflection completed`);
        break;
    }
  }

  onStateUpdated(_node: WorkflowNode): void {}
  onTreeChanged(_root: WorkflowNode): void {}

  getTotalTokenUsage(): TokenUsage {
    return aggregateTokenUsage(this.tokenUsage);
  }

  getEventCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.events.forEach((e) => {
      counts[e.type] = (counts[e.type] || 0) + 1;
    });
    return counts;
  }
}

// ============================================================================
// TOOLS
// ============================================================================

const tools = {
  search_knowledge: async (input: { topic: string }) => {
    console.log(`        [Tool] Searching knowledge base for: ${input.topic}`);
    // Simulate knowledge base search
    return {
      topic: input.topic,
      facts: [
        `${input.topic} is a rapidly evolving field`,
        `Key considerations include scalability and reliability`,
        `Best practices recommend iterative approaches`,
      ],
      confidence: 0.85,
    };
  },

  validate_content: async (input: { content: string }) => {
    console.log(`        [Tool] Validating content quality...`);
    // Simulate content validation
    const wordCount = input.content.split(/\s+/).length;
    return {
      wordCount,
      readabilityScore: Math.random() * 30 + 70, // 70-100
      suggestions: wordCount < 50 ? ['Content could be more detailed'] : [],
      isValid: wordCount >= 20,
    };
  },

  format_output: async (input: { text: string; format: string }) => {
    console.log(`        [Tool] Formatting output as ${input.format}...`);
    // Simulate formatting
    if (input.format === 'markdown') {
      return { formatted: `## Summary\n\n${input.text}`, format: 'markdown' };
    }
    return { formatted: input.text, format: 'plain' };
  },
};

// ============================================================================
// CACHE
// ============================================================================

const cache = new MemoryCache();

async function getCachedOrExecute(
  client: AnthropicClient,
  config: { name: string; system?: string; user: string },
  input: unknown
): Promise<PromptResult> {
  const cacheKey = generateCacheKey(config, MODEL, input);
  const cached = await cache.get<PromptResult>(cacheKey);

  if (cached) {
    console.log(`        [Cache] HIT for "${config.name}"`);
    return { ...cached, cacheHit: true };
  }

  console.log(`        [Cache] MISS for "${config.name}" - executing...`);
  const prompt = new PromptInstance(config, MODEL, input);
  const result = await prompt.run(client);
  await cache.set(cacheKey, result, 300000); // 5 min TTL
  return result;
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           LAMINAR COMBINED FEATURES DEMO                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\nThis demo showcases all major Laminar features:\n');
  console.log('  • AgentWorkflow with multiple steps');
  console.log('  • Agents with prompts, retries, and reflection');
  console.log('  • Tool calling with agentic loops');
  console.log('  • Caching for repeated prompts');
  console.log('  • Full observability with tree debugging');
  console.log('  • Token usage tracking and cost estimation');
  console.log('  • Lifecycle hooks throughout');
  console.log('\n' + '='.repeat(60));

  const client = new AnthropicClient();
  const observer = new ComprehensiveObserver();

  // Create comprehensive workflow
  const workflow = new AgentWorkflow({
    name: 'ComprehensiveDemo',
    defaultModel: MODEL,
    steps: [
      // Step 1: Research with tool calling
      {
        name: 'research',
        agents: [
          {
            name: 'research-agent',
            maxRetries: 1,
            prompts: [
              {
                name: 'gather-info',
                system: `You are a research assistant with access to a knowledge base.
Use the search_knowledge tool to gather information about the topic.
Be concise in your final response.`,
                user: 'Research "{{topic}}" and provide key insights.',
              },
            ],
            hooks: {
              beforeRun: (input) => {
                console.log('    [Hook] Research agent beforeRun');
                return input;
              },
              afterRun: (result) => {
                console.log('    [Hook] Research agent afterRun');
                return result;
              },
            },
          },
        ],
      },
      // Step 2: Content creation with reflection
      {
        name: 'creation',
        agents: [
          {
            name: 'writer-agent',
            maxRetries: 2,
            enableReflection: true,
            prompts: [
              {
                name: 'write-content',
                system: 'You are a content writer. Write clear, engaging content.',
                user: 'Write a brief summary about {{topic}} (3-4 sentences).',
                hooks: {
                  afterCall: async (result: PromptResult): Promise<PromptResult> => {
                    // Validate word count
                    const words = result.content.split(/\s+/).length;
                    if (words < 15) {
                      console.log(`        [Validation] Too short (${words} words)`);
                      return { ...result, error: new Error('Content too short') };
                    }
                    console.log(`        [Validation] Passed (${words} words)`);
                    return result;
                  },
                },
              },
            ],
            hooks: {
              onError: (error) => {
                console.log(`    [Hook] Writer agent error: ${error}`);
              },
              onReflection: (failed, reflection) => {
                console.log(`    [Hook] Reflection triggered`);
                console.log(`      Original error: ${failed.error}`);
              },
            },
          },
        ],
      },
      // Step 3: Review with validation tool
      {
        name: 'review',
        agents: [
          {
            name: 'editor-agent',
            prompts: [
              {
                name: 'review-content',
                system: `You are an editor. Review content for quality.
Use the validate_content tool to check the content.
Provide a brief assessment.`,
                user: 'Review the following content about {{topic}} and provide feedback.',
              },
            ],
          },
        ],
      },
    ],
  });

  // Register tools
  Object.entries(tools).forEach(([name, handler]) => {
    workflow.registerTool(name, handler as (input: unknown) => Promise<unknown>);
  });

  // Attach observer and debugger
  workflow.addObserver(observer);
  const debugger_ = new WorkflowTreeDebugger(workflow);

  // Run workflow
  console.log('\nStarting workflow execution...');
  console.log('-'.repeat(60));

  const startTime = Date.now();
  const result = await workflow.run({ topic: 'machine learning in healthcare' });
  const totalTime = Date.now() - startTime;

  // Display results
  console.log('\n' + '='.repeat(60));
  console.log('WORKFLOW RESULTS');
  console.log('='.repeat(60));

  result.stepResults.forEach((step, i) => {
    console.log(`\n[Step ${i + 1}: ${step.stepName}]`);
    step.agentResults.forEach((agent) => {
      agent.promptResults.forEach((prompt) => {
        const preview = prompt.content.substring(0, 150);
        console.log(`  ${preview}${prompt.content.length > 150 ? '...' : ''}`);
      });
    });
  });

  // Display tree
  console.log('\n' + '='.repeat(60));
  console.log('EXECUTION TREE');
  console.log('='.repeat(60));
  console.log(debugger_.toTreeString());

  // Display metrics
  console.log('METRICS');
  console.log('='.repeat(60));
  console.log(`  Status: ${workflow.status}`);
  console.log(`  Total duration: ${totalTime}ms`);
  console.log(`  Steps completed: ${result.stepResults.length}`);
  console.log(`  Token usage: ${formatTokenUsage(result.tokenUsage)}`);
  console.log(`  Estimated cost: $${estimateCost(result.tokenUsage).toFixed(6)}`);

  const eventCounts = observer.getEventCounts();
  console.log('\n  Event counts:');
  Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([type, count]) => {
      console.log(`    ${type}: ${count}`);
    });

  // Cache statistics
  console.log(`\n  Cache size: ${cache.size} entries`);

  // Tree statistics
  const treeStats = debugger_.getStats();
  console.log(`\n  Tree stats:`);
  console.log(`    Total nodes: ${treeStats.totalNodes}`);
  console.log(`    Total events: ${treeStats.totalEvents}`);

  if (result.error) {
    console.log(`\n  Error: ${result.error}`);
  }

  // Demonstrate caching by running similar prompt
  console.log('\n' + '='.repeat(60));
  console.log('CACHE DEMONSTRATION');
  console.log('='.repeat(60));

  const cachedConfig = {
    name: 'cached-demo',
    system: 'You are helpful.',
    user: 'Say hello to {{name}}.',
  };

  console.log('\nFirst call (cache miss):');
  await getCachedOrExecute(client, cachedConfig, { name: 'Alice' });

  console.log('\nSecond call (cache hit):');
  await getCachedOrExecute(client, cachedConfig, { name: 'Alice' });

  console.log('\nThird call different input (cache miss):');
  await getCachedOrExecute(client, cachedConfig, { name: 'Bob' });

  // Demonstrate streaming
  console.log('\n' + '='.repeat(60));
  console.log('STREAMING DEMONSTRATION');
  console.log('='.repeat(60));

  const streamingPrompt = new PromptInstance(
    {
      name: 'streaming-demo',
      user: 'Count from 1 to 5, one number per line.',
    },
    MODEL,
    {}
  );

  console.log('\nStreaming response:');
  for await (const event of streamingPrompt.runStreaming(client)) {
    if (event.type === 'token') {
      process.stdout.write(event.token);
    } else {
      console.log(`\n  Streaming complete: ${formatTokenUsage(event.result.tokenUsage)}`);
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('DEMO COMPLETE');
  console.log('='.repeat(60));
}

// Run the demo
main().catch(console.error);
