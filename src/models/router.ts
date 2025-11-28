import type { CCR, CCRRequest, CCRResponse } from './ccr.js';
import type { CategoryModelConfig } from '../types/model.js';
import { ModelResolver, ModelResolutionError } from './resolver.js';

/**
 * Error thrown when all routing attempts fail
 */
export class CCRRoutingError extends Error {
  constructor(
    public readonly category: string,
    public readonly attemptedModels: string[],
    public readonly lastError: Error
  ) {
    super(
      `All models failed for category "${category}". ` +
      `Attempted: ${attemptedModels.join(', ')}. ` +
      `Last error: ${lastError.message}`
    );
    this.name = 'CCRRoutingError';
  }
}

/**
 * Event emitted during routing attempts
 */
export interface RoutingAttemptEvent {
  model: string;
  attempt: number;
  success: boolean;
  error?: Error;
  durationMs: number;
}

/**
 * Router that wraps CCR with automatic fallback
 *
 * @remarks
 * When a model fails, automatically tries the next model
 * in the category array until one succeeds or all fail.
 */
export class CCRRouter {
  private readonly resolver: ModelResolver;

  constructor(
    private readonly ccr: CCR,
    config: CategoryModelConfig
  ) {
    this.resolver = new ModelResolver(config);
  }

  /**
   * Execute a CCR request with automatic fallback
   *
   * @param request - Base request (model will be overridden)
   * @param category - Category to select models from
   * @param onAttempt - Optional callback for attempt events
   * @returns Response from successful model
   * @throws CCRRoutingError if all models fail
   */
  async run(
    request: Omit<CCRRequest, 'model'>,
    category: string,
    onAttempt?: (event: RoutingAttemptEvent) => void
  ): Promise<CCRResponse> {
    const models = this.resolver.getCategoryModels(category);

    if (models.length === 0) {
      throw new ModelResolutionError(
        { category, modelIndex: 0 },
        `Category "${category}" not found or empty`
      );
    }

    const attemptedModels: string[] = [];
    let lastError: Error | undefined;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      attemptedModels.push(model);

      const startTime = Date.now();

      try {
        const response = await this.ccr.run({
          ...request,
          model,
        });

        // Emit success event
        onAttempt?.({
          model,
          attempt: i + 1,
          success: true,
          durationMs: Date.now() - startTime,
        });

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Emit failure event
        onAttempt?.({
          model,
          attempt: i + 1,
          success: false,
          error: lastError,
          durationMs: Date.now() - startTime,
        });

        // Only continue if it's a retriable error (network, rate limit)
        // Validation errors should not trigger fallback
        if (this.isValidationError(lastError)) {
          throw lastError;
        }

        // Continue to next model
      }
    }

    // All models failed
    throw new CCRRoutingError(category, attemptedModels, lastError!);
  }

  /**
   * Check if an error is a validation error (should not retry)
   */
  private isValidationError(error: Error): boolean {
    // Zod validation errors
    if (error.name === 'ZodError') {
      return true;
    }
    // Check message for common validation patterns
    const msg = error.message.toLowerCase();
    return (
      msg.includes('invalid') ||
      msg.includes('validation') ||
      msg.includes('schema')
    );
  }

  /**
   * Get the underlying resolver for direct model resolution
   */
  getResolver(): ModelResolver {
    return this.resolver;
  }
}
