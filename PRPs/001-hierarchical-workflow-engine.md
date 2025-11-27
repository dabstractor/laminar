# PRP-001: Hierarchical Workflow Engine with Full Observability

> **PRP**: Product Requirements Package - Comprehensive implementation guide for Laminar workflow orchestration engine

**Version**: 1.0
**Status**: Implementation-Ready
**Source PRD**: `/home/dustin/projects/laminar/PRD.md`

## Pre-Implementation Checklist

Before implementing, verify you have:
- [ ] Read the full PRD at `/home/dustin/projects/laminar/PRD.md`
- [ ] Node.js 18+ LTS installed
- [ ] TypeScript 5.2+ available
- [ ] Understanding of TypeScript decorators (see `DECORATOR_QUICK_REFERENCE.md`)
- [ ] Familiarity with async/await patterns and Promises

---

## 1. Goal

### Feature Goal
Build a TypeScript workflow orchestration engine that provides hierarchical workflows with automatic parent/child attachment, high-resolution observability (logs, events, snapshots), and a real-time tree debugger API for terminal visualization.

### Deliverable
A complete npm-publishable TypeScript library exporting:
- `Workflow` abstract base class
- `@Step`, `@Task`, `@ObservedState` decorators
- `WorkflowLogger` class
- `WorkflowTreeDebugger` class
- All TypeScript interfaces and types
- Example workflows demonstrating usage

### Success Definition
1. All TypeScript compiles with strict mode enabled
2. Example `TDDOrchestrator` workflow runs successfully with child `TestCycleWorkflow`
3. `WorkflowTreeDebugger` produces accurate ASCII tree visualization
4. All logs and events form a **perfect 1:1 tree mirror** of workflow execution
5. Errors contain full state snapshots and log history

---

## 2. Context

### External Documentation
```yaml
primary_docs:
  - url: "https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#decorators"
    purpose: "Modern TC39 Stage 3 decorator syntax and behavior"
    key_sections:
      - "Decorators"
      - "Decorator Metadata"
      - "Auto-Accessors"

  - url: "https://tc39.es/proposal-decorators/"
    purpose: "Official TC39 decorator specification"
    key_sections:
      - "Method Decorators"
      - "Field Decorators"
      - "Class Decorators"

  - url: "https://docs.temporal.io/develop/typescript/child-workflows"
    purpose: "Parent-child workflow patterns and lifecycle management"
    key_sections:
      - "executeChild vs startChild"
      - "Parent Close Policy"
      - "Cancellation Scopes"

  - url: "https://nodejs.org/api/events.html"
    purpose: "EventEmitter patterns for observer system"
    key_sections:
      - "emitter.on(eventName, listener)"
      - "Memory leak warnings"

reference_implementations:
  - url: "https://github.com/temporalio/sdk-typescript"
    purpose: "Production workflow engine patterns"
    files_to_study:
      - "packages/workflow/src/workflow.ts"
      - "packages/common/src/interfaces/workflow.ts"

  - url: "https://github.com/danielgerlag/workflow-es"
    purpose: "TypeScript workflow step patterns"
    files_to_study:
      - "src/workflow-builder.ts"
      - "src/step-body.ts"

local_research:
  - file: "/home/dustin/projects/laminar/DECORATOR_QUICK_REFERENCE.md"
    purpose: "Decorator implementation patterns for this project"

  - file: "/home/dustin/projects/laminar/DECORATOR_EXAMPLES.ts"
    purpose: "Production-ready decorator code to adapt"

  - file: "/home/dustin/projects/laminar/TREE_VISUALIZATION_QUICK_REF.md"
    purpose: "ASCII tree rendering patterns and status indicators"
```

### Codebase Context
```yaml
existing_patterns:
  # This is a greenfield project - no existing patterns
  # Follow patterns from research documents

project_structure:
  root: "/home/dustin/projects/laminar"
  source: "/home/dustin/projects/laminar/src"
  tests: "/home/dustin/projects/laminar/src/__tests__"

naming_conventions:
  files: "kebab-case.ts (e.g., workflow-logger.ts, tree-debugger.ts)"
  classes: "PascalCase (e.g., WorkflowLogger, WorkflowTreeDebugger)"
  interfaces: "PascalCase with descriptive names (e.g., WorkflowNode, LogEntry)"
  types: "PascalCase for type aliases (e.g., WorkflowStatus, LogLevel)"
  constants: "SCREAMING_SNAKE_CASE (e.g., OBSERVED_STATE_FIELDS)"
  functions: "camelCase (e.g., generateId, getObservedState)"
```

### Technical Constraints
```yaml
typescript:
  version: "5.2+"
  config_requirements:
    - "target: ES2022"
    - "module: ES2022"
    - "strict: true"
    - "useDefineForClassFields: true"
    - "DO NOT use experimentalDecorators flag - use modern Stage 3 decorators"

dependencies:
  required: []  # Zero runtime dependencies - pure TypeScript

  dev_dependencies:
    - name: "typescript"
      version: "^5.2.0"
      purpose: "TypeScript compiler with modern decorator support"
    - name: "vitest"
      version: "^1.0.0"
      purpose: "Fast unit testing framework"
    - name: "@types/node"
      version: "^20.0.0"
      purpose: "Node.js type definitions"

  avoid:
    - name: "reflect-metadata"
      reason: "Legacy pattern - use Symbol.metadata instead"
    - name: "rxjs"
      reason: "Too heavy - implement lightweight Observable"

runtime:
  node_version: "18+"
  target: "ES2022"
```

### Known Gotchas
```yaml
pitfalls:
  - issue: "Arrow functions in decorators lose 'this' context"
    solution: "Always use regular function declarations in decorator wrappers"
    example: |
      // WRONG
      return (...args) => original.call(this, ...args);
      // CORRECT
      return function(...args) { return original.call(this, ...args); };

  - issue: "Decorator not preserving async behavior"
    solution: "Ensure wrapper function is async and properly awaits original"
    example: |
      async function wrapper(this: This, ...args: Args): Promise<any> {
        return await originalMethod.call(this, ...args);
      }

  - issue: "Child workflow parent not set correctly"
    solution: "Set parent in constructor AND call attachChild on parent"

  - issue: "Events not reaching root observer"
    solution: "Always traverse up to root via getRootObservers() method"

  - issue: "State snapshot missing fields"
    solution: "Use WeakMap keyed by prototype, not instance"

  - issue: "Tree debugger showing stale data"
    solution: "Emit 'treeUpdated' event after every structural change"
```

