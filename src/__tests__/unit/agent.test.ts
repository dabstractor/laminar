import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agents/agent.js';
import { Prompt } from '../../prompts/prompt.js';
import { LRUAgentCache } from '../../cache/agent-cache.js';
import { RuntimeEventBus } from '../../events/event-bus.js';
import { CCRRouter } from '../../models/router.js';
import type { CCR, CCRResponse } from '../../models/ccr.js';
import type { CCRModel, CategoryModelConfig } from '../../types/model.js';
import type { AgentConfig } from '../../types/agent.js';

// Helper to create a mock CCR
function createMockCCR(response: Partial<CCRResponse> = {}): CCR {
  return {
    run: async () => ({
      content: [{ type: 'text', text: JSON.stringify({ result: 'success' }) }],
      usage: { tokensIn: 10, tokensOut: 5 },
      ...response,
    }),
  };
}

// Helper to create test setup
function createTestSetup(
  agentConfig: AgentConfig = {},
  mockResponse?: Partial<CCRResponse>
) {
  const config: CategoryModelConfig = {
    default: ['openai,gpt-4o' as CCRModel],
    coding: ['openai,gpt-4o' as CCRModel, 'openai,gpt-4o-mini' as CCRModel],
  };

  const mockCCR = createMockCCR(mockResponse);
  const router = new CCRRouter(mockCCR, config);
  const cache = new LRUAgentCache(100);
  const eventBus = new RuntimeEventBus();
  const agent = new Agent(agentConfig);

  agent.setExecutionContext({ router, cache, eventBus });

  return { agent, router, cache, eventBus, mockCCR };
}

