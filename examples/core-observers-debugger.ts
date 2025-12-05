/**
 * Example 4: Observers and Debugger
 *
 * Demonstrates:
 * - Implementing custom WorkflowObserver
 * - Real-time event streaming
 * - Log collection and filtering
 * - Using WorkflowTreeDebugger API
 * - Observable subscription patterns
 */

import {
  Workflow,
  Step,
  Task,
  ObservedState,
  WorkflowTreeDebugger,
  WorkflowObserver,
  WorkflowEvent,
  LogEntry,
  WorkflowNode,
  Observable,
} from '../src/index.js';
import { printHeader, printSection, sleep } from './utils/helpers.js';

/**
 * Custom observer that collects detailed metrics
 */
class MetricsObserver implements WorkflowObserver {
  public logCount = 0;
  public eventCount = 0;
  public stateUpdates = 0;
  public treeChanges = 0;

  public logsByLevel: Record<string, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  };

  public eventsByType: Record<string, number> = {};
  public stepDurations: { step: string; duration: number }[] = [];
  public errors: WorkflowEvent[] = [];

  onLog(entry: LogEntry): void {
    this.logCount++;
    this.logsByLevel[entry.level] = (this.logsByLevel[entry.level] || 0) + 1;
  }

  onEvent(event: WorkflowEvent): void {
    this.eventCount++;
    this.eventsByType[event.type] = (this.eventsByType[event.type] || 0) + 1;

    if (event.type === 'stepEnd') {
      this.stepDurations.push({
        step: event.step,
        duration: event.duration,
      });
    }

    if (event.type === 'error') {
      this.errors.push(event);
    }
  }

  onStateUpdated(_node: WorkflowNode): void {
    this.stateUpdates++;
  }

  onTreeChanged(_root: WorkflowNode): void {
    this.treeChanges++;
  }

  getReport(): string {
    const lines = [
      `=== Metrics Report ===`,
      `Logs: ${this.logCount} total`,
      `  - debug: ${this.logsByLevel.debug}`,
      `  - info: ${this.logsByLevel.info}`,
      `  - warn: ${this.logsByLevel.warn}`,
      `  - error: ${this.logsByLevel.error}`,
      ``,
      `Events: ${this.eventCount} total`,
      ...Object.entries(this.eventsByType).map(([type, count]) => `  - ${type}: ${count}`),
      ``,
      `State updates: ${this.stateUpdates}`,
      `Tree changes: ${this.treeChanges}`,
      ``,
      `Step durations:`,
      ...this.stepDurations.map((s) => `  - ${s.step}: ${s.duration}ms`),
    ];

    if (this.errors.length > 0) {
      lines.push(``, `Errors: ${this.errors.length}`);
    }

    return lines.join('\n');
  }
}

/**
 * Custom observer that logs in real-time
 */
class ConsoleObserver implements WorkflowObserver {
  private prefix: string;

  constructor(prefix: string = 'OBSERVER') {
    this.prefix = prefix;
  }

  onLog(entry: LogEntry): void {
    const level = entry.level.toUpperCase().padEnd(5);
    console.log(`[${this.prefix}] ${level} | ${entry.message}`);
  }

  onEvent(event: WorkflowEvent): void {
    if (event.type === 'stepStart') {
      console.log(`[${this.prefix}] >> Step started: ${event.step}`);
    } else if (event.type === 'stepEnd') {
      console.log(`[${this.prefix}] << Step ended: ${event.step} (${event.duration}ms)`);
    } else if (event.type === 'childAttached') {
      console.log(`[${this.prefix}] ++ Child attached: ${event.child.name}`);
    } else if (event.type === 'error') {
      console.log(`[${this.prefix}] !! ERROR: ${event.error.message}`);
    }
  }

  onStateUpdated(node: WorkflowNode): void {
    console.log(`[${this.prefix}] State updated: ${node.name}`);
  }

  onTreeChanged(_root: WorkflowNode): void {
    console.log(`[${this.prefix}] Tree structure changed`);
  }
}

/**
 * Sample workflow for observation
 */
class ObservableWorkflow extends Workflow {
  @ObservedState()
  phase: string = 'init';

  @ObservedState()
  progress: number = 0;

  @Step({ trackTiming: true, snapshotState: true, logStart: true })
  async phase1(): Promise<void> {
    this.phase = 'phase1';
    this.progress = 25;
    await sleep(100);
  }

  @Step({ trackTiming: true, snapshotState: true })
  async phase2(): Promise<void> {
    this.phase = 'phase2';
    this.progress = 50;
    await sleep(150);
  }

  @Step({ trackTiming: true, snapshotState: true })
  async phase3(): Promise<void> {
    this.phase = 'phase3';
    this.progress = 75;
    await sleep(80);
  }