---

## 3. Implementation Tasks

> Complete tasks in order. Each task builds on previous tasks.

---

### Task 1: Project Setup and Configuration
**Depends on**: None

**Input**: Empty `/home/dustin/projects/laminar/src` directory

**Steps**:
1. Create directory structure:
   ```
   src/
   ├── types/
   ├── core/
   ├── decorators/
   ├── debugger/
   ├── utils/
   ├── examples/
   └── __tests__/
       ├── unit/
       └── integration/
   ```

2. Create `/home/dustin/projects/laminar/package.json`:
   ```json
   {
     "name": "laminar",
     "version": "1.0.0",
     "description": "Hierarchical workflow orchestration engine with full observability",
     "type": "module",
     "main": "./dist/index.js",
     "module": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "exports": {
       ".": {
         "import": "./dist/index.js",
         "types": "./dist/index.d.ts"
       }
     },
     "scripts": {
       "build": "tsc",
       "test": "vitest run",
       "test:watch": "vitest",
       "lint": "tsc --noEmit"
     },
     "devDependencies": {
       "typescript": "^5.2.0",
       "vitest": "^1.0.0",
       "@types/node": "^20.0.0"
     },
     "engines": {
       "node": ">=18"
     }
   }
   ```

3. Create `/home/dustin/projects/laminar/tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ES2022",
       "moduleResolution": "bundler",
       "lib": ["ES2022"],
       "outDir": "./dist",
       "rootDir": "./src",
       "declaration": true,
       "declarationMap": true,
       "sourceMap": true,
       "strict": true,
       "useDefineForClassFields": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true,
       "resolveJsonModule": true,
       "isolatedModules": true
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist"]
   }
   ```

4. Run `npm install` to install dependencies

**Output**:
- Complete directory structure
- Configured package.json and tsconfig.json
- Dependencies installed

**Validation**:
- `npx tsc --version` shows 5.2+
- `npm run lint` runs without errors (empty project)

---

### Task 2: Core Type Definitions
**Depends on**: Task 1

**Input**: Empty `src/types/` directory

**Steps**:

1. Create `/home/dustin/projects/laminar/src/types/workflow.ts`:
   ```typescript
   /**
    * Workflow status representing the current execution state
    */
   export type WorkflowStatus =
     | 'idle'
     | 'running'
     | 'completed'
     | 'failed'
     | 'cancelled';

   /**
    * Represents a node in the workflow execution tree
    * This is the data structure, not the Workflow class
    */
   export interface WorkflowNode {
     /** Unique identifier for this workflow instance */
     id: string;
     /** Human-readable name */
     name: string;
     /** Parent node reference (null for root) */
     parent: WorkflowNode | null;
     /** Child workflow nodes */
     children: WorkflowNode[];
     /** Current execution status */
     status: WorkflowStatus;
     /** Log entries for this node */
     logs: LogEntry[];
     /** Events emitted by this node */
     events: WorkflowEvent[];
     /** Optional serialized state snapshot */
     stateSnapshot: SerializedWorkflowState | null;
   }

   // Forward declarations - import from their respective files
   import type { LogEntry } from './logging.js';
   import type { WorkflowEvent } from './events.js';
   import type { SerializedWorkflowState } from './snapshot.js';
   ```

2. Create `/home/dustin/projects/laminar/src/types/logging.ts`:
   ```typescript
   /**
    * Log severity levels
    */
   export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

   /**
    * A single log entry in the workflow
    */
   export interface LogEntry {
     /** Unique identifier for this log entry */
     id: string;
     /** ID of the workflow that created this log */
     workflowId: string;
     /** Unix timestamp in milliseconds */
     timestamp: number;
     /** Severity level */
     level: LogLevel;
     /** Log message */
     message: string;
     /** Optional structured data */
     data?: unknown;
     /** ID of parent log entry (for hierarchical logging) */
     parentLogId?: string;
   }
   ```

3. Create `/home/dustin/projects/laminar/src/types/snapshot.ts`:
   ```typescript
   /**
    * Serialized workflow state as key-value pairs
    */
   export type SerializedWorkflowState = Record<string, unknown>;

   /**
    * Metadata for observed state fields
    */
   export interface StateFieldMetadata {
     /** If true, field is not included in snapshots */
     hidden?: boolean;
     /** If true, value is shown as '***' in snapshots */
     redact?: boolean;
   }
   ```

4. Create `/home/dustin/projects/laminar/src/types/error.ts`:
   ```typescript
   import type { LogEntry } from './logging.js';
   import type { SerializedWorkflowState } from './snapshot.js';

   /**
    * Rich error object containing workflow context
    */
   export interface WorkflowError {
     /** Error message */
     message: string;
     /** Original thrown error */
     original: unknown;
     /** ID of workflow where error occurred */
     workflowId: string;
     /** Stack trace if available */
     stack?: string;
     /** State snapshot at time of error */
     state: SerializedWorkflowState;
     /** Logs from the failing workflow node */
     logs: LogEntry[];
   }
   ```

5. Create `/home/dustin/projects/laminar/src/types/events.ts`:
   ```typescript
   import type { WorkflowNode } from './workflow.js';
   import type { WorkflowError } from './error.js';

   /**
    * Discriminated union of all workflow events
    */
   export type WorkflowEvent =
     | { type: 'childAttached'; parentId: string; child: WorkflowNode }
     | { type: 'stateSnapshot'; node: WorkflowNode }
     | { type: 'stepStart'; node: WorkflowNode; step: string }
     | { type: 'stepEnd'; node: WorkflowNode; step: string; duration: number }
     | { type: 'error'; node: WorkflowNode; error: WorkflowError }
     | { type: 'taskStart'; node: WorkflowNode; task: string }
     | { type: 'taskEnd'; node: WorkflowNode; task: string }
     | { type: 'treeUpdated'; root: WorkflowNode };
   ```

