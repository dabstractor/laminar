/**
 * Laminar Workflow Engine - Example Runner
 *
 * This file runs all examples demonstrating the features of the
 * Laminar workflow orchestration engine.
 *
 * Run individual examples:
 *   npm run start:basic
 *   npm run start:decorators
 *   npm run start:parent-child
 *   npm run start:observers
 *   npm run start:errors
 *   npm run start:concurrent
 *
 * Run all examples:
 *   npm run start:all
 */

import { runBasicWorkflowExample } from './examples/01-basic-workflow.js';
import { runDecoratorOptionsExample } from './examples/02-decorator-options.js';
import { runParentChildExample } from './examples/03-parent-child.js';
import { runObserversDebuggerExample } from './examples/04-observers-debugger.js';
import { runErrorHandlingExample } from './examples/05-error-handling.js';
import { runConcurrentTasksExample } from './examples/06-concurrent-tasks.js';

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
`);
}

// Main entry point
runAllExamples()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