  @Step({ trackTiming: true, snapshotState: true, logFinish: true })
  async phase4(): Promise<void> {
    this.phase = 'phase4';
    this.progress = 100;
    await sleep(120);
  }

  async run(): Promise<void> {
    this.setStatus('running');
    this.logger.info('Observable workflow starting');

    await this.phase1();
    await this.phase2();
    await this.phase3();
    await this.phase4();

    this.setStatus('completed');
    this.logger.info('Observable workflow completed');
  }
}

/**
 * Child workflow for tree demonstration
 */
class ChildWorkflow extends Workflow {
  @Step({ trackTiming: true })
  async doWork(): Promise<void> {
    this.logger.info('Child doing work');
    await sleep(50);
  }

  async run(): Promise<void> {
    this.setStatus('running');
    await this.doWork();
    this.setStatus('completed');
  }
}

/**
 * Parent workflow that spawns children
 */
class ParentWithChildrenWorkflow extends Workflow {
  @Task()
  async spawnChild(name: string): Promise<ChildWorkflow> {
    return new ChildWorkflow(name, this);
  }

  async run(): Promise<void> {
    this.setStatus('running');
    this.logger.info('Parent starting');

    const child1 = await this.spawnChild('Child-1');
    await child1.run();

    const child2 = await this.spawnChild('Child-2');
    await child2.run();

    this.setStatus('completed');
    this.logger.info('Parent completed');
  }
}

/**
 * Run the observers and debugger example
 */
export async function runObserversDebuggerExample(): Promise<void> {
  printHeader('Example 4: Observers and Debugger');

  // Part 1: Custom MetricsObserver
  printSection('Part 1: MetricsObserver');
  {
    const workflow = new ObservableWorkflow('MetricsDemo');
    const metricsObserver = new MetricsObserver();
    workflow.addObserver(metricsObserver);

    await workflow.run();

    console.log(metricsObserver.getReport());
  }

  // Part 2: Real-time ConsoleObserver
  printSection('Part 2: Real-time ConsoleObserver');
  {
    const workflow = new ObservableWorkflow('ConsoleDemo');
    const consoleObserver = new ConsoleObserver('LIVE');
    workflow.addObserver(consoleObserver);

    await workflow.run();
  }

  // Part 3: Using Observable for event streaming
  printSection('Part 3: Observable Event Stream');
  {
    const workflow = new ParentWithChildrenWorkflow('StreamDemo');
    const debugger_ = new WorkflowTreeDebugger(workflow);

    const eventLog: string[] = [];

    // Subscribe to the event stream
    const subscription = debugger_.events.subscribe({
      next: (event) => {
        eventLog.push(`${event.type}: ${'node' in event ? event.node.name : 'N/A'}`);
      },
    });

    await workflow.run();

    console.log('Events received via Observable:');
    eventLog.forEach((e) => console.log(`  ${e}`));

    // Cleanup subscription
    subscription.unsubscribe();
  }

  // Part 4: WorkflowTreeDebugger API
  printSection('Part 4: WorkflowTreeDebugger API');
  {
    const workflow = new ParentWithChildrenWorkflow('DebuggerDemo');
    const debugger_ = new WorkflowTreeDebugger(workflow);

    await workflow.run();

    console.log('1. Tree visualization:');
    console.log(debugger_.toTreeString());

    console.log('2. Get tree root:');
    const root = debugger_.getTree();
    console.log(`   Root: ${root.name} (${root.id})`);
    console.log(`   Children: ${root.children.length}`);

    console.log('\n3. Find node by ID:');
    const firstChild = workflow.children[0];
    const foundNode = debugger_.getNode(firstChild.id);
    console.log(`   Found: ${foundNode?.name}`);

    console.log('\n4. Statistics:');
    const stats = debugger_.getStats();
    console.log(`   ${JSON.stringify(stats, null, 2)}`);

    console.log('\n5. Formatted logs:');
    const logs = debugger_.toLogString().split('\n').slice(0, 5);
    logs.forEach((log) => console.log(`   ${log}`));
    console.log('   ...');
  }

  // Part 5: Multiple observers
  printSection('Part 5: Multiple Observers');
  {
    const workflow = new ObservableWorkflow('MultiObserver');

    const metrics = new MetricsObserver();
    const console1 = new ConsoleObserver('OBS-1');
    const console2 = new ConsoleObserver('OBS-2');

    workflow.addObserver(metrics);
    workflow.addObserver(console1);
    workflow.addObserver(console2);

    // Note: both console observers will print
    console.log('Running with 3 observers attached...');
    await workflow.run();

    console.log('\nMetrics summary:');
    console.log(`  Events received: ${metrics.eventCount}`);
    console.log(`  Logs received: ${metrics.logCount}`);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runObserversDebuggerExample().catch(console.error);
}
