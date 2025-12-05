/**
 * Cache interface for prompt result caching
 */
export interface Cache {
  /** Get a value by key */
  get<T>(key: string): Promise<T | undefined>;
  /** Set a value with optional TTL in ms */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  /** Delete a key */
  delete(key: string): Promise<boolean>;
  /** Clear all entries */
  clear(): Promise<void>;
  /** Check if key exists */
  has(key: string): Promise<boolean>;
}
