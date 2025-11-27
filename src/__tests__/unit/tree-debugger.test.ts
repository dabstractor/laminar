import { describe, it, expect } from 'vitest';
import { Workflow, WorkflowTreeDebugger } from '../../index.js';

class DebugTestWorkflow extends Workflow {
  async run(): Promise<void> {
    this.setStatus('completed');
  }
}

describe('WorkflowTreeDebugger', () => {
  it('should render tree string', () => {
    const wf = new DebugTestWorkflow('Root');
    const debugger_ = new WorkflowTreeDebugger(wf);

    const tree = debugger_.toTreeString();
    expect(tree).toContain('Root');
    expect(tree).toContain('[idle]');
  });

  it('should show child nodes in tree', () => {
    const parent = new DebugTestWorkflow('Parent');
    const child1 = new DebugTestWorkflow('Child1', parent);
    const child2 = new DebugTestWorkflow('Child2', parent);

    const debugger_ = new WorkflowTreeDebugger(parent);
    const tree = debugger_.toTreeString();

    expect(tree).toContain('Parent');
    expect(tree).toContain('Child1');
    expect(tree).toContain('Child2');
    expect(tree).toContain('├──');
    expect(tree).toContain('└──');
  });

  it('should find node by ID', () => {
    const parent = new DebugTestWorkflow('Parent');
    const child = new DebugTestWorkflow('Child', parent);

    const debugger_ = new WorkflowTreeDebugger(parent);

    expect(debugger_.getNode(parent.id)).toBe(parent.getNode());
    expect(debugger_.getNode(child.id)).toBe(child.getNode());
    expect(debugger_.getNode('nonexistent')).toBeUndefined();
  });

  it('should collect logs from all nodes', async () => {
    const parent = new DebugTestWorkflow('Parent');
    const child = new DebugTestWorkflow('Child', parent);

    const debugger_ = new WorkflowTreeDebugger(parent);

    // Add some logs manually
    parent.getNode().logs.push({
      id: '1',
      workflowId: parent.id,
      timestamp: Date.now(),
      level: 'info',
      message: 'Parent log',
    });

    child.getNode().logs.push({
      id: '2',
      workflowId: child.id,
      timestamp: Date.now(),
      level: 'info',
      message: 'Child log',
    });

    const logString = debugger_.toLogString();
    expect(logString).toContain('Parent log');
    expect(logString).toContain('Child log');
  });

  it('should return stats', () => {
    const parent = new DebugTestWorkflow('Parent');
    new DebugTestWorkflow('Child1', parent);
    new DebugTestWorkflow('Child2', parent);

    const debugger_ = new WorkflowTreeDebugger(parent);
    const stats = debugger_.getStats();

    expect(stats.totalNodes).toBe(3);
    expect(stats.byStatus.idle).toBe(3);
  });
});
