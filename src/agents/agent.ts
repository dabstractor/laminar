import type {
  AgentConfig,
  AgentHooks,
  AgentRuntimeOverrides,
  AgentRunContext,
  ToolConfig,
  McpConfig,
} from '../types/agent.js';
import type { CCRModel } from '../types/model.js';
import { generateId } from '../utils/id.js';
import { parseCCRModel } from '../models/parser.js';
import type { CCRRouter } from '../models/router.js';
import type { Prompt } from '../prompts/prompt.js';
import type { AgentCache } from '../cache/agent-cache.js';
import { generateCacheKey, getSchemaVersionHash } from '../cache/key-generator.js';
import type { RuntimeEventBus } from '../events/event-bus.js';

/**
 * Execution context for agent runs
 */
export interface AgentExecutionContext {
  /** CCR Router for model execution */
  router: CCRRouter;
  /** Cache instance */
  cache?: AgentCache;
  /** Event bus for emitting events */
  eventBus?: RuntimeEventBus;
  /** Workflow node ID for tree attachment */
  workflowNodeId?: string;
}

/**
 * Agent class for executing prompts with LLM models
 *
 * @remarks
 * Per PRD Section 3.2, agents:
 * - Execute prompts with schema validation
 * - Support tools and MCP servers
 * - Have lifecycle hooks
 * - Can reflect on errors
 */
export class Agent {
  /** Unique agent identifier */
  public readonly id: string;

  /** Agent name */
  public readonly name: string;

  /** Model category */
  public readonly category: string | undefined;

  /** Available tools */
  public readonly tools: readonly ToolConfig[];

  /** Available MCP servers */
  public readonly mcps: readonly McpConfig[];

  /** Full configuration (private) */
  private readonly config: AgentConfig;

  /** Execution context (set when running in workflow) */
  private executionContext?: AgentExecutionContext;

  /**
   * Create a new Agent instance
   *
   * @param config - Agent configuration
   */
  constructor(config: AgentConfig = {}) {
    this.id = generateId();
    this.config = config;
    this.name = config.name ?? 'Agent';
    this.category = config.category;
    this.tools = Object.freeze([...(config.tools ?? [])]);
    this.mcps = Object.freeze([...(config.mcps ?? [])]);
  }

  /**
   * Set execution context (called by workflow integration)
   */
  setExecutionContext(context: AgentExecutionContext): void {
    this.executionContext = context;
  }

  /**
   * Execute a prompt and return validated result
   *
   * @typeParam T - Expected response type
   * @param prompt - Prompt to execute
   * @param overrides - Optional runtime overrides
   * @returns Validated response
   */
  async prompt<T>(
    prompt: Prompt<T>,
    overrides?: AgentRuntimeOverrides
  ): Promise<T> {
    if (!this.executionContext) {
      throw new Error('Agent must have execution context set before calling prompt()');
    }

    const { router, cache, eventBus, workflowNodeId } = this.executionContext;
    const hooks = this.config.hooks ?? {};
    const runId = generateId();

    // Resolve model
    const model = this.resolveModel(prompt, overrides);
    const { provider } = parseCCRModel(model);

    // Create run context
    const ctx: AgentRunContext = {
      agentId: this.id,
      runId,
      prompt: prompt as Prompt<unknown>,
      model,
      provider,
      workflowNodeId,
      timestamp: Date.now(),
      params: overrides ? { ...overrides } : {},
    };

    // Emit agent.start event
    eventBus?.emit({
      type: 'agent.start',
      nodeType: 'agent',
      name: this.name,
      payload: { agentId: this.id, runId, model, category: this.category },
    });

    try {
      // Call beforePrompt hook
      await this.callHook(hooks.beforePrompt, ctx);

      // Check cache
      const cacheEnabled = this.isCacheEnabled() && !overrides?.disableCache;
      let cacheKey: string | undefined;

      if (cacheEnabled && cache) {
        await this.callHook(hooks.beforeCacheCheck, ctx);

        cacheKey = this.generateCacheKey(prompt, model, provider, overrides);
        const cached = await cache.get(cacheKey);

        if (cached !== undefined) {
          eventBus?.emit({
            type: 'cache.hit',
            nodeType: 'agent',
            payload: { cacheKey, hit: true },
          });

          // Validate cached result
          const validated = prompt.validate(cached);
          await this.callHook(hooks.afterValidation, ctx, validated);

          eventBus?.emit({
            type: 'agent.end',
            nodeType: 'agent',
            name: this.name,
            payload: { agentId: this.id, runId, cached: true },
          });

          return validated;
        }

        eventBus?.emit({
          type: 'cache.miss',
          nodeType: 'agent',
          payload: { cacheKey, hit: false },
        });
      }

      // Build messages
      const messages = [{ role: 'user' as const, content: prompt.render() }];

      // Merge tools
      const tools = this.getMergedTools(overrides);
      const toolConfigs = tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));

      // Execute via router
      const response = await router.run(
        {
          messages,
          tools: toolConfigs.length > 0 ? toolConfigs : undefined,
          temperature: overrides?.temperature,
        },
        this.category ?? 'default',
        (attempt) => {
          if (!attempt.success) {
            eventBus?.emit({
              type: 'agent.retry',
              nodeType: 'agent',
              name: this.name,
              payload: { model: attempt.model, attempt: attempt.attempt, error: attempt.error?.message },
            });
          }
        }
      );

