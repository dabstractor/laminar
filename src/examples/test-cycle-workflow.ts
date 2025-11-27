import { Workflow } from '../core/workflow.js';
import { Step } from '../decorators/step.js';
import { ObservedState } from '../decorators/observed-state.js';

/**
 * Example child workflow demonstrating test cycle
 */
export class TestCycleWorkflow extends Workflow {
  @ObservedState()
  currentTest: string = '';

  @ObservedState()
  testResult: 'pending' | 'passed' | 'failed' = 'pending';

  @Step({ snapshotState: true, trackTiming: true, logStart: true })
  async generateTest(): Promise<string> {
    this.logger.info('Generating test case');
    this.currentTest = `test_${Date.now()}`;
    // Simulate test generation
    await this.delay(100);
    return this.currentTest;
  }

  @Step({ trackTiming: true })
  async runTest(): Promise<boolean> {
    this.logger.info(`Running test: ${this.currentTest}`);
    // Simulate test execution
    await this.delay(200);

    // Randomly pass or fail for demonstration
    const passed = Math.random() > 0.3;
    this.testResult = passed ? 'passed' : 'failed';

    if (!passed) {
      throw new Error(`Test ${this.currentTest} failed`);
    }

    return true;
  }

  @Step({ snapshotState: true })
  async updateImplementation(): Promise<void> {
    this.logger.info('Updating implementation based on test results');
    await this.delay(150);
  }

  async run(): Promise<void> {
    this.setStatus('running');

    try {
      await this.generateTest();
      await this.runTest();
      await this.updateImplementation();
      this.setStatus('completed');
    } catch (error) {
      this.setStatus('failed');
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