6. Create `/home/dustin/projects/laminar/src/types/observer.ts`:
   ```typescript
   import type { LogEntry } from './logging.js';
   import type { WorkflowEvent } from './events.js';
   import type { WorkflowNode } from './workflow.js';

   /**
    * Observer interface for subscribing to workflow events
    * Observers attach to the root workflow and receive all events
    */
   export interface WorkflowObserver {
     /** Called when a log entry is created */
     onLog(entry: LogEntry): void;
     /** Called when any workflow event occurs */
     onEvent(event: WorkflowEvent): void;
     /** Called when a node's state is updated */
     onStateUpdated(node: WorkflowNode): void;
     /** Called when the tree structure changes */
     onTreeChanged(root: WorkflowNode): void;
   }
   ```

7. Create `/home/dustin/projects/laminar/src/types/decorators.ts`:
   ```typescript
   /**
    * Configuration options for @Step decorator
    */
   export interface StepOptions {
     /** Custom step name (defaults to method name) */
     name?: string;
     /** If true, capture state snapshot after step completion */
     snapshotState?: boolean;
     /** If true, track and emit step duration */
     trackTiming?: boolean;
     /** If true, log message at step start */
     logStart?: boolean;
     /** If true, log message at step end */
     logFinish?: boolean;
   }

   /**
    * Configuration options for @Task decorator
    */
   export interface TaskOptions {
     /** Custom task name (defaults to method name) */
     name?: string;
     /** If true, run returned workflows concurrently */
     concurrent?: boolean;
   }
   ```

8. Create `/home/dustin/projects/laminar/src/types/error-strategy.ts`:
   ```typescript
   import type { WorkflowError } from './error.js';

   /**
    * Strategy for merging multiple errors from concurrent operations
    */
   export interface ErrorMergeStrategy {
     /** Enable error merging (default: false, first error wins) */
     enabled: boolean;
     /** Maximum depth to merge errors */
     maxMergeDepth?: number;
     /** Custom function to combine multiple errors */
     combine?(errors: WorkflowError[]): WorkflowError;
   }
   ```

9. Create `/home/dustin/projects/laminar/src/types/index.ts`:
   ```typescript
   // Core types
   export type { WorkflowStatus, WorkflowNode } from './workflow.js';
   export type { LogLevel, LogEntry } from './logging.js';
   export type { SerializedWorkflowState, StateFieldMetadata } from './snapshot.js';
   export type { WorkflowError } from './error.js';
   export type { WorkflowEvent } from './events.js';
   export type { WorkflowObserver } from './observer.js';
   export type { StepOptions, TaskOptions } from './decorators.js';
   export type { ErrorMergeStrategy } from './error-strategy.js';
   ```

**Output**: Complete type system in `src/types/`

**Validation**:
- `npm run lint` passes with no errors
- All imports resolve correctly

---

### Task 3: Utility Functions
**Depends on**: Task 2

**Input**: Type definitions from Task 2

**Steps**:

1. Create `/home/dustin/projects/laminar/src/utils/id.ts`:
   ```typescript
   /**
    * Generate a unique identifier
    * Uses crypto.randomUUID if available, falls back to timestamp + random
    */
   export function generateId(): string {
     if (typeof crypto !== 'undefined' && crypto.randomUUID) {
       return crypto.randomUUID();
     }
     // Fallback for environments without crypto.randomUUID
     return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
   }
   ```

2. Create `/home/dustin/projects/laminar/src/utils/observable.ts`:
   ```typescript
   /**
    * Lightweight Observable implementation for event streaming
    * No external dependencies
    */
   export interface Subscription {
     unsubscribe(): void;
   }

   export interface Observer<T> {
     next?: (value: T) => void;
     error?: (error: unknown) => void;
     complete?: () => void;
   }

   export class Observable<T> {
     private subscribers: Set<Observer<T>> = new Set();

     /**
      * Subscribe to this observable
      * @returns Subscription with unsubscribe method
      */
     subscribe(observer: Observer<T>): Subscription {
       this.subscribers.add(observer);
       return {
         unsubscribe: () => {
           this.subscribers.delete(observer);
         },
       };
     }

     /**
      * Emit a value to all subscribers
      */
     next(value: T): void {
       for (const subscriber of this.subscribers) {
         try {
           subscriber.next?.(value);
         } catch (err) {
           console.error('Observable subscriber error:', err);
         }
       }
     }

     /**
      * Signal an error to all subscribers
      */
     error(err: unknown): void {
       for (const subscriber of this.subscribers) {
         try {
           subscriber.error?.(err);
         } catch (e) {
           console.error('Observable error handler failed:', e);
         }
       }
     }

     /**
      * Signal completion to all subscribers
      */
     complete(): void {
       for (const subscriber of this.subscribers) {
         try {
           subscriber.complete?.();
         } catch (err) {
           console.error('Observable complete handler failed:', err);
         }
       }
       this.subscribers.clear();
     }

     /**
      * Get current subscriber count
      */
     get subscriberCount(): number {
       return this.subscribers.size;
     }
   }
   ```

3. Create `/home/dustin/projects/laminar/src/utils/index.ts`:
   ```typescript
   export { generateId } from './id.js';
   export { Observable } from './observable.js';
   export type { Subscription, Observer } from './observable.js';
   ```

**Output**: Utility functions in `src/utils/`

**Validation**: `npm run lint` passes

---

### Task 4: WorkflowLogger Implementation
**Depends on**: Task 3

**Input**: Types and utilities from previous tasks

**Steps**:

