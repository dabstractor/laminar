/**
 * CCR Model string format: "provider-slug,model-version"
 * Examples: "openai,gpt-4o", "anthropic,claude-3-opus"
 *
 * @remarks
 * - Provider slug is lowercase with hyphens
 * - Model version is the provider's model identifier
 * - Comma separates provider from model
 */
export type CCRModel = string & { readonly __brand: unique symbol };

/**
 * Category-based model configuration
 * Maps category names to ordered arrays of models
 *
 * @remarks
 * - Index 0 = smartest/most capable model
 * - Higher indices = faster/cheaper models
 * - Used for fallback routing on failures
 *
 * @example
 * ```typescript
 * const config: CategoryModelConfig = {
 *   coding: ["openai,gpt-4o", "openai,gpt-4o-mini"],
 *   research: ["anthropic,claude-3-opus", "anthropic,claude-3-sonnet"],
 * };
 * ```
 */
export type CategoryModelConfig = Record<string, CCRModel[]>;

/**
 * Request for model resolution
 * Used by ModelResolver to determine which model to use
 */
export interface ModelResolutionRequest {
  /** Model override from prompt (highest priority) */
  promptOverride?: CCRModel;
  /** Default model from agent configuration */
  agentDefault?: CCRModel;
  /** Default model from workflow configuration */
  workflowDefault?: CCRModel;
  /** Category to select from */
  category: string;
  /** Index within category (0 = smartest, default: 0) */
  modelIndex?: number;
}