      // Extract text content
      const textContent = response.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text)
        .join('');

      // Parse JSON response
      let rawResult: unknown;
      try {
        rawResult = JSON.parse(textContent);
      } catch {
        rawResult = textContent;
      }

      // Call beforeValidation hook
      await this.callHook(hooks.beforeValidation, ctx, rawResult);

      // Validate response
      const validated = prompt.validate(rawResult);

      // Call afterValidation hook
      await this.callHook(hooks.afterValidation, ctx, validated);

      // Cache result
      if (cacheEnabled && cache && cacheKey) {
        await cache.set(cacheKey, validated);
        await this.callHook(hooks.afterCacheWrite, ctx);
      }

      // Call afterPrompt hook
      await this.callHook(hooks.afterPrompt, ctx, validated);

      // Emit agent.end event
      eventBus?.emit({
        type: 'agent.end',
        nodeType: 'agent',
        name: this.name,
        metrics: {
          tokensIn: response.usage.tokensIn,
          tokensOut: response.usage.tokensOut,
        },
        payload: { agentId: this.id, runId, cached: false },
      });

      return validated;
    } catch (error) {
      // Call onError hook
      const err = error instanceof Error ? error : new Error(String(error));
      await this.callHook(hooks.onError, ctx, err);

      // Emit error event
      eventBus?.emit({
        type: 'error',
        nodeType: 'agent',
        name: this.name,
        payload: { agentId: this.id, runId, error: err.message },
      });

      throw error;
    }
  }

  /**
   * Execute reflection on error
   *
   * @typeParam T - Expected response type
   * @param prompt - Original prompt to reflect on
   * @param overrideModel - Optional model to use for reflection
   * @returns Validated response from reflection
   */
  async reflect<T>(
    prompt: Prompt<T>,
    overrideModel?: CCRModel
  ): Promise<T> {
    // Create modified prompt with reflection context
    const reflectionPrompt = prompt.with({
      userPrompt: `REFLECTION REQUEST:\n\n${prompt.userPrompt}\n\nPlease review and provide a corrected response.`,
      modelOverride: overrideModel ?? prompt.modelOverride,
    });

    return this.prompt(reflectionPrompt);
  }

  /**
   * Resolve which model to use
   */
  private resolveModel(prompt: Prompt<unknown>, overrides?: AgentRuntimeOverrides): CCRModel {
    // Precedence: override > prompt > agent default > category default
    if (overrides?.model) return overrides.model;
    if (prompt.modelOverride) return prompt.modelOverride;
    if (this.config.defaultModel) return this.config.defaultModel;

    // Category-based resolution happens in router
    // Return a placeholder that router will resolve
    return `${this.category ?? 'default'},default` as CCRModel;
  }

  /**
   * Generate cache key for this prompt execution
   */
  private generateCacheKey(
    prompt: Prompt<unknown>,
    model: CCRModel,
    provider: string,
    overrides?: AgentRuntimeOverrides
  ): string {
    return generateCacheKey({
      userPrompt: prompt.userPrompt,
      data: prompt.data as Record<string, unknown>,
      model,
      provider,
      temperature: overrides?.temperature,
      tools: this.getMergedTools(overrides),
      mcps: this.getMergedMcps(overrides),
      schemaVersion: getSchemaVersionHash(prompt.responseFormat),
    });
  }

  /**
   * Safely call a hook function
   */
  private async callHook<T extends unknown[]>(
    hook: ((...args: T) => void | Promise<void>) | undefined,
    ...args: T
  ): Promise<void> {
    if (hook) {
      try {
        await hook(...args);
      } catch (err) {
        console.error('Hook error:', err);
      }
    }
  }

  /**
   * Get the full agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Get lifecycle hooks
   */
  getHooks(): AgentHooks {
    return this.config.hooks ?? {};
  }

  /**
   * Check if caching is enabled
   */
  isCacheEnabled(): boolean {
    return this.config.enableCache !== false;
  }

  /**
   * Get default model if set
   */
  getDefaultModel(): CCRModel | undefined {
    return this.config.defaultModel;
  }

  /**
   * Get default provider if set
   */
  getDefaultProvider(): string | undefined {
    return this.config.defaultProvider;
  }

  /**
   * Get model index within category
   */
  getModelIndex(): number {
    return this.config.modelIndex ?? 0;
  }

  /**
   * Merge runtime tools with config tools
   */
  getMergedTools(overrides?: AgentRuntimeOverrides): ToolConfig[] {
    const configTools = this.config.tools ?? [];
    const overrideTools = overrides?.tools ?? [];
    return [...configTools, ...overrideTools];
  }

  /**
   * Merge runtime MCPs with config MCPs
   */
  getMergedMcps(overrides?: AgentRuntimeOverrides): McpConfig[] {
    const configMcps = this.config.mcps ?? [];
    const overrideMcps = overrides?.mcps ?? [];
    return [...configMcps, ...overrideMcps];
  }
}
