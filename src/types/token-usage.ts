/**
 * Token usage tracking for API calls
 */
export interface TokenUsage {
  /** Input tokens consumed */
  inputTokens: number;
  /** Output tokens generated */
  outputTokens: number;
  /** Tokens used for cache creation (if applicable) */
  cacheCreationInputTokens?: number;
  /** Tokens read from cache (if applicable) */
  cacheReadInputTokens?: number;
}
