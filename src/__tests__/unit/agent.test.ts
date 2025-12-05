import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../../core/agent.js';
import { AnthropicClient } from '../../integrations/anthropic-client.js';
import type { AgentConfig } from '../../types/index.js';

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

describe('Agent', () => {
  let mockClient: AnthropicClient;

  beforeEach(() => {
    mockClient = createMockClient();
    vi.clearAllMocks();
  });

  it('should create agent with unique id', () => {
    const config: AgentConfig = {
      name: 'TestAgent',
      prompts: [{ name: 'test', user: 'Hello' }],
    };

    const agent1 = new Agent(config);
    const agent2 = new Agent(config);

    expect(agent1.id).not.toBe(agent2.id);
  });

  it('should use provided id if specified', () => {
    const config: AgentConfig = {
      id: 'custom-id',
      name: 'TestAgent',
      prompts: [{ name: 'test', user: 'Hello' }],
    };

    const agent = new Agent(config);
    expect(agent.id).toBe('custom-id');
  });

  it('should resolve model from config', () => {
    const config: AgentConfig = {
      name: 'TestAgent',
      model: 'claude-sonnet-4-5-20250929',
      prompts: [{ name: 'test', user: 'Hello' }],
    };

    const agent = new Agent(config);
    expect(agent.config.model).toBe('claude-sonnet-4-5-20250929');
  });

  it('should execute prompts in sequence', async () => {
    const config: AgentConfig = {
      name: 'TestAgent',
      model: 'claude-sonnet-4-5-20250929',
      prompts: [
        { name: 'prompt1', user: 'First' },
        { name: 'prompt2', user: 'Second' },
      ],
    };

    const agent = new Agent(config);
    const result = await agent.run(mockClient, {});

    expect(result.promptResults.length).toBe(2);
    expect(result.error).toBeUndefined();
  });

  it('should aggregate token usage', async () => {
    const config: AgentConfig = {
      name: 'TestAgent',
      model: 'claude-sonnet-4-5-20250929',
      prompts: [
        { name: 'prompt1', user: 'First' },
        { name: 'prompt2', user: 'Second' },
      ],
    };

    const agent = new Agent(config);
    const result = await agent.run(mockClient, {});

    expect(result.tokenUsage.inputTokens).toBe(20); // 10 * 2
    expect(result.tokenUsage.outputTokens).toBe(40); // 20 * 2
  });

  it('should track retry count', async () => {
    const config: AgentConfig = {
      name: 'TestAgent',
      model: 'claude-sonnet-4-5-20250929',
      maxRetries: 2,
      prompts: [{ name: 'test', user: 'Hello' }],
    };

    const agent = new Agent(config);
    const result = await agent.run(mockClient, {});

    expect(result.retryCount).toBe(0); // No retries needed
  });

  it('should record total duration', async () => {
    const config: AgentConfig = {
      name: 'TestAgent',
      model: 'claude-sonnet-4-5-20250929',
      prompts: [{ name: 'test', user: 'Hello' }],
    };

    const agent = new Agent(config);
    const result = await agent.run(mockClient, {});

    expect(result.totalDuration).toBeGreaterThanOrEqual(0);
  });

  it('should throw error if no model configured', async () => {
    const config: AgentConfig = {
      name: 'TestAgent',
      prompts: [{ name: 'test', user: 'Hello' }],
    };

    const agent = new Agent(config);
    const result = await agent.run(mockClient, {});

    // Should have error because no model is configured
    expect(result.error).toBeDefined();
    expect(String(result.error)).toContain('No model configured');
  });

  it('should use parent model when agent model not specified', async () => {
    const config: AgentConfig = {
      name: 'TestAgent',
      prompts: [{ name: 'test', user: 'Hello' }],
    };

    const agent = new Agent(config, {
      parentModel: 'claude-sonnet-4-5-20250929',
    });

    const result = await agent.run(mockClient, {});
    expect(result.error).toBeUndefined();
    expect(result.promptResults.length).toBe(1);
  });

  it('should call beforeRun hook', async () => {
    const beforeRun = vi.fn((input) => ({ ...input, modified: true }));
    const config: AgentConfig = {
      name: 'TestAgent',
      model: 'claude-sonnet-4-5-20250929',
      prompts: [{ name: 'test', user: 'Hello' }],
      hooks: { beforeRun },
    };

    const agent = new Agent(config);
    await agent.run(mockClient, { original: true });

    expect(beforeRun).toHaveBeenCalled();
    expect(beforeRun).toHaveBeenCalledWith({ original: true });
  });

  it('should call afterRun hook', async () => {
    const afterRun = vi.fn((result) => result);
    const config: AgentConfig = {
      name: 'TestAgent',
      model: 'claude-sonnet-4-5-20250929',
      prompts: [{ name: 'test', user: 'Hello' }],
      hooks: { afterRun },
    };

    const agent = new Agent(config);
    await agent.run(mockClient, {});

    expect(afterRun).toHaveBeenCalled();
  });

  it('should handle errors from API', async () => {
    const errorClient = {
      createMessage: vi.fn().mockRejectedValue(new Error('API Error')),
    } as unknown as AnthropicClient;

    const config: AgentConfig = {
      name: 'TestAgent',
      model: 'claude-sonnet-4-5-20250929',
      prompts: [{ name: 'test', user: 'Hello' }],
    };

    const agent = new Agent(config);
    const result = await agent.run(errorClient, {});

    expect(result.error).toBeDefined();
    expect(String(result.error)).toContain('API Error');
  });
});
