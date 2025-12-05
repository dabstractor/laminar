import type {
  PromptConfig,
  PromptResult,
  ToolCallEvent,
  MCPEvent,
  TokenUsage,
  WorkflowEvent,
} from '../types/index.js';
import { generateId } from '../utils/id.js';
import { emptyTokenUsage, aggregateTokenUsage } from '../utils/token-aggregator.js';
import {
  AnthropicClient,
  type MessageParams,
  type MessageParam,
  type ContentBlock,
  type TextBlock,
  type ToolUseBlock,
  type Tool,
} from '../integrations/anthropic-client.js';
import { Observable } from '../utils/observable.js';

/**
 * Immutable prompt instance for a single execution
 */
export class PromptInstance {
  /** Unique ID for this instance */
  public readonly id: string;

  /** Frozen prompt config */
  public readonly config: Readonly<PromptConfig>;

  /** Resolved model for execution */
  public readonly resolvedModel: string;

  /** Input data for interpolation */
  public readonly input: unknown;

  /** Observable for events */
  private eventObservable: Observable<WorkflowEvent> | null = null;

  /** Tool handlers */
  private toolHandlers: Map<string, (input: unknown) => Promise<unknown>> = new Map();

  constructor(
    config: PromptConfig,
    resolvedModel: string,
    input: unknown,
    options?: {
      eventObservable?: Observable<WorkflowEvent>;
      toolHandlers?: Map<string, (input: unknown) => Promise<unknown>>;
    }
  ) {
    this.id = config.id ?? generateId();
    this.config = Object.freeze({ ...config });
    this.resolvedModel = resolvedModel;
    this.input = input;
    this.eventObservable = options?.eventObservable ?? null;
    this.toolHandlers = options?.toolHandlers ?? new Map();
  }

