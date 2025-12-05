import type {
  AgentConfig,
  AgentRunResult,
  PromptResult,
  TokenUsage,
  WorkflowEvent,
  ToolDefinition,
} from '../types/index.js';
import { generateId } from '../utils/id.js';
import { aggregateTokenUsage, emptyTokenUsage } from '../utils/token-aggregator.js';
import { AnthropicClient } from '../integrations/anthropic-client.js';
import { PromptInstance } from './prompt-instance.js';
import { Observable } from '../utils/observable.js';

/**
 * Default reflection prompt template
 */
const DEFAULT_REFLECTION_PROMPT = {
  name: 'reflection',
  system: `You are a helpful assistant tasked with analyzing a failed response and providing a corrected version.
Analyze the error and the original output, then provide a corrected response.`,
  user: `Original prompt: {{originalPrompt}}

Original response: {{originalResult}}

Error: {{error}}

Please provide a corrected response that addresses the error.`,
};

/**
 * Agent that executes prompts with tools, retries, and reflection
 */
export class Agent {
  /** Unique agent ID */
  public readonly id: string;

  /** Agent configuration */
  public readonly config: AgentConfig;

  /** Parent model (from workflow) */
  private parentModel: string | null;

  /** Event observable */
  private eventObservable: Observable<WorkflowEvent>;

  /** Tool handlers */
  private toolHandlers: Map<string, (input: unknown) => Promise<unknown>> = new Map();

  constructor(
    config: AgentConfig,
    options?: {
      parentModel?: string;
      eventObservable?: Observable<WorkflowEvent>;
      toolHandlers?: Record<string, (input: unknown) => Promise<unknown>>;
    }
  ) {
    this.id = config.id ?? generateId();
    this.config = config;
    this.parentModel = options?.parentModel ?? null;
    this.eventObservable = options?.eventObservable ?? new Observable();

    // Register tool handlers
    if (options?.toolHandlers) {
      for (const [name, handler] of Object.entries(options.toolHandlers)) {
        this.toolHandlers.set(name, handler);
      }
    }
  }

  /**
   * Resolve the model to use for a prompt
   */
  private resolveModel(promptModel?: string): string {
    const model = promptModel ?? this.config.model ?? this.parentModel;
    if (!model) {
      throw new Error('No model configured. Specify model on prompt, agent, or workflow.');
    }
    return model;
  }

  /**
   * Emit an event
   */
  private emit(event: WorkflowEvent): void {
    this.eventObservable.next(event);
  }

  /**
   * Execute reflection on a failed prompt result
   */
  async reflect(
    client: AnthropicClient,
    originalPromptConfig: { user: string; system?: string },
    failedResult: PromptResult,
    overrideModel?: string
  ): Promise<PromptResult> {
    this.emit({
      type: 'reflectionStart',
      agentId: this.id,
      originalError: failedResult.error,
      timestamp: Date.now(),
    });

    const reflectionInstance = new PromptInstance(
      DEFAULT_REFLECTION_PROMPT,
      this.resolveModel(overrideModel),
      {
        originalPrompt: originalPromptConfig.user,
        originalResult: failedResult.content,
        error: String(failedResult.error),
      },
      { eventObservable: this.eventObservable }
    );

    const result = await reflectionInstance.run(client);

    this.emit({
      type: 'reflectionEnd',
      agentId: this.id,
      result,
      timestamp: Date.now(),
    });

    // Call onReflection hook
    if (this.config.hooks?.onReflection) {
      await this.config.hooks.onReflection(failedResult, result);
    }

    return result;
  }

  /**
   * Run the agent
   */
  async run(client: AnthropicClient, input: unknown): Promise<AgentRunResult> {
    const startTime = Date.now();
    const promptResults: PromptResult[] = [];
    const maxRetries = this.config.maxRetries ?? 0;
    let retryCount = 0;
    let reflectionMetadata: AgentRunResult['reflectionMetadata'];

    // Apply beforeRun hook
    let processedInput = input;
    if (this.config.hooks?.beforeRun) {
      processedInput = await this.config.hooks.beforeRun(input);
    }

    // Emit agent start
    this.emit({
      type: 'agentRunStart',
      agentId: this.id,
      agentName: this.config.name,
      input: processedInput,
      timestamp: startTime,
    });

    try {
      // Execute each prompt in sequence
      for (const promptConfig of this.config.prompts) {
        // Apply beforePrompt hook
        let promptInput = processedInput;
        if (this.config.hooks?.beforePrompt) {
          promptInput = await this.config.hooks.beforePrompt(promptConfig, promptInput);
        }

        let result: PromptResult | null = null;
        let attempts = 0;

        // Retry loop
        while (attempts <= maxRetries) {
          const instance = new PromptInstance(
            promptConfig,
            this.resolveModel(promptConfig.model),
            promptInput,
            {
              eventObservable: this.eventObservable,
              toolHandlers: this.toolHandlers,
            }
          );

          result = await instance.run(client);

          // Check for error
          if (result.error) {
            attempts++;
            retryCount++;

            // Call onError hook
            if (this.config.hooks?.onError) {
              await this.config.hooks.onError(result.error);
            }

            // Try reflection if enabled and not already at max retries
            if (this.config.enableReflection && attempts <= maxRetries) {
              const reflectionResult = await this.reflect(
                client,
                promptConfig,
                result
              );

              if (!reflectionResult.error) {
                reflectionMetadata = {
                  originalError: result.error,
                  reflectionPromptId: instance.id,
                  reflectionResult,
                };
                result = reflectionResult;
                break;
              }
            }

            // Continue retry loop
            if (attempts <= maxRetries) {
              continue;
            }
          }

          // Success or final failure
          break;
        }

        // Apply afterPrompt hook
        if (result && this.config.hooks?.afterPrompt) {
          result = await this.config.hooks.afterPrompt(promptConfig, result);
        }

        if (result) {
          promptResults.push(result);
        }

        // Stop on error if we've exhausted retries
        if (result?.error && retryCount > maxRetries) {
          break;
        }
      }

      // Aggregate token usage
      const tokenUsage = aggregateTokenUsage(promptResults.map(r => r.tokenUsage));

      let agentResult: AgentRunResult = {
        promptResults,
        tokenUsage,
        totalDuration: Date.now() - startTime,
        retryCount,
        reflectionMetadata,
        error: promptResults.some(r => r.error) ? promptResults.find(r => r.error)?.error : undefined,
      };

      // Apply afterRun hook
      if (this.config.hooks?.afterRun) {
        agentResult = await this.config.hooks.afterRun(agentResult);
      }

      // Emit agent end
      this.emit({
        type: 'agentRunEnd',
        agentId: this.id,
        agentName: this.config.name,
        result: agentResult,
        duration: agentResult.totalDuration,
        tokenUsage: agentResult.tokenUsage,
      });

      return agentResult;

    } catch (error) {
      // Call onError hook
      if (this.config.hooks?.onError) {
        await this.config.hooks.onError(error);
      }

      const agentResult: AgentRunResult = {
        promptResults,
        tokenUsage: aggregateTokenUsage(promptResults.map(r => r.tokenUsage)),
        totalDuration: Date.now() - startTime,
        retryCount,
        error,
      };

      // Emit agent end with error
      this.emit({
        type: 'agentRunEnd',
        agentId: this.id,
        agentName: this.config.name,
        result: agentResult,
        duration: agentResult.totalDuration,
        tokenUsage: agentResult.tokenUsage,
      });

      return agentResult;
    }
  }

  /**
   * Get the event observable for subscriptions
   */
  getEventObservable(): Observable<WorkflowEvent> {
    return this.eventObservable;
  }
}
