/**
 * Basic Agent Example
 *
 * Demonstrates agent execution with:
 * - Multiple prompts in sequence
 * - Token usage aggregation
 * - Lifecycle hooks
 *
 * Run with: ANTHROPIC_API_KEY=your-key npx tsx examples/basic-agent.ts
 */

import { Agent, AnthropicClient, formatTokenUsage, estimateCost } from '../src/index.js';

async function main() {
  const client = new AnthropicClient();

  // Create an agent with multiple prompts
  const agent = new Agent({
    name: 'ResearchAgent',
    model: 'claude-sonnet-4-5-20250929',
    prompts: [
      {
        name: 'research',
        system: 'You are a research assistant. Provide concise, factual information.',
        user: 'Provide 3 key facts about {{topic}}.',
      },
      {
        name: 'summarize',
        system: 'You are a summarization expert.',
        user: 'Create a one-sentence summary of these facts about {{topic}}.',
      },
    ],
  });

  console.log('Running Research Agent...\n');

  const result = await agent.run(client, { topic: 'renewable energy' });

  // Display results from each prompt
  console.log('Prompt Results:');
  console.log('='.repeat(50));
  result.promptResults.forEach((promptResult, index) => {
    console.log(`\n[Prompt ${index + 1}]`);
    console.log(promptResult.content);
    console.log(`Tokens: ${formatTokenUsage(promptResult.tokenUsage)}`);
  });

  // Display aggregated metrics
  console.log('\n' + '='.repeat(50));
  console.log('Aggregated Metrics:');
  console.log(`Total tokens: ${formatTokenUsage(result.tokenUsage)}`);
  console.log(`Estimated cost: $${estimateCost(result.tokenUsage).toFixed(6)}`);
  console.log(`Total duration: ${result.totalDuration}ms`);
  console.log(`Retry count: ${result.retryCount}`);

  if (result.error) {
    console.error('Error:', result.error);
  }
}

// Example with hooks
async function hooksExample() {
  const client = new AnthropicClient();

  const agent = new Agent({
    name: 'HookedAgent',
    model: 'claude-sonnet-4-5-20250929',
    prompts: [
      {
        name: 'generate',
        user: 'Generate a creative name for a {{type}} startup.',
      },
    ],
    hooks: {
      beforeRun: (input) => {
        console.log('\n[Hook] beforeRun:', input);
        return input;
      },
      afterRun: (result) => {
        console.log('[Hook] afterRun - completed with', result.promptResults.length, 'prompts');
        return result;
      },
      beforePrompt: (prompt, input) => {
        console.log(`[Hook] beforePrompt "${prompt.name}":`, input);
        return input;
      },
      afterPrompt: (prompt, result) => {
        console.log(`[Hook] afterPrompt "${prompt.name}": ${result.content.substring(0, 50)}...`);
        return result;
      },
    },
  });

  console.log('\n\nHooked Agent Example:');
  console.log('='.repeat(50));

  const result = await agent.run(client, { type: 'AI' });
  console.log('\nFinal result:', result.promptResults[0].content);
}

// Example with multiple sequential prompts building on each other
async function chainedPromptsExample() {
  const client = new AnthropicClient();

  const agent = new Agent({
    name: 'ContentCreator',
    model: 'claude-sonnet-4-5-20250929',
    prompts: [
      {
        name: 'brainstorm',
        system: 'You are a creative brainstorming assistant.',
        user: 'Generate 3 blog post title ideas about {{topic}}. Format as a numbered list.',
      },
      {
        name: 'outline',
        system: 'You are a content outline specialist.',
        user: 'Create a brief 3-point outline for a blog post about {{topic}}.',
      },
      {
        name: 'introduction',
        system: 'You are a skilled content writer.',
        user: 'Write a compelling 2-sentence introduction for a blog post about {{topic}}.',
      },
    ],
  });

  console.log('\n\nChained Prompts Example:');
  console.log('='.repeat(50));
  console.log('Creating content about "machine learning"...\n');

  const result = await agent.run(client, { topic: 'machine learning' });

  const stages = ['Brainstorm', 'Outline', 'Introduction'];
  result.promptResults.forEach((promptResult, index) => {
    console.log(`\n--- ${stages[index]} ---`);
    console.log(promptResult.content);
  });

  console.log('\n--- Summary ---');
  console.log(`Total tokens: ${formatTokenUsage(result.tokenUsage)}`);
  console.log(`Total duration: ${result.totalDuration}ms`);
}

// Run all examples
main()
  .then(() => hooksExample())
  .then(() => chainedPromptsExample())
  .catch(console.error);
