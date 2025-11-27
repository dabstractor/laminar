import type { StepOptions, WorkflowError, WorkflowNode, LogEntry, WorkflowEvent } from '../types/index.js';
import { getObservedState } from './observed-state.js';

// Type for workflow-like objects that @Step can decorate methods on
interface WorkflowLike {
  id: string;
  node: WorkflowNode;
  logger: {
    info(message: string, data?: unknown): void;
  };
  emitEvent(event: WorkflowEvent): void;
  snapshotState(): void;
}

/**
 * @Step decorator
 * Wraps a method to emit step events, handle errors, and optionally snapshot state
 *
 * @example
 * class MyWorkflow extends Workflow {
 *   @Step({ snapshotState: true, trackTiming: true })
 *   async processData() {
 *     // ... step logic
 *   }
 * }
 */
export function Step(opts: StepOptions = {}) {
  return function <This, Args extends unknown[], Return>(
    originalMethod: (this: This, ...args: Args) => Promise<Return>,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Return>>
  ) {
    const methodName = String(context.name);

    // CRITICAL: Use regular function, not arrow function, to preserve 'this'
    async function stepWrapper(this: This, ...args: Args): Promise<Return> {
      // Cast to WorkflowLike for type safety when accessing workflow properties
      const wf = this as unknown as WorkflowLike;
      const stepName = opts.name ?? methodName;
      const startTime = Date.now();

      // Log start if requested
      if (opts.logStart) {
        wf.logger.info(`STEP START: ${stepName}`);
      }

      // Emit step start event
      wf.emitEvent({
        type: 'stepStart',
        node: wf.node,
        step: stepName,
      });

      try {
        // Execute the original method
        const result = await originalMethod.call(this, ...args);

        // Snapshot state if requested
        if (opts.snapshotState) {
          wf.snapshotState();
        }

        // Calculate duration and emit end event
        const duration = Date.now() - startTime;
        if (opts.trackTiming !== false) {
          wf.emitEvent({
            type: 'stepEnd',
            node: wf.node,
            step: stepName,
            duration,
          });
        }

        // Log finish if requested
        if (opts.logFinish) {
          wf.logger.info(`STEP END: ${stepName} (${duration}ms)`);
        }

        return result;
      } catch (err: unknown) {
        // Create rich error with context
        const error = err as Error;
        const snap = getObservedState(this as object);

        const workflowError: WorkflowError = {
          message: error?.message ?? 'Unknown error',
          original: err,
          workflowId: wf.id,
          stack: error?.stack,
          state: snap,
          logs: [...wf.node.logs] as LogEntry[],
        };

        // Emit error event
        wf.emitEvent({
          type: 'error',
          node: wf.node,
          error: workflowError,
        });

        // Re-throw the enriched error
        throw workflowError;
      }
    }

    return stepWrapper;
  };
}
