/**
 * Basic AgentWorkflow Example
 *
 * Demonstrates workflow orchestration with:
 * - Multiple steps with agents
 * - Token usage aggregation across steps
 * - Workflow status tracking
 * - Tree debugging
 *
 * Run with: ANTHROPIC_API_KEY=your-key npx tsx examples/basic-workflow.ts
 */

import {
  AgentWorkflow,
  WorkflowTreeDebugger,
  formatTokenUsage,
  estimateCost,
} from '../src/index.js';

async function main() {
  // Create a content pipeline workflow
  const workflow = new AgentWorkflow({
    name: 'ContentPipeline',
    defaultModel: 'claude-sonnet-4-5-20250929',
    steps: [
      {
        name: 'research',
        agents: [
          {
            name: 'researcher',
            prompts: [
              {
                name: 'gather-facts',
                system: 'You are a research assistant. Be concise.',
                user: 'List 3 key facts about {{topic}}.',
              },
            ],
          },
        ],
      },
      {
        name: 'writing',
        agents: [
          {
            name: 'writer',
            prompts: [
              {
                name: 'write-intro',
                system: 'You are a skilled writer.',
                user: 'Write a 2-sentence introduction about {{topic}}.',
              },
            ],
          },
        ],
      },
      {
        name: 'review',
        agents: [
          {
            name: 'editor',
            prompts: [
              {
                name: 'review-content',
                system: 'You are an editor. Be brief.',
                user: 'Suggest one improvement for content about {{topic}}.',
              },
            ],
          },
        ],
      },
    ],
  });

  // Attach tree debugger
  const debugger_ = new WorkflowTreeDebugger(workflow);

  console.log('Starting Content Pipeline Workflow...');
  console.log(`Initial status: ${workflow.status}`);
  console.log('='.repeat(50));

  // Run the workflow
  const result = await workflow.run({ topic: 'artificial intelligence' });

  // Display results
  console.log('\nWorkflow Results:');
  console.log('='.repeat(50));

  result.stepResults.forEach((stepResult, stepIndex) => {
    console.log(`\n[Step ${stepIndex + 1}: ${stepResult.stepName}]`);
    console.log(`Duration: ${stepResult.duration}ms`);

    stepResult.agentResults.forEach((agentResult, agentIndex) => {
      console.log(`  Agent ${agentIndex + 1}:`);
      agentResult.promptResults.forEach((promptResult) => {
        console.log(`    ${promptResult.content.substring(0, 100)}...`);
      });
    });
  });

  // Display metrics
  console.log('\n' + '='.repeat(50));
  console.log('Workflow Metrics:');
  console.log(`Final status: ${workflow.status}`);
  console.log(`Total tokens: ${formatTokenUsage(result.tokenUsage)}`);
  console.log(`Estimated cost: $${estimateCost(result.tokenUsage).toFixed(6)}`);
  console.log(`Total duration: ${result.totalDuration}ms`);

  // Display tree
  console.log('\n' + '='.repeat(50));
  console.log('Workflow Tree:');
  console.log(debugger_.toTreeString());

  if (result.error) {
    console.error('Error:', result.error);
  }
}

// Example with multiple agents per step
async function multiAgentStepExample() {
  const workflow = new AgentWorkflow({
    name: 'ParallelResearch',
    defaultModel: 'claude-sonnet-4-5-20250929',
    steps: [
      {
        name: 'multi-perspective-analysis',
        agents: [
          {
            name: 'optimist',
            prompts: [
              {
                name: 'positive-view',
                system: 'You focus on positive aspects and opportunities.',
                user: 'What are the benefits of {{topic}}? (2 sentences)',
              },
            ],
          },
          {
            name: 'critic',
            prompts: [
              {
                name: 'critical-view',
                system: 'You focus on challenges and risks.',
                user: 'What are the challenges of {{topic}}? (2 sentences)',
              },
            ],
          },
          {
            name: 'pragmatist',
            prompts: [
              {
                name: 'practical-view',
                system: 'You focus on practical implementation.',
                user: 'How can we practically implement {{topic}}? (2 sentences)',
              },
            ],
          },
        ],
      },
    ],
  });

  const debugger_ = new WorkflowTreeDebugger(workflow);

  console.log('\n\nMulti-Agent Step Example:');
  console.log('='.repeat(50));

  const result = await workflow.run({ topic: 'remote work' });

  console.log('\nPerspectives on "remote work":');
  const perspectives = ['Optimist', 'Critic', 'Pragmatist'];
  result.stepResults[0].agentResults.forEach((agentResult, index) => {
    console.log(`\n${perspectives[index]}:`);
    console.log(agentResult.promptResults[0].content);
  });

  console.log('\nTree:');
  console.log(debugger_.toTreeString());
}

// Example with event observation
async function observedWorkflowExample() {
  const workflow = new AgentWorkflow({
    name: 'ObservedWorkflow',
    defaultModel: 'claude-sonnet-4-5-20250929',
    steps: [
      {
        name: 'step1',
        agents: [
          {
            name: 'agent1',
            prompts: [{ name: 'prompt1', user: 'Say "Hello" briefly.' }],
          },
        ],
      },
    ],
  });

  // Add observer to track events
  workflow.addObserver({
    onLog: (entry) => {
      console.log(`[LOG ${entry.level.toUpperCase()}] ${entry.message}`);
    },
    onEvent: (event) => {
      if (event.type === 'stepStart') {
        console.log(`[EVENT] Step started: ${event.step}`);
      } else if (event.type === 'stepEnd') {
        console.log(`[EVENT] Step ended: ${event.step} (${event.duration}ms)`);
      } else if (event.type === 'agentRunStart') {
        console.log(`[EVENT] Agent started: ${event.agentName}`);
      } else if (event.type === 'agentRunEnd') {
        console.log(`[EVENT] Agent ended: ${event.agentName} (${formatTokenUsage(event.tokenUsage)})`);
      }
    },
    onStateUpdated: () => {},
    onTreeChanged: () => {},
  });

  console.log('\n\nObserved Workflow Example:');
  console.log('='.repeat(50));

  await workflow.run({});

  console.log(`\nFinal status: ${workflow.status}`);
}

// Run all examples
main()
  .then(() => multiAgentStepExample())
  .then(() => observedWorkflowExample())
  .catch(console.error);
