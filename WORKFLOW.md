# Workflows

Workflows are hierarchical task containers with built-in logging, state observation, and event emission.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Decorators](#decorators)
- [Parent-Child Workflows](#parent-child-workflows)
- [Observers](#observers)
- [Tree Debugger](#tree-debugger)
- [Error Handling](#error-handling)
- [Concurrent Execution](#concurrent-execution)

## Basic Usage

Extend `Workflow` and implement `run()`:

```typescript
import { Workflow } from 'laminar';

class DataProcessor extends Workflow {
  async run(): Promise<string[]> {
    this.setStatus('running');
    this.logger.info('Processing started');

    const result = await this.processData();

    this.setStatus('completed');
    return result;
  }

  private async processData(): Promise<string[]> {
    return ['item1', 'item2'];
  }
}

const workflow = new DataProcessor('MyProcessor');
const result = await workflow.run();
```

### Workflow Status

```
idle -> running -> completed
                -> failed
                -> cancelled
```

### Logger

Every workflow has a built-in logger:

```typescript
this.logger.debug('Debug message', { data });
this.logger.info('Info message');
this.logger.warn('Warning message');
this.logger.error('Error message', { error });
```

## Decorators

### @Step

Wraps methods with event emission and error handling.

```typescript
import { Step } from 'laminar';

class MyWorkflow extends Workflow {
  // Default - emits stepStart/stepEnd events
  @Step()
  async basicStep(): Promise<void> {}

  // Custom name
  @Step({ name: 'CustomStepName' })
  async namedStep(): Promise<void> {}

  // Capture state after completion
  @Step({ snapshotState: true })
  async snapshotStep(): Promise<void> {}

  // Track execution duration
  @Step({ trackTiming: true })
  async timedStep(): Promise<void> {}

  // Log start/end messages
  @Step({ logStart: true, logFinish: true })
  async loggedStep(): Promise<void> {}

  // All options
  @Step({
    name: 'FullStep',
    snapshotState: true,
    trackTiming: true,
    logStart: true,
    logFinish: true,
  })
  async fullStep(): Promise<void> {}

  async run(): Promise<void> {
    await this.basicStep();
  }
}
```

### @Task

Wraps methods that return child workflows.

```typescript
import { Task } from 'laminar';

class ParentWorkflow extends Workflow {
  // Basic - attaches returned workflow as child
  @Task()
  async createChild(): Promise<ChildWorkflow> {
    return new ChildWorkflow('Child', this);
  }

  // Custom name
  @Task({ name: 'SpawnWorker' })
  async spawnWorker(): Promise<WorkerWorkflow> {
    return new WorkerWorkflow('Worker', this);
  }

  // Concurrent - runs all returned workflows in parallel
  @Task({ concurrent: true })
  async createWorkers(): Promise<WorkerWorkflow[]> {
    return [
      new WorkerWorkflow('W1', this),
      new WorkerWorkflow('W2', this),
      new WorkerWorkflow('W3', this),
    ];
  }

  async run(): Promise<void> {
    const child = await this.createChild();
    await child.run();
  }
}
```

### @ObservedState

Marks fields for inclusion in state snapshots.

```typescript
import { ObservedState, getObservedState } from 'laminar';

class MyWorkflow extends Workflow {
  // Included in snapshots
  @ObservedState()
  progress = 0;

  // Shown as '***' in snapshots
  @ObservedState({ redact: true })
  apiKey = 'secret';

  // Excluded from snapshots
  @ObservedState({ hidden: true })
  internalState = {};

  async run(): Promise<void> {
    this.progress = 50;

    // Get current state snapshot
    const state = getObservedState(this);
    // { progress: 50, apiKey: '***' }
  }
}
```

## Parent-Child Workflows

Workflows form a hierarchy. Pass the parent to the constructor:

```typescript
class ChildWorkflow extends Workflow {
  async run(): Promise<void> {
    this.setStatus('running');
    this.logger.info('Child executing');
    this.setStatus('completed');
  }
}

class ParentWorkflow extends Workflow {
  @Task()
  async spawnChild(): Promise<ChildWorkflow> {
    return new ChildWorkflow('Child', this); // 'this' is parent
  }

  async run(): Promise<void> {
    this.setStatus('running');

    const child = await this.spawnChild();
    await child.run();

    // Access children
    console.log(this.children.length); // 1

    this.setStatus('completed');
  }
}
```

Events from children propagate to observers on the root workflow.

## Observers

Attach observers to the root workflow to receive all events:

```typescript
import { WorkflowObserver, LogEntry, WorkflowEvent, WorkflowNode } from 'laminar';

const observer: WorkflowObserver = {
  onLog(entry: LogEntry): void {
    console.log(`[${entry.level}] ${entry.message}`);
  },

  onEvent(event: WorkflowEvent): void {
    console.log(`Event: ${event.type}`);
  },

  onStateUpdated(node: WorkflowNode): void {
    console.log(`State updated: ${node.name}`);
  },

  onTreeChanged(root: WorkflowNode): void {
    console.log('Tree structure changed');
  },
};

const workflow = new MyWorkflow('Root');
workflow.addObserver(observer);
await workflow.run();
```

### Event Types

| Type | Description |
|------|-------------|
| `stepStart` | Step execution started |
| `stepEnd` | Step completed, includes `duration` |
| `taskStart` | Task execution started |
| `taskEnd` | Task completed |
| `childAttached` | Child workflow attached |
| `stateSnapshot` | State snapshot captured |
| `error` | Error occurred |
| `treeUpdated` | Tree structure changed |

## Tree Debugger

Visualize workflow execution:

```typescript
import { WorkflowTreeDebugger } from 'laminar';

const workflow = new ParentWorkflow('Root');
const debugger = new WorkflowTreeDebugger(workflow);

await workflow.run();

// ASCII tree
console.log(debugger.toTreeString());
// ✓ Root [completed]
// ├── ✓ Child-1 [completed]
// └── ✓ Child-2 [completed]

// Formatted logs
console.log(debugger.toLogString());

// Statistics
console.log(debugger.getStats());
// { totalNodes: 3, byStatus: { completed: 3 }, totalLogs: 10, totalEvents: 15 }

// Find node by ID
const node = debugger.getNode(workflow.id);

// Subscribe to events
debugger.events.subscribe({
  next: (event) => console.log(event.type),
});
```

### Status Symbols

| Symbol | Status |
|--------|--------|
| ○ | idle |
| ◐ | running |
| ✓ | completed |
| ✗ | failed |
| ⊘ | cancelled |

## Error Handling

Errors in `@Step` methods are wrapped in `WorkflowError` with full context:

```typescript
import { WorkflowError } from 'laminar';

class MyWorkflow extends Workflow {
  @ObservedState()
  currentItem = '';

  @Step({ snapshotState: true })
  async process(): Promise<void> {
    this.currentItem = 'item-1';
    throw new Error('Processing failed');
  }

  async run(): Promise<void> {
    try {
      await this.process();
    } catch (error) {
      const wfError = error as WorkflowError;

      console.log(wfError.message);     // 'Processing failed'
      console.log(wfError.workflowId);  // workflow ID
      console.log(wfError.state);       // { currentItem: 'item-1' }
      console.log(wfError.logs);        // logs up to error
      console.log(wfError.stack);       // stack trace
    }
  }
}
```

### Retry Pattern

```typescript
class RetryWorkflow extends Workflow {
  @ObservedState()
  attempt = 0;

  @Step()
  async unreliableOperation(): Promise<void> {
    this.attempt++;
    if (this.attempt < 3) {
      throw new Error('Temporary failure');
    }
  }

  async run(): Promise<void> {
    const maxAttempts = 3;

    while (this.attempt < maxAttempts) {
      try {
        await this.unreliableOperation();
        break;
      } catch (error) {
        if (this.attempt >= maxAttempts) throw error;
        await this.delay(1000 * this.attempt); // backoff
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
```

### Error Isolation

Parent workflows can catch and handle child errors:

```typescript
class ResilientParent extends Workflow {
  async run(): Promise<void> {
    for (const config of this.childConfigs) {
      const child = new ChildWorkflow(config, this);

      try {
        await child.run();
      } catch (error) {
        this.logger.warn(`Child failed: ${error.message}`);
        // Continue with other children
      }
    }
  }
}
```

## Concurrent Execution

### Sequential (default)

```typescript
for (const item of items) {
  const worker = await this.createWorker(item);
  await worker.run(); // waits for each
}
```

### Parallel with @Task

```typescript
@Task({ concurrent: true })
async createWorkers(): Promise<Worker[]> {
  return items.map(item => new Worker(item, this));
}

// All workers run in parallel when method completes
```

### Manual Parallel

```typescript
const workers = await Promise.all(
  items.map(item => this.createWorker(item))
);

const results = await Promise.all(
  workers.map(w => w.run())
);
```

### Fan-Out / Fan-In

```typescript
class Pipeline extends Workflow {
  @Step()
  async fanOut(): Promise<string[]> {
    const workers = this.items.map(
      item => new Worker(item, this)
    );

    // Run all in parallel
    return Promise.all(workers.map(w => w.run()));
  }

  @Step()
  async fanIn(results: string[]): Promise<void> {
    this.aggregatedResult = results.join(',');
  }

  async run(): Promise<void> {
    const results = await this.fanOut();
    await this.fanIn(results);
  }
}
```

## API Reference

### Workflow

```typescript
abstract class Workflow {
  readonly id: string;
  parent: Workflow | null;
  children: Workflow[];
  status: WorkflowStatus;

  constructor(name?: string, parent?: Workflow);

  abstract run(...args: unknown[]): Promise<unknown>;

  protected setStatus(status: WorkflowStatus): void;
  protected readonly logger: WorkflowLogger;

  addObserver(observer: WorkflowObserver): void;
  removeObserver(observer: WorkflowObserver): void;
  attachChild(child: Workflow): void;
  snapshotState(): void;
  getNode(): WorkflowNode;
}
```

### Types

```typescript
type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  id: string;
  workflowId: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: unknown;
  parentLogId?: string;
}

interface WorkflowError {
  message: string;
  original: unknown;
  workflowId: string;
  stack?: string;
  state: Record<string, unknown>;
  logs: LogEntry[];
}

interface WorkflowNode {
  id: string;
  name: string;
  parent: WorkflowNode | null;
  children: WorkflowNode[];
  status: WorkflowStatus;
  logs: LogEntry[];
  events: WorkflowEvent[];
  stateSnapshot: Record<string, unknown> | null;
}
```
