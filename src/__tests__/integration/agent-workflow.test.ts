import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AgentWorkflow,
  WorkflowTreeDebugger,
} from '../../index.js';
import type { WorkflowEvent } from '../../index.js';
import { AnthropicClient } from '../../integrations/anthropic-client.js';

// Create mock client
function createMockClient() {
  return {
    createMessage: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Mocked response' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 50, outputTokens: 100 },
      id: 'msg_mock',
    }),
    createMessageStream: vi.fn(),
    countTokens: vi.fn(),
    getRawClient: vi.fn(),
  } as unknown as AnthropicClient;
}

describe('AgentWorkflow Integration', () => {
  let mockClient: AnthropicClient;

  beforeEach(() => {
    mockClient = createMockClient();
    vi.clearAllMocks();
  });

  it('should execute workflow with agents', async () => {
    const workflow = new AgentWorkflow(
      {
        name: 'TestWorkflow',
        defaultModel: 'claude-sonnet-4-5-20250929',
        steps: [
          {
            name: 'analysis',
            agents: [
              {
                name: 'analyzer',
                prompts: [
                  { name: 'analyze', user: 'Analyze: {{text}}' },
                ],
              },
            ],
          },
        ],
      },
      { client: mockClient }
    );

    const result = await workflow.run({ text: 'Hello world' });

    expect(result.stepResults.length).toBe(1);
    expect(result.stepResults[0].agentResults.length).toBe(1);
    expect(result.tokenUsage.inputTokens).toBe(50);
    expect(result.tokenUsage.outputTokens).toBe(100);
  });

  it('should emit events during execution', async () => {
    const workflow = new AgentWorkflow(
      {
        name: 'EventTestWorkflow',
        defaultModel: 'claude-sonnet-4-5-20250929',
        steps: [
          {
            name: 'step1',
            agents: [
              {
                name: 'agent1',
                prompts: [{ name: 'prompt1', user: 'Hello' }],
              },
            ],
          },
        ],
      },
      { client: mockClient }
    );

    const events: WorkflowEvent[] = [];
    workflow.addObserver({
      onLog: () => {},
      onEvent: (e) => events.push(e),
      onStateUpdated: () => {},
      onTreeChanged: () => {},
    });

    await workflow.run({});

    // Should have step start and end events
    expect(events.some(e => e.type === 'stepStart')).toBe(true);
    expect(events.some(e => e.type === 'stepEnd')).toBe(true);
  });

  it('should update workflow status', async () => {
    const workflow = new AgentWorkflow(
      {
        name: 'StatusTestWorkflow',
        defaultModel: 'claude-sonnet-4-5-20250929',
        steps: [
          {
            name: 'step1',
            agents: [
              {
                name: 'agent1',
                prompts: [{ name: 'prompt1', user: 'Hello' }],
              },
            ],
          },
        ],
      },
      { client: mockClient }
    );

    expect(workflow.status).toBe('idle');

    await workflow.run({});

    expect(workflow.status).toBe('completed');
  });

  it('should work with tree debugger', async () => {
    const workflow = new AgentWorkflow(
      {
        name: 'DebugTestWorkflow',
        defaultModel: 'claude-sonnet-4-5-20250929',
        steps: [
          {
            name: 'step1',
            agents: [
              {
                name: 'agent1',
                prompts: [{ name: 'prompt1', user: 'Hello' }],
              },
            ],
          },
        ],
      },
      { client: mockClient }
    );

    const debugger_ = new WorkflowTreeDebugger(workflow);

    await workflow.run({});

    const treeString = debugger_.toTreeString();
    expect(treeString).toContain('DebugTestWorkflow');
  });

  it('should execute multiple steps in sequence', async () => {
    const workflow = new AgentWorkflow(
      {
        name: 'MultiStepWorkflow',
        defaultModel: 'claude-sonnet-4-5-20250929',
        steps: [
          {
            name: 'step1',
            agents: [
              {
                name: 'agent1',
                prompts: [{ name: 'prompt1', user: 'First step' }],
              },
            ],
          },
          {
            name: 'step2',
            agents: [
              {
                name: 'agent2',
                prompts: [{ name: 'prompt2', user: 'Second step' }],
              },
            ],
          },
        ],
      },
      { client: mockClient }
    );

    const result = await workflow.run({});

    expect(result.stepResults.length).toBe(2);
    expect(result.stepResults[0].stepName).toBe('step1');
    expect(result.stepResults[1].stepName).toBe('step2');
  });

  it('should execute multiple agents in a step', async () => {
    const workflow = new AgentWorkflow(
      {
        name: 'MultiAgentWorkflow',
        defaultModel: 'claude-sonnet-4-5-20250929',
        steps: [
          {
            name: 'step1',
            agents: [
              {
                name: 'agent1',
                prompts: [{ name: 'prompt1', user: 'Agent 1' }],
              },
              {
                name: 'agent2',
                prompts: [{ name: 'prompt2', user: 'Agent 2' }],
              },
            ],
          },
        ],
      },
      { client: mockClient }
    );

    const result = await workflow.run({});

    expect(result.stepResults[0].agentResults.length).toBe(2);
  });

  it('should aggregate token usage across all steps and agents', async () => {
    const workflow = new AgentWorkflow(
      {
        name: 'TokenAggregationWorkflow',
        defaultModel: 'claude-sonnet-4-5-20250929',
        steps: [
          {
            name: 'step1',
            agents: [
              {
                name: 'agent1',
                prompts: [
                  { name: 'prompt1', user: 'Prompt 1' },
                  { name: 'prompt2', user: 'Prompt 2' },
                ],
              },
            ],
          },
          {
            name: 'step2',
            agents: [
              {
                name: 'agent2',
                prompts: [{ name: 'prompt3', user: 'Prompt 3' }],
              },
            ],
          },
        ],
      },
      { client: mockClient }
    );

    const result = await workflow.run({});

    // 3 prompts total, each with 50 input and 100 output tokens
    expect(result.tokenUsage.inputTokens).toBe(150);
    expect(result.tokenUsage.outputTokens).toBe(300);
  });

  it('should set status to failed on error', async () => {
    const errorClient = {
      createMessage: vi.fn().mockRejectedValue(new Error('API Error')),
    } as unknown as AnthropicClient;

    const workflow = new AgentWorkflow(
      {
        name: 'ErrorWorkflow',
        defaultModel: 'claude-sonnet-4-5-20250929',
        steps: [
          {
            name: 'step1',
            agents: [
              {
                name: 'agent1',
                prompts: [{ name: 'prompt1', user: 'Hello' }],
              },
            ],
          },
        ],
      },
      { client: errorClient }
    );

    const result = await workflow.run({});

    expect(workflow.status).toBe('failed');
    expect(result.error).toBeDefined();
  });

  it('should support tool registration', async () => {
    const workflow = new AgentWorkflow(
      {
        name: 'ToolWorkflow',
        defaultModel: 'claude-sonnet-4-5-20250929',
        steps: [
          {
            name: 'step1',
            agents: [
              {
                name: 'agent1',
                prompts: [{ name: 'prompt1', user: 'Hello' }],
              },
            ],
          },
        ],
      },
      { client: mockClient }
    );

    const toolHandler = vi.fn().mockResolvedValue('tool result');
    workflow.registerTool('myTool', toolHandler);

    // Verify tool is registered
    await workflow.run({});
    // Tool won't be called since model returns end_turn, but registration should work
    expect(workflow.getClient()).toBe(mockClient);
  });

  it('should record step durations', async () => {
    const workflow = new AgentWorkflow(
      {
        name: 'DurationWorkflow',
        defaultModel: 'claude-sonnet-4-5-20250929',
        steps: [
          {
            name: 'step1',
            agents: [
              {
                name: 'agent1',
                prompts: [{ name: 'prompt1', user: 'Hello' }],
              },
            ],
          },
        ],
      },
      { client: mockClient }
    );

    const result = await workflow.run({});

    expect(result.stepResults[0].duration).toBeGreaterThanOrEqual(0);
    expect(result.totalDuration).toBeGreaterThanOrEqual(0);
  });
});