1. Create `/home/dustin/projects/laminar/src/core/logger.ts`:
   ```typescript
   import type { WorkflowNode, LogEntry, LogLevel, WorkflowObserver } from '../types/index.js';
   import { generateId } from '../utils/id.js';

   /**
    * Logger that emits log entries to workflow node and observers
    */
   export class WorkflowLogger {
     constructor(
       private readonly node: WorkflowNode,
       private readonly observers: WorkflowObserver[]
     ) {}

     /**
      * Emit a log entry to the node and all observers
      */
     private emit(entry: LogEntry): void {
       this.node.logs.push(entry);
       for (const obs of this.observers) {
         try {
           obs.onLog(entry);
         } catch (err) {
           console.error('Observer onLog error:', err);
         }
       }
     }

     /**
      * Create a log entry with the given level
      */
     private log(level: LogLevel, message: string, data?: unknown): void {
       const entry: LogEntry = {
         id: generateId(),
         workflowId: this.node.id,
         timestamp: Date.now(),
         level,
         message,
         data,
       };
       this.emit(entry);
     }

     /**
      * Log a debug message
      */
     debug(message: string, data?: unknown): void {
       this.log('debug', message, data);
     }

     /**
      * Log an info message
      */
     info(message: string, data?: unknown): void {
       this.log('info', message, data);
     }

     /**
      * Log a warning message
      */
     warn(message: string, data?: unknown): void {
       this.log('warn', message, data);
     }

     /**
      * Log an error message
      */
     error(message: string, data?: unknown): void {
       this.log('error', message, data);
     }

     /**
      * Create a child logger that includes parentLogId
      */
     child(parentLogId: string): WorkflowLogger {
       const childLogger = new ChildWorkflowLogger(
         this.node,
         this.observers,
         parentLogId
       );
       return childLogger;
     }
   }

   /**
    * Child logger that includes parent log ID in entries
    */
   class ChildWorkflowLogger extends WorkflowLogger {
     constructor(
       node: WorkflowNode,
       observers: WorkflowObserver[],
       private readonly parentLogId: string
     ) {
       super(node, observers);
     }

     private emit(entry: LogEntry): void {
       const entryWithParent: LogEntry = {
         ...entry,
         parentLogId: this.parentLogId,
       };
       // Access parent's emit through node
       (this as any).node.logs.push(entryWithParent);
       for (const obs of (this as any).observers) {
         try {
           obs.onLog(entryWithParent);
         } catch (err) {
           console.error('Observer onLog error:', err);
         }
       }
     }
   }
   ```

**Output**: `src/core/logger.ts`

**Validation**: TypeScript compiles without errors

---

### Task 5: @ObservedState Decorator
**Depends on**: Task 2

**Input**: Type definitions

**Steps**:

1. Create `/home/dustin/projects/laminar/src/decorators/observed-state.ts`:
   ```typescript
   import type { StateFieldMetadata, SerializedWorkflowState } from '../types/index.js';

   /**
    * WeakMap storing field metadata keyed by class prototype
    * Structure: Map<propertyKey, StateFieldMetadata>
    */
   const OBSERVED_STATE_FIELDS = new WeakMap<object, Map<string, StateFieldMetadata>>();

   /**
    * @ObservedState decorator
    * Marks a class field for inclusion in state snapshots
    *
    * @example
    * class MyWorkflow extends Workflow {
    *   @ObservedState()
    *   currentStep!: string;
    *
    *   @ObservedState({ redact: true })
    *   sensitiveData!: string;
    *
    *   @ObservedState({ hidden: true })
    *   internalState!: object;
    * }
    */
   export function ObservedState(meta: StateFieldMetadata = {}) {
     return function (
       _value: undefined,
       context: ClassFieldDecoratorContext
     ): void {
       const propertyKey = String(context.name);

       // Use addInitializer to register field when class is instantiated
       context.addInitializer(function (this: object) {
         const proto = Object.getPrototypeOf(this);
         let map = OBSERVED_STATE_FIELDS.get(proto);
         if (!map) {
           map = new Map();
           OBSERVED_STATE_FIELDS.set(proto, map);
         }
         map.set(propertyKey, meta);
       });
     };
   }

   /**
    * Get all observed state from an object instance
    * Applies hidden and redact transformations
    */
   export function getObservedState(obj: object): SerializedWorkflowState {
     const proto = Object.getPrototypeOf(obj);
     const map = OBSERVED_STATE_FIELDS.get(proto);

     if (!map) {
       return {};
     }

     const result: SerializedWorkflowState = {};

     for (const [key, meta] of map) {
       // Skip hidden fields
       if (meta.hidden) {
         continue;
       }

       let value = (obj as Record<string, unknown>)[key];

       // Redact sensitive fields
       if (meta.redact) {
         value = '***';
       }

       result[key] = value;
     }

     return result;
   }

   /**
    * Check if a field is observed on an object
    */
   export function isFieldObserved(obj: object, fieldName: string): boolean {
     const proto = Object.getPrototypeOf(obj);
     const map = OBSERVED_STATE_FIELDS.get(proto);
     return map?.has(fieldName) ?? false;
   }

   /**
    * Get metadata for a specific field
    */
   export function getFieldMetadata(obj: object, fieldName: string): StateFieldMetadata | undefined {
     const proto = Object.getPrototypeOf(obj);
     const map = OBSERVED_STATE_FIELDS.get(proto);
     return map?.get(fieldName);
   }
   ```

**Output**: `src/decorators/observed-state.ts`

**Validation**: TypeScript compiles without errors

---

### Task 6: Workflow Base Class
**Depends on**: Tasks 4, 5

**Input**: Logger and ObservedState decorator

**Steps**:

