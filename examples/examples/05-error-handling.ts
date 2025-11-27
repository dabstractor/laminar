/**
 * Example 5: Error Handling
 *
 * Demonstrates:
 * - How @Step decorator wraps errors in WorkflowError
 * - Error context including state snapshots and logs
 * - Error events emitted to observers
 * - Error propagation in parent-child workflows
 * - Recovery strategies in workflow orchestration
 */

import {
  Workflow,
  Step,
  Task,
  ObservedState,
  getObservedState,
  WorkflowTreeDebugger,
  WorkflowObserver,
  WorkflowEvent,
  WorkflowError,
  LogEntry,
  WorkflowNode,
} from 'laminar';
import { printHeader, printSection, sleep } from '../utils/helpers.js';

/**
 * Workflow that demonstrates error wrapping
 */
class ErrorDemoWorkflow extends Workflow {
  @ObservedState()
  currentStep: string = 'init';

  @ObservedState()
  itemsProcessed: number = 0;

  @ObservedState({ redact: true })
  sensitiveContext: string = 'secret-data';

  @Step({ snapshotState: true })
  async step1(): Promise<void> {
    this.currentStep = 'step1';
    this.itemsProcessed = 5;
    this.logger.info('Step 1 completed successfully');
    await sleep(50);
  }

  @Step({ snapshotState: true })
  async step2(): Promise<void> {
    this.currentStep = 'step2';
    this.itemsProcessed = 10;
    this.logger.info('Step 2 completed successfully');
    await sleep(50);
  }

  @Step({ snapshotState: true })
  async failingStep(): Promise<void> {
    this.currentStep = 'failing';
    this.logger.info('About to fail...');
    await sleep(30);

    // This error will be wrapped in WorkflowError
    throw new Error('Something went wrong in failingStep!');
  }

  async run(): Promise<void> {
    this.setStatus('running');
    this.logger.info('Starting error demo workflow');

    await this.step1();
    await this.step2();
    await this.failingStep(); // This will throw

    // This line won't be reached
    this.setStatus('completed');
  }
}

/**
 * Workflow with retry logic
 */
class RetryableWorkflow extends Workflow {
  @ObservedState()
  attempt: number = 0;

  @ObservedState()
  maxAttempts: number = 3;

  @ObservedState()
  success: boolean = false;

  private failUntilAttempt: number;

  constructor(name: string, failUntilAttempt: number = 2) {
    super(name);
    this.failUntilAttempt = failUntilAttempt;
  }

  @Step({ trackTiming: true, snapshotState: true })
  async unreliableOperation(): Promise<void> {
    this.attempt++;
    this.logger.info(`Attempt ${this.attempt}/${this.maxAttempts}`);
    await sleep(50);

    if (this.attempt < this.failUntilAttempt) {
      throw new Error(`Simulated failure on attempt ${this.attempt}`);
    }

    this.success = true;
    this.logger.info('Operation succeeded!');
  }

  async run(): Promise<boolean> {
    this.setStatus('running');
    this.logger.info('Starting retryable workflow');

    while (this.attempt < this.maxAttempts) {
      try {
        await this.unreliableOperation();
        this.setStatus('completed');
        return true;
      } catch (error) {
        const wfError = error as WorkflowError;
        this.logger.warn(`Attempt failed: ${wfError.message}`);

        if (this.attempt >= this.maxAttempts) {
          this.setStatus('failed');
          this.logger.error('All attempts exhausted');
          throw error;
        }

        this.logger.info('Retrying...');
        await sleep(100); // Backoff delay
      }
    }

    this.setStatus('failed');
    return false;
  }
}

/**
 * Child workflow that may fail
 */
class FailableChildWorkflow extends Workflow {
  private shouldFail: boolean;

  @ObservedState()
  taskStatus: string = 'pending';

  constructor(name: string, shouldFail: boolean, parent?: Workflow) {
    super(name, parent);
    this.shouldFail = shouldFail;
  }

  @Step({ snapshotState: true })
  async execute(): Promise<void> {
    this.taskStatus = 'executing';
    this.logger.info('Executing child workflow');
    await sleep(50);

    if (this.shouldFail) {
      throw new Error(`Child ${this.getNode().name} failed intentionally`);
    }

    this.taskStatus = 'success';
  }

  async run(): Promise<void> {
    this.setStatus('running');
    await this.execute();
    this.setStatus('completed');
  }
}

/**
 * Parent workflow with error recovery
 */
class ResilientParentWorkflow extends Workflow {
  @ObservedState()
  totalChildren: number = 0;

  @ObservedState()
  successfulChildren: number = 0;

  @ObservedState()
  failedChildren: number = 0;

  private childConfigs: { name: string; shouldFail: boolean }[];

  constructor(name: string, childConfigs: { name: string; shouldFail: boolean }[]) {
    super(name);
    this.childConfigs = childConfigs;
    this.totalChildren = childConfigs.length;
  }

  @Task()
  async spawnChild(config: { name: string; shouldFail: boolean }): Promise<FailableChildWorkflow> {
    return new FailableChildWorkflow(config.name, config.shouldFail, this);
  }

