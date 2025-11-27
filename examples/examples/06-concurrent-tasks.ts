/**
 * Example 6: Concurrent Tasks
 *
 * Demonstrates:
 * - Using @Task with concurrent: true option
 * - Manual parallel execution patterns
 * - Comparing sequential vs concurrent execution
 * - Fan-out/fan-in patterns
 */

import {
  Workflow,
  Step,
  Task,
  ObservedState,
  WorkflowTreeDebugger,
} from 'laminar';
import { printHeader, printSection, sleep } from '../utils/helpers.js';

/**
 * Simple worker workflow
 */
class WorkerWorkflow extends Workflow {
  @ObservedState()
  workerId: string;

  @ObservedState()
  processingTime: number;

  @ObservedState()
  result: string = '';

  constructor(id: string, processingTime: number, parent?: Workflow) {
    super(`Worker-${id}`, parent);
    this.workerId = id;
    this.processingTime = processingTime;
  }

  @Step({ trackTiming: true, snapshotState: true })
  async process(): Promise<string> {
    this.logger.info(`Worker ${this.workerId} starting (${this.processingTime}ms)`);
    await sleep(this.processingTime);
    this.result = `Result from ${this.workerId}`;
    this.logger.info(`Worker ${this.workerId} completed`);
    return this.result;
  }

  async run(): Promise<string> {
    this.setStatus('running');
    const result = await this.process();
    this.setStatus('completed');
    return result;
  }
}

/**
 * Sequential execution pattern
 */
class SequentialWorkflow extends Workflow {
  @ObservedState()
  workerCount: number;

  @ObservedState()
  completedWorkers: number = 0;

  private workers: { id: string; time: number }[];

  constructor(name: string, workers: { id: string; time: number }[]) {
    super(name);
    this.workers = workers;
    this.workerCount = workers.length;
  }

  @Task()
  async createWorker(config: { id: string; time: number }): Promise<WorkerWorkflow> {
    return new WorkerWorkflow(config.id, config.time, this);
  }

  async run(): Promise<string[]> {
    this.setStatus('running');
    this.logger.info(`Starting ${this.workerCount} workers SEQUENTIALLY`);

    const results: string[] = [];
    const startTime = Date.now();

    for (const config of this.workers) {
      const worker = await this.createWorker(config);
      const result = await worker.run();
      results.push(result);
      this.completedWorkers++;
    }

    const totalTime = Date.now() - startTime;
    this.logger.info(`All workers completed in ${totalTime}ms`);

    this.setStatus('completed');
    return results;
  }
}

/**
 * Concurrent execution using @Task concurrent option
 */
class ConcurrentTaskWorkflow extends Workflow {
  @ObservedState()
  workerCount: number;

  private workers: { id: string; time: number }[];

  constructor(name: string, workers: { id: string; time: number }[]) {
    super(name);
    this.workers = workers;
    this.workerCount = workers.length;
  }

  // Note: The concurrent option auto-runs the returned workflows
  @Task({ concurrent: true })
  async createAllWorkers(): Promise<WorkerWorkflow[]> {
    return this.workers.map(
      (config) => new WorkerWorkflow(config.id, config.time, this)
    );
  }

  async run(): Promise<void> {
    this.setStatus('running');
    this.logger.info(`Starting ${this.workerCount} workers with @Task concurrent`);

    const startTime = Date.now();

    // This will create all workers and run them concurrently
    await this.createAllWorkers();

    const totalTime = Date.now() - startTime;
    this.logger.info(`All workers completed in ${totalTime}ms`);

    this.setStatus('completed');
  }
}

/**
 * Manual parallel execution pattern (more control)
 */
class ManualParallelWorkflow extends Workflow {
  @ObservedState()
  workerCount: number;

  private workers: { id: string; time: number }[];

  constructor(name: string, workers: { id: string; time: number }[]) {
    super(name);
    this.workers = workers;
    this.workerCount = workers.length;
  }

  @Task()
  async createWorker(config: { id: string; time: number }): Promise<WorkerWorkflow> {
    return new WorkerWorkflow(config.id, config.time, this);
  }

  async run(): Promise<string[]> {
    this.setStatus('running');
    this.logger.info(`Starting ${this.workerCount} workers MANUALLY PARALLEL`);

    const startTime = Date.now();

    // Create all workers first
    const workerPromises: Promise<WorkerWorkflow>[] = [];
    for (const config of this.workers) {
      workerPromises.push(this.createWorker(config));
    }
    const workers = await Promise.all(workerPromises);

    // Run all workers in parallel
    const results = await Promise.all(workers.map((w) => w.run()));

    const totalTime = Date.now() - startTime;
    this.logger.info(`All workers completed in ${totalTime}ms`);

    this.setStatus('completed');
    return results;
  }
}

/**
 * Fan-out / Fan-in pattern
 */
