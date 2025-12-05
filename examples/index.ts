/**
 * Laminar Workflow Engine - Example Runner
 *
 * This file runs all examples demonstrating the features of the
 * Laminar workflow orchestration engine.
 *
 * WORKFLOW EXAMPLES (synchronous, no API key required):
 *   npx tsx examples/index.ts
 *
 * AGENT/PROMPT EXAMPLES (requires ANTHROPIC_API_KEY):
 *
 *   Basic Examples:
 *   - npx tsx examples/basic-prompt.ts       - Simple prompt execution
 *   - npx tsx examples/basic-agent.ts        - Agent with multiple prompts
 *   - npx tsx examples/basic-workflow.ts     - AgentWorkflow with steps
 *   - npx tsx examples/cache-usage.ts        - Prompt result caching
 *
 *   Advanced Examples:
 *   - npx tsx examples/tool-calling-agent.ts       - Agent with tools
 *   - npx tsx examples/streaming-example.ts        - Token streaming
 *   - npx tsx examples/reflection-retry.ts         - Self-correcting agents
 *   - npx tsx examples/multi-step-orchestration.ts - Complex workflows
 *   - npx tsx examples/observability-demo.ts       - Full observability
 *   - npx tsx examples/combined-features.ts        - All features together
 *
 * Run individual workflow examples:
 *   npm run start:basic
 *   npm run start:decorators
 *   npm run start:parent-child
 *   npm run start:observers
 *   npm run start:errors
 *   npm run start:concurrent
 *
 * Run all workflow examples:
 *   npm run start:all
 */

import { runBasicWorkflowExample } from './core-basic-workflow.js';
import { runDecoratorOptionsExample } from './core-decorator-options.js';
import { runParentChildExample } from './core-parent-child.js';
import { runObserversDebuggerExample } from './core-observers-debugger.js';
import { runErrorHandlingExample } from './core-error-handling.js';
import { runConcurrentTasksExample } from './core-concurrent-tasks.js';

const BANNER = `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ██╗      █████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██████╗   ║
║     ██║     ██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██╔══██╗  ║
║     ██║     ███████║██╔████╔██║██║██╔██╗ ██║███████║██████╔╝  ║
║     ██║     ██╔══██║██║╚██╔╝██║██║██║╚██╗██║██╔══██║██╔══██╗  ║
║     ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║██║  ██║  ║
║     ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝  ║
║                                                               ║
║         Workflow Engine Examples & Feature Showcase           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`;

const MENU = `
Available Examples:
───────────────────────────────────────────────────────────────────
  1. Basic Workflow          - Core workflow concepts
  2. Decorator Options       - All @Step, @Task, @ObservedState options
  3. Parent-Child Workflows  - Hierarchical workflow structures
  4. Observers & Debugger    - Real-time monitoring and debugging
  5. Error Handling          - Error wrapping, recovery patterns
  6. Concurrent Tasks        - Parallel execution patterns

  A. Run All Examples
  Q. Quit
───────────────────────────────────────────────────────────────────
`;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForInput(prompt: string): Promise<void> {
  console.log(`\n${prompt}`);
  console.log('Press Enter to continue...');
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });
}

async function runAllExamples(): Promise<void> {
  console.log(BANNER);
  console.log('Running all examples sequentially...\n');

  const examples = [
    { name: '1. Basic Workflow', fn: runBasicWorkflowExample },
    { name: '2. Decorator Options', fn: runDecoratorOptionsExample },
    { name: '3. Parent-Child Workflows', fn: runParentChildExample },
    { name: '4. Observers & Debugger', fn: runObserversDebuggerExample },
    { name: '5. Error Handling', fn: runErrorHandlingExample },
    { name: '6. Concurrent Tasks', fn: runConcurrentTasksExample },
  ];

  for (const example of examples) {
    console.log(`\n${'#'.repeat(70)}`);
    console.log(`# Running: ${example.name}`);
    console.log(`${'#'.repeat(70)}`);

    try {
      await example.fn();
    } catch (error) {
      console.error(`Example ${example.name} failed:`, error);
    }

    await sleep(500); // Brief pause between examples
  }

  console.log('\n' + '═'.repeat(70));
  console.log('All examples completed!');
  console.log('═'.repeat(70));

  console.log(`
Summary of Features Demonstrated:
─────────────────────────────────
✓ Workflow base class with status management
✓ WorkflowLogger with structured logging
✓ @Step decorator with all options (name, snapshotState, trackTiming, logStart, logFinish)
✓ @Task decorator with concurrent option
✓ @ObservedState decorator with hidden and redact options
✓ Parent-child workflow hierarchies
✓ Automatic child attachment via constructor
✓ Event propagation to root observers
✓ WorkflowTreeDebugger with ASCII tree visualization
✓ Custom WorkflowObserver implementations
✓ Observable event streaming
✓ WorkflowError with full context (state, logs, stack)
✓ Error recovery patterns
✓ Sequential vs parallel execution
✓ Fan-out / fan-in patterns

Agent/Prompt Features (see separate examples with ANTHROPIC_API_KEY):
─────────────────────────────────────────────────────────────────────
✓ AgentWorkflow for multi-step orchestration
✓ Agent with prompts, retries, and reflection
✓ PromptInstance with variable interpolation
✓ Tool calling with agentic loops
✓ Streaming for real-time output
✓ Caching for prompt results
✓ Token usage tracking and cost estimation
✓ Full observability with tree debugging
`);
}

// Main entry point
runAllExamples()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
