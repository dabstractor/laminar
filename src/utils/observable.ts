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
