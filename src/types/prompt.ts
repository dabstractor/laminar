import type { z } from 'zod';
import type { CCRModel } from './model.js';

/**
 * Configuration for creating a Prompt
 *
 * @typeParam T - The validated response type
 */
export interface PromptConfig<T> {
  /** The prompt text to send to the model */
  userPrompt: string;
  /** Optional data to include (for templating) */
  data?: Record<string, unknown>;
  /** Zod schema for response validation */
  responseFormat: z.ZodType<T>;
  /** Optional model override (highest priority) */
  modelOverride?: CCRModel;
  /** Optional error handler */
  onError?: (err: Error) => void;
}
