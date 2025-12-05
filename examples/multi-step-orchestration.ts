/**
 * Multi-Step Orchestration Example
 *
 * Demonstrates complex workflow orchestration with:
 * - Multiple sequential steps
 * - Multiple agents per step
 * - Data flow between steps
 * - Comprehensive observability
 *
 * Run with: ANTHROPIC_API_KEY=your-key npx tsx examples/multi-step-orchestration.ts
 */

import {
  AgentWorkflow,
  WorkflowTreeDebugger,
  formatTokenUsage,
  estimateCost,
  aggregateTokenUsage,
  type WorkflowEvent,
  type TokenUsage,
} from '../src/index.js';

// Event logger for tracking execution
class ExecutionLogger {
  private events: Array<{ timestamp: number; type: string; details: string }> = [];
  private stepTokenUsage: Map<string, TokenUsage> = new Map();

  log(type: string, details: string) {
    this.events.push({ timestamp: Date.now(), type, details });
    console.log(`  [${type}] ${details}`);
  }

  trackStepTokens(stepName: string, usage: TokenUsage) {
    const existing = this.stepTokenUsage.get(stepName);
    if (existing) {
      this.stepTokenUsage.set(stepName, aggregateTokenUsage([existing, usage]));
    } else {
      this.stepTokenUsage.set(stepName, usage);
    }
  }

  printSummary() {
    console.log('\nExecution Summary:');
    console.log('-'.repeat(40));
    console.log(`Total events: ${this.events.length}`);
    console.log('\nTokens by step:');
    this.stepTokenUsage.forEach((usage, step) => {
      console.log(`  ${step}: ${formatTokenUsage(usage)}`);
    });
  }
}

