import type {
  AgentWorkflowConfig,
  WorkflowStepConfig,
  WorkflowRunResult,
  StepRunResult,
  AgentRunResult,
  TokenUsage,
  WorkflowEvent,
} from '../types/index.js';
import { Workflow } from './workflow.js';
import { Agent } from './agent.js';
import { AnthropicClient } from '../integrations/anthropic-client.js';
import { aggregateTokenUsage, emptyTokenUsage } from '../utils/token-aggregator.js';
import { Observable } from '../utils/observable.js';

/**
 * Workflow that orchestrates agents
 */
export class AgentWorkflow extends Workflow {
  /** Workflow configuration */
  private workflowConfig: AgentWorkflowConfig;

  /** Anthropic client */
  private client: AnthropicClient;

  /** Tool handlers */
  private toolHandlers: Record<string, (input: unknown) => Promise<unknown>> = {};

  /** Internal event observable for agent wiring */
  private internalEventObservable: Observable<WorkflowEvent>;

  constructor(
    config: AgentWorkflowConfig,
    options?: {
      client?: AnthropicClient;
      parent?: Workflow;
      toolHandlers?: Record<string, (input: unknown) => Promise<unknown>>;
    }
  ) {
    super(config.name ?? 'AgentWorkflow', options?.parent);
    this.workflowConfig = config;
    this.client = options?.client ?? new AnthropicClient();
    this.toolHandlers = options?.toolHandlers ?? {};
    this.internalEventObservable = new Observable<WorkflowEvent>();

    // Subscribe to internal observable to forward events to workflow
    this.internalEventObservable.subscribe({
      next: (event) => {
        this.emitEvent(event);
      },
    });
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: WorkflowStepConfig, input: unknown): Promise<StepRunResult> {
    const startTime = Date.now();
    const stepName = step.name ?? `step-${step.id ?? 'unknown'}`;

    // Emit step start
    this.emitEvent({
      type: 'stepStart',
      node: this.node,
      step: stepName,
    });

    const agentResults: AgentRunResult[] = [];

    // Execute each agent in the step sequentially
    for (const agentConfig of step.agents) {
      const agent = new Agent(agentConfig, {
        parentModel: this.workflowConfig.defaultModel,
        eventObservable: this.internalEventObservable,
        toolHandlers: this.toolHandlers,
      });

      const result = await agent.run(this.client, input);
      agentResults.push(result);

      // Stop on error
      if (result.error) {
        break;
      }
    }

    const duration = Date.now() - startTime;

    // Emit step end
    this.emitEvent({
      type: 'stepEnd',
      node: this.node,
      step: stepName,
      duration,
    });

    return {
      stepName,
      agentResults,
      duration,
    };
  }

  /**
   * Run the workflow
   */
  async run(input?: unknown): Promise<WorkflowRunResult> {
    const startTime = Date.now();
    this.setStatus('running');

    const stepResults: StepRunResult[] = [];
    let totalUsage = emptyTokenUsage();

    try {
      // Execute each step in order
      for (const step of this.workflowConfig.steps) {
        const stepResult = await this.executeStep(step, input);
        stepResults.push(stepResult);

        // Aggregate token usage from this step
        for (const agentResult of stepResult.agentResults) {
          totalUsage = aggregateTokenUsage([totalUsage, agentResult.tokenUsage]);
        }

        // Check for errors
        const stepError = stepResult.agentResults.find(r => r.error)?.error;
        if (stepError) {
          this.setStatus('failed');
          return {
            stepResults,
            tokenUsage: totalUsage,
            totalDuration: Date.now() - startTime,
            error: stepError,
          };
        }
      }

      this.setStatus('completed');

      return {
        stepResults,
        tokenUsage: totalUsage,
        totalDuration: Date.now() - startTime,
      };

    } catch (error) {
      this.setStatus('failed');
      return {
        stepResults,
        tokenUsage: totalUsage,
        totalDuration: Date.now() - startTime,
        error,
      };
    }
  }

  /**
   * Register a tool handler
   */
  registerTool(name: string, handler: (input: unknown) => Promise<unknown>): void {
    this.toolHandlers[name] = handler;
  }

  /**
   * Get the Anthropic client
   */
  getClient(): AnthropicClient {
    return this.client;
  }
}
