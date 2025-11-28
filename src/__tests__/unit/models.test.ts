import { describe, it, expect } from 'vitest';
import {
  parseCCRModel,
  formatCCRModel,
  validateCCRModel,
  InvalidCCRModelError,
  ModelResolver,
  ModelResolutionError,
  CCRRouter,
  CCRRoutingError,
} from '../../models/index.js';
import type { CCRModel, CategoryModelConfig } from '../../types/model.js';
import type { CCR, CCRRequest, CCRResponse } from '../../models/ccr.js';

describe('CCR Model Parser', () => {
  describe('parseCCRModel', () => {
    it('should parse valid CCR model string', () => {
      const result = parseCCRModel('openai,gpt-4o');
      expect(result.provider).toBe('openai');
      expect(result.version).toBe('gpt-4o');
    });

    it('should parse model with complex version string', () => {
      const result = parseCCRModel('anthropic,claude-3-opus-20240229');
      expect(result.provider).toBe('anthropic');
      expect(result.version).toBe('claude-3-opus-20240229');
    });

    it('should throw on missing comma', () => {
      expect(() => parseCCRModel('openai-gpt-4o')).toThrow(InvalidCCRModelError);
    });

    it('should throw on empty provider', () => {
      expect(() => parseCCRModel(',gpt-4o')).toThrow(InvalidCCRModelError);
    });

    it('should throw on empty version', () => {
      expect(() => parseCCRModel('openai,')).toThrow(InvalidCCRModelError);
    });

    it('should throw on invalid provider format', () => {
      expect(() => parseCCRModel('OpenAI,gpt-4o')).toThrow(InvalidCCRModelError);
    });

    it('should throw on empty string', () => {
      expect(() => parseCCRModel('')).toThrow(InvalidCCRModelError);
    });
  });

  describe('formatCCRModel', () => {
    it('should create valid CCR model string', () => {
      const model = formatCCRModel('openai', 'gpt-4o');
      expect(model).toBe('openai,gpt-4o');
    });

    it('should throw on invalid provider', () => {
      expect(() => formatCCRModel('OPENAI', 'gpt-4o')).toThrow(InvalidCCRModelError);
    });
  });

  describe('validateCCRModel', () => {
    it('should return true for valid model', () => {
      expect(validateCCRModel('openai,gpt-4o')).toBe(true);
    });

    it('should return false for invalid model', () => {
      expect(validateCCRModel('invalid')).toBe(false);
    });
  });
});

describe('ModelResolver', () => {
  const config: CategoryModelConfig = {
    coding: ['openai,gpt-4o' as CCRModel, 'openai,gpt-4o-mini' as CCRModel],
    research: ['anthropic,claude-3-opus' as CCRModel, 'anthropic,claude-3-sonnet' as CCRModel],
  };

  const resolver = new ModelResolver(config);

  describe('resolve', () => {
    it('should use prompt override when provided', () => {
      const result = resolver.resolve({
        category: 'coding',
        promptOverride: 'anthropic,claude-3-opus' as CCRModel,
        agentDefault: 'openai,gpt-4o-mini' as CCRModel,
      });
      expect(result).toBe('anthropic,claude-3-opus');
    });

    it('should use agent default when prompt override not provided', () => {
      const result = resolver.resolve({
        category: 'coding',
        agentDefault: 'anthropic,claude-3-sonnet' as CCRModel,
      });
      expect(result).toBe('anthropic,claude-3-sonnet');
    });

    it('should use workflow default when agent default not provided', () => {
      const result = resolver.resolve({
        category: 'coding',
        workflowDefault: 'anthropic,claude-3-opus' as CCRModel,
      });
      expect(result).toBe('anthropic,claude-3-opus');
    });

    it('should use category index 0 (smartest) by default', () => {
      const result = resolver.resolve({ category: 'coding' });
      expect(result).toBe('openai,gpt-4o');
    });

    it('should use specified model index', () => {
      const result = resolver.resolve({ category: 'coding', modelIndex: 1 });
      expect(result).toBe('openai,gpt-4o-mini');
    });

    it('should fallback to last model if index exceeds array', () => {
      const result = resolver.resolve({ category: 'coding', modelIndex: 99 });
      expect(result).toBe('openai,gpt-4o-mini');
    });

    it('should throw on unknown category', () => {
      expect(() => resolver.resolve({ category: 'unknown' })).toThrow(ModelResolutionError);
    });
  });

  describe('getNextFallback', () => {
    it('should return next model in sequence', () => {
      const next = resolver.getNextFallback('coding', 0);
      expect(next).toBe('openai,gpt-4o-mini');
    });

    it('should return undefined when no more fallbacks', () => {
      const next = resolver.getNextFallback('coding', 1);
      expect(next).toBeUndefined();
    });

    it('should return undefined for unknown category', () => {
      const next = resolver.getNextFallback('unknown', 0);
      expect(next).toBeUndefined();
    });
  });

  describe('hasCategory', () => {
    it('should return true for existing category', () => {
      expect(resolver.hasCategory('coding')).toBe(true);
    });

    it('should return false for non-existent category', () => {
      expect(resolver.hasCategory('unknown')).toBe(false);
    });
  });
});

