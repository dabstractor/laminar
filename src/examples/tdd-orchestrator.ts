import { Workflow } from '../core/workflow.js';
import { Step } from '../decorators/step.js';
import { Task } from '../decorators/task.js';
import { ObservedState } from '../decorators/observed-state.js';
import { TestCycleWorkflow } from './test-cycle-workflow.js';

/**
 * Example parent workflow demonstrating TDD orchestration
 */
export class TDDOrchestrator extends Workflow {
  @ObservedState()
  cycleCount: number = 0;

  @ObservedState()
  maxCycles: number = 3;

  @ObservedState({ redact: true })
  apiKey: string = 'secret-key';

  @Step({ logStart: true, logFinish: true })
  async setupEnvironment(): Promise<void> {
    this.logger.info('Setting up TDD environment');
    // Simulate environment setup
    await this.delay(50);
    this.logger.debug('Environment ready');
  }

  @Task()
  async runCycle(): Promise<TestCycleWorkflow> {
    this.cycleCount++;
    this.logger.info(`Starting cycle ${this.cycleCount}/${this.maxCycles}`);
    return new TestCycleWorkflow(`Cycle-${this.cycleCount}`, this);
  }

  async run(): Promise<void> {
    this.setStatus('running');
    this.logger.info('TDD Orchestrator starting');

    try {
      await this.setupEnvironment();

      while (this.cycleCount < this.maxCycles) {
        try {
          const cycle = await this.runCycle();
          await cycle.run();
          this.logger.info(`Cycle ${this.cycleCount} completed successfully`);
        } catch (error) {
          this.logger.warn(`Cycle ${this.cycleCount} failed, continuing...`);
          // In real implementation, analyze error and potentially restart
        }
      }

      this.setStatus('completed');
      this.logger.info('TDD Orchestrator completed all cycles');
    } catch (error) {
      this.setStatus('failed');
      this.logger.error('TDD Orchestrator failed', { error });
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
