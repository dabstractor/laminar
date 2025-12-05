import type { Cache } from './cache.js';

interface CacheEntry<T> {
  value: T;
  expires?: number;
}

/**
 * In-memory cache implementation
 */
export class MemoryCache implements Cache {
  private store: Map<string, CacheEntry<unknown>> = new Map();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    // Check expiration
    if (entry.expires && Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const entry: CacheEntry<T> = {
      value,
      expires: ttl ? Date.now() + ttl : undefined,
    };
    this.store.set(key, entry);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);

    if (!entry) {
      return false;
    }

    // Check expiration
    if (entry.expires && Date.now() > entry.expires) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.store.size;
  }
}
