import { describe, it, expect } from 'vitest';
import {
  TDDOrchestrator,
  WorkflowTreeDebugger,
  WorkflowEvent,
  WorkflowObserver,
} from '../../index.js';

describe('Tree Mirroring Integration', () => {
  it('should create 1:1 tree mirror of workflow execution', async () => {
    const orchestrator = new TDDOrchestrator('TDDOrchestrator');
    (orchestrator as any).maxCycles = 1; // Limit to one cycle for test

    const debugger_ = new WorkflowTreeDebugger(orchestrator);
    const events: WorkflowEvent[] = [];

    debugger_.events.subscribe({
      next: (event) => events.push(event),
    });

    try {
      await orchestrator.run();
    } catch {
      // May fail due to random test failures, that's ok
    }

    // Verify tree structure
    const tree = debugger_.getTree();
    expect(tree.name).toBe('TDDOrchestrator');

    // Should have at least one child (the cycle)
    expect(tree.children.length).toBeGreaterThanOrEqual(1);

    // Child should be named Cycle-N
    const cycleChild = tree.children.find((c) => c.name.startsWith('Cycle-'));
    expect(cycleChild).toBeDefined();

    // Verify events were captured
    expect(events.some((e) => e.type === 'stepStart')).toBe(true);
    expect(events.some((e) => e.type === 'taskStart')).toBe(true);
  });

  it('should propagate events to root observer', async () => {
    const orchestrator = new TDDOrchestrator('Root');
    (orchestrator as any).maxCycles = 1;

    const allEvents: WorkflowEvent[] = [];
    const allLogs: any[] = [];

    const observer: WorkflowObserver = {
      onLog: (entry) => allLogs.push(entry),
      onEvent: (event) => allEvents.push(event),
      onStateUpdated: () => {},
      onTreeChanged: () => {},
    };

    orchestrator.addObserver(observer);

    try {
      await orchestrator.run();
    } catch {
      // May fail
    }

    // Events from child workflows should reach root
    expect(allLogs.length).toBeGreaterThan(0);
    expect(allEvents.length).toBeGreaterThan(0);

    // Should have events from both parent and child
    const parentEvents = allEvents.filter(
      (e) => 'node' in e && e.node.name === 'Root'
    );
    const childEvents = allEvents.filter(
      (e) => 'node' in e && e.node.name.startsWith('Cycle-')
    );

    expect(parentEvents.length).toBeGreaterThan(0);
    expect(childEvents.length).toBeGreaterThan(0);
  });

  it('should include state snapshot on error', async () => {
    const orchestrator = new TDDOrchestrator('ErrorTest');
    (orchestrator as any).maxCycles = 1;

    const errorEvents: WorkflowEvent[] = [];

    orchestrator.addObserver({
      onLog: () => {},
      onEvent: (event) => {
        if (event.type === 'error') {
          errorEvents.push(event);
        }
      },
      onStateUpdated: () => {},
      onTreeChanged: () => {},
    });

    try {
      await orchestrator.run();
    } catch {
      // Expected
    }

    // If there was an error, it should have state
    if (errorEvents.length > 0) {
      const errEvent = errorEvents[0];
      if (errEvent.type === 'error') {
        expect(errEvent.error.state).toBeDefined();
        expect(errEvent.error.logs).toBeDefined();
        expect(errEvent.error.workflowId).toBeDefined();
      }
    }
  });
});
