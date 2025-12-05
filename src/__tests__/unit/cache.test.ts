import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCache, generateCacheKey } from '../../index.js';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
  });

  it('should store and retrieve values', async () => {
    await cache.set('key1', 'value1');
    const value = await cache.get('key1');
    expect(value).toBe('value1');
  });

  it('should return undefined for missing keys', async () => {
    const value = await cache.get('nonexistent');
    expect(value).toBeUndefined();
  });

  it('should delete values', async () => {
    await cache.set('key1', 'value1');
    const deleted = await cache.delete('key1');
    expect(deleted).toBe(true);
    expect(await cache.get('key1')).toBeUndefined();
  });

  it('should return false when deleting non-existent key', async () => {
    const deleted = await cache.delete('nonexistent');
    expect(deleted).toBe(false);
  });

  it('should clear all values', async () => {
    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');
    await cache.clear();
    expect(cache.size).toBe(0);
  });

  it('should check if key exists', async () => {
    await cache.set('key1', 'value1');
    expect(await cache.has('key1')).toBe(true);
    expect(await cache.has('key2')).toBe(false);
  });

  it('should respect TTL', async () => {
    await cache.set('key1', 'value1', 10); // 10ms TTL
    expect(await cache.has('key1')).toBe(true);

    // Wait for TTL to expire
    await new Promise(r => setTimeout(r, 15));
    expect(await cache.has('key1')).toBe(false);
  });

  it('should return undefined for expired values', async () => {
    await cache.set('key1', 'value1', 10); // 10ms TTL

    // Wait for TTL to expire
    await new Promise(r => setTimeout(r, 15));
    const value = await cache.get('key1');
    expect(value).toBeUndefined();
  });

  it('should store complex objects', async () => {
    const obj = { name: 'test', nested: { value: 42 } };
    await cache.set('key1', obj);
    const retrieved = await cache.get<typeof obj>('key1');
    expect(retrieved).toEqual(obj);
  });

  it('should track size correctly', async () => {
    expect(cache.size).toBe(0);
    await cache.set('key1', 'value1');
    expect(cache.size).toBe(1);
    await cache.set('key2', 'value2');
    expect(cache.size).toBe(2);
    await cache.delete('key1');
    expect(cache.size).toBe(1);
  });
});

describe('generateCacheKey', () => {
  it('should generate consistent keys for same input', () => {
    const prompt = { name: 'test', user: 'Hello' };
    const key1 = generateCacheKey(prompt, 'model', { x: 1 });
    const key2 = generateCacheKey(prompt, 'model', { x: 1 });
    expect(key1).toBe(key2);
  });

  it('should generate different keys for different inputs', () => {
    const prompt = { name: 'test', user: 'Hello' };
    const key1 = generateCacheKey(prompt, 'model', { x: 1 });
    const key2 = generateCacheKey(prompt, 'model', { x: 2 });
    expect(key1).not.toBe(key2);
  });

  it('should handle object key ordering', () => {
    const prompt = { name: 'test', user: 'Hello' };
    const key1 = generateCacheKey(prompt, 'model', { a: 1, b: 2 });
    const key2 = generateCacheKey(prompt, 'model', { b: 2, a: 1 });
    expect(key1).toBe(key2); // Should be same due to stable stringify
  });

  it('should generate different keys for different models', () => {
    const prompt = { name: 'test', user: 'Hello' };
    const key1 = generateCacheKey(prompt, 'model-a', { x: 1 });
    const key2 = generateCacheKey(prompt, 'model-b', { x: 1 });
    expect(key1).not.toBe(key2);
  });

  it('should include system prompt in key calculation', () => {
    const prompt1 = { name: 'test', user: 'Hello', system: 'System A' };
    const prompt2 = { name: 'test', user: 'Hello', system: 'System B' };
    const key1 = generateCacheKey(prompt1, 'model', {});
    const key2 = generateCacheKey(prompt2, 'model', {});
    expect(key1).not.toBe(key2);
  });

  it('should handle null and undefined inputs', () => {
    const prompt = { name: 'test', user: 'Hello' };
    const key1 = generateCacheKey(prompt, 'model', null);
    const key2 = generateCacheKey(prompt, 'model', undefined);
    // Both should generate keys without errors
    expect(key1).toBeTruthy();
    expect(key2).toBeTruthy();
  });

  it('should handle arrays in input', () => {
    const prompt = { name: 'test', user: 'Hello' };
    const key1 = generateCacheKey(prompt, 'model', { items: [1, 2, 3] });
    const key2 = generateCacheKey(prompt, 'model', { items: [1, 2, 3] });
    const key3 = generateCacheKey(prompt, 'model', { items: [3, 2, 1] });
    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });
});