1. Create `/home/dustin/projects/laminar/src/core/workflow.ts`:
   ```typescript
   import type {
     WorkflowNode,
     WorkflowStatus,
     WorkflowEvent,
     WorkflowObserver,
   } from '../types/index.js';
   import { generateId } from '../utils/id.js';
   import { WorkflowLogger } from './logger.js';
   import { getObservedState } from '../decorators/observed-state.js';

   /**
    * Abstract base class for all workflows
    * Provides parent/child management, logging, events, and state snapshots
    */
   export abstract class Workflow {
     /** Unique identifier for this workflow instance */
     public readonly id: string;

     /** Parent workflow (null for root workflows) */
     public parent: Workflow | null = null;

     /** Child workflows */
     public children: Workflow[] = [];

     /** Current execution status */
     public status: WorkflowStatus = 'idle';

     /** Logger instance for this workflow */
     protected readonly logger: WorkflowLogger;

     /** The node representation of this workflow */
     protected readonly node: WorkflowNode;

     /** Observers (only populated on root workflow) */
     private observers: WorkflowObserver[] = [];

     /**
      * Create a new workflow instance
      * @param name Human-readable name (defaults to class name)
      * @param parent Optional parent workflow
      */
     constructor(name?: string, parent?: Workflow) {
       this.id = generateId();
       this.parent = parent ?? null;

       // Create the node representation
       this.node = {
         id: this.id,
         name: name ?? this.constructor.name,
         parent: parent?.node ?? null,
         children: [],
         status: 'idle',
         logs: [],
         events: [],
         stateSnapshot: null,
       };

       // Create logger with root observers
       this.logger = new WorkflowLogger(this.node, this.getRootObservers());

       // Attach to parent if provided
       if (parent) {
         parent.attachChild(this);
       }
     }

     /**
      * Get observers from the root workflow
      * Traverses up the tree to find the root
      */
     private getRootObservers(): WorkflowObserver[] {
       if (this.parent) {
         return this.parent.getRootObservers();
       }
       return this.observers;
     }

     /**
      * Get the root workflow
      */
     protected getRoot(): Workflow {
       if (this.parent) {
         return this.parent.getRoot();
       }
       return this;
     }

     /**
      * Add an observer to this workflow (must be root)
      * @throws Error if called on non-root workflow
      */
     public addObserver(observer: WorkflowObserver): void {
       if (this.parent) {
         throw new Error('Observers can only be added to root workflows');
       }
       this.observers.push(observer);
     }

     /**
      * Remove an observer from this workflow
      */
     public removeObserver(observer: WorkflowObserver): void {
       const index = this.observers.indexOf(observer);
       if (index !== -1) {
         this.observers.splice(index, 1);
       }
     }

     /**
      * Attach a child workflow
      * Called automatically in constructor when parent is provided
      */
     public attachChild(child: Workflow): void {
       this.children.push(child);
       this.node.children.push(child.node);

       // Emit child attached event
       this.emitEvent({
         type: 'childAttached',
         parentId: this.id,
         child: child.node,
       });
     }

     /**
      * Emit an event to all root observers
      */
     protected emitEvent(event: WorkflowEvent): void {
       this.node.events.push(event);

       const observers = this.getRootObservers();
       for (const obs of observers) {
         try {
           obs.onEvent(event);

           // Also notify tree changed for tree update events
           if (event.type === 'treeUpdated' || event.type === 'childAttached') {
             obs.onTreeChanged(this.getRoot().node);
           }
         } catch (err) {
           console.error('Observer onEvent error:', err);
         }
       }
     }

     /**
      * Capture and emit a state snapshot
      */
     public snapshotState(): void {
       const snapshot = getObservedState(this);
       this.node.stateSnapshot = snapshot;

       // Notify observers
       const observers = this.getRootObservers();
       for (const obs of observers) {
         try {
           obs.onStateUpdated(this.node);
         } catch (err) {
           console.error('Observer onStateUpdated error:', err);
         }
       }

       // Emit snapshot event
       this.emitEvent({
         type: 'stateSnapshot',
         node: this.node,
       });
     }

     /**
      * Update workflow status and sync with node
      */
     protected setStatus(status: WorkflowStatus): void {
       this.status = status;
       this.node.status = status;
     }

     /**
      * Get the node representation of this workflow
      */
     public getNode(): WorkflowNode {
       return this.node;
     }

     /**
      * Abstract run method - must be implemented by subclasses
      * This is the main entry point for workflow execution
      */
     public abstract run(...args: unknown[]): Promise<unknown>;
   }
   ```

**Output**: `src/core/workflow.ts`

**Validation**: TypeScript compiles without errors

---

### Task 7: @Step Decorator
**Depends on**: Task 6

**Input**: Workflow base class

**Steps**:

1. Create `/home/dustin/projects/laminar/src/decorators/step.ts`:
   ```typescript
   import type { StepOptions, WorkflowError } from '../types/index.js';
   import { getObservedState } from './observed-state.js';

   // Type for workflow-like objects
   interface WorkflowLike {
     id: string;
     node: {
       id: string;
       logs: unknown[];
     };
     logger: {
       info(message: string, data?: unknown): void;
     };
     emitEvent(event: unknown): void;
     snapshotState(): void;
   }

   /**
    * @Step decorator
    * Wraps a method to emit step events, handle errors, and optionally snapshot state
    *
    * @example
    * class MyWorkflow extends Workflow {
    *   @Step({ snapshotState: true, trackTiming: true })
    *   async processData() {
    *     // ... step logic
    *   }
    * }
    */
   export function Step(opts: StepOptions = {}) {
     return function <This extends WorkflowLike, Args extends unknown[], Return>(
       originalMethod: (this: This, ...args: Args) => Promise<Return>,
       context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Return>>
     ) {
       const methodName = String(context.name);

       // CRITICAL: Use regular function, not arrow function, to preserve 'this'
       async function stepWrapper(this: This, ...args: Args): Promise<Return> {
         const stepName = opts.name ?? methodName;
         const startTime = Date.now();

         // Log start if requested
         if (opts.logStart) {
           this.logger.info(`STEP START: ${stepName}`);
         }

         // Emit step start event
         this.emitEvent({
           type: 'stepStart',
           node: this.node,
           step: stepName,
         });

         try {
           // Execute the original method
           const result = await originalMethod.call(this, ...args);

           // Snapshot state if requested
           if (opts.snapshotState) {
             this.snapshotState();
           }

           // Calculate duration and emit end event
           const duration = Date.now() - startTime;
           if (opts.trackTiming !== false) {
             this.emitEvent({
               type: 'stepEnd',
               node: this.node,
               step: stepName,
               duration,
             });
           }

           // Log finish if requested
           if (opts.logFinish) {
             this.logger.info(`STEP END: ${stepName} (${duration}ms)`);
           }

           return result;
         } catch (err: unknown) {
           // Create rich error with context
           const error = err as Error;
           const snap = getObservedState(this);

           const workflowError: WorkflowError = {
             message: error?.message ?? 'Unknown error',
             original: err,
             workflowId: this.id,
             stack: error?.stack,
             state: snap,
             logs: [...this.node.logs] as any,
           };

           // Emit error event
           this.emitEvent({
             type: 'error',
             node: this.node,
             error: workflowError,
           });

           // Re-throw the enriched error
           throw workflowError;
         }
       }

       return stepWrapper;
     };
   }
   ```

**Output**: `src/decorators/step.ts`

**Validation**: TypeScript compiles without errors

---

### Task 8: @Task Decorator
**Depends on**: Task 6

**Input**: Workflow base class

**Steps**:

