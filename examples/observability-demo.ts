/**
 * Observability Demo
 *
 * Demonstrates full observability features:
 * - Tree debugging with node types and token usage
 * - Event streaming and filtering
 * - Log aggregation
 * - State snapshots
 * - Performance metrics
 *
 * Run with: ANTHROPIC_API_KEY=your-key npx tsx examples/observability-demo.ts
 */

import {
  AgentWorkflow,
  WorkflowTreeDebugger,
  formatTokenUsage,
  estimateCost,
  aggregateTokenUsage,
  type WorkflowEvent,
  type WorkflowObserver,
  type LogEntry,
  type WorkflowNode,
  type TokenUsage,
} from '../src/index.js';

// Comprehensive metrics collector
class MetricsCollector implements WorkflowObserver {
  private logs: LogEntry[] = [];
  private events: WorkflowEvent[] = [];
  private tokenUsageByAgent: Map<string, TokenUsage> = new Map();
  private promptDurations: number[] = [];
  private agentDurations: number[] = [];
  private stepDurations: number[] = [];

  onLog(entry: LogEntry): void {
    this.logs.push(entry);
  }

  onEvent(event: WorkflowEvent): void {
    this.events.push(event);

    // Track specific metrics
    if (event.type === 'agentRunEnd') {
      this.tokenUsageByAgent.set(event.agentName, event.tokenUsage);
      this.agentDurations.push(event.duration);
    } else if (event.type === 'promptInstanceEnd') {
      this.promptDurations.push(event.duration);
    } else if (event.type === 'stepEnd') {
      this.stepDurations.push(event.duration);
    }
  }

  onStateUpdated(_node: WorkflowNode): void {
    // Track state updates if needed
  }

  onTreeChanged(_root: WorkflowNode): void {
    // Track tree changes if needed
  }

  // Metrics methods
  getEventCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.events.forEach((e) => {
      counts[e.type] = (counts[e.type] || 0) + 1;
    });
    return counts;
  }

  getLogCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.logs.forEach((l) => {
      counts[l.level] = (counts[l.level] || 0) + 1;
    });
    return counts;
  }

  getAverageDurations(): { prompt: number; agent: number; step: number } {
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    return {
      prompt: avg(this.promptDurations),
      agent: avg(this.agentDurations),
      step: avg(this.stepDurations),
    };
  }

  getTotalTokenUsage(): TokenUsage {
    return aggregateTokenUsage(Array.from(this.tokenUsageByAgent.values()));
  }

  printReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('OBSERVABILITY METRICS REPORT');
    console.log('='.repeat(60));

    console.log('\n--- Event Counts ---');
    const eventCounts = this.getEventCounts();
    Object.entries(eventCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

    console.log('\n--- Log Counts ---');
    const logCounts = this.getLogCounts();
    Object.entries(logCounts).forEach(([level, count]) => {
      console.log(`  ${level}: ${count}`);
    });

    console.log('\n--- Token Usage by Agent ---');
    this.tokenUsageByAgent.forEach((usage, agent) => {
      console.log(`  ${agent}: ${formatTokenUsage(usage)}`);
    });

    console.log('\n--- Average Durations ---');
    const avgDurations = this.getAverageDurations();
    console.log(`  Prompt: ${avgDurations.prompt.toFixed(0)}ms`);
    console.log(`  Agent: ${avgDurations.agent.toFixed(0)}ms`);
    console.log(`  Step: ${avgDurations.step.toFixed(0)}ms`);

    console.log('\n--- Total Token Usage ---');
    const totalUsage = this.getTotalTokenUsage();
    console.log(`  ${formatTokenUsage(totalUsage)}`);
    console.log(`  Estimated cost: $${estimateCost(totalUsage).toFixed(6)}`);
  }
}

// Real-time event logger
class RealTimeLogger implements WorkflowObserver {
  private startTime = Date.now();
  private indent = 0;

  private getElapsed(): string {
    return `+${(Date.now() - this.startTime).toString().padStart(5)}ms`;
  }

  private getIndent(): string {
    return '  '.repeat(this.indent);
  }

  onLog(entry: LogEntry): void {
    const levelColors: Record<string, string> = {
      debug: '\x1b[90m',
      info: '\x1b[36m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
    };
    const color = levelColors[entry.level] || '';
    const reset = '\x1b[0m';
    console.log(`${this.getElapsed()} ${this.getIndent()}${color}[${entry.level.toUpperCase()}]${reset} ${entry.message}`);
  }

  onEvent(event: WorkflowEvent): void {
    const elapsed = this.getElapsed();

    switch (event.type) {
      case 'stepStart':
        console.log(`${elapsed} ${this.getIndent()}[STEP START] ${event.step}`);
        this.indent++;
        break;
      case 'stepEnd':
        this.indent = Math.max(0, this.indent - 1);
        console.log(`${elapsed} ${this.getIndent()}[STEP END] ${event.step} (${event.duration}ms)`);
        break;
      case 'agentRunStart':
        console.log(`${elapsed} ${this.getIndent()}[AGENT START] ${event.agentName}`);
        this.indent++;
        break;
      case 'agentRunEnd':
        this.indent = Math.max(0, this.indent - 1);
        console.log(`${elapsed} ${this.getIndent()}[AGENT END] ${event.agentName} - ${formatTokenUsage(event.tokenUsage)}`);
        break;
      case 'promptInstanceStart':
        console.log(`${elapsed} ${this.getIndent()}[PROMPT START] ${event.promptName}`);
        break;
      case 'promptInstanceEnd':
        console.log(`${elapsed} ${this.getIndent()}[PROMPT END] ${event.promptName} (${event.duration}ms)`);
        break;
      case 'toolCallStart':
        console.log(`${elapsed} ${this.getIndent()}[TOOL START] ${event.toolName}`);
        break;
      case 'toolCallEnd':
        console.log(`${elapsed} ${this.getIndent()}[TOOL END] ${event.toolName} (${event.duration}ms)`);
        break;
    }
  }

