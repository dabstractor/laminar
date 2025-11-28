import type { RuntimeEvent, EventType } from '../types/runtime-events.js';
import { Observable } from '../utils/observable.js';
import type { Subscription } from '../utils/observable.js';
import { generateId } from '../utils/id.js';

/**
 * Event handler function type
 */
export type EventHandler = (event: RuntimeEvent) => void;

/**
 * Event filter predicate
 */
export type EventFilter = (event: RuntimeEvent) => boolean;

/**
 * Centralized event bus for runtime events
 *
 * @remarks
 * Provides pub/sub for runtime events with:
 * - Type-safe event emission
 * - Observable streaming
 * - Event filtering
 */
export class RuntimeEventBus {
  private readonly observable: Observable<RuntimeEvent>;
  private readonly handlers: Set<EventHandler> = new Set();

  constructor() {
    this.observable = new Observable<RuntimeEvent>();
  }

  /**
   * Emit a runtime event
   *
   * @param event - Partial event (id and timestamp auto-assigned)
   */
  emit(event: Omit<RuntimeEvent, 'id' | 'timestamp'>): void {
    const fullEvent: RuntimeEvent = {
      ...event,
      id: generateId(),
      timestamp: Date.now(),
    };

    // Notify Observable subscribers
    this.observable.next(fullEvent);

    // Notify direct handlers
    for (const handler of this.handlers) {
      try {
        handler(fullEvent);
      } catch (err) {
        console.error('Event handler error:', err);
      }
    }
  }

  /**
   * Subscribe to all events
   *
   * @param handler - Handler called for each event
   * @returns Subscription for cleanup
   */
  subscribe(handler: EventHandler): Subscription {
    this.handlers.add(handler);
    return {
      unsubscribe: () => {
        this.handlers.delete(handler);
      },
    };
  }

  /**
   * Subscribe to events matching a filter
   *
   * @param filter - Predicate to filter events
   * @param handler - Handler called for matching events
   * @returns Subscription for cleanup
   */
  subscribeFiltered(filter: EventFilter, handler: EventHandler): Subscription {
    const wrappedHandler: EventHandler = (event) => {
      if (filter(event)) {
        handler(event);
      }
    };

    return this.subscribe(wrappedHandler);
  }

  /**
   * Subscribe to events of specific type(s)
   *
   * @param types - Event type(s) to subscribe to
   * @param handler - Handler called for matching events
   * @returns Subscription for cleanup
   */
  subscribeToTypes(
    types: EventType | EventType[],
    handler: EventHandler
  ): Subscription {
    const typeSet = new Set(Array.isArray(types) ? types : [types]);
    return this.subscribeFiltered(
      (event) => typeSet.has(event.type),
      handler
    );
  }

  /**
   * Get the underlying Observable for advanced streaming
   */
  asObservable(): Observable<RuntimeEvent> {
    return this.observable;
  }

  /**
   * Create a child event bus that forwards to this one
   * Useful for scoped event emission
   *
   * @param parentId - Parent event ID to set on forwarded events
   */
  createChild(parentId: string): ChildEventBus {
    return new ChildEventBus(this, parentId);
  }
}

/**
 * Child event bus that auto-sets parentId
 */
export class ChildEventBus {
  constructor(
    private readonly parent: RuntimeEventBus,
    private readonly parentId: string
  ) {}

  emit(event: Omit<RuntimeEvent, 'id' | 'timestamp' | 'parentId'>): void {
    this.parent.emit({
      ...event,
      parentId: this.parentId,
    });
  }
}
