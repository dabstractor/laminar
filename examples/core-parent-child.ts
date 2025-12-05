/**
 * Example 3: Parent-Child Workflows
 *
 * Demonstrates:
 * - Creating hierarchical workflow structures
 * - Automatic parent-child attachment
 * - Using @Task decorator to spawn child workflows
 * - Event propagation from children to root
 * - Tree visualization of nested workflows
 */

import {
  Workflow,
  Step,
  Task,
  ObservedState,
  WorkflowTreeDebugger,
} from '../src/index.js';
import { printHeader, printSection, sleep } from './utils/helpers.js';

/**
 * Leaf workflow - performs actual work
 */
class ProcessItemWorkflow extends Workflow {
  @ObservedState()
  itemId: string;

  @ObservedState()
  processed: boolean = false;

  constructor(itemId: string, parent?: Workflow) {
    super(`ProcessItem-${itemId}`, parent);
    this.itemId = itemId;
  }

  @Step({ trackTiming: true, snapshotState: true })
  async validate(): Promise<void> {
    this.logger.info(`Validating item ${this.itemId}`);
    await sleep(50);
  }

  @Step({ trackTiming: true, snapshotState: true })
  async transform(): Promise<void> {
    this.logger.info(`Transforming item ${this.itemId}`);
    await sleep(100);
  }

  @Step({ trackTiming: true, snapshotState: true })
  async save(): Promise<void> {
    this.logger.info(`Saving item ${this.itemId}`);
    this.processed = true;
    await sleep(50);
  }

  async run(): Promise<void> {
    this.setStatus('running');
    this.logger.info(`Starting item processing for ${this.itemId}`);

    await this.validate();
    await this.transform();
    await this.save();

    this.setStatus('completed');
    this.logger.info(`Completed processing ${this.itemId}`);
  }
}

/**
 * Middle-tier workflow - manages a batch of items
 */
class BatchProcessorWorkflow extends Workflow {
  @ObservedState()
  batchId: string;

  @ObservedState()
  itemCount: number = 0;

  @ObservedState()
  processedCount: number = 0;

  private items: string[];

  constructor(batchId: string, items: string[], parent?: Workflow) {
    super(`Batch-${batchId}`, parent);
    this.batchId = batchId;
    this.items = items;
    this.itemCount = items.length;
  }

  @Step({ logStart: true })
  async prepareBatch(): Promise<void> {
    this.logger.info(`Preparing batch ${this.batchId} with ${this.itemCount} items`);
    await sleep(50);
  }

  @Task()
  async processItem(itemId: string): Promise<ProcessItemWorkflow> {
    this.logger.info(`Spawning workflow for item ${itemId}`);
    return new ProcessItemWorkflow(itemId, this);
  }

  @Step({ logFinish: true, snapshotState: true })
  async finalizeBatch(): Promise<void> {
    this.processedCount = this.itemCount;
    this.logger.info(`Batch ${this.batchId} finalized: ${this.processedCount} items processed`);
    await sleep(30);
  }

  async run(): Promise<void> {
    this.setStatus('running');
    this.logger.info(`Starting batch ${this.batchId}`);

    await this.prepareBatch();

    // Process each item sequentially
    for (const itemId of this.items) {
      const itemWorkflow = await this.processItem(itemId);
      await itemWorkflow.run();
      this.processedCount++;
    }

    await this.finalizeBatch();

    this.setStatus('completed');
  }
}

/**
 * Top-level orchestrator workflow
 */
class DataPipelineWorkflow extends Workflow {
  @ObservedState()
  pipelineName: string;

  @ObservedState()
  totalBatches: number = 0;

  @ObservedState()
  completedBatches: number = 0;

  private batches: { id: string; items: string[] }[];

  constructor(name: string, batches: { id: string; items: string[] }[]) {
    super(name);
    this.pipelineName = name;
    this.batches = batches;
    this.totalBatches = batches.length;
  }

  @Step({ logStart: true, logFinish: true })
  async initialize(): Promise<void> {
    this.logger.info(`Initializing pipeline: ${this.pipelineName}`);
    this.logger.info(`Total batches to process: ${this.totalBatches}`);
    await sleep(50);
  }

  @Task()
  async processBatch(batch: { id: string; items: string[] }): Promise<BatchProcessorWorkflow> {
    this.logger.info(`Creating batch processor for ${batch.id}`);
    return new BatchProcessorWorkflow(batch.id, batch.items, this);
  }

  @Step({ logStart: true, logFinish: true, snapshotState: true })
  async cleanup(): Promise<void> {
    this.logger.info('Running cleanup tasks');
    await sleep(50);
  }

  async run(): Promise<void> {
    this.setStatus('running');
    this.logger.info('=== Pipeline Started ===');

    await this.initialize();

    // Process each batch
    for (const batch of this.batches) {
      const batchWorkflow = await this.processBatch(batch);
      await batchWorkflow.run();
      this.completedBatches++;
      this.logger.info(`Completed ${this.completedBatches}/${this.totalBatches} batches`);
    }

    await this.cleanup();

    this.setStatus('completed');
    this.logger.info('=== Pipeline Completed ===');
  }
}

/**
 * Run the parent-child workflow example
 */
export async function runParentChildExample(): Promise<void> {
  printHeader('Example 3: Parent-Child Workflows');

  // Create sample data
  const batches = [
    { id: 'batch-A', items: ['A1', 'A2'] },
    { id: 'batch-B', items: ['B1', 'B2', 'B3'] },
  ];

  // Create the pipeline
  const pipeline = new DataPipelineWorkflow('MyDataPipeline', batches);
  const debugger_ = new WorkflowTreeDebugger(pipeline);

  printSection('Initial Tree Structure');
  console.log(debugger_.toTreeString());

  printSection('Executing Pipeline');
  await pipeline.run();

  printSection('Final Tree Structure');
  console.log(debugger_.toTreeString());

  printSection('Tree Statistics');
  const stats = debugger_.getStats();
  console.log(`Total nodes: ${stats.totalNodes}`);
  console.log(`By status:`, stats.byStatus);
  console.log(`Total logs: ${stats.totalLogs}`);
  console.log(`Total events: ${stats.totalEvents}`);

  printSection('Workflow Hierarchy');
  console.log('Pipeline:', pipeline.id);
  console.log('  Children (batches):', pipeline.children.length);
  for (const batch of pipeline.children) {
    console.log(`    ${batch.getNode().name} - ${batch.children.length} items`);
    for (const item of batch.children) {
      console.log(`      ${item.getNode().name} [${item.getNode().status}]`);
    }
  }

  printSection('Sample Logs (first 15)');
  const logLines = debugger_.toLogString().split('\n').slice(0, 15);
  console.log(logLines.join('\n'));
  console.log('...');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runParentChildExample().catch(console.error);
}
