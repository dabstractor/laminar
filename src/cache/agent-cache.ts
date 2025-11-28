/**
 * Default maximum cache size
 */
const DEFAULT_MAX_SIZE = 1000;

/**
 * Cache entry with value and metadata
 */
interface CacheEntry<T> {
  value: T;
  createdAt: number;
}

/**
 * AgentCache interface per PRD Section 6.2
 */
export interface AgentCache {
  /**
   * Get a cached value by key
   * @returns Cached value or undefined if not found
   */
  get(key: string): Promise<unknown | undefined>;

  /**
   * Set a cached value
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: string, value: unknown): Promise<void>;

  /**
   * Remove a specific cache entry
   * @param key - Cache key to remove
   */
  bust(key: string): Promise<void>;

  /**
   * Remove all entries matching a prefix
   * @param prefix - Prefix to match
   */
  bustByPrefix(prefix: string): Promise<void>;
}

/**
 * In-memory LRU cache implementation
 *
 * @remarks
 * Uses Map's insertion order preservation for LRU behavior.
 * When capacity is reached, oldest entries are evicted.
 */
export class LRUAgentCache implements AgentCache {
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly maxSize: number;

  /**
   * Create a new LRU cache
   * @param maxSize - Maximum number of entries (default: 1000)
   */
  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
  }

  async get(key: string): Promise<unknown | undefined> {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  async set(key: string, value: unknown): Promise<void> {
    // Delete existing entry if present (will be re-added at end)
    this.cache.delete(key);

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    // Add new entry
    this.cache.set(key, {
      value,
      createdAt: Date.now(),
    });
  }

  async bust(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async bustByPrefix(prefix: string): Promise<void> {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}
