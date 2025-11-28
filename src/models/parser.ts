import type { CCRModel } from '../types/model.js';

/**
 * Error thrown when CCR model string is invalid
 */
export class InvalidCCRModelError extends Error {
  constructor(model: string, reason: string) {
    super(`Invalid CCR model "${model}": ${reason}`);
    this.name = 'InvalidCCRModelError';
  }
}

/**
 * Parsed components of a CCR model string
 */
export interface ParsedCCRModel {
  /** Provider slug (e.g., "openai", "anthropic") */
  provider: string;
  /** Model version (e.g., "gpt-4o", "claude-3-opus") */
  version: string;
}

/**
 * Parse a CCR model string into provider and version components
 *
 * @param model - CCR model string in format "provider,model-version"
 * @returns Parsed provider and version
 * @throws InvalidCCRModelError if format is invalid
 *
 * @example
 * ```typescript
 * const { provider, version } = parseCCRModel("openai,gpt-4o");
 * // provider = "openai", version = "gpt-4o"
 * ```
 */
export function parseCCRModel(model: string): ParsedCCRModel {
  if (!model || typeof model !== 'string') {
    throw new InvalidCCRModelError(model, 'model must be a non-empty string');
  }

  const commaIndex = model.indexOf(',');
  if (commaIndex === -1) {
    throw new InvalidCCRModelError(model, 'must contain comma separator');
  }

  const provider = model.slice(0, commaIndex).trim();
  const version = model.slice(commaIndex + 1).trim();

  if (!provider) {
    throw new InvalidCCRModelError(model, 'provider cannot be empty');
  }
  if (!version) {
    throw new InvalidCCRModelError(model, 'version cannot be empty');
  }

  // Validate provider format (lowercase, alphanumeric with hyphens)
  if (!/^[a-z][a-z0-9-]*$/.test(provider)) {
    throw new InvalidCCRModelError(
      model,
      'provider must be lowercase alphanumeric with hyphens'
    );
  }

  return { provider, version };
}

/**
 * Create a valid CCR model string from components
 *
 * @param provider - Provider slug
 * @param version - Model version
 * @returns Branded CCRModel string
 *
 * @example
 * ```typescript
 * const model = formatCCRModel("openai", "gpt-4o");
 * // model = "openai,gpt-4o" as CCRModel
 * ```
 */
export function formatCCRModel(provider: string, version: string): CCRModel {
  const model = `${provider},${version}`;
  // Validate by parsing
  parseCCRModel(model);
  return model as CCRModel;
}

/**
 * Type guard to check if a string is a valid CCR model
 *
 * @param model - String to validate
 * @returns True if valid CCR model format
 */
export function validateCCRModel(model: string): model is CCRModel {
  try {
    parseCCRModel(model);
    return true;
  } catch {
    return false;
  }
}