class FanOutFanInWorkflow extends Workflow {
  @ObservedState()
  inputData: string[] = [];

  @ObservedState()
  processedData: string[] = [];

  @Step({ logStart: true })
  async prepareData(): Promise<void> {
    this.logger.info('Preparing input data');
    this.inputData = ['A', 'B', 'C', 'D', 'E'];
    await sleep(50);
  }

  @Task()
  async createProcessor(item: string): Promise<WorkerWorkflow> {
    // Variable processing times
    const time = 50 + Math.floor(Math.random() * 100);
    return new WorkerWorkflow(item, time, this);
  }

  @Step({ snapshotState: true })
  async fanOut(): Promise<string[]> {
    this.logger.info(`Fan-out: Creating ${this.inputData.length} parallel processors`);

    // Create all workers
    const workers: WorkerWorkflow[] = [];
    for (const item of this.inputData) {
      workers.push(await this.createProcessor(item));
    }

    // Run all in parallel
    const results = await Promise.all(workers.map((w) => w.run()));

    return results;
  }

  @Step({ logFinish: true, snapshotState: true })
  async fanIn(results: string[]): Promise<void> {
    this.logger.info(`Fan-in: Aggregating ${results.length} results`);
    this.processedData = results;
    await sleep(50);
  }

  async run(): Promise<string[]> {
    this.setStatus('running');

    await this.prepareData();
    const results = await this.fanOut();
    await this.fanIn(results);

    this.setStatus('completed');
    return this.processedData;
  }
}

/**
 * Run the concurrent tasks example
 */
export async function runConcurrentTasksExample(): Promise<void> {
  printHeader('Example 6: Concurrent Tasks');

  const workerConfigs = [
    { id: 'W1', time: 200 },
    { id: 'W2', time: 150 },
    { id: 'W3', time: 100 },
    { id: 'W4', time: 180 },
  ];

  // Part 1: Sequential execution
  printSection('Part 1: Sequential Execution');
  {
    const workflow = new SequentialWorkflow('Sequential', workerConfigs);
    const debugger_ = new WorkflowTreeDebugger(workflow);

    console.log('Expected time: ~630ms (200+150+100+180)');
    const start = Date.now();
    await workflow.run();
    const elapsed = Date.now() - start;
    console.log(`Actual time: ${elapsed}ms`);

    console.log('\nTree:');
    console.log(debugger_.toTreeString());
  }

  // Part 2: Manual parallel execution
  printSection('Part 2: Manual Parallel Execution');
  {
    const workflow = new ManualParallelWorkflow('ManualParallel', workerConfigs);
    const debugger_ = new WorkflowTreeDebugger(workflow);

    console.log('Expected time: ~200ms (max of all workers)');
    const start = Date.now();
    await workflow.run();
    const elapsed = Date.now() - start;
    console.log(`Actual time: ${elapsed}ms`);

    console.log('\nTree:');
    console.log(debugger_.toTreeString());
  }

  // Part 3: @Task concurrent option
  printSection('Part 3: @Task concurrent: true');
  {
    const workflow = new ConcurrentTaskWorkflow('TaskConcurrent', workerConfigs);
    const debugger_ = new WorkflowTreeDebugger(workflow);

    console.log('Expected time: ~200ms (using concurrent option)');
    const start = Date.now();
    await workflow.run();
    const elapsed = Date.now() - start;
    console.log(`Actual time: ${elapsed}ms`);

    console.log('\nTree:');
    console.log(debugger_.toTreeString());
  }

  // Part 4: Fan-out / Fan-in
  printSection('Part 4: Fan-Out / Fan-In Pattern');
  {
    const workflow = new FanOutFanInWorkflow('FanOutFanIn');
    const debugger_ = new WorkflowTreeDebugger(workflow);

    const results = await workflow.run();

    console.log('Results:', results);
    console.log('\nTree:');
    console.log(debugger_.toTreeString());

    const stats = debugger_.getStats();
    console.log('Statistics:', stats);
  }

  // Part 5: Performance comparison summary
  printSection('Part 5: Performance Summary');
  {
    const configs = [
      { id: 'A', time: 100 },
      { id: 'B', time: 100 },
      { id: 'C', time: 100 },
      { id: 'D', time: 100 },
    ];

    // Sequential
    const seq = new SequentialWorkflow('SeqTest', configs);
    const seqStart = Date.now();
    await seq.run();
    const seqTime = Date.now() - seqStart;

    // Parallel
    const par = new ManualParallelWorkflow('ParTest', configs);
    const parStart = Date.now();
    await par.run();
    const parTime = Date.now() - parStart;

    console.log('4 workers x 100ms each:');
    console.log(`  Sequential: ${seqTime}ms`);
    console.log(`  Parallel:   ${parTime}ms`);
    console.log(`  Speedup:    ${(seqTime / parTime).toFixed(2)}x`);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runConcurrentTasksExample().catch(console.error);
}
