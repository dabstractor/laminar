import type { CCRModel, CategoryModelConfig, ModelResolutionRequest } from '../types/model.js';
import { validateCCRModel } from './parser.js';

/**
 * Error thrown when model resolution fails
 */
export class ModelResolutionError extends Error {
  constructor(
    public readonly request: ModelResolutionRequest,
    public readonly reason: string
  ) {
    super(`Model resolution failed: ${reason}`);
    this.name = 'ModelResolutionError';
  }
}

/**
 * Resolves which model to use based on precedence rules
 *
 * Resolution precedence (per PRD Section 2.1):
 * 1. Prompt override
 * 2. Agent default model
 * 3. Workflow default model
 * 4. Category[0] (smartest)
 * 5. Fallback indices (1, 2, 3...)
 * 6. Error
 */
export class ModelResolver {
  constructor(private readonly config: CategoryModelConfig) {}

  /**
   * Resolve which model to use for a request
   *
   * @param request - Resolution request with overrides and category
   * @returns Resolved CCR model string
   * @throws ModelResolutionError if no model can be resolved
   */
  resolve(request: ModelResolutionRequest): CCRModel {
    // 1. Prompt override (highest priority)
    if (request.promptOverride && validateCCRModel(request.promptOverride)) {
      return request.promptOverride;
    }

    // 2. Agent default model
    if (request.agentDefault && validateCCRModel(request.agentDefault)) {
      return request.agentDefault;
    }

    // 3. Workflow default model
    if (request.workflowDefault && validateCCRModel(request.workflowDefault)) {
      return request.workflowDefault;
    }

    // 4-5. Category-based resolution
    const categoryModels = this.config[request.category];
    if (!categoryModels || categoryModels.length === 0) {
      throw new ModelResolutionError(
        request,
        `Category "${request.category}" not found or empty`
      );
    }

    // Use specified index or default to 0
    const index = request.modelIndex ?? 0;
    if (index >= 0 && index < categoryModels.length) {
      return categoryModels[index];
    }

    // 5. Fallback to last available model
    if (index >= categoryModels.length) {
      return categoryModels[categoryModels.length - 1];
    }

    // 6. Error - should not reach here
    throw new ModelResolutionError(
      request,
      `Invalid model index ${index} for category "${request.category}"`
    );
  }

  /**
   * Get the next fallback model for a category
   * Used when primary model fails
   *
   * @param category - Category to get fallback from
   * @param currentIndex - Current model index
   * @returns Next model or undefined if no more fallbacks
   */
  getNextFallback(category: string, currentIndex: number): CCRModel | undefined {
    const categoryModels = this.config[category];
    if (!categoryModels) {
      return undefined;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < categoryModels.length) {
      return categoryModels[nextIndex];
    }

    return undefined;
  }

  /**
   * Check if a category exists in configuration
   */
  hasCategory(category: string): boolean {
    return category in this.config && this.config[category].length > 0;
  }

  /**
   * Get all models for a category
   */
  getCategoryModels(category: string): readonly CCRModel[] {
    return this.config[category] ?? [];
  }
}