  /**
   * Interpolate template variables in a string
   * Supports {{path.to.value}} syntax
   */
  private interpolate(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const keys = path.trim().split('.');
      let value: unknown = context;

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = (value as Record<string, unknown>)[key];
        } else {
          // Leave placeholder if path not found
          return match;
        }
      }

      return String(value ?? match);
    });
  }

  /**
   * Emit an event to the observable
   */
  private emit(event: WorkflowEvent): void {
    if (this.eventObservable) {
      this.eventObservable.next(event);
    }
  }

  /**
   * Check if a content block is a text block
   */
  private isTextBlock(block: ContentBlock): block is TextBlock {
    return block.type === 'text';
  }

  /**
   * Check if a content block is a tool use block
   */
  private isToolUseBlock(block: ContentBlock): block is ToolUseBlock {
    return block.type === 'tool_use';
  }

  /**
   * Execute the prompt
   */
  async run(client: AnthropicClient): Promise<PromptResult> {
    const startTime = Date.now();
    const toolCalls: ToolCallEvent[] = [];
    const mcpEvents: MCPEvent[] = [];
    let totalUsage = emptyTokenUsage();

    // Apply beforeCall hook
    let processedInput = this.input;
    if (this.config.hooks?.beforeCall) {
      processedInput = await this.config.hooks.beforeCall(this.input);
    }

    // Emit start event
    this.emit({
      type: 'promptInstanceStart',
      promptId: this.id,
      promptName: this.config.name,
      input: processedInput,
      timestamp: startTime,
    });

    try {
      // Build context for interpolation
      const context = typeof processedInput === 'object' && processedInput !== null
        ? processedInput as Record<string, unknown>
        : { input: processedInput };

      // Interpolate templates
      const userContent = this.interpolate(this.config.user, context);
      const systemContent = this.config.system
        ? this.interpolate(this.config.system, context)
        : undefined;

      // Build messages
      const messages: MessageParam[] = [
        { role: 'user', content: userContent }
      ];

      // Build tool definitions if available
      const tools: Tool[] | undefined = this.toolHandlers.size > 0
        ? Array.from(this.toolHandlers.keys()).map(name => ({
            name,
            description: `Tool: ${name}`,
            input_schema: { type: 'object' as const, properties: {} },
          }))
        : undefined;

      // Execute API call with agentic loop
      let response = await client.createMessage({
        model: this.resolvedModel,
        max_tokens: 4096,
        system: systemContent,
        messages,
        tools,
      });

      totalUsage = aggregateTokenUsage([totalUsage, response.usage]);

      // Handle tool calls in a loop
      while (response.stopReason === 'tool_use') {
        // Add assistant response to messages
        messages.push({
          role: 'assistant',
          content: response.content,
        });

        // Process tool calls
        const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

        for (const block of response.content) {
          if (this.isToolUseBlock(block)) {
            const toolStartTime = Date.now();
            const toolId = generateId();

            // Emit tool start
            this.emit({
              type: 'toolCallStart',
              toolId,
              toolName: block.name,
              input: block.input,
              parentPromptId: this.id,
              timestamp: toolStartTime,
            });

            let toolOutput: unknown;
            let toolError: unknown;

            try {
              const handler = this.toolHandlers.get(block.name);
              if (handler) {
                // Call onTool hook
                const toolCallEvent: ToolCallEvent = {
                  id: toolId,
                  toolName: block.name,
                  input: block.input,
                  duration: 0,
                  parentPromptId: this.id,
                };
                if (this.config.hooks?.onTool) {
                  await this.config.hooks.onTool(toolCallEvent);
                }

                toolOutput = await handler(block.input);
              } else {
                toolError = new Error(`Unknown tool: ${block.name}`);
              }
            } catch (err) {
              toolError = err;
            }

            const toolEndTime = Date.now();

            // Emit tool end
            this.emit({
              type: 'toolCallEnd',
              toolId,
              toolName: block.name,
              output: toolOutput,
              error: toolError,
              duration: toolEndTime - toolStartTime,
              parentPromptId: this.id,
            });

            // Record tool call
            toolCalls.push({
              id: toolId,
              toolName: block.name,
              input: block.input,
              output: toolOutput,
              error: toolError,
              duration: toolEndTime - toolStartTime,
              parentPromptId: this.id,
            });

            // Add to results
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: toolError ? String(toolError) : JSON.stringify(toolOutput),
            });
          }
        }

        // Add tool results
        messages.push({
          role: 'user',
          content: toolResults,
        });

        // Continue the loop
        response = await client.createMessage({
          model: this.resolvedModel,
          max_tokens: 4096,
          system: systemContent,
          messages,
          tools,
        });

        totalUsage = aggregateTokenUsage([totalUsage, response.usage]);
      }

      // Extract final text content
      const textContent = response.content
        .filter((b): b is TextBlock => this.isTextBlock(b))
        .map((b) => b.text)
        .join('\n');

      let result: PromptResult = {
        content: textContent,
        tokenUsage: totalUsage,
        duration: Date.now() - startTime,
        toolCalls,
        mcpEvents,
      };

      // Apply afterCall hook
      if (this.config.hooks?.afterCall) {
        result = await this.config.hooks.afterCall(result);
      }

      // Emit end event
      this.emit({
        type: 'promptInstanceEnd',
        promptId: this.id,
        promptName: this.config.name,
        result,
        duration: result.duration,
        tokenUsage: result.tokenUsage,
      });

      return result;

    } catch (error) {
      const result: PromptResult = {
        content: '',
        tokenUsage: totalUsage,
        duration: Date.now() - startTime,
        toolCalls,
        mcpEvents,
        error,
      };

      // Emit end event with error
      this.emit({
        type: 'promptInstanceEnd',
        promptId: this.id,
        promptName: this.config.name,
        result,
        duration: result.duration,
        tokenUsage: result.tokenUsage,
      });

      return result;
    }
  }

  /**
   * Execute with streaming
   */
  async *runStreaming(client: AnthropicClient): AsyncGenerator<{ type: 'token'; token: string } | { type: 'result'; result: PromptResult }> {
    const startTime = Date.now();
    const toolCalls: ToolCallEvent[] = [];
    const mcpEvents: MCPEvent[] = [];
    let totalUsage = emptyTokenUsage();
    let fullContent = '';

    // Apply beforeCall hook
    let processedInput = this.input;
    if (this.config.hooks?.beforeCall) {
      processedInput = await this.config.hooks.beforeCall(this.input);
    }

    // Emit start event
    this.emit({
      type: 'promptInstanceStart',
      promptId: this.id,
      promptName: this.config.name,
      input: processedInput,
      timestamp: startTime,
    });

    try {
      // Build context for interpolation
      const context = typeof processedInput === 'object' && processedInput !== null
        ? processedInput as Record<string, unknown>
        : { input: processedInput };

      // Interpolate templates
      const userContent = this.interpolate(this.config.user, context);
      const systemContent = this.config.system
        ? this.interpolate(this.config.system, context)
        : undefined;

      // Create streaming request
      const stream = client.createMessageStream({
        model: this.resolvedModel,
        max_tokens: 4096,
        system: systemContent,
        messages: [{ role: 'user' as const, content: userContent }],
      });

      // Process stream events
      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if ('text' in delta && typeof delta.text === 'string') {
            const token = delta.text;
            fullContent += token;

            // Emit token event
            this.emit({
              type: 'promptTokenReceived',
              promptId: this.id,
              token,
              timestamp: Date.now(),
            });

            yield { type: 'token', token };
          }
        }
      }

      // Get final message for usage
      const finalMessage = await stream.finalMessage();
      totalUsage = {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      };

      const result: PromptResult = {
        content: fullContent,
        tokenUsage: totalUsage,
        duration: Date.now() - startTime,
        toolCalls,
        mcpEvents,
      };

      // Apply afterCall hook
      let finalResult = result;
      if (this.config.hooks?.afterCall) {
        finalResult = await this.config.hooks.afterCall(result);
      }

      // Emit end event
      this.emit({
        type: 'promptInstanceEnd',
        promptId: this.id,
        promptName: this.config.name,
        result: finalResult,
        duration: finalResult.duration,
        tokenUsage: finalResult.tokenUsage,
      });

      yield { type: 'result', result: finalResult };

    } catch (error) {
      const result: PromptResult = {
        content: fullContent,
        tokenUsage: totalUsage,
        duration: Date.now() - startTime,
        toolCalls,
        mcpEvents,
        error,
      };

      // Emit end event with error
      this.emit({
        type: 'promptInstanceEnd',
        promptId: this.id,
        promptName: this.config.name,
        result,
        duration: result.duration,
        tokenUsage: result.tokenUsage,
      });

      yield { type: 'result', result };
    }
  }
}
