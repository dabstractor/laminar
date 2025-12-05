/**
 * Basic Prompt Example
 *
 * Demonstrates simple prompt execution with:
 * - Variable interpolation
 * - Token usage tracking
 * - Duration tracking
 *
 * Run with: ANTHROPIC_API_KEY=your-key npx tsx examples/basic-prompt.ts
 */

import { PromptInstance, AnthropicClient, formatTokenUsage } from '../src/index.js';

async function main() {
  // Create the Anthropic client
  const client = new AnthropicClient();

  // Create a simple prompt with variable interpolation
  const prompt = new PromptInstance(
    {
      name: 'greeting',
      system: 'You are a friendly assistant who speaks concisely.',
      user: 'Say hello to {{name}} and tell them one interesting fact about {{topic}}.',
    },
    'claude-sonnet-4-5-20250929',
    { name: 'Alice', topic: 'space exploration' }
  );

  console.log('Executing prompt...\n');

  // Execute the prompt
  const result = await prompt.run(client);

  // Display results
  console.log('Response:');
  console.log('-'.repeat(50));
  console.log(result.content);
  console.log('-'.repeat(50));
  console.log(`\nToken usage: ${formatTokenUsage(result.tokenUsage)}`);
  console.log(`Duration: ${result.duration}ms`);

  if (result.error) {
    console.error('Error:', result.error);
  }
}

// Example with nested variable interpolation
async function nestedVariablesExample() {
  const client = new AnthropicClient();

  const prompt = new PromptInstance(
    {
      name: 'user-profile',
      system: 'You generate brief user profile summaries.',
      user: `Create a brief summary for:
Name: {{user.name}}
Age: {{user.age}}
Location: {{user.location.city}}, {{user.location.country}}
Interests: {{user.interests}}`,
    },
    'claude-sonnet-4-5-20250929',
    {
      user: {
        name: 'Bob Smith',
        age: 32,
        location: {
          city: 'San Francisco',
          country: 'USA',
        },
        interests: 'hiking, photography, AI',
      },
    }
  );

  console.log('\n\nNested Variables Example:');
  console.log('='.repeat(50));

  const result = await prompt.run(client);
  console.log(result.content);
  console.log(`\nToken usage: ${formatTokenUsage(result.tokenUsage)}`);
}

// Example with hooks
async function hooksExample() {
  const client = new AnthropicClient();

  const prompt = new PromptInstance(
    {
      name: 'with-hooks',
      user: 'Generate a JSON object with a random number between 1-100.',
      hooks: {
        beforeCall: (input) => {
          console.log('beforeCall hook triggered with input:', input);
          return input;
        },
        afterCall: (result) => {
          console.log('afterCall hook triggered');
          // Try to extract and format JSON
          try {
            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              return {
                ...result,
                content: `Parsed JSON: ${JSON.stringify(parsed, null, 2)}`,
              };
            }
          } catch {
            // Return original if parsing fails
          }
          return result;
        },
      },
    },
    'claude-sonnet-4-5-20250929',
    {}
  );

  console.log('\n\nHooks Example:');
  console.log('='.repeat(50));

  const result = await prompt.run(client);
  console.log(result.content);
}

// Run all examples
main()
  .then(() => nestedVariablesExample())
  .then(() => hooksExample())
  .catch(console.error);
