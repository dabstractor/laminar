import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuntimeEventBus, ChildEventBus } from '../../events/event-bus.js';
import type { RuntimeEvent, EventType } from '../../types/runtime-events.js';

describe('RuntimeEventBus', () => {
  let eventBus: RuntimeEventBus;

  beforeEach(() => {
    eventBus = new RuntimeEventBus();
  });

  describe('emit', () => {
    it('should add id and timestamp to events', () => {
      let receivedEvent: RuntimeEvent | undefined;

      eventBus.subscribe((event) => {
        receivedEvent = event;
      });

      eventBus.emit({
        type: 'agent.start',
        nodeType: 'agent',
        name: 'TestAgent',
      });

      expect(receivedEvent).toBeDefined();
      expect(receivedEvent!.id).toBeDefined();
      expect(receivedEvent!.timestamp).toBeGreaterThan(0);
      expect(receivedEvent!.type).toBe('agent.start');
      expect(receivedEvent!.name).toBe('TestAgent');
    });

    it('should notify all subscribers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.subscribe(handler1);
      eventBus.subscribe(handler2);

      eventBus.emit({
        type: 'agent.start',
        nodeType: 'agent',
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should continue if a handler throws', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();

      eventBus.subscribe(errorHandler);
      eventBus.subscribe(normalHandler);

      // Should not throw
      eventBus.emit({
        type: 'agent.start',
        nodeType: 'agent',
      });

      expect(normalHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribe', () => {
    it('should return subscription with unsubscribe', () => {
      const handler = vi.fn();
      const subscription = eventBus.subscribe(handler);

      eventBus.emit({ type: 'agent.start', nodeType: 'agent' });
      expect(handler).toHaveBeenCalledTimes(1);

      subscription.unsubscribe();

      eventBus.emit({ type: 'agent.end', nodeType: 'agent' });
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should handle multiple subscriptions and unsubscriptions', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const sub1 = eventBus.subscribe(handler1);
      const sub2 = eventBus.subscribe(handler2);

      eventBus.emit({ type: 'agent.start', nodeType: 'agent' });
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      sub1.unsubscribe();

      eventBus.emit({ type: 'agent.end', nodeType: 'agent' });
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(2);
    });
  });

  describe('subscribeFiltered', () => {
    it('should only call handler for matching events', () => {
      const handler = vi.fn();

      eventBus.subscribeFiltered(
        (event) => event.nodeType === 'agent',
        handler
      );

      eventBus.emit({ type: 'agent.start', nodeType: 'agent' });
      eventBus.emit({ type: 'tool.start', nodeType: 'tool' });
      eventBus.emit({ type: 'agent.end', nodeType: 'agent' });

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('subscribeToTypes', () => {
    it('should filter by single event type', () => {
      const handler = vi.fn();

      eventBus.subscribeToTypes('agent.start', handler);

      eventBus.emit({ type: 'agent.start', nodeType: 'agent' });
      eventBus.emit({ type: 'agent.end', nodeType: 'agent' });
      eventBus.emit({ type: 'tool.start', nodeType: 'tool' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'agent.start' })
      );
    });

    it('should filter by multiple event types', () => {
      const handler = vi.fn();

      eventBus.subscribeToTypes(['agent.start', 'agent.end'], handler);

      eventBus.emit({ type: 'agent.start', nodeType: 'agent' });
      eventBus.emit({ type: 'agent.end', nodeType: 'agent' });
      eventBus.emit({ type: 'tool.start', nodeType: 'tool' });

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should return subscription for cleanup', () => {
      const handler = vi.fn();
      const subscription = eventBus.subscribeToTypes('cache.hit', handler);

      eventBus.emit({ type: 'cache.hit', nodeType: 'agent' });
      subscription.unsubscribe();
      eventBus.emit({ type: 'cache.hit', nodeType: 'agent' });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('asObservable', () => {
    it('should return Observable that receives events', () => {
      const observable = eventBus.asObservable();
      const receivedEvents: RuntimeEvent[] = [];

      observable.subscribe({
        next: (event) => receivedEvents.push(event),
      });

      eventBus.emit({ type: 'agent.start', nodeType: 'agent' });
      eventBus.emit({ type: 'agent.end', nodeType: 'agent' });

      expect(receivedEvents).toHaveLength(2);
    });
  });
});

describe('ChildEventBus', () => {
  let parentBus: RuntimeEventBus;
  let childBus: ChildEventBus;

  beforeEach(() => {
    parentBus = new RuntimeEventBus();
    childBus = parentBus.createChild('parent-event-id');
  });

  it('should automatically set parentId on emitted events', () => {
    let receivedEvent: RuntimeEvent | undefined;

    parentBus.subscribe((event) => {
      receivedEvent = event;
    });

    childBus.emit({
      type: 'tool.start',
      nodeType: 'tool',
      name: 'TestTool',
    });

    expect(receivedEvent).toBeDefined();
    expect(receivedEvent!.parentId).toBe('parent-event-id');
    expect(receivedEvent!.name).toBe('TestTool');
  });

  it('should forward events to parent bus subscribers', () => {
    const handler = vi.fn();
    parentBus.subscribe(handler);

    childBus.emit({ type: 'tool.end', nodeType: 'tool' });

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
