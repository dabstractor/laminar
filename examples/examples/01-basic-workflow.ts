/**
 * Example 1: Basic Workflow
 *
 * Demonstrates:
 * - Creating a simple workflow by extending the Workflow base class
 * - Using the logger for structured logging
 * - Managing workflow status (idle -> running -> completed/failed)
 * - Basic execution flow
 */

import { Workflow, WorkflowTreeDebugger } from 'laminar';
import { printHeader, printSection, sleep } from '../utils/helpers.js';

/**
 * A simple data processing workflow
 */
class DataProcessingWorkflow extends Workflow {
  private data: string[] = [];

  async run(): Promise<string[]> {
    this.setStatus('running');
    this.logger.info('Starting data processing workflow');

    try {
      // Step 1: Load data
      this.logger.info('Loading data...');
      await this.loadData();

      // Step 2: Process data
      this.logger.info('Processing data...');
      await this.processData();

      // Step 3: Save results
      this.logger.info('Saving results...');
      await this.saveResults();

      this.setStatus('completed');
      this.logger.info('Workflow completed successfully');
      return this.data;
    } catch (error) {
      this.setStatus('failed');
      this.logger.error('Workflow failed', { error });
      throw error;
    }
  }

  private async loadData(): Promise<void> {
    await sleep(100);
    this.data = ['item1', 'item2', 'item3'];
    this.logger.debug('Loaded items', { count: this.data.length });
  }

  private async processData(): Promise<void> {
    await sleep(150);
    this.data = this.data.map((item) => item.toUpperCase());
    this.logger.debug('Processed items', { data: this.data });
  }

  private async saveResults(): Promise<void> {
    await sleep(50);
    this.logger.debug('Results saved');
  }
}

/**
 * Run the basic workflow example
 */
export async function runBasicWorkflowExample(): Promise<void> {
  printHeader('Example 1: Basic Workflow');

  // Create workflow with custom name
  const workflow = new DataProcessingWorkflow('DataProcessor');

  // Attach debugger to visualize
  const debugger_ = new WorkflowTreeDebugger(workflow);

  printSection('Initial State');
  console.log('Workflow ID:', workflow.id);
  console.log('Status:', workflow.status);
  console.log('Tree:\n' + debugger_.toTreeString());

  printSection('Running Workflow');
  const result = await workflow.run();

  printSection('Final State');
  console.log('Status:', workflow.status);
  console.log('Result:', result);
  console.log('\nTree:\n' + debugger_.toTreeString());

  printSection('Logs');
  console.log(debugger_.toLogString());

  printSection('Statistics');
  console.log(debugger_.getStats());
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBasicWorkflowExample().catch(console.error);
}