describe('CCRRouter', () => {
  const config: CategoryModelConfig = {
    coding: ['openai,gpt-4o' as CCRModel, 'openai,gpt-4o-mini' as CCRModel],
  };

  describe('run with automatic fallback', () => {
    it('should return response from first successful model', async () => {
      const mockCCR: CCR = {
        run: async () => ({
          content: [{ type: 'text', text: 'success' }],
          usage: { tokensIn: 10, tokensOut: 5 },
        }),
      };

      const router = new CCRRouter(mockCCR, config);
      const response = await router.run({ messages: [] }, 'coding');

      expect(response.content[0]).toEqual({ type: 'text', text: 'success' });
    });

    it('should fallback to next model on failure', async () => {
      let callCount = 0;
      const mockCCR: CCR = {
        run: async (req: CCRRequest) => {
          callCount++;
          if (req.model === 'openai,gpt-4o') {
            throw new Error('Network error');
          }
          return {
            content: [{ type: 'text', text: 'fallback success' }],
            usage: { tokensIn: 10, tokensOut: 5 },
          };
        },
      };

      const router = new CCRRouter(mockCCR, config);
      const attempts: string[] = [];

      const response = await router.run({ messages: [] }, 'coding', (event) => {
        attempts.push(event.model);
      });

      expect(callCount).toBe(2);
      expect(attempts).toEqual(['openai,gpt-4o', 'openai,gpt-4o-mini']);
      expect(response.content[0]).toEqual({ type: 'text', text: 'fallback success' });
    });

    it('should throw CCRRoutingError when all models fail', async () => {
      const mockCCR: CCR = {
        run: async () => {
          throw new Error('All models down');
        },
      };

      const router = new CCRRouter(mockCCR, config);

      await expect(router.run({ messages: [] }, 'coding')).rejects.toThrow(CCRRoutingError);
    });

    it('should not retry on validation errors', async () => {
      let callCount = 0;
      const mockCCR: CCR = {
        run: async () => {
          callCount++;
          const error = new Error('Invalid request');
          error.name = 'ZodError';
          throw error;
        },
      };

      const router = new CCRRouter(mockCCR, config);

      await expect(router.run({ messages: [] }, 'coding')).rejects.toThrow();
      expect(callCount).toBe(1); // Should not retry
    });

    it('should throw on unknown category', async () => {
      const mockCCR: CCR = {
        run: async () => ({ content: [], usage: { tokensIn: 0, tokensOut: 0 } }),
      };

      const router = new CCRRouter(mockCCR, config);

      await expect(router.run({ messages: [] }, 'unknown')).rejects.toThrow(ModelResolutionError);
    });
  });
});
