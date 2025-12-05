/**
 * Streaming Example
 *
 * Demonstrates real-time token streaming with:
 * - Token-by-token delivery
 * - Progress tracking
 * - Final result handling
 *
 * Run with: ANTHROPIC_API_KEY=your-key npx tsx examples/streaming-example.ts
 */

import { PromptInstance, AnthropicClient, formatTokenUsage } from '../src/index.js';

async function main() {
  const client = new AnthropicClient();

  console.log('Streaming Example');
  console.log('='.repeat(50));
  console.log('\nGenerating a short story (tokens appear in real-time):\n');

  const prompt = new PromptInstance(
    {
      name: 'story-generator',
      system: 'You are a creative storyteller. Write engaging, vivid prose.',
      user: 'Write a very short story (about 100 words) about {{topic}}.',
    },
    'claude-sonnet-4-5-20250929',
    { topic: 'a robot learning to paint' }
  );

  let tokenCount = 0;
  const startTime = Date.now();

  // Stream tokens
  for await (const event of prompt.runStreaming(client)) {
    if (event.type === 'token') {
      // Write token to stdout without newline
      process.stdout.write(event.token);
      tokenCount++;
    } else if (event.type === 'result') {
      // Final result
      const elapsed = Date.now() - startTime;
      console.log('\n\n' + '='.repeat(50));
      console.log('Streaming complete!');
      console.log(`Tokens streamed: ${tokenCount}`);
      console.log(`Token usage: ${formatTokenUsage(event.result.tokenUsage)}`);
      console.log(`Duration: ${event.result.duration}ms`);
      console.log(`Tokens per second: ${(tokenCount / (elapsed / 1000)).toFixed(1)}`);

      if (event.result.error) {
        console.error('Error:', event.result.error);
      }
    }
  }
}

// Example with progress indicator
async function progressIndicatorExample() {
  const client = new AnthropicClient();

  console.log('\n\nStreaming with Progress Indicator');
  console.log('='.repeat(50));

  const prompt = new PromptInstance(
    {
      name: 'list-generator',
      system: 'You create numbered lists.',
      user: 'List 5 interesting facts about {{topic}}. Number each fact.',
    },
    'claude-sonnet-4-5-20250929',
    { topic: 'the ocean' }
  );

  let charCount = 0;
  const spinnerFrames = ['|', '/', '-', '\\'];
  let spinnerIndex = 0;

  process.stdout.write('\n');

  for await (const event of prompt.runStreaming(client)) {
    if (event.type === 'token') {
      charCount += event.token.length;

      // Update spinner every few characters
      if (charCount % 5 === 0) {
        process.stdout.write(`\r${spinnerFrames[spinnerIndex]} Receiving... (${charCount} chars)`);
        spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
      }
    } else if (event.type === 'result') {
      process.stdout.write('\r' + ' '.repeat(40) + '\r'); // Clear spinner line
      console.log('Response received!\n');
      console.log(event.result.content);
      console.log(`\nTotal characters: ${charCount}`);
      console.log(`Token usage: ${formatTokenUsage(event.result.tokenUsage)}`);
    }
  }
}

// Example collecting all tokens before processing
async function collectThenProcessExample() {
  const client = new AnthropicClient();

  console.log('\n\nCollect Then Process Example');
  console.log('='.repeat(50));

  const prompt = new PromptInstance(
    {
      name: 'json-generator',
      system: 'You output valid JSON only. No markdown, no explanation.',
      user: 'Generate a JSON object representing a {{entity}} with name, age, and occupation fields.',
    },
    'claude-sonnet-4-5-20250929',
    { entity: 'fictional character' }
  );

  const tokens: string[] = [];
  let finalResult;

  console.log('\nCollecting tokens...');

  for await (const event of prompt.runStreaming(client)) {
    if (event.type === 'token') {
      tokens.push(event.token);
      process.stdout.write('.'); // Progress dot
    } else if (event.type === 'result') {
      finalResult = event.result;
    }
  }

  console.log(' Done!\n');

  // Process collected content
  const fullContent = tokens.join('');
  console.log('Raw content:');
  console.log(fullContent);

  // Try to parse as JSON
  try {
    const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('\nParsed JSON:');
      console.log(JSON.stringify(parsed, null, 2));
    }
  } catch (e) {
    console.log('\nCould not parse as JSON');
  }

  console.log(`\nToken count: ${tokens.length}`);
  console.log(`Token usage: ${formatTokenUsage(finalResult!.tokenUsage)}`);
}

// Example with timing analysis
async function timingAnalysisExample() {
  const client = new AnthropicClient();

  console.log('\n\nTiming Analysis Example');
  console.log('='.repeat(50));

  const prompt = new PromptInstance(
    {
      name: 'explanation',
      user: 'Explain {{topic}} in exactly 3 sentences.',
    },
    'claude-sonnet-4-5-20250929',
    { topic: 'how computers work' }
  );

  const timings: number[] = [];
  let lastTime = Date.now();
  let totalTokens = 0;

  for await (const event of prompt.runStreaming(client)) {
    if (event.type === 'token') {
      const now = Date.now();
      const gap = now - lastTime;
      timings.push(gap);
      lastTime = now;
      totalTokens++;
      process.stdout.write(event.token);
    } else if (event.type === 'result') {
      console.log('\n\n' + '-'.repeat(50));

      // Calculate timing statistics
      const avgGap = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxGap = Math.max(...timings);
      const minGap = Math.min(...timings.filter((t) => t > 0));

      console.log('Timing Analysis:');
      console.log(`  Total tokens: ${totalTokens}`);
      console.log(`  Average inter-token gap: ${avgGap.toFixed(1)}ms`);
      console.log(`  Max gap: ${maxGap}ms`);
      console.log(`  Min gap (non-zero): ${minGap}ms`);
      console.log(`  Time to first token: ${timings[0]}ms`);
      console.log(`  Total duration: ${event.result.duration}ms`);
    }
  }
}

// Run all examples
main()
  .then(() => progressIndicatorExample())
  .then(() => collectThenProcessExample())
  .then(() => timingAnalysisExample())
  .catch(console.error);
