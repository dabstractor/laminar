import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Prompt, PromptValidationError } from '../../prompts/prompt.js';
import type { CCRModel } from '../../types/model.js';

describe('Prompt', () => {
  describe('immutability', () => {
    it('should be frozen after construction', () => {
      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: z.string(),
      });

      expect(Object.isFrozen(prompt)).toBe(true);
    });

    it('should have frozen data object', () => {
      const prompt = new Prompt({
        userPrompt: 'test',
        data: { key: 'value' },
        responseFormat: z.string(),
      });

      expect(Object.isFrozen(prompt.data)).toBe(true);
    });

    it('should not allow modification', () => {
      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: z.string(),
      });

      expect(() => {
        (prompt as any).userPrompt = 'modified';
      }).toThrow();
    });
  });

  describe('data rendering', () => {
    it('should substitute placeholders with data values', () => {
      const prompt = new Prompt({
        userPrompt: 'Hello {name}, welcome to {place}!',
        data: { name: 'Alice', place: 'Wonderland' },
        responseFormat: z.string(),
      });

      expect(prompt.render()).toBe('Hello Alice, welcome to Wonderland!');
    });

    it('should handle missing placeholders gracefully', () => {
      const prompt = new Prompt({
        userPrompt: 'Hello {name}!',
        data: {},
        responseFormat: z.string(),
      });

      expect(prompt.render()).toBe('Hello {name}!');
    });

    it('should handle empty data', () => {
      const prompt = new Prompt({
        userPrompt: 'No placeholders here',
        responseFormat: z.string(),
      });

      expect(prompt.render()).toBe('No placeholders here');
    });

    it('should substitute multiple occurrences', () => {
      const prompt = new Prompt({
        userPrompt: '{x} + {x} = {result}',
        data: { x: '2', result: '4' },
        responseFormat: z.string(),
      });

      expect(prompt.render()).toBe('2 + 2 = 4');
    });
  });

  describe('Zod validation', () => {
    it('should validate and return typed result', () => {
      const schema = z.object({
        code: z.string(),
        language: z.string(),
      });

      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: schema,
      });

      const result = prompt.validate({ code: 'console.log(1)', language: 'typescript' });
      expect(result.code).toBe('console.log(1)');
      expect(result.language).toBe('typescript');
    });

    it('should throw PromptValidationError on validation failure', () => {
      const schema = z.object({
        code: z.string(),
        language: z.string(),
      });

      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: schema,
      });

      expect(() => prompt.validate({ code: 'test' })).toThrow(PromptValidationError);
    });

    it('should call onError handler on validation failure', () => {
      const onError = vi.fn();
      const schema = z.string();

      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: schema,
        onError,
      });

      expect(() => prompt.validate(123)).toThrow();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.any(PromptValidationError));
    });

    it('should include zodError in PromptValidationError', () => {
      const schema = z.string();

      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: schema,
      });

      try {
        prompt.validate(123);
      } catch (error) {
        expect(error).toBeInstanceOf(PromptValidationError);
        expect((error as PromptValidationError).zodError).toBeDefined();
      }
    });
  });

  describe('with() method', () => {
    it('should create new prompt with updated values', () => {
      const original = new Prompt({
        userPrompt: 'original',
        data: { a: 1 },
        responseFormat: z.string(),
      });

      const updated = original.with({ userPrompt: 'updated' });

      expect(original.userPrompt).toBe('original');
      expect(updated.userPrompt).toBe('updated');
      expect(updated.data).toEqual({ a: 1 });
    });

    it('should preserve original when no updates provided', () => {
      const original = new Prompt({
        userPrompt: 'test',
        responseFormat: z.string(),
        modelOverride: 'openai,gpt-4o' as CCRModel,
      });

      const updated = original.with({});

      expect(updated.userPrompt).toBe('test');
      expect(updated.modelOverride).toBe('openai,gpt-4o');
    });

    it('should allow updating model override', () => {
      const original = new Prompt({
        userPrompt: 'test',
        responseFormat: z.string(),
      });

      const updated = original.with({ modelOverride: 'anthropic,claude-3-opus' as CCRModel });

      expect(original.modelOverride).toBeUndefined();
      expect(updated.modelOverride).toBe('anthropic,claude-3-opus');
    });
  });

  describe('properties', () => {
    it('should expose all configuration properties', () => {
      const schema = z.object({ result: z.string() });
      const onError = () => {};

      const prompt = new Prompt({
        userPrompt: 'Generate {thing}',
        data: { thing: 'code' },
        responseFormat: schema,
        modelOverride: 'openai,gpt-4o' as CCRModel,
        onError,
      });

      expect(prompt.userPrompt).toBe('Generate {thing}');
      expect(prompt.data).toEqual({ thing: 'code' });
      expect(prompt.responseFormat).toBe(schema);
      expect(prompt.modelOverride).toBe('openai,gpt-4o');
      expect(prompt.onError).toBe(onError);
    });

    it('should default data to empty object', () => {
      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: z.string(),
      });

      expect(prompt.data).toEqual({});
    });
  });
});