  onStateUpdated(_node: WorkflowNode): void {}
  onTreeChanged(_root: WorkflowNode): void {}
}

async function main() {
  // Create workflow
  const workflow = new AgentWorkflow({
    name: 'ObservabilityDemo',
    defaultModel: 'claude-sonnet-4-5-20250929',
    steps: [
      {
        name: 'analysis',
        agents: [
          {
            name: 'analyzer',
            prompts: [
              {
                name: 'analyze',
                system: 'You are an analyst. Be very brief.',
                user: 'Analyze: {{topic}} (1 sentence)',
              },
            ],
          },
        ],
      },
      {
        name: 'synthesis',
        agents: [
          {
            name: 'synthesizer',
            prompts: [
              {
                name: 'synthesize',
                system: 'You synthesize information. Be brief.',
                user: 'Create a synthesis about {{topic}} (1 sentence)',
              },
            ],
          },
          {
            name: 'summarizer',
            prompts: [
              {
                name: 'summarize',
                system: 'You summarize. Be brief.',
                user: 'Summarize {{topic}} in 5 words.',
              },
            ],
          },
        ],
      },
    ],
  });

  // Attach observers
  const metricsCollector = new MetricsCollector();
  const realTimeLogger = new RealTimeLogger();
  const treeDebugger = new WorkflowTreeDebugger(workflow);

  workflow.addObserver(metricsCollector);
  workflow.addObserver(realTimeLogger);

  console.log('Observability Demo');
  console.log('='.repeat(60));
  console.log('Running workflow with full observability...\n');

  // Run workflow
  const result = await workflow.run({ topic: 'cloud computing' });

  // Print metrics report
  metricsCollector.printReport();

  // Print workflow tree
  console.log('\n' + '='.repeat(60));
  console.log('WORKFLOW EXECUTION TREE');
  console.log('='.repeat(60));
  console.log(treeDebugger.toTreeString());

  // Print tree statistics
  const stats = treeDebugger.getStats();
  console.log('Tree Statistics:');
  console.log(`  Total nodes: ${stats.totalNodes}`);
  console.log(`  By status: ${JSON.stringify(stats.byStatus)}`);
  console.log(`  Total logs: ${stats.totalLogs}`);
  console.log(`  Total events: ${stats.totalEvents}`);

  // Print final status
  console.log('\n' + '='.repeat(60));
  console.log('FINAL STATUS');
  console.log('='.repeat(60));
  console.log(`  Workflow: ${workflow.status}`);
  console.log(`  Duration: ${result.totalDuration}ms`);
  console.log(`  Steps completed: ${result.stepResults.length}`);
  console.log(`  Errors: ${result.error ? 'Yes' : 'None'}`);
}

// Example filtering events by type
async function eventFilteringExample() {
  console.log('\n\nEvent Filtering Example');
  console.log('='.repeat(60));

  const workflow = new AgentWorkflow({
    name: 'FilterDemo',
    defaultModel: 'claude-sonnet-4-5-20250929',
    steps: [
      {
        name: 'step1',
        agents: [
          {
            name: 'agent1',
            prompts: [{ name: 'prompt1', user: 'Say hello briefly.' }],
          },
        ],
      },
    ],
  });

  // Collect only token-related events
  const tokenEvents: WorkflowEvent[] = [];
  const timingEvents: WorkflowEvent[] = [];

  workflow.addObserver({
    onLog: () => {},
    onEvent: (event) => {
      // Filter for token events
      if (event.type === 'agentRunEnd' || event.type === 'promptInstanceEnd') {
        tokenEvents.push(event);
      }

      // Filter for timing events
      if (
        event.type === 'stepEnd' ||
        event.type === 'agentRunEnd' ||
        event.type === 'promptInstanceEnd'
      ) {
        timingEvents.push(event);
      }
    },
    onStateUpdated: () => {},
    onTreeChanged: () => {},
  });

  await workflow.run({});

  console.log('\nFiltered Token Events:');
  tokenEvents.forEach((e) => {
    if (e.type === 'agentRunEnd') {
      console.log(`  Agent "${e.agentName}": ${formatTokenUsage(e.tokenUsage)}`);
    } else if (e.type === 'promptInstanceEnd') {
      console.log(`  Prompt "${e.promptName}": ${formatTokenUsage(e.tokenUsage)}`);
    }
  });

  console.log('\nFiltered Timing Events:');
  timingEvents.forEach((e) => {
    if (e.type === 'stepEnd') {
      console.log(`  Step "${e.step}": ${e.duration}ms`);
    } else if (e.type === 'agentRunEnd') {
      console.log(`  Agent "${e.agentName}": ${e.duration}ms`);
    } else if (e.type === 'promptInstanceEnd') {
      console.log(`  Prompt "${e.promptName}": ${e.duration}ms`);
    }
  });
}

// Run all examples
main()
  .then(() => eventFilteringExample())
  .catch(console.error);