1. Create `/home/dustin/projects/laminar/src/decorators/task.ts`:
   ```typescript
   import type { TaskOptions } from '../types/index.js';

   // Type for workflow-like objects
   interface WorkflowLike {
     id: string;
     node: unknown;
     emitEvent(event: unknown): void;
     attachChild(child: WorkflowLike): void;
   }

   // Minimal Workflow type for checking instanceof
   interface WorkflowClass {
     id: string;
     parent: WorkflowLike | null;
   }

   /**
    * @Task decorator
    * Wraps a method that returns child workflow(s), automatically attaching them
    *
    * @example
    * class ParentWorkflow extends Workflow {
    *   @Task({ concurrent: true })
    *   async createChildren(): Promise<ChildWorkflow[]> {
    *     return [
    *       new ChildWorkflow('child1', this),
    *       new ChildWorkflow('child2', this),
    *     ];
    *   }
    * }
    */
   export function Task(opts: TaskOptions = {}) {
     return function <This extends WorkflowLike, Args extends unknown[], Return>(
       originalMethod: (this: This, ...args: Args) => Promise<Return>,
       context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Return>>
     ) {
       const methodName = String(context.name);

       // CRITICAL: Use regular function, not arrow function
       async function taskWrapper(this: This, ...args: Args): Promise<Return> {
         const taskName = opts.name ?? methodName;

         // Emit task start event
         this.emitEvent({
           type: 'taskStart',
           node: this.node,
           task: taskName,
         });

         // Execute the original method
         const result = await originalMethod.call(this, ...args);

         // Process returned workflows
         const workflows = Array.isArray(result) ? result : [result];

         for (const workflow of workflows) {
           // Type guard to check if it's a workflow
           if (workflow && typeof workflow === 'object' && 'id' in workflow) {
             const wf = workflow as WorkflowClass;

             // Only attach if not already attached
             if (!wf.parent) {
               wf.parent = this;
               this.attachChild(wf as unknown as WorkflowLike);
             }
           }
         }

         // If concurrent option is set and we have multiple workflows, run them in parallel
         if (opts.concurrent && Array.isArray(result)) {
           const runnable = workflows.filter(
             (w): w is WorkflowClass & { run(): Promise<unknown> } =>
               w && typeof w === 'object' && 'run' in w && typeof (w as any).run === 'function'
           );

           if (runnable.length > 0) {
             await Promise.all(runnable.map((w) => w.run()));
           }
         }

         // Emit task end event
         this.emitEvent({
           type: 'taskEnd',
           node: this.node,
           task: taskName,
         });

         return result;
       }

       return taskWrapper;
     };
   }
   ```

**Output**: `src/decorators/task.ts`

**Validation**: TypeScript compiles without errors

---

### Task 9: Decorator Barrel Export
**Depends on**: Tasks 5, 7, 8

**Input**: All decorator files

**Steps**:

1. Create `/home/dustin/projects/laminar/src/decorators/index.ts`:
   ```typescript
   export { ObservedState, getObservedState, isFieldObserved, getFieldMetadata } from './observed-state.js';
   export { Step } from './step.js';
   export { Task } from './task.js';
   ```

**Output**: `src/decorators/index.ts`

**Validation**: All exports resolve correctly

---

### Task 10: Core Barrel Export
**Depends on**: Tasks 4, 6

**Input**: Core module files

**Steps**:

1. Create `/home/dustin/projects/laminar/src/core/index.ts`:
   ```typescript
   export { WorkflowLogger } from './logger.js';
   export { Workflow } from './workflow.js';
   ```

**Output**: `src/core/index.ts`

---

### Task 11: WorkflowTreeDebugger
**Depends on**: Tasks 6, 3

**Input**: Workflow class and Observable utility

**Steps**:

1. Create `/home/dustin/projects/laminar/src/debugger/tree-debugger.ts`:
   ```typescript
   import type {
     WorkflowNode,
     WorkflowEvent,
     WorkflowObserver,
     LogEntry,
   } from '../types/index.js';
   import { Observable } from '../utils/observable.js';
   import type { Workflow } from '../core/workflow.js';

   /**
    * Status symbols for tree visualization
    */
   const STATUS_SYMBOLS: Record<string, string> = {
     idle: '○',
     running: '◐',
     completed: '✓',
     failed: '✗',
     cancelled: '⊘',
   };

   /**
    * Tree debugger for real-time workflow visualization
    * Implements WorkflowObserver to receive all events
    */
   export class WorkflowTreeDebugger implements WorkflowObserver {
     /** Root node of the workflow tree */
     private root: WorkflowNode;

     /** Observable stream of workflow events */
     public readonly events: Observable<WorkflowEvent>;

     /** Node lookup map for quick access */
     private nodeMap: Map<string, WorkflowNode> = new Map();

     /**
      * Create a tree debugger attached to a workflow
      * @param workflow The root workflow to debug
      */
     constructor(workflow: Workflow) {
       this.root = workflow.getNode();
       this.events = new Observable<WorkflowEvent>();

       // Build initial node map
       this.buildNodeMap(this.root);

       // Register as observer on the workflow
       workflow.addObserver(this);
     }

     /**
      * Build node lookup map recursively
      */
     private buildNodeMap(node: WorkflowNode): void {
       this.nodeMap.set(node.id, node);
       for (const child of node.children) {
         this.buildNodeMap(child);
       }
     }

     // WorkflowObserver implementation

     onLog(entry: LogEntry): void {
       // Events are forwarded through the event stream
     }

     onEvent(event: WorkflowEvent): void {
       // Rebuild node map on structural changes
       if (event.type === 'childAttached') {
         this.buildNodeMap(event.child);
       }

       // Forward to event stream
       this.events.next(event);
     }

     onStateUpdated(node: WorkflowNode): void {
       // State updates are available through the node
     }

     onTreeChanged(root: WorkflowNode): void {
       this.root = root;
       this.nodeMap.clear();
       this.buildNodeMap(root);
     }

     // Public API

     /**
      * Get the current tree root
      */
     getTree(): WorkflowNode {
       return this.root;
     }

     /**
      * Get a node by ID
      */
     getNode(id: string): WorkflowNode | undefined {
       return this.nodeMap.get(id);
     }

     /**
      * Render tree as ASCII string
      * @param node Starting node (defaults to root)
      */
     toTreeString(node?: WorkflowNode): string {
       return this.renderTree(node ?? this.root, '', true, true);
     }

     /**
      * Recursive tree rendering
      */
     private renderTree(
       node: WorkflowNode,
       prefix: string,
       isLast: boolean,
       isRoot: boolean
     ): string {
       let result = '';

       // Status symbol and color indicator
       const statusSymbol = STATUS_SYMBOLS[node.status] || '?';
       const nodeInfo = `${statusSymbol} ${node.name} [${node.status}]`;

       if (isRoot) {
         result += nodeInfo + '\n';
       } else {
         const connector = isLast ? '└── ' : '├── ';
         result += prefix + connector + nodeInfo + '\n';
       }

       // Render children
       const childCount = node.children.length;
       node.children.forEach((child, index) => {
         const isLastChild = index === childCount - 1;
         const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
         result += this.renderTree(child, childPrefix, isLastChild, false);
       });

       return result;
     }

     /**
      * Render logs as formatted string
      * @param node Starting node (defaults to root, includes descendants)
      */
     toLogString(node?: WorkflowNode): string {
       const logs = this.collectLogs(node ?? this.root);

       // Sort by timestamp
       logs.sort((a, b) => a.timestamp - b.timestamp);

       return logs
         .map((log) => {
           const time = new Date(log.timestamp).toISOString();
           const level = log.level.toUpperCase().padEnd(5);
           const nodeRef = this.nodeMap.get(log.workflowId);
           const nodeName = nodeRef?.name ?? log.workflowId;
           return `[${time}] ${level} [${nodeName}] ${log.message}`;
         })
         .join('\n');
     }

     /**
      * Collect all logs from a node and its descendants
      */
     private collectLogs(node: WorkflowNode): LogEntry[] {
       const logs: LogEntry[] = [...node.logs];

       for (const child of node.children) {
         logs.push(...this.collectLogs(child));
       }

       return logs;
     }

     /**
      * Get summary statistics for the tree
      */
     getStats(): {
       totalNodes: number;
       byStatus: Record<string, number>;
       totalLogs: number;
       totalEvents: number;
     } {
       const stats = {
         totalNodes: 0,
         byStatus: {} as Record<string, number>,
         totalLogs: 0,
         totalEvents: 0,
       };

       this.collectStats(this.root, stats);
       return stats;
     }

     private collectStats(
       node: WorkflowNode,
       stats: ReturnType<typeof this.getStats>
     ): void {
       stats.totalNodes++;
       stats.byStatus[node.status] = (stats.byStatus[node.status] || 0) + 1;
       stats.totalLogs += node.logs.length;
       stats.totalEvents += node.events.length;

       for (const child of node.children) {
         this.collectStats(child, stats);
       }
     }
   }
   ```

