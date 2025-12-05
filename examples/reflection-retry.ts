/**
 * Reflection and Retry Example
 *
 * Demonstrates self-correcting agents with:
 * - Automatic retry on failures
 * - Reflection-based error correction
 * - Error hooks and tracking
 *
 * Run with: ANTHROPIC_API_KEY=your-key npx tsx examples/reflection-retry.ts
 */

import {
  Agent,
  AnthropicClient,
  formatTokenUsage,
  type PromptResult,
} from '../src/index.js';

// Simulated validation that sometimes fails
function validateOutput(content: string, requiredFormat: string): { valid: boolean; error?: string } {
  if (requiredFormat === 'json') {
    try {
      JSON.parse(content);
      return { valid: true };
    } catch {
      return { valid: false, error: 'Output is not valid JSON' };
    }
  }

  if (requiredFormat === 'numbered-list') {
    const hasNumbers = /^\d+\./m.test(content);
    if (!hasNumbers) {
      return { valid: false, error: 'Output does not contain a numbered list' };
    }
    return { valid: true };
  }

  return { valid: true };
}

async function main() {
  const client = new AnthropicClient();

  console.log('Reflection and Retry Example');
  console.log('='.repeat(50));

  // Agent with retry and reflection enabled
  const agent = new Agent({
    name: 'ResilientAgent',
    model: 'claude-sonnet-4-5-20250929',
    maxRetries: 2,
    enableReflection: true,
    prompts: [
      {
        name: 'generate-json',
        system: `You are a data generator that MUST output valid JSON only.
No markdown code blocks, no explanations - just raw JSON.
The JSON must be parseable by JSON.parse().`,
        user: 'Generate a JSON object representing a {{entity}} with id, name, and attributes fields.',
        hooks: {
          afterCall: async (result: PromptResult): Promise<PromptResult> => {
            // Validate the output
            const validation = validateOutput(result.content, 'json');
            if (!validation.valid) {
              // Mark as error to trigger retry/reflection
              console.log(`    [Validation Failed] ${validation.error}`);
              return {
                ...result,
                error: new Error(validation.error),
              };
            }
            console.log('    [Validation Passed]');
            return result;
          },
        },
      },
    ],
    hooks: {
      onError: (error) => {
        console.log(`  [Error Hook] ${error}`);
      },
      onReflection: (failed, reflection) => {
        console.log('  [Reflection Hook]');
        console.log(`    Original error: ${failed.error}`);
        console.log(`    Reflection response: ${reflection.content.substring(0, 100)}...`);
      },
    },
  });

  console.log('\nRunning agent with validation...');
  console.log('(May retry if output fails validation)\n');

  const result = await agent.run(client, { entity: 'superhero' });

  console.log('\n' + '-'.repeat(50));
  console.log('Final Result:');

  if (result.error) {
    console.log(`Status: Failed after ${result.retryCount} retries`);
    console.log(`Error: ${result.error}`);
  } else {
    console.log('Status: Success');
    console.log(`Content: ${result.promptResults[0]?.content}`);
  }

  console.log(`\nRetry count: ${result.retryCount}`);
  console.log(`Total tokens: ${formatTokenUsage(result.tokenUsage)}`);

  if (result.reflectionMetadata) {
    console.log('\nReflection was used:');
    console.log(`  Original error: ${result.reflectionMetadata.originalError}`);
  }
}

// Example with custom reflection handling
async function customReflectionExample() {
  const client = new AnthropicClient();

  console.log('\n\nCustom Reflection Handling Example');
  console.log('='.repeat(50));

  let attemptCount = 0;
  const reflectionHistory: Array<{ attempt: number; error: string; correction: string }> = [];

  const agent = new Agent({
    name: 'StrictFormatAgent',
    model: 'claude-sonnet-4-5-20250929',
    maxRetries: 3,
    enableReflection: true,
    prompts: [
      {
        name: 'strict-format',
        system: `You MUST respond with exactly 3 bullet points.
Each bullet must start with "- " (dash space).
No other format is acceptable.`,
        user: 'List 3 benefits of {{topic}}.',
        hooks: {
          afterCall: async (result: PromptResult): Promise<PromptResult> => {
            attemptCount++;
            console.log(`\n  Attempt ${attemptCount}:`);
            console.log(`    Output: ${result.content.substring(0, 100)}...`);

            // Check for exactly 3 bullet points
            const bullets = result.content.match(/^- .+$/gm) || [];
            if (bullets.length !== 3) {
              const error = `Expected 3 bullets, got ${bullets.length}`;
              console.log(`    [FAIL] ${error}`);
              return { ...result, error: new Error(error) };
            }

            console.log('    [PASS] Format is correct');
            return result;
          },
        },
      },
    ],
    hooks: {
      onReflection: (failed, reflection) => {
        reflectionHistory.push({
          attempt: attemptCount,
          error: String(failed.error),
          correction: reflection.content.substring(0, 200),
        });
      },
    },
  });

  const result = await agent.run(client, { topic: 'exercise' });

  console.log('\n' + '-'.repeat(50));
  console.log('Results Summary:');
  console.log(`Total attempts: ${attemptCount}`);
  console.log(`Final status: ${result.error ? 'Failed' : 'Success'}`);

  if (reflectionHistory.length > 0) {
    console.log('\nReflection History:');
    reflectionHistory.forEach((r, i) => {
      console.log(`  ${i + 1}. Attempt ${r.attempt}: ${r.error}`);
    });
  }

  console.log(`\nFinal output:\n${result.promptResults[0]?.content}`);
}

// Example showing progressive improvement through retries
async function progressiveImprovementExample() {
  const client = new AnthropicClient();

  console.log('\n\nProgressive Improvement Example');
  console.log('='.repeat(50));

  const outputs: string[] = [];

  const agent = new Agent({
    name: 'ImprovingAgent',
    model: 'claude-sonnet-4-5-20250929',
    maxRetries: 2,
    enableReflection: true,
    prompts: [
      {
        name: 'improve-each-time',
        system: `Generate a haiku about technology.
A haiku has EXACTLY 3 lines with 5-7-5 syllable pattern.
Each line must be on its own line.`,
        user: 'Write a haiku about {{topic}}.',
        hooks: {
          afterCall: async (result: PromptResult): Promise<PromptResult> => {
            outputs.push(result.content);
            console.log(`\n  Output ${outputs.length}:`);
            console.log('  ' + result.content.replace(/\n/g, '\n  '));

            // Check for 3 lines
            const lines = result.content.trim().split('\n').filter((l) => l.trim());
            if (lines.length !== 3) {
              return {
                ...result,
                error: new Error(`Expected 3 lines, got ${lines.length}`),
              };
            }

            return result;
          },
        },
      },
    ],
  });

  await agent.run(client, { topic: 'artificial intelligence' });

  console.log('\n' + '-'.repeat(50));
  console.log('All outputs generated:');
  outputs.forEach((output, i) => {
    console.log(`\n--- Output ${i + 1} ---`);
    console.log(output);
  });
}

// Run all examples
main()
  .then(() => customReflectionExample())
  .then(() => progressiveImprovementExample())
  .catch(console.error);