describe('Agent', () => {
  describe('instantiation', () => {
    it('should create agent with default values', () => {
      const agent = new Agent();

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('Agent');
      expect(agent.category).toBeUndefined();
      expect(agent.tools).toEqual([]);
      expect(agent.mcps).toEqual([]);
    });

    it('should create agent with provided config', () => {
      const agent = new Agent({
        name: 'TestAgent',
        category: 'coding',
        defaultModel: 'openai,gpt-4o' as CCRModel,
        enableCache: false,
      });

      expect(agent.name).toBe('TestAgent');
      expect(agent.category).toBe('coding');
      expect(agent.getDefaultModel()).toBe('openai,gpt-4o');
      expect(agent.isCacheEnabled()).toBe(false);
    });

    it('should freeze tools and mcps arrays', () => {
      const agent = new Agent({
        tools: [{ name: 'tool1', description: 'd', inputSchema: {}, execute: async () => {} }],
        mcps: [{ name: 'mcp1', url: 'http://localhost' }],
      });

      expect(Object.isFrozen(agent.tools)).toBe(true);
      expect(Object.isFrozen(agent.mcps)).toBe(true);
    });
  });

  describe('configuration merging', () => {
    it('should merge runtime tools with config tools', () => {
      const { agent } = createTestSetup({
        tools: [{ name: 'configTool', description: 'd', inputSchema: {}, execute: async () => {} }],
      });

      const merged = agent.getMergedTools({
        tools: [{ name: 'runtimeTool', description: 'd', inputSchema: {}, execute: async () => {} }],
      });

      expect(merged).toHaveLength(2);
      expect(merged.map(t => t.name)).toEqual(['configTool', 'runtimeTool']);
    });

    it('should merge runtime MCPs with config MCPs', () => {
      const { agent } = createTestSetup({
        mcps: [{ name: 'configMcp', url: 'http://config' }],
      });

      const merged = agent.getMergedMcps({
        mcps: [{ name: 'runtimeMcp', url: 'http://runtime' }],
      });

      expect(merged).toHaveLength(2);
      expect(merged.map(m => m.name)).toEqual(['configMcp', 'runtimeMcp']);
    });
  });

  describe('prompt execution', () => {
    it('should throw if execution context not set', async () => {
      const agent = new Agent();
      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: z.object({ result: z.string() }),
      });

      await expect(agent.prompt(prompt)).rejects.toThrow(
        'Agent must have execution context set before calling prompt()'
      );
    });

    it('should execute prompt and return validated result', async () => {
      const { agent } = createTestSetup();
      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: z.object({ result: z.string() }),
      });

      const result = await agent.prompt(prompt);

      expect(result).toEqual({ result: 'success' });
    });

    it('should use cached result on cache hit', async () => {
      const { agent, cache } = createTestSetup();
      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: z.object({ result: z.string() }),
      });

      // First call - populates cache
      const result1 = await agent.prompt(prompt);

      // Second call - should use cache
      const result2 = await agent.prompt(prompt);

      expect(result1).toEqual(result2);
    });

    it('should skip cache when disableCache is true', async () => {
      const callCount = { value: 0 };
      const mockCCR: CCR = {
        run: async () => {
          callCount.value++;
          return {
            content: [{ type: 'text', text: JSON.stringify({ result: `call-${callCount.value}` }) }],
            usage: { tokensIn: 10, tokensOut: 5 },
          };
        },
      };

      const config: CategoryModelConfig = {
        default: ['openai,gpt-4o' as CCRModel],
      };

      const router = new CCRRouter(mockCCR, config);
      const cache = new LRUAgentCache(100);
      const agent = new Agent();
      agent.setExecutionContext({ router, cache });

      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: z.object({ result: z.string() }),
      });

      await agent.prompt(prompt);
      await agent.prompt(prompt, { disableCache: true });

      expect(callCount.value).toBe(2);
    });
  });

  describe('hooks', () => {
    it('should call beforePrompt hook', async () => {
      const beforePrompt = vi.fn();
      const { agent } = createTestSetup({
        hooks: { beforePrompt },
      });

      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: z.object({ result: z.string() }),
      });

      await agent.prompt(prompt);

      expect(beforePrompt).toHaveBeenCalledTimes(1);
      expect(beforePrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: agent.id,
          prompt: expect.any(Object),
        })
      );
    });

    it('should call afterPrompt hook with result', async () => {
      const afterPrompt = vi.fn();
      const { agent } = createTestSetup({
        hooks: { afterPrompt },
      });

      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: z.object({ result: z.string() }),
      });

      await agent.prompt(prompt);

      expect(afterPrompt).toHaveBeenCalledTimes(1);
      expect(afterPrompt).toHaveBeenCalledWith(
        expect.any(Object),
        { result: 'success' }
      );
    });

    it('should call onError hook on failure', async () => {
      const onError = vi.fn();
      const mockCCR: CCR = {
        run: async () => {
          throw new Error('API error');
        },
      };

      const config: CategoryModelConfig = {
        default: ['openai,gpt-4o' as CCRModel],
      };

      const router = new CCRRouter(mockCCR, config);
      const agent = new Agent({
        hooks: { onError },
      });
      agent.setExecutionContext({ router });

      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: z.object({ result: z.string() }),
      });

      await expect(agent.prompt(prompt)).rejects.toThrow();
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('should continue execution if hook throws', async () => {
      const beforePrompt = vi.fn(() => {
        throw new Error('Hook error');
      });
      const { agent } = createTestSetup({
        hooks: { beforePrompt },
      });

      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: z.object({ result: z.string() }),
      });

      // Should not throw, hook errors are caught
      const result = await agent.prompt(prompt);
      expect(result).toEqual({ result: 'success' });
    });
  });

  describe('events', () => {
    it('should emit agent.start and agent.end events', async () => {
      const { agent, eventBus } = createTestSetup();
      const events: string[] = [];

      eventBus.subscribe((event) => {
        events.push(event.type);
      });

      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: z.object({ result: z.string() }),
      });

      await agent.prompt(prompt);

      expect(events).toContain('agent.start');
      expect(events).toContain('agent.end');
    });

    it('should emit cache.hit on cache hit', async () => {
      const { agent, eventBus } = createTestSetup();
      const events: string[] = [];

      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: z.object({ result: z.string() }),
      });

      // First call to populate cache
      await agent.prompt(prompt);

      eventBus.subscribe((event) => {
        events.push(event.type);
      });

      // Second call should hit cache
      await agent.prompt(prompt);

      expect(events).toContain('cache.hit');
    });

    it('should emit error event on failure', async () => {
      const mockCCR: CCR = {
        run: async () => {
          throw new Error('API error');
        },
      };

      const config: CategoryModelConfig = {
        default: ['openai,gpt-4o' as CCRModel],
      };

      const router = new CCRRouter(mockCCR, config);
      const eventBus = new RuntimeEventBus();
      const events: string[] = [];

      eventBus.subscribe((event) => {
        events.push(event.type);
      });

      const agent = new Agent();
      agent.setExecutionContext({ router, eventBus });

      const prompt = new Prompt({
        userPrompt: 'test',
        responseFormat: z.object({ result: z.string() }),
      });

      await expect(agent.prompt(prompt)).rejects.toThrow();
      expect(events).toContain('error');
    });
  });

  describe('reflect', () => {
    it('should create reflection prompt with modified user prompt', async () => {
      let capturedPrompt: string = '';
      const mockCCR: CCR = {
        run: async (req) => {
          capturedPrompt = req.messages[0].content;
          return {
            content: [{ type: 'text', text: JSON.stringify({ result: 'reflected' }) }],
            usage: { tokensIn: 10, tokensOut: 5 },
          };
        },
      };

      const config: CategoryModelConfig = {
        default: ['openai,gpt-4o' as CCRModel],
      };

      const router = new CCRRouter(mockCCR, config);
      const agent = new Agent();
      agent.setExecutionContext({ router });

      const prompt = new Prompt({
        userPrompt: 'Original prompt',
        responseFormat: z.object({ result: z.string() }),
      });

      await agent.reflect(prompt);

      expect(capturedPrompt).toContain('REFLECTION REQUEST');
      expect(capturedPrompt).toContain('Original prompt');
    });
  });
});
