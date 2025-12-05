/**
 * Cache Usage Example
 *
 * Demonstrates prompt result caching with:
 * - MemoryCache with TTL
 * - Cache key generation
 * - Cache hit/miss tracking
 *
 * Run with: ANTHROPIC_API_KEY=your-key npx tsx examples/cache-usage.ts
 */

import {
  MemoryCache,
  generateCacheKey,
  PromptInstance,
  AnthropicClient,
  formatTokenUsage,
  type PromptConfig,
  type PromptResult,
} from '../src/index.js';

// Create a cached prompt executor
class CachedPromptExecutor {
  private cache: MemoryCache;
  private client: AnthropicClient;
  private model: string;
  private hitCount = 0;
  private missCount = 0;

  constructor(model: string, ttlMs: number = 60000) {
    this.cache = new MemoryCache();
    this.client = new AnthropicClient();
    this.model = model;
  }

  async execute(config: PromptConfig, input: unknown): Promise<PromptResult & { cacheHit: boolean }> {
    const cacheKey = generateCacheKey(config, this.model, input);

    // Check cache
    const cached = await this.cache.get<PromptResult>(cacheKey);
    if (cached) {
      this.hitCount++;
      console.log(`  [CACHE HIT] Key: ${cacheKey.substring(0, 12)}...`);
      return { ...cached, cacheHit: true };
    }

    // Execute prompt
    this.missCount++;
    console.log(`  [CACHE MISS] Key: ${cacheKey.substring(0, 12)}... - Calling API`);
    const prompt = new PromptInstance(config, this.model, input);
    const result = await prompt.run(this.client);

    // Store in cache
    await this.cache.set(cacheKey, result, 60000); // 1 minute TTL

    return { ...result, cacheHit: false };
  }

  getStats() {
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
      cacheSize: this.cache.size,
    };
  }
}

async function main() {
  const executor = new CachedPromptExecutor('claude-sonnet-4-5-20250929');

  const promptConfig: PromptConfig = {
    name: 'fact-generator',
    system: 'You provide brief, interesting facts.',
    user: 'Tell me one interesting fact about {{topic}}.',
  };

  console.log('Cache Usage Demo');
  console.log('='.repeat(50));

  // First request - should miss cache
  console.log('\n1. First request for "dolphins":');
  const result1 = await executor.execute(promptConfig, { topic: 'dolphins' });
  console.log(`   Result: ${result1.content.substring(0, 80)}...`);
  console.log(`   Tokens: ${formatTokenUsage(result1.tokenUsage)}`);

  // Same request - should hit cache
  console.log('\n2. Same request for "dolphins" (should hit cache):');
  const result2 = await executor.execute(promptConfig, { topic: 'dolphins' });
  console.log(`   Result: ${result2.content.substring(0, 80)}...`);
  console.log(`   Cache hit: ${result2.cacheHit}`);

  // Different topic - should miss cache
  console.log('\n3. Different request for "octopuses":');
  const result3 = await executor.execute(promptConfig, { topic: 'octopuses' });
  console.log(`   Result: ${result3.content.substring(0, 80)}...`);
  console.log(`   Tokens: ${formatTokenUsage(result3.tokenUsage)}`);

  // Back to dolphins - should hit cache
  console.log('\n4. Back to "dolphins" (should hit cache):');
  const result4 = await executor.execute(promptConfig, { topic: 'dolphins' });
  console.log(`   Result: ${result4.content.substring(0, 80)}...`);
  console.log(`   Cache hit: ${result4.cacheHit}`);

  // Display stats
  const stats = executor.getStats();
  console.log('\n' + '='.repeat(50));
  console.log('Cache Statistics:');
  console.log(`  Hits: ${stats.hitCount}`);
  console.log(`  Misses: ${stats.missCount}`);
  console.log(`  Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(`  Cache size: ${stats.cacheSize} entries`);
}

// Demonstrate cache key stability
async function cacheKeyDemo() {
  console.log('\n\nCache Key Stability Demo');
  console.log('='.repeat(50));

  const config: PromptConfig = {
    name: 'test',
    system: 'You are helpful.',
    user: 'Hello {{name}}',
  };

  // Same inputs with different key order should produce same cache key
  const key1 = generateCacheKey(config, 'model', { name: 'Alice', age: 30 });
  const key2 = generateCacheKey(config, 'model', { age: 30, name: 'Alice' });

  console.log('\nInput 1: { name: "Alice", age: 30 }');
  console.log(`Key 1: ${key1}`);
  console.log('\nInput 2: { age: 30, name: "Alice" }');
  console.log(`Key 2: ${key2}`);
  console.log(`\nKeys match: ${key1 === key2}`);

  // Different inputs should produce different keys
  const key3 = generateCacheKey(config, 'model', { name: 'Bob', age: 30 });
  console.log('\nInput 3: { name: "Bob", age: 30 }');
  console.log(`Key 3: ${key3}`);
  console.log(`\nKey 1 vs Key 3 match: ${key1 === key3}`);
}

// Demonstrate TTL expiration
async function ttlDemo() {
  console.log('\n\nTTL Expiration Demo');
  console.log('='.repeat(50));

  const cache = new MemoryCache();

  // Set value with 100ms TTL
  await cache.set('short-lived', 'This will expire soon', 100);
  await cache.set('long-lived', 'This will stay longer', 5000);

  console.log('\nImmediately after setting:');
  console.log(`  short-lived exists: ${await cache.has('short-lived')}`);
  console.log(`  long-lived exists: ${await cache.has('long-lived')}`);

  // Wait for short TTL to expire
  console.log('\nWaiting 150ms...');
  await new Promise((r) => setTimeout(r, 150));

  console.log('\nAfter 150ms:');
  console.log(`  short-lived exists: ${await cache.has('short-lived')}`);
  console.log(`  long-lived exists: ${await cache.has('long-lived')}`);

  // Cleanup
  await cache.clear();
}

// Run all demos
main()
  .then(() => cacheKeyDemo())
  .then(() => ttlDemo())
  .catch(console.error);