  async run(): Promise<{ success: number; failed: number }> {
    this.setStatus('running');
    this.logger.info(`Starting resilient parent with ${this.totalChildren} children`);

    for (const config of this.childConfigs) {
      const child = await this.spawnChild(config);

      try {
        await child.run();
        this.successfulChildren++;
        this.logger.info(`Child ${config.name} succeeded`);
      } catch (error) {
        this.failedChildren++;
        const wfError = error as WorkflowError;
        this.logger.warn(`Child ${config.name} failed: ${wfError.message}`);
        // Continue with other children instead of failing entirely
      }
    }

    const allSucceeded = this.failedChildren === 0;
    this.setStatus(allSucceeded ? 'completed' : 'completed'); // Still complete, but with partial success
    this.logger.info(`Completed: ${this.successfulChildren} succeeded, ${this.failedChildren} failed`);

    return {
      success: this.successfulChildren,
      failed: this.failedChildren,
    };
  }
}

/**
 * Run the error handling example
 */
export async function runErrorHandlingExample(): Promise<void> {
  printHeader('Example 5: Error Handling');

  // Part 1: Basic error wrapping
  printSection('Part 1: WorkflowError Structure');
  {
    const workflow = new ErrorDemoWorkflow('ErrorDemo');
    const debugger_ = new WorkflowTreeDebugger(workflow);

    let capturedError: WorkflowError | null = null;

    try {
      await workflow.run();
    } catch (error) {
      capturedError = error as WorkflowError;
    }

    console.log('Error caught and wrapped in WorkflowError:');
    console.log(`  message: ${capturedError?.message}`);
    console.log(`  workflowId: ${capturedError?.workflowId}`);
    console.log(`  stack: ${capturedError?.stack?.split('\n')[0]}...`);

    console.log('\nState snapshot at time of error:');
    console.log(JSON.stringify(capturedError?.state, null, 2));

    console.log('\nLogs at time of error:');
    capturedError?.logs.forEach((log) => {
      console.log(`  [${log.level}] ${log.message}`);
    });

    console.log('\nTree state after error:');
    console.log(debugger_.toTreeString());
  }

  // Part 2: Error events
  printSection('Part 2: Error Events');
  {
    const workflow = new ErrorDemoWorkflow('ErrorEvents');
    const errors: WorkflowEvent[] = [];

    const observer: WorkflowObserver = {
      onLog: () => {},
      onEvent: (event) => {
        if (event.type === 'error') {
          errors.push(event);
        }
      },
      onStateUpdated: () => {},
      onTreeChanged: () => {},
    };

    workflow.addObserver(observer);

    try {
      await workflow.run();
    } catch {
      // Expected
    }

    console.log(`Error events captured: ${errors.length}`);
    errors.forEach((e) => {
      if (e.type === 'error') {
        console.log(`  - Node: ${e.node.name}`);
        console.log(`    Message: ${e.error.message}`);
        console.log(`    State keys: ${Object.keys(e.error.state).join(', ')}`);
      }
    });
  }

  // Part 3: Retry logic
  printSection('Part 3: Retry Pattern');
  {
    console.log('Workflow that succeeds on 3rd attempt:');
    const workflow1 = new RetryableWorkflow('RetrySuccess', 3);

    try {
      const success = await workflow1.run();
      console.log(`  Result: ${success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`  Attempts: ${workflow1.attempt}`);
    } catch {
      console.log('  Unexpected failure');
    }

    console.log('\nWorkflow that exhausts all retries:');
    const workflow2 = new RetryableWorkflow('RetryFail', 10); // Will never succeed

    try {
      await workflow2.run();
    } catch (error) {
      const wfError = error as WorkflowError;
      console.log(`  Failed after ${workflow2.attempt} attempts`);
      console.log(`  Final error: ${wfError.message}`);
    }
  }

  // Part 4: Parent-child error isolation
  printSection('Part 4: Error Isolation in Hierarchies');
  {
    const childConfigs = [
      { name: 'Child-A', shouldFail: false },
      { name: 'Child-B', shouldFail: true }, // This one will fail
      { name: 'Child-C', shouldFail: false },
      { name: 'Child-D', shouldFail: true }, // This one will fail
      { name: 'Child-E', shouldFail: false },
    ];

    const workflow = new ResilientParentWorkflow('ResilientParent', childConfigs);
    const debugger_ = new WorkflowTreeDebugger(workflow);

    const result = await workflow.run();

    console.log('Result:', result);
    console.log('\nTree visualization:');
    console.log(debugger_.toTreeString());

    console.log('Child statuses:');
    workflow.children.forEach((child) => {
      const node = child.getNode();
      const state = getObservedState(child);
      console.log(`  ${node.name}: ${node.status} (internal: ${state.taskStatus || 'N/A'})`);
    });
  }

  // Part 5: Error context preservation
  printSection('Part 5: Full Error Context');
  {
    const workflow = new ErrorDemoWorkflow('ContextDemo');

    try {
      await workflow.run();
    } catch (error) {
      const wfError = error as WorkflowError;

      console.log('Complete WorkflowError object:');
      console.log({
        message: wfError.message,
        workflowId: wfError.workflowId,
        hasStack: !!wfError.stack,
        stateFields: Object.keys(wfError.state),
        logCount: wfError.logs.length,
        originalError: wfError.original instanceof Error ? wfError.original.message : 'unknown',
      });

      console.log('\nNote: sensitiveContext is redacted in state snapshot');
      console.log('State:', wfError.state);
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runErrorHandlingExample().catch(console.error);
}
