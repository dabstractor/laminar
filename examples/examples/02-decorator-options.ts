/**
 * Example 2: Decorator Options
 *
 * Demonstrates all decorator configuration options:
 *
 * @Step options:
 * - name: Custom step name (defaults to method name)
 * - snapshotState: Capture state snapshot after step completion
 * - trackTiming: Track and emit step duration
 * - logStart: Log message at step start
 * - logFinish: Log message at step end
 *
 * @Task options:
 * - name: Custom task name
 * - concurrent: Run returned workflows concurrently
 *
 * @ObservedState options:
 * - hidden: Field not included in snapshots
 * - redact: Value shown as '***' in snapshots
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
  LogEntry,
  WorkflowNode,
} from 'laminar';
import { printHeader, printSection, sleep } from '../utils/helpers.js';

/**
 * Workflow demonstrating all @Step decorator options
 */
class StepOptionsWorkflow extends Workflow {
  @ObservedState()
  currentPhase: string = 'init';

  @ObservedState()
  itemsProcessed: number = 0;

  // Default step - minimal configuration
  @Step()
  async defaultStep(): Promise<void> {
    this.currentPhase = 'default';
    await sleep(50);
  }

  // Step with custom name
  @Step({ name: 'CustomNamedStep' })
  async stepWithCustomName(): Promise<void> {
    this.currentPhase = 'custom-named';
    await sleep(50);
  }

  // Step with state snapshot
  @Step({ snapshotState: true })
  async stepWithSnapshot(): Promise<void> {
    this.currentPhase = 'snapshot';
    this.itemsProcessed = 10;
    await sleep(50);
    // State will be captured after this step
  }

  // Step with timing tracking
  @Step({ trackTiming: true })
  async stepWithTiming(): Promise<void> {
    this.currentPhase = 'timed';
    await sleep(200); // Longer delay to show timing
  }

  // Step with start/finish logging
  @Step({ logStart: true, logFinish: true })
  async stepWithLogging(): Promise<void> {
    this.currentPhase = 'logged';
    this.logger.info('Inside the step - this is custom logging');
    await sleep(50);
  }

  // Step with ALL options enabled
  @Step({
    name: 'FullyConfiguredStep',
    snapshotState: true,
    trackTiming: true,
    logStart: true,
    logFinish: true,
  })
  async fullyConfiguredStep(): Promise<void> {
    this.currentPhase = 'fully-configured';
    this.itemsProcessed = 100;
    await sleep(100);
  }

  async run(): Promise<void> {
    this.setStatus('running');

    await this.defaultStep();
    await this.stepWithCustomName();
    await this.stepWithSnapshot();
    await this.stepWithTiming();
    await this.stepWithLogging();
    await this.fullyConfiguredStep();

    this.setStatus('completed');
  }
}

/**
 * Workflow demonstrating @ObservedState options
 */
class StateOptionsWorkflow extends Workflow {
  // Regular observed state - included in snapshots
  @ObservedState()
  publicData: string = 'visible-value';

  // Redacted state - shows as '***' in snapshots
  @ObservedState({ redact: true })
  apiKey: string = 'super-secret-api-key-12345';

  // Another redacted field
  @ObservedState({ redact: true })
  password: string = 'my-password';

  // Hidden state - completely excluded from snapshots
  @ObservedState({ hidden: true })
  internalCounter: number = 0;

  // Another hidden field
  @ObservedState({ hidden: true })
  debugInfo: object = { internal: true };

  // Multiple observed fields for demonstration
  @ObservedState()
  processingStatus: string = 'pending';

  @ObservedState()
  progress: number = 0;

  async run(): Promise<void> {
    this.setStatus('running');
    this.processingStatus = 'processing';
    this.progress = 50;
    this.internalCounter = 999; // This won't appear in snapshots
    await sleep(50);
    this.processingStatus = 'done';
    this.progress = 100;
    this.setStatus('completed');
  }
}

/**
 * Run the decorator options example
 */
export async function runDecoratorOptionsExample(): Promise<void> {
  printHeader('Example 2: Decorator Options');

  // Part 1: @Step options
  printSection('@Step Decorator Options');

  const stepWorkflow = new StepOptionsWorkflow('StepOptions');
  const events: WorkflowEvent[] = [];

  // Custom observer to capture events
  const observer: WorkflowObserver = {
    onLog: (entry: LogEntry) => {
      console.log(`  [LOG] ${entry.level.toUpperCase()}: ${entry.message}`);
    },
    onEvent: (event: WorkflowEvent) => {
      events.push(event);
      if (event.type === 'stepStart') {
        console.log(`  [EVENT] Step started: ${event.step}`);
      } else if (event.type === 'stepEnd') {
        console.log(`  [EVENT] Step ended: ${event.step} (${event.duration}ms)`);
      } else if (event.type === 'stateSnapshot') {
        console.log(`  [EVENT] State snapshot captured`);
      }
    },
    onStateUpdated: () => {},
    onTreeChanged: () => {},
  };

  stepWorkflow.addObserver(observer);
  await stepWorkflow.run();

  console.log('\nStep events captured:', events.filter((e) => e.type.includes('step')).length);

  // Part 2: @ObservedState options
  printSection('@ObservedState Decorator Options');

  const stateWorkflow = new StateOptionsWorkflow('StateOptions');
  await stateWorkflow.run();

  console.log('Actual field values:');
  console.log('  publicData:', stateWorkflow.publicData);
  console.log('  apiKey:', stateWorkflow.apiKey);
  console.log('  password:', stateWorkflow.password);
  console.log('  internalCounter:', (stateWorkflow as any).internalCounter);
  console.log('  processingStatus:', stateWorkflow.processingStatus);
  console.log('  progress:', stateWorkflow.progress);

  console.log('\nState snapshot (via getObservedState):');
  const snapshot = getObservedState(stateWorkflow);
  console.log(JSON.stringify(snapshot, null, 2));

  console.log('\nNote:');
  console.log('  - apiKey and password show as "***" (redacted)');
  console.log('  - internalCounter and debugInfo are not present (hidden)');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDecoratorOptionsExample().catch(console.error);
}
