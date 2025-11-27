import { describe, it, expect } from 'vitest';
import { Workflow, Step, Task, ObservedState, getObservedState, WorkflowEvent, WorkflowObserver } from '../../index.js';

describe('@Step decorator', () => {
  class StepTestWorkflow extends Workflow {
    stepCalled = false;

    @Step({ trackTiming: true })
    async myStep(): Promise<string> {
      this.stepCalled = true;
      return 'step result';
    }

    async run(): Promise<void> {
      await this.myStep();
    }
  }

  it('should execute the original method', async () => {
    const wf = new StepTestWorkflow();
    await wf.run();
    expect(wf.stepCalled).toBe(true);
  });

  it('should emit stepStart and stepEnd events', async () => {
    const wf = new StepTestWorkflow();
    const events: WorkflowEvent[] = [];

    wf.addObserver({
      onLog: () => {},
      onEvent: (e) => events.push(e),
      onStateUpdated: () => {},
      onTreeChanged: () => {},
    });

    await wf.run();

    const startEvent = events.find((e) => e.type === 'stepStart');
    const endEvent = events.find((e) => e.type === 'stepEnd');

    expect(startEvent).toBeDefined();
    expect(endEvent).toBeDefined();
    if (endEvent?.type === 'stepEnd') {
      expect(endEvent.duration).toBeGreaterThanOrEqual(0);
    }
  });

  it('should wrap errors in WorkflowError', async () => {
    class FailingWorkflow extends Workflow {
      @Step()
      async failingStep(): Promise<void> {
        throw new Error('Step failed');
      }

      async run(): Promise<void> {
        await this.failingStep();
      }
    }

    const wf = new FailingWorkflow();

    await expect(wf.run()).rejects.toMatchObject({
      message: 'Step failed',
      workflowId: wf.id,
    });
  });
});

describe('@ObservedState decorator', () => {
  class StateTestWorkflow extends Workflow {
    @ObservedState()
    publicField: string = 'public';

    @ObservedState({ redact: true })
    secretField: string = 'secret';

    @ObservedState({ hidden: true })
    hiddenField: string = 'hidden';

    async run(): Promise<void> {}
  }

  it('should include public fields in snapshot', () => {
    const wf = new StateTestWorkflow();
    const state = getObservedState(wf);
    expect(state.publicField).toBe('public');
  });

  it('should redact secret fields', () => {
    const wf = new StateTestWorkflow();
    const state = getObservedState(wf);
    expect(state.secretField).toBe('***');
  });

  it('should exclude hidden fields', () => {
    const wf = new StateTestWorkflow();
    const state = getObservedState(wf);
    expect('hiddenField' in state).toBe(false);
  });
});
