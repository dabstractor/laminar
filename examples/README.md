# Laminar Workflow Engine - Examples

Comprehensive examples showcasing all features and configuration options of the Laminar hierarchical workflow engine.

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run all examples
npm run start:all

# Or run individual examples
npm run start:basic
npm run start:decorators
npm run start:parent-child
npm run start:observers
npm run start:errors
npm run start:concurrent
```

## Examples Overview

### 1. Basic Workflow (`01-basic-workflow.ts`)

Core workflow concepts:
- Creating workflows by extending `Workflow` base class
- Using `WorkflowLogger` for structured logging
- Managing workflow status (`idle` → `running` → `completed`/`failed`)
- Using `WorkflowTreeDebugger` for visualization

### 2. Decorator Options (`02-decorator-options.ts`)

All decorator configuration options:

**@Step options:**
- `name` - Custom step name (defaults to method name)
- `snapshotState` - Capture state after step completion
- `trackTiming` - Track and emit step duration
- `logStart` - Log message at step start
- `logFinish` - Log message at step end

**@Task options:**
- `name` - Custom task name
- `concurrent` - Run returned workflows concurrently

**@ObservedState options:**
- `hidden` - Exclude from state snapshots
- `redact` - Show as `***` in snapshots (for sensitive data)

### 3. Parent-Child Workflows (`03-parent-child.ts`)

Hierarchical workflow structures:
- Multi-level workflow hierarchies
- Automatic parent-child attachment
- `@Task` decorator for spawning child workflows
- Event propagation from children to root
- Tree visualization of nested structures

### 4. Observers & Debugger (`04-observers-debugger.ts`)

Real-time monitoring and debugging:
- Implementing custom `WorkflowObserver`
- `MetricsObserver` for collecting statistics
- `ConsoleObserver` for real-time logging
- `Observable` event stream subscription
- `WorkflowTreeDebugger` complete API

### 5. Error Handling (`05-error-handling.ts`)

Error management patterns:
- `WorkflowError` structure with full context
- State snapshots preserved at error time
- Error events emitted to observers
- Retry patterns with backoff
- Error isolation in parent-child workflows

### 6. Concurrent Tasks (`06-concurrent-tasks.ts`)

Parallel execution patterns:
- Sequential vs concurrent comparison
- `@Task({ concurrent: true })` option
- Manual `Promise.all` patterns
- Fan-out / fan-in architecture
- Performance benchmarks

## Project Structure

```
workflow-examples/
├── src/
│   ├── examples/
│   │   ├── 01-basic-workflow.ts
│   │   ├── 02-decorator-options.ts
│   │   ├── 03-parent-child.ts
│   │   ├── 04-observers-debugger.ts
│   │   ├── 05-error-handling.ts
│   │   └── 06-concurrent-tasks.ts
│   ├── utils/
│   │   └── helpers.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Key Concepts

### Workflow Status Lifecycle

```
idle → running → completed
                ↘ failed
                ↘ cancelled
```

### Event Types

| Event Type | Description |
|------------|-------------|
| `stepStart` | Step execution started |
| `stepEnd` | Step completed (includes duration) |
| `taskStart` | Task execution started |
| `taskEnd` | Task completed |
| `childAttached` | Child workflow attached to parent |
| `stateSnapshot` | State snapshot captured |
| `error` | Error occurred |
| `treeUpdated` | Tree structure changed |

### Tree Visualization Symbols

| Symbol | Status |
|--------|--------|
| ○ | idle |
| ◐ | running |
| ✓ | completed |
| ✗ | failed |
| ⊘ | cancelled |

## Usage Patterns

### Basic Workflow
```typescript
class MyWorkflow extends Workflow {
  async run(): Promise<void> {
    this.setStatus('running');
    this.logger.info('Starting workflow');
    // ... workflow logic
    this.setStatus('completed');
  }
}
```

### Step with All Options
```typescript
@Step({
  name: 'CustomStepName',
  snapshotState: true,
  trackTiming: true,
  logStart: true,
  logFinish: true,
})
async myStep(): Promise<void> {
  // Step logic
}
```

### Observable State
```typescript
@ObservedState()
publicField: string = 'visible';

@ObservedState({ redact: true })
apiKey: string = 'secret';

@ObservedState({ hidden: true })
internalState: object = {};
```

### Concurrent Child Workflows
```typescript
@Task({ concurrent: true })
async createWorkers(): Promise<WorkerWorkflow[]> {
  return items.map(item => new WorkerWorkflow(item, this));
}
```

## License

MIT
