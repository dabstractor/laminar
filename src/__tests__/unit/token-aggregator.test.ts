import { describe, it, expect } from 'vitest';
import {
  aggregateTokenUsage,
  formatTokenUsage,
  estimateCost,
  emptyTokenUsage,
} from '../../index.js';

describe('Token Aggregator', () => {
  describe('aggregateTokenUsage', () => {
    it('should sum token counts', () => {
      const usages = [
        { inputTokens: 100, outputTokens: 50 },
        { inputTokens: 200, outputTokens: 100 },
      ];

      const result = aggregateTokenUsage(usages);

      expect(result.inputTokens).toBe(300);
      expect(result.outputTokens).toBe(150);
    });

    it('should handle cache tokens', () => {
      const usages = [
        { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 10 },
        { inputTokens: 200, outputTokens: 100, cacheReadInputTokens: 5 },
      ];

      const result = aggregateTokenUsage(usages);

      expect(result.cacheCreationInputTokens).toBe(10);
      expect(result.cacheReadInputTokens).toBe(5);
    });

    it('should handle empty array', () => {
      const result = aggregateTokenUsage([]);
      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
    });

    it('should aggregate multiple cache tokens', () => {
      const usages = [
        { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 10, cacheReadInputTokens: 5 },
        { inputTokens: 200, outputTokens: 100, cacheCreationInputTokens: 20, cacheReadInputTokens: 15 },
      ];

      const result = aggregateTokenUsage(usages);

      expect(result.cacheCreationInputTokens).toBe(30);
      expect(result.cacheReadInputTokens).toBe(20);
    });
  });

  describe('formatTokenUsage', () => {
    it('should format basic usage', () => {
      const usage = { inputTokens: 100, outputTokens: 50 };
      const formatted = formatTokenUsage(usage);
      expect(formatted).toBe('in: 100, out: 50');
    });

    it('should include cache tokens when present', () => {
      const usage = {
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 10,
        cacheReadInputTokens: 5,
      };
      const formatted = formatTokenUsage(usage);
      expect(formatted).toContain('cache-create: 10');
      expect(formatted).toContain('cache-read: 5');
    });

    it('should only include cache-create when cache-read is absent', () => {
      const usage = {
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 10,
      };
      const formatted = formatTokenUsage(usage);
      expect(formatted).toContain('cache-create: 10');
      expect(formatted).not.toContain('cache-read');
    });
  });

  describe('estimateCost', () => {
    it('should calculate cost correctly with defaults', () => {
      const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
      const cost = estimateCost(usage);
      expect(cost).toBe(18); // $3 input + $15 output
    });

    it('should calculate cost with custom rates', () => {
      const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
      const cost = estimateCost(usage, 1, 5);
      expect(cost).toBe(6); // $1 input + $5 output
    });

    it('should handle zero tokens', () => {
      const usage = { inputTokens: 0, outputTokens: 0 };
      const cost = estimateCost(usage);
      expect(cost).toBe(0);
    });

    it('should calculate fractional costs', () => {
      const usage = { inputTokens: 1000, outputTokens: 1000 };
      const cost = estimateCost(usage);
      // 1000/1M * $3 = 0.003 input, 1000/1M * $15 = 0.015 output, total = 0.018
      expect(cost).toBeCloseTo(0.018);
    });
  });

  describe('emptyTokenUsage', () => {
    it('should return zero counts', () => {
      const empty = emptyTokenUsage();
      expect(empty.inputTokens).toBe(0);
      expect(empty.outputTokens).toBe(0);
    });

    it('should not have cache fields', () => {
      const empty = emptyTokenUsage();
      expect(empty.cacheCreationInputTokens).toBeUndefined();
      expect(empty.cacheReadInputTokens).toBeUndefined();
    });
  });
});
