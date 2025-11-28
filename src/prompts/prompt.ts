import type { z } from 'zod';
import type { PromptConfig } from '../types/prompt.js';
import type { CCRModel } from '../types/model.js';

/**
 * Error thrown during prompt validation
 */
export class PromptValidationError extends Error {
  constructor(
    message: string,
    public readonly zodError: z.ZodError
  ) {
    super(message);
    this.name = 'PromptValidationError';
  }
}

/**
 * Immutable Prompt class
 *
 * @typeParam T - The validated response type
 *
 * @remarks
 * Per PRD Section 4.1, prompts are immutable and contain:
 * - User prompt text
 * - Optional data for templating
 * - Zod schema for response validation
 * - Optional model override
 * - Optional error handler
 *
 * @example
 * ```typescript
 * const prompt = new Prompt({
 *   userPrompt: "Generate a greeting for {name}",
 *   data: { name: "Alice" },
 *   responseFormat: z.object({ greeting: z.string() }),
 * });
 * ```
 */
export class Prompt<T> {
  /** The prompt text */
  public readonly userPrompt: string;

  /** Data for templating */
  public readonly data: Record<string, unknown>;

  /** Response validation schema */
  public readonly responseFormat: z.ZodType<T>;

  /** Optional model override */
  public readonly modelOverride: CCRModel | undefined;

  /** Optional error handler */
  public readonly onError: ((err: Error) => void) | undefined;

  /**
   * Create an immutable Prompt
   *
   * @param config - Prompt configuration
   */
  constructor(config: PromptConfig<T>) {
    this.userPrompt = config.userPrompt;
    this.data = Object.freeze({ ...(config.data ?? {}) });
    this.responseFormat = config.responseFormat;
    this.modelOverride = config.modelOverride;
    this.onError = config.onError;

    // Freeze the instance to ensure immutability
    Object.freeze(this);
  }

  /**
   * Validate raw response data against the schema
   *
   * @param raw - Raw response to validate
   * @returns Validated and typed response
   * @throws PromptValidationError on validation failure
   */
  validate(raw: unknown): T {
    const result = this.responseFormat.safeParse(raw);

    if (!result.success) {
      const error = new PromptValidationError(
        `Response validation failed: ${result.error.message}`,
        result.error
      );

      // Call error handler if provided
      this.onError?.(error);

      throw error;
    }

    return result.data;
  }

  /**
   * Render the prompt with data substitution
   *
   * @returns Prompt text with {key} placeholders replaced by data values
   */
  render(): string {
    let rendered = this.userPrompt;

    for (const [key, value] of Object.entries(this.data)) {
      const placeholder = `{${key}}`;
      rendered = rendered.split(placeholder).join(String(value));
    }

    return rendered;
  }

  /**
   * Create a new Prompt with updated configuration
   * (Since Prompt is immutable, this returns a new instance)
   *
   * @param updates - Partial configuration updates
   * @returns New Prompt instance with updates applied
   */
  with(updates: Partial<PromptConfig<T>>): Prompt<T> {
    return new Prompt({
      userPrompt: updates.userPrompt ?? this.userPrompt,
      data: updates.data ?? { ...this.data },
      responseFormat: updates.responseFormat ?? this.responseFormat,
      modelOverride: updates.modelOverride ?? this.modelOverride,
      onError: updates.onError ?? this.onError,
    });
  }
}