async function main() {
  const logger = new ExecutionLogger();

  // Create a comprehensive content creation pipeline
  const workflow = new AgentWorkflow({
    name: 'ContentCreationPipeline',
    defaultModel: 'claude-sonnet-4-5-20250929',
    steps: [
      // Step 1: Research and ideation
      {
        name: 'research',
        agents: [
          {
            name: 'topic-researcher',
            prompts: [
              {
                name: 'research-topic',
                system: 'You are a research specialist. Be concise but thorough.',
                user: 'Research the topic "{{topic}}" and provide 3 key insights.',
              },
            ],
          },
          {
            name: 'audience-analyzer',
            prompts: [
              {
                name: 'analyze-audience',
                system: 'You are an audience analysis expert.',
                user: 'Identify the target audience for content about "{{topic}}". Describe in 2 sentences.',
              },
            ],
          },
        ],
      },
      // Step 2: Content planning
      {
        name: 'planning',
        agents: [
          {
            name: 'outline-creator',
            prompts: [
              {
                name: 'create-outline',
                system: 'You are a content strategist.',
                user: 'Create a brief 3-point outline for an article about "{{topic}}".',
              },
            ],
          },
        ],
      },
      // Step 3: Content creation
      {
        name: 'creation',
        agents: [
          {
            name: 'writer',
            prompts: [
              {
                name: 'write-intro',
                system: 'You are a skilled content writer.',
                user: 'Write a compelling 2-sentence introduction for an article about "{{topic}}".',
              },
              {
                name: 'write-conclusion',
                system: 'You are a skilled content writer.',
                user: 'Write a 1-sentence call-to-action conclusion for content about "{{topic}}".',
              },
            ],
          },
        ],
      },
      // Step 4: Review
      {
        name: 'review',
        agents: [
          {
            name: 'editor',
            prompts: [
              {
                name: 'review-content',
                system: 'You are a senior editor.',
                user: 'Provide one brief editorial suggestion for improving content about "{{topic}}".',
              },
            ],
          },
          {
            name: 'seo-specialist',
            prompts: [
              {
                name: 'seo-review',
                system: 'You are an SEO expert.',
                user: 'Suggest 3 keywords to optimize content about "{{topic}}" for search.',
              },
            ],
          },
        ],
      },
    ],
  });

  // Attach tree debugger
  const debugger_ = new WorkflowTreeDebugger(workflow);

  // Add comprehensive observer
  let currentStep = '';
  workflow.addObserver({
    onLog: (entry) => {
      if (entry.level !== 'debug') {
        logger.log('LOG', `[${entry.level}] ${entry.message}`);
      }
    },
    onEvent: (event: WorkflowEvent) => {
      switch (event.type) {
        case 'stepStart':
          currentStep = event.step;
          logger.log('STEP', `Starting: ${event.step}`);
          break;
        case 'stepEnd':
          logger.log('STEP', `Completed: ${event.step} (${event.duration}ms)`);
          break;
        case 'agentRunStart':
          logger.log('AGENT', `Starting: ${event.agentName}`);
          break;
        case 'agentRunEnd':
          logger.log('AGENT', `Completed: ${event.agentName} - ${formatTokenUsage(event.tokenUsage)}`);
          logger.trackStepTokens(currentStep, event.tokenUsage);
          break;
        case 'promptInstanceStart':
          logger.log('PROMPT', `Executing: ${event.promptName}`);
          break;
      }
    },
    onStateUpdated: () => {},
    onTreeChanged: () => {},
  });

  console.log('Multi-Step Content Creation Pipeline');
  console.log('='.repeat(50));
  console.log('Topic: "sustainable technology"\n');

  const startTime = Date.now();
  const result = await workflow.run({ topic: 'sustainable technology' });
  const totalTime = Date.now() - startTime;

  // Display results from each step
  console.log('\n' + '='.repeat(50));
  console.log('Pipeline Results:');
  console.log('='.repeat(50));

  result.stepResults.forEach((stepResult) => {
    console.log(`\n[${stepResult.stepName.toUpperCase()}] (${stepResult.duration}ms)`);
    stepResult.agentResults.forEach((agentResult) => {
      agentResult.promptResults.forEach((promptResult) => {
        console.log(`  ${promptResult.content.substring(0, 150)}${promptResult.content.length > 150 ? '...' : ''}`);
      });
    });
  });

  // Display metrics
  console.log('\n' + '='.repeat(50));
  console.log('Pipeline Metrics:');
  console.log(`  Status: ${workflow.status}`);
  console.log(`  Total steps: ${result.stepResults.length}`);
  console.log(`  Total tokens: ${formatTokenUsage(result.tokenUsage)}`);
  console.log(`  Estimated cost: $${estimateCost(result.tokenUsage).toFixed(6)}`);
  console.log(`  Total duration: ${totalTime}ms`);

  // Display tree
  console.log('\n' + '='.repeat(50));
  console.log('Execution Tree:');
  console.log(debugger_.toTreeString());

  // Display execution summary
  logger.printSummary();
}

// Example with conditional step execution
async function conditionalStepsExample() {
  console.log('\n\nConditional Processing Example');
  console.log('='.repeat(50));

  // Create workflow that processes based on input type
  const workflow = new AgentWorkflow({
    name: 'ConditionalPipeline',
    defaultModel: 'claude-sonnet-4-5-20250929',
    steps: [
      {
        name: 'classify',
        agents: [
          {
            name: 'classifier',
            prompts: [
              {
                name: 'classify-input',
                system: 'Classify the input type. Respond with exactly one word: QUESTION, STATEMENT, or COMMAND.',
                user: '{{input}}',
              },
            ],
          },
        ],
      },
      {
        name: 'process',
        agents: [
          {
            name: 'processor',
            prompts: [
              {
                name: 'process-input',
                system: 'Process the input appropriately based on its type.',
                user: 'The following was classified and needs processing: "{{input}}"',
              },
            ],
          },
        ],
      },
    ],
  });

  const debugger_ = new WorkflowTreeDebugger(workflow);

  const inputs = [
    'What is the capital of France?',
    'The sky is blue.',
    'Tell me a joke.',
  ];

  for (const input of inputs) {
    console.log(`\nProcessing: "${input}"`);
    const result = await workflow.run({ input });
    console.log(`  Classification: ${result.stepResults[0]?.agentResults[0]?.promptResults[0]?.content.trim()}`);
    console.log(`  Response: ${result.stepResults[1]?.agentResults[0]?.promptResults[0]?.content.substring(0, 100)}...`);
  }
}

// Run examples
main()
  .then(() => conditionalStepsExample())
  .catch(console.error);