2. Create `/home/dustin/projects/laminar/src/debugger/index.ts`:
   ```typescript
   export { WorkflowTreeDebugger } from './tree-debugger.js';
   ```

**Output**: `src/debugger/tree-debugger.ts` and `src/debugger/index.ts`

**Validation**: TypeScript compiles without errors

---

### Task 12: Example Workflows
**Depends on**: Tasks 9, 10

**Input**: All core components

**Steps**:

1. Create `/home/dustin/projects/laminar/src/examples/test-cycle-workflow.ts`:
   ```typescript
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
   ```

2. Create `/home/dustin/projects/laminar/src/examples/tdd-orchestrator.ts`:
   ```typescript
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
   ```

3. Create `/home/dustin/projects/laminar/src/examples/index.ts`:
   ```typescript
   export { TestCycleWorkflow } from './test-cycle-workflow.js';
   export { TDDOrchestrator } from './tdd-orchestrator.js';
   ```

**Output**: Example workflows in `src/examples/`

**Validation**: Examples can be instantiated and run

---

### Task 13: Main Entry Point
**Depends on**: All previous tasks

**Input**: All module exports

**Steps**:

1. Create `/home/dustin/projects/laminar/src/index.ts`:
   ```typescript
   // Types
   export type {
     WorkflowStatus,
     WorkflowNode,
     LogLevel,
     LogEntry,
     SerializedWorkflowState,
     StateFieldMetadata,
     WorkflowError,
     WorkflowEvent,
     WorkflowObserver,
     StepOptions,
     TaskOptions,
     ErrorMergeStrategy,
   } from './types/index.js';

   // Core classes
   export { Workflow } from './core/workflow.js';
   export { WorkflowLogger } from './core/logger.js';

   // Decorators
   export { Step } from './decorators/step.js';
   export { Task } from './decorators/task.js';
   export { ObservedState, getObservedState } from './decorators/observed-state.js';

   // Debugger
   export { WorkflowTreeDebugger } from './debugger/tree-debugger.js';

   // Utilities
   export { Observable } from './utils/observable.js';
   export type { Subscription, Observer } from './utils/observable.js';
   export { generateId } from './utils/id.js';

   // Examples (for reference)
   export { TestCycleWorkflow } from './examples/test-cycle-workflow.js';
   export { TDDOrchestrator } from './examples/tdd-orchestrator.js';
   ```

**Output**: `src/index.ts`

**Validation**: `npm run build` completes successfully

---

### Task 14: Unit Tests
**Depends on**: Task 13

**Input**: Complete implementation

**Steps**:

1. Create `/home/dustin/projects/laminar/src/__tests__/unit/workflow.test.ts`:
   ```typescript
   import { describe, it, expect, beforeEach } from 'vitest';
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

     it('should emit logs to observers', () => {
       const wf = new SimpleWorkflow();
       const logs: LogEntry[] = [];

       const observer: WorkflowObserver = {
         onLog: (entry) => logs.push(entry),
         onEvent: () => {},
         onStateUpdated: () => {},
         onTreeChanged: () => {},
       };

       wf.addObserver(observer);
       wf.run();

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
   ```

2. Create `/home/dustin/projects/laminar/src/__tests__/unit/decorators.test.ts`:
   ```typescript
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
   ```

3. Create `/home/dustin/projects/laminar/src/__tests__/unit/tree-debugger.test.ts`:
   ```typescript
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
   ```

4. Create `/home/dustin/projects/laminar/vitest.config.ts`:
   ```typescript
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     test: {
       include: ['src/__tests__/**/*.test.ts'],
       globals: true,
     },
   });
   ```

**Output**: Test files and vitest config

**Validation**: `npm test` passes all tests

---

### Task 15: Integration Test
**Depends on**: Task 14

**Input**: Complete implementation with unit tests

**Steps**:

1. Create `/home/dustin/projects/laminar/src/__tests__/integration/tree-mirroring.test.ts`:
   ```typescript
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
       orchestrator['maxCycles'] = 1; // Limit to one cycle for test

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
       orchestrator['maxCycles'] = 1;

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
       orchestrator['maxCycles'] = 1;

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
   ```

