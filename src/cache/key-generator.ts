import { createHash } from 'node:crypto';
import type { CCRModel } from '../types/model.js';
import type { ToolConfig, McpConfig } from '../types/agent.js';
import type { z } from 'zod';

/**
 * Parameters used to generate cache key
 */
export interface CacheKeyParams {
  /** User prompt text */
  userPrompt: string;
  /** Prompt data */
  data: Record<string, unknown>;
  /** Model used */
  model: CCRModel;
  /** Provider */
  provider: string;
  /** Temperature (affects output) */
  temperature?: number;
  /** Tools (tool names affect caching) */
  tools: ToolConfig[];
  /** MCP servers */
  mcps: McpConfig[];
  /** Schema version hash */
  schemaVersion: string;
}

/**
 * Sort object keys recursively for deterministic JSON
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();

  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }

  return sorted;
}

/**
 * Create a stable JSON string with sorted keys
 */
function stableStringify(obj: unknown): string {
  return JSON.stringify(sortObjectKeys(obj));
}

/**
 * Generate SHA-256 hash of data
 */
function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a deterministic cache key from parameters
 *
 * @remarks
 * Per PRD Section 6.1, cache key is hash of:
 * - prompt.userPrompt
 * - prompt.data
 * - model
 * - provider
 * - temperature
 * - tool list (names only)
 * - MCP list (names only)
 * - schema version hash
 *
 * @param params - Cache key parameters
 * @returns Hex SHA-256 hash string
 */
export function generateCacheKey(params: CacheKeyParams): string {
  // Extract only tool names (not implementations)
  const toolNames = params.tools.map(t => t.name).sort();

  // Extract only MCP names
  const mcpNames = params.mcps.map(m => m.name).sort();

  const keyData = {
    userPrompt: params.userPrompt,
    data: params.data,
    model: params.model,
    provider: params.provider,
    temperature: params.temperature,
    tools: toolNames,
    mcps: mcpNames,
    schemaVersion: params.schemaVersion,
  };

  const stableJson = stableStringify(keyData);
  return sha256(stableJson);
}

/**
 * Generate a version hash for a Zod schema
 *
 * @remarks
 * Uses schema description and shape to create fingerprint.
 * Changes to schema structure will produce different hash.
 *
 * @param schema - Zod schema
 * @returns Hex SHA-256 hash string
 */
export function getSchemaVersionHash(schema: z.ZodType<unknown>): string {
  // Get schema description for hashing
  const schemaInfo = {
    description: schema.description,
    // Use JSON representation of schema shape
    shape: getSchemaShape(schema),
  };

  return sha256(stableStringify(schemaInfo));
}

/**
 * Extract shape information from a Zod schema
 */
function getSchemaShape(schema: z.ZodType<unknown>): unknown {
  // Access internal Zod structure
  const def = (schema as unknown as { _def: unknown })._def;

  if (!def) {
    return { type: 'unknown' };
  }

  // Get type name from _def
  const typeName = (def as { typeName?: string }).typeName;

  if (typeName === 'ZodObject') {
    const shape = (def as { shape?: () => Record<string, unknown> }).shape?.();
    if (shape) {
      const shapeInfo: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(shape)) {
        shapeInfo[key] = getSchemaShape(value as z.ZodType<unknown>);
      }
      return { type: 'object', shape: shapeInfo };
    }
  }

  return { type: typeName ?? 'unknown' };
}

/**
 * Generate a cache key prefix for busting related entries
 *
 * @param agentId - Agent identifier
 * @param promptPrefix - Prompt prefix to match
 * @returns Prefix string for cache key matching
 */
export function getCacheKeyPrefix(agentId: string, promptPrefix?: string): string {
  if (promptPrefix) {
    return sha256(`${agentId}:${promptPrefix}`).slice(0, 16);
  }
  return sha256(agentId).slice(0, 16);
}
