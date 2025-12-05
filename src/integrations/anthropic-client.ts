import Anthropic from '@anthropic-ai/sdk';
import type { TokenUsage } from '../types/index.js';

// Re-export Anthropic types for convenience
export type MessageParam = Anthropic.Messages.MessageParam;
export type ContentBlock = Anthropic.Messages.ContentBlock;
export type Tool = Anthropic.Messages.Tool;
export type TextBlock = Anthropic.Messages.TextBlock;
export type ToolUseBlock = Anthropic.Messages.ToolUseBlock;

/**
 * Message parameters for API calls
 */
export interface MessageParams {
  model: string;
  max_tokens: number;
  system?: string;
  messages: MessageParam[];
  tools?: Tool[];
}

/**
 * Wrapper around Anthropic SDK for consistent usage
 */
export class AnthropicClient {
  private client: Anthropic;
  private maxRetries: number;

  constructor(options?: { apiKey?: string; maxRetries?: number }) {
    this.client = new Anthropic({
      apiKey: options?.apiKey ?? process.env.ANTHROPIC_API_KEY,
      maxRetries: options?.maxRetries ?? 3,
    });
    this.maxRetries = options?.maxRetries ?? 3;
  }

  /**
   * Create a message (non-streaming)
   */
  async createMessage(params: MessageParams): Promise<{
    content: ContentBlock[];
    stopReason: string | null;
    usage: TokenUsage;
    id: string;
  }> {
    const response = await this.client.messages.create(params);

    return {
      content: response.content,
      stopReason: response.stop_reason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      id: response.id,
    };
  }

  /**
   * Create a streaming message
   */
  createMessageStream(params: MessageParams): ReturnType<typeof this.client.messages.stream> {
    return this.client.messages.stream(params);
  }

  /**
   * Count tokens before sending
   */
  async countTokens(params: Omit<MessageParams, 'max_tokens'>): Promise<number> {
    const result = await this.client.messages.countTokens({
      model: params.model,
      system: params.system,
      messages: params.messages,
      tools: params.tools,
    });
    return result.input_tokens;
  }

  /**
   * Get the underlying Anthropic client
   */
  getRawClient(): Anthropic {
    return this.client;
  }
}
