import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  generateCacheKey,
  getSchemaVersionHash,
  getCacheKeyPrefix,
  LRUAgentCache,
} from '../../cache/index.js';
import type { CCRModel } from '../../types/model.js';

describe('Cache Key Generation', () => {
  describe('generateCacheKey', () => {
    it('should generate deterministic cache keys', () => {
      const params = {
        userPrompt: 'Generate code',
        data: { language: 'typescript' },
        model: 'openai,gpt-4o' as CCRModel,
        provider: 'openai',
        temperature: 0.7,
        tools: [
          { name: 'runCode', description: 'Run code', inputSchema: {}, execute: async () => {} },
        ],
        mcps: [],
        schemaVersion: 'v1',
      };

      const key1 = generateCacheKey(params);
      const key2 = generateCacheKey(params);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA-256 hex string
    });

    it('should produce different keys for different prompts', () => {
      const baseParams = {
        data: {},
        model: 'openai,gpt-4o' as CCRModel,
        provider: 'openai',
        tools: [],
        mcps: [],
        schemaVersion: 'v1',
      };

      const key1 = generateCacheKey({ ...baseParams, userPrompt: 'prompt 1' });
      const key2 = generateCacheKey({ ...baseParams, userPrompt: 'prompt 2' });

      expect(key1).not.toBe(key2);
    });

    it('should produce different keys for different models', () => {
      const baseParams = {
        userPrompt: 'test',
        data: {},
        provider: 'openai',
        tools: [],
        mcps: [],
        schemaVersion: 'v1',
      };

      const key1 = generateCacheKey({ ...baseParams, model: 'openai,gpt-4o' as CCRModel });
      const key2 = generateCacheKey({ ...baseParams, model: 'openai,gpt-4o-mini' as CCRModel });

      expect(key1).not.toBe(key2);
    });

    it('should produce same key regardless of object property order', () => {
      const params1 = {
        userPrompt: 'test',
        data: { b: 2, a: 1 },
        model: 'openai,gpt-4o' as CCRModel,
        provider: 'openai',
        tools: [],
        mcps: [],
        schemaVersion: 'v1',
      };

      const params2 = {
        userPrompt: 'test',
        data: { a: 1, b: 2 },
        model: 'openai,gpt-4o' as CCRModel,
        provider: 'openai',
        tools: [],
        mcps: [],
        schemaVersion: 'v1',
      };

      expect(generateCacheKey(params1)).toBe(generateCacheKey(params2));
    });

    it('should only include tool names, not implementations', () => {
      const params1 = {
        userPrompt: 'test',
        data: {},
        model: 'openai,gpt-4o' as CCRModel,
        provider: 'openai',
        tools: [
          { name: 'tool1', description: 'desc', inputSchema: {}, execute: async () => 'result1' },
        ],
        mcps: [],
        schemaVersion: 'v1',
      };

      const params2 = {
        userPrompt: 'test',
        data: {},
        model: 'openai,gpt-4o' as CCRModel,
        provider: 'openai',
        tools: [
          { name: 'tool1', description: 'desc', inputSchema: {}, execute: async () => 'result2' },
        ],
        mcps: [],
        schemaVersion: 'v1',
      };

      // Same tool name = same cache key (different implementations don't matter)
      expect(generateCacheKey(params1)).toBe(generateCacheKey(params2));
    });
  });

  describe('getSchemaVersionHash', () => {
    it('should generate hash for Zod schema', () => {
      const schema = z.object({ code: z.string() });
      const hash = getSchemaVersionHash(schema);

      expect(hash).toHaveLength(64);
    });

    it('should produce same hash for same schema', () => {
      const schema1 = z.object({ code: z.string() });
      const schema2 = z.object({ code: z.string() });

      expect(getSchemaVersionHash(schema1)).toBe(getSchemaVersionHash(schema2));
    });

    it('should produce different hash for different schemas', () => {
      const schema1 = z.object({ code: z.string() });
      const schema2 = z.object({ result: z.number() });

      expect(getSchemaVersionHash(schema1)).not.toBe(getSchemaVersionHash(schema2));
    });
  });

  describe('getCacheKeyPrefix', () => {
    it('should generate prefix from agent ID', () => {
      const prefix = getCacheKeyPrefix('agent-123');
      expect(prefix).toHaveLength(16);
    });

    it('should include prompt prefix when provided', () => {
      const prefix1 = getCacheKeyPrefix('agent-123');
      const prefix2 = getCacheKeyPrefix('agent-123', 'prompt-');

      expect(prefix1).not.toBe(prefix2);
    });
  });
});

describe('LRUAgentCache', () => {
  let cache: LRUAgentCache;

  beforeEach(() => {
    cache = new LRUAgentCache(3); // Small size for testing
  });

  describe('basic operations', () => {
    it('should store and retrieve values', async () => {
      await cache.set('key1', { data: 'value1' });
      const result = await cache.get('key1');

      expect(result).toEqual({ data: 'value1' });
    });

    it('should return undefined for missing keys', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should track size correctly', async () => {
      expect(cache.size).toBe(0);

      await cache.set('key1', 'value1');
      expect(cache.size).toBe(1);

      await cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when at capacity', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      // Cache is now full

      await cache.set('key4', 'value4');
      // key1 should be evicted

      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBe('value2');
      expect(await cache.get('key4')).toBe('value4');
    });

    it('should update LRU order on get', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      // Access key1, making it most recently used
      await cache.get('key1');

      // Add new entry, should evict key2 (now oldest)
      await cache.set('key4', 'value4');

      expect(await cache.get('key1')).toBe('value1'); // Still present
      expect(await cache.get('key2')).toBeUndefined(); // Evicted
      expect(await cache.get('key3')).toBe('value3'); // Still present
    });

    it('should update LRU order on set of existing key', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      // Update key1, making it most recently used
      await cache.set('key1', 'updated1');

      // Add new entry, should evict key2 (now oldest)
      await cache.set('key4', 'value4');

      expect(await cache.get('key1')).toBe('updated1');
      expect(await cache.get('key2')).toBeUndefined();
    });
  });

  describe('bust operations', () => {
    it('should remove specific key', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.bust('key1');

      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBe('value2');
    });

    it('should remove keys by prefix', async () => {
      await cache.set('prefix_key1', 'value1');
      await cache.set('prefix_key2', 'value2');
      await cache.set('other_key', 'value3');

      await cache.bustByPrefix('prefix_');

      expect(await cache.get('prefix_key1')).toBeUndefined();
      expect(await cache.get('prefix_key2')).toBeUndefined();
      expect(await cache.get('other_key')).toBe('value3');
    });
  });

  describe('clear and stats', () => {
    it('should clear all entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      cache.clear();

      expect(cache.size).toBe(0);
      expect(await cache.get('key1')).toBeUndefined();
    });

    it('should return correct stats', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
    });
  });
});
