import type { ToolConfig } from '../types/agent.js';
import type { RuntimeEventBus } from '../events/event-bus.js';
import { generateId } from '../utils/id.js';

/**
 * Error thrown during tool execution
 */
export class ToolExecutionError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly originalError: Error
  ) {
    super(`Tool "${toolName}" failed: ${originalError.message}`);
    this.name = 'ToolExecutionError';
  }
}

/**
 * Executor for agent tools
 *
 * @remarks
 * Handles tool execution with event emission per PRD Section 10.
 * Tool results attach to the AgentRunNode.toolCalls array.
 */
export class ToolExecutor {
  private readonly toolMap: Map<string, ToolConfig>;

  constructor(
    tools: ToolConfig[],
    private readonly eventBus?: RuntimeEventBus
  ) {
    this.toolMap = new Map(tools.map(t => [t.name, t]));
  }

  /**
   * Execute a tool by name
   *
   * @param toolName - Name of the tool to execute
   * @param input - Input data for the tool
   * @param parentRunId - Parent agent run ID
   * @returns Tool execution result
   */
  async execute(
    toolName: string,
    input: unknown,
    parentRunId: string
  ): Promise<unknown> {
    const tool = this.toolMap.get(toolName);

    if (!tool) {
      throw new ToolExecutionError(
        toolName,
        new Error(`Tool "${toolName}" not found`)
      );
    }

    const startTime = Date.now();

    // Emit tool.start event
    this.eventBus?.emit({
      type: 'tool.start',
      nodeType: 'tool',
      name: toolName,
      parentId: parentRunId,
      payload: { input },
    });

    try {
      const result = await tool.execute(input);

      // Emit tool.end event
      this.eventBus?.emit({
        type: 'tool.end',
        nodeType: 'tool',
        name: toolName,
        parentId: parentRunId,
        metrics: { durationMs: Date.now() - startTime },
        payload: { output: result },
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Emit error event
      this.eventBus?.emit({
        type: 'error',
        nodeType: 'tool',
        name: toolName,
        parentId: parentRunId,
        payload: { error: err.message },
      });

      throw new ToolExecutionError(toolName, err);
    }
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.toolMap.has(name);
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.toolMap.keys());
  }
}
