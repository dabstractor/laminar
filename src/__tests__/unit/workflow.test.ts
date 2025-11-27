import { describe, it, expect } from 'vitest';
import { Workflow, WorkflowObserver, WorkflowNode, LogEntry, WorkflowEvent } from '../../index.js';

class SimpleWorkflow extends Workflow {
  async run(): Promise<string> {
    this.setStatus('running');
    this.logger.info('Running simple workflow');
    this.setStatus('completed');
    return 'done';
  }
}

describe('Workflow', () => {
  it('should create with unique id', () => {
    const wf1 = new SimpleWorkflow();
    const wf2 = new SimpleWorkflow();
    expect(wf1.id).not.toBe(wf2.id);
  });

  it('should use class name as default name', () => {
    const wf = new SimpleWorkflow();
    expect(wf.getNode().name).toBe('SimpleWorkflow');
  });

  it('should use custom name when provided', () => {
    const wf = new SimpleWorkflow('CustomName');
    expect(wf.getNode().name).toBe('CustomName');
  });

  it('should start with idle status', () => {
    const wf = new SimpleWorkflow();
    expect(wf.status).toBe('idle');
    expect(wf.getNode().status).toBe('idle');
  });

  it('should attach child to parent', () => {
    const parent = new SimpleWorkflow('Parent');
    const child = new SimpleWorkflow('Child', parent);

    expect(child.parent).toBe(parent);
    expect(parent.children).toContain(child);
    expect(parent.getNode().children).toContain(child.getNode());
  });

  it('should emit logs to observers', async () => {
    const wf = new SimpleWorkflow();
    const logs: LogEntry[] = [];

    const observer: WorkflowObserver = {
      onLog: (entry) => logs.push(entry),
      onEvent: () => {},
      onStateUpdated: () => {},
      onTreeChanged: () => {},
    };

    wf.addObserver(observer);
    await wf.run();

    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].message).toBe('Running simple workflow');
  });

  it('should emit childAttached event', () => {
    const parent = new SimpleWorkflow('Parent');
    const events: WorkflowEvent[] = [];

    const observer: WorkflowObserver = {
      onLog: () => {},
      onEvent: (event) => events.push(event),
      onStateUpdated: () => {},
      onTreeChanged: () => {},
    };

    parent.addObserver(observer);
    const child = new SimpleWorkflow('Child', parent);

    const attachEvent = events.find((e) => e.type === 'childAttached');
    expect(attachEvent).toBeDefined();
    expect(attachEvent?.type === 'childAttached' && attachEvent.parentId).toBe(parent.id);
  });
});