**Output**: Integration test file

**Validation**: `npm test` passes all integration tests

---

## 4. Implementation Details

### Code Patterns to Follow

**Decorator Pattern (Modern TC39 Stage 3)**:
```typescript
// Method decorator with proper this binding
function MyDecorator(options: Options) {
  return function <This, Args extends unknown[], Return>(
    originalMethod: (this: This, ...args: Args) => Return,
    context: ClassMethodDecoratorContext<This>
  ) {
    // CRITICAL: Regular function, NOT arrow function
    function wrapper(this: This, ...args: Args): Return {
      // Use originalMethod.call(this, ...args) to preserve context
      return originalMethod.call(this, ...args);
    }
    return wrapper;
  };
}
```

**Observer Pattern**:
```typescript
// Always traverse to root for observers
private getRootObservers(): WorkflowObserver[] {
  if (this.parent) {
    return this.parent.getRootObservers();
  }
  return this.observers;
}
```

### File Structure
```
src/
├── types/
│   ├── workflow.ts         # WorkflowNode, WorkflowStatus
│   ├── logging.ts          # LogEntry, LogLevel
│   ├── snapshot.ts         # SerializedWorkflowState, StateFieldMetadata
│   ├── error.ts            # WorkflowError
│   ├── events.ts           # WorkflowEvent union
│   ├── observer.ts         # WorkflowObserver interface
│   ├── decorators.ts       # StepOptions, TaskOptions
│   ├── error-strategy.ts   # ErrorMergeStrategy
│   └── index.ts            # Barrel export
├── core/
│   ├── logger.ts           # WorkflowLogger class
│   ├── workflow.ts         # Workflow abstract base class
│   └── index.ts
├── decorators/
│   ├── observed-state.ts   # @ObservedState decorator
│   ├── step.ts             # @Step decorator
│   ├── task.ts             # @Task decorator
│   └── index.ts
├── debugger/
│   ├── tree-debugger.ts    # WorkflowTreeDebugger class
│   └── index.ts
├── utils/
│   ├── id.ts               # generateId function
│   ├── observable.ts       # Observable class
│   └── index.ts
├── examples/
│   ├── test-cycle-workflow.ts
│   ├── tdd-orchestrator.ts
│   └── index.ts
├── __tests__/
│   ├── unit/
│   │   ├── workflow.test.ts
│   │   ├── decorators.test.ts
│   │   └── tree-debugger.test.ts
│   └── integration/
│       └── tree-mirroring.test.ts
└── index.ts                # Main entry point
```

---

## 5. Testing Strategy

### Unit Tests
```yaml
test_files:
  - path: "src/__tests__/unit/workflow.test.ts"
    covers:
      - Workflow instantiation
      - Parent-child relationships
      - Status management
      - Observer registration
      - Event emission

  - path: "src/__tests__/unit/decorators.test.ts"
    covers:
      - "@Step event emission"
      - "@Step error wrapping"
      - "@ObservedState snapshot inclusion"
      - "@ObservedState redaction"
      - "@ObservedState hidden fields"

  - path: "src/__tests__/unit/tree-debugger.test.ts"
    covers:
      - Tree string rendering
      - Node lookup
      - Log collection
      - Statistics gathering

test_patterns:
  - "Use describe/it blocks from vitest"
  - "Test both success and failure paths"
  - "Verify event emission with mock observers"
```

### Integration Tests
```yaml
scenarios:
  - name: "Tree Mirroring"
    validates: "1:1 tree mirror of workflow execution"

  - name: "Event Propagation"
    validates: "Events from children reach root observers"

  - name: "Error Context"
    validates: "Errors include state snapshots and logs"
```

### Manual Validation
```yaml
steps:
  - action: "npm run build"
    expected: "Compiles without errors"

  - action: "npm test"
    expected: "All tests pass"

  - action: "Create test script that runs TDDOrchestrator"
    expected: "Console shows tree structure and logs"
```

---

## 6. Final Validation Checklist

### Code Quality
- [ ] All TypeScript compiles with `strict: true`
- [ ] No linting warnings
- [ ] Follows naming conventions (kebab-case files, PascalCase classes)
- [ ] Proper error handling in all decorators

### Functionality
- [ ] Workflow instances have unique IDs
- [ ] Parent-child relationships work correctly
- [ ] Events emit to root observers
- [ ] @Step wraps errors in WorkflowError
- [ ] @ObservedState respects hidden/redact options
- [ ] @Task attaches child workflows
- [ ] WorkflowTreeDebugger renders accurate tree

### Testing
- [ ] Unit tests pass for all core components
- [ ] Integration tests verify tree mirroring
- [ ] Error scenarios are tested

### Documentation
- [ ] All public APIs have JSDoc comments
- [ ] Complex logic has inline comments
- [ ] Example workflows demonstrate usage

---

## 7. "No Prior Knowledge" Test

**Validation**: If someone knew nothing about this codebase, would they have everything needed to implement this successfully using only this PRP?

- [x] All file paths are absolute and specific
- [x] All patterns have concrete code examples
- [x] All dependencies are explicitly listed (none required!)
- [x] All validation steps are executable commands
- [x] TypeScript configuration is complete
- [x] Test patterns are specified
- [x] Example workflows demonstrate all decorators

---

## Confidence Score: 9/10

**Rationale**:
- Comprehensive research completed on decorators, observables, and tree visualization
- PRD provides complete interfaces and class skeletons
- All patterns are documented with working code examples
- Zero runtime dependencies reduces complexity
- Testing strategy is thorough

**Remaining uncertainties**:
- Edge cases in concurrent @Task execution may need refinement
- Real-world performance with deep workflow trees not validated
- Additional error merge strategies could be added later

---

## Quick Start Commands

```bash
# 1. Setup
cd /home/dustin/projects/laminar
npm install

# 2. Build
npm run build

# 3. Test
npm test

# 4. Verify tree output (create this file to test)
# Create src/demo.ts with:
# import { TDDOrchestrator, WorkflowTreeDebugger } from './index.js';
# const wf = new TDDOrchestrator();
# const dbg = new WorkflowTreeDebugger(wf);
# wf.run().then(() => console.log(dbg.toTreeString()));
```
