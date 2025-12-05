import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { PromptInstance } from '../../core/prompt-instance.js';
import { AnthropicClient } from '../../integrations/anthropic-client.js';
import type { PromptConfig } from '../../types/index.js';

// Create mock client
function createMockClient() {
  return {
    createMessage: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Test response' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 20 },
      id: 'msg_123',
    }),
    createMessageStream: vi.fn(),
    countTokens: vi.fn(),
    getRawClient: vi.fn(),
  } as unknown as AnthropicClient;
}

describe('PromptInstance', () => {
  let mockClient: AnthropicClient;

  beforeEach(() => {
    mockClient = createMockClient();
    vi.clearAllMocks();
  });

  it('should create instance with frozen config', () => {
    const config: PromptConfig = {
      name: 'test',
      user: 'Hello {{name}}',
    };

    const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', { name: 'World' });

    expect(instance.config.name).toBe('test');
    expect(Object.isFrozen(instance.config)).toBe(true);
  });

  it('should generate unique ids', () => {
    const config: PromptConfig = {
      name: 'test',
      user: 'Hello',
    };

    const instance1 = new PromptInstance(config, 'model', {});
    const instance2 = new PromptInstance(config, 'model', {});

    expect(instance1.id).not.toBe(instance2.id);
  });

  it('should use provided id if specified', () => {
    const config: PromptConfig = {
      id: 'custom-id',
      name: 'test',
      user: 'Hello',
    };

    const instance = new PromptInstance(config, 'model', {});
    expect(instance.id).toBe('custom-id');
  });

  it('should store resolved model', () => {
    const config: PromptConfig = {
      name: 'test',
      user: 'Hello',
    };

    const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', {});
    expect(instance.resolvedModel).toBe('claude-sonnet-4-5-20250929');
  });

  it('should execute and return result', async () => {
    const config: PromptConfig = {
      name: 'test',
      user: 'Hello',
    };

    const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', {});
    const result = await instance.run(mockClient);

    expect(result.content).toBe('Test response');
    expect(result.error).toBeUndefined();
  });

  it('should track token usage', async () => {
    const config: PromptConfig = {
      name: 'test',
      user: 'Hello',
    };

    const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', {});
    const result = await instance.run(mockClient);

    expect(result.tokenUsage.inputTokens).toBe(10);
    expect(result.tokenUsage.outputTokens).toBe(20);
  });

  it('should track duration', async () => {
    const config: PromptConfig = {
      name: 'test',
      user: 'Hello',
    };

    const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', {});
    const result = await instance.run(mockClient);

    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should call beforeCall hook', async () => {
    const beforeCall = vi.fn((input) => input);
    const config: PromptConfig = {
      name: 'test',
      user: 'Hello',
      hooks: { beforeCall },
    };

    const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', { data: 'value' });
    await instance.run(mockClient);

    expect(beforeCall).toHaveBeenCalledWith({ data: 'value' });
  });

  it('should call afterCall hook', async () => {
    const afterCall = vi.fn((result) => result);
    const config: PromptConfig = {
      name: 'test',
      user: 'Hello',
      hooks: { afterCall },
    };

    const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', {});
    await instance.run(mockClient);

    expect(afterCall).toHaveBeenCalled();
    expect(afterCall.mock.calls[0][0].content).toBe('Test response');
  });

  it('should handle API errors gracefully', async () => {
    const errorClient = {
      createMessage: vi.fn().mockRejectedValue(new Error('API Error')),
    } as unknown as AnthropicClient;

    const config: PromptConfig = {
      name: 'test',
      user: 'Hello',
    };

    const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', {});
    const result = await instance.run(errorClient);

    expect(result.error).toBeDefined();
    expect(String(result.error)).toContain('API Error');
    expect(result.content).toBe('');
  });

  it('should initialize empty tool calls and mcp events', async () => {
    const config: PromptConfig = {
      name: 'test',
      user: 'Hello',
    };

    const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', {});
    const result = await instance.run(mockClient);

    expect(result.toolCalls).toEqual([]);
    expect(result.mcpEvents).toEqual([]);
  });

  it('should include system prompt when provided', async () => {
    const config: PromptConfig = {
      name: 'test',
      system: 'You are a helpful assistant',
      user: 'Hello',
    };

    const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', {});
    await instance.run(mockClient);

    // Verify createMessage was called with system
    const createMessageMock = mockClient.createMessage as Mock;
    expect(createMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'You are a helpful assistant',
      })
    );
  });

  describe('variable interpolation', () => {
    it('should interpolate simple variables', async () => {
      const config: PromptConfig = {
        name: 'test',
        user: 'Hello {{name}}!',
      };

      const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', { name: 'World' });
      await instance.run(mockClient);

      const createMessageMock = mockClient.createMessage as Mock;
      const callArgs = createMessageMock.mock.calls[0][0];
      expect(callArgs.messages[0].content).toBe('Hello World!');
    });

    it('should interpolate nested variables', async () => {
      const config: PromptConfig = {
        name: 'test',
        user: 'User: {{user.name}}, Age: {{user.age}}',
      };

      const instance = new PromptInstance(
        config,
        'claude-sonnet-4-5-20250929',
        { user: { name: 'Alice', age: 30 } }
      );
      await instance.run(mockClient);

      const createMessageMock = mockClient.createMessage as Mock;
      const callArgs = createMessageMock.mock.calls[0][0];
      expect(callArgs.messages[0].content).toBe('User: Alice, Age: 30');
    });

    it('should leave unmatched placeholders', async () => {
      const config: PromptConfig = {
        name: 'test',
        user: 'Hello {{unknown}}!',
      };

      const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', { name: 'World' });
      await instance.run(mockClient);

      const createMessageMock = mockClient.createMessage as Mock;
      const callArgs = createMessageMock.mock.calls[0][0];
      expect(callArgs.messages[0].content).toBe('Hello {{unknown}}!');
    });

    it('should interpolate in system prompt', async () => {
      const config: PromptConfig = {
        name: 'test',
        system: 'You are {{role}}',
        user: 'Hello',
      };

      const instance = new PromptInstance(config, 'claude-sonnet-4-5-20250929', { role: 'a helpful assistant' });
      await instance.run(mockClient);

      const createMessageMock = mockClient.createMessage as Mock;
      const callArgs = createMessageMock.mock.calls[0][0];
      expect(callArgs.system).toBe('You are a helpful assistant');
    });
  });
});
