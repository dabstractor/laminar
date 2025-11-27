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
