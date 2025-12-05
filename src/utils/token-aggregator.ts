import type { TokenUsage } from '../types/index.js';

/**
 * Aggregate multiple token usages into one
 */
export function aggregateTokenUsage(usages: TokenUsage[]): TokenUsage {
  const result: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
  };

  for (const usage of usages) {
    result.inputTokens += usage.inputTokens;
    result.outputTokens += usage.outputTokens;
    if (usage.cacheCreationInputTokens) {
      result.cacheCreationInputTokens = (result.cacheCreationInputTokens ?? 0) + usage.cacheCreationInputTokens;
    }
    if (usage.cacheReadInputTokens) {
      result.cacheReadInputTokens = (result.cacheReadInputTokens ?? 0) + usage.cacheReadInputTokens;
    }
  }

  return result;
}

/**
 * Format token usage as human-readable string
 */
export function formatTokenUsage(usage: TokenUsage): string {
  const parts = [`in: ${usage.inputTokens}`, `out: ${usage.outputTokens}`];

  if (usage.cacheCreationInputTokens) {
    parts.push(`cache-create: ${usage.cacheCreationInputTokens}`);
  }
  if (usage.cacheReadInputTokens) {
    parts.push(`cache-read: ${usage.cacheReadInputTokens}`);
  }

  return parts.join(', ');
}

/**
 * Calculate estimated cost in USD (using Claude Sonnet pricing)
 * @param usage Token usage
 * @param inputCostPer1M Cost per 1M input tokens (default: $3)
 * @param outputCostPer1M Cost per 1M output tokens (default: $15)
 */
export function estimateCost(
  usage: TokenUsage,
  inputCostPer1M: number = 3,
  outputCostPer1M: number = 15
): number {
  const inputCost = (usage.inputTokens / 1_000_000) * inputCostPer1M;
  const outputCost = (usage.outputTokens / 1_000_000) * outputCostPer1M;
  return inputCost + outputCost;
}

/**
 * Create empty token usage
 */
export function emptyTokenUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0 };
}
