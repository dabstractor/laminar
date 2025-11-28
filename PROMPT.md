# Prompts

Prompts are immutable request objects that define what to ask an LLM and how to validate the response.

## Overview

```typescript
import { z } from 'zod';
import { Prompt } from 'laminar';

const prompt = new Prompt({
  userPrompt: 'Generate a greeting',
  responseFormat: z.object({
    greeting: z.string(),
    tone: z.enum(['formal', 'casual']),
  }),
});
```

## Core Principles

1. **Immutable**: Once created, prompts cannot be modified. Use `with()` to create variants.
2. **Validated**: Responses are validated against Zod schemas.
3. **Templated**: Support `{placeholder}` substitution via `data`.
4. **Portable**: Do not store provider or category information.

## Configuration

### PromptConfig

```typescript
interface PromptConfig<T> {
  userPrompt: string;              // The prompt text
  data?: Record<string, unknown>;  // Template data
  responseFormat: z.ZodType<T>;    // Zod schema for validation
  modelOverride?: CCRModel;        // Force specific model
  onError?: (err: Error) => void;  // Error callback
}
```

## Creating Prompts

### Basic Prompt

```typescript
const prompt = new Prompt({
  userPrompt: 'List 3 programming languages',
  responseFormat: z.object({
    languages: z.array(z.string()).length(3),
  }),
});
```

### With Data Templating

```typescript
const prompt = new Prompt({
  userPrompt: 'Write a {tone} email to {recipient} about {topic}',
  data: {
    tone: 'professional',
    recipient: 'the engineering team',
    topic: 'the upcoming release',
  },
  responseFormat: z.object({
    subject: z.string(),
    body: z.string(),
  }),
});

// Renders to: "Write a professional email to the engineering team about the upcoming release"
```

### With Model Override

```typescript
const prompt = new Prompt({
  userPrompt: 'Complex analysis task',
  responseFormat: AnalysisSchema,
  modelOverride: 'anthropic,claude-3-opus',  // Force smartest model
});
```

### With Error Handler

```typescript
const prompt = new Prompt({
  userPrompt: 'Generate data',
  responseFormat: DataSchema,
  onError: (err) => {
    console.error('Prompt failed:', err.message);
    // Log to monitoring system
  },
});
```

## Properties

All properties are readonly after construction:

```typescript
const prompt = new Prompt(config);

prompt.userPrompt       // string - The raw prompt text
prompt.data             // Record<string, unknown> - Template data (frozen)
prompt.responseFormat   // z.ZodType<T> - Validation schema
prompt.modelOverride    // CCRModel | undefined
prompt.onError          // ((err: Error) => void) | undefined
```

## Methods

### render()

Substitute `{placeholder}` patterns with data values:

```typescript
const prompt = new Prompt({
  userPrompt: 'Hello {name}, your role is {role}',
  data: { name: 'Alice', role: 'developer' },
  responseFormat: z.string(),
});

prompt.render();  // "Hello Alice, your role is developer"
```

Placeholders without matching data are left unchanged:

```typescript
const prompt = new Prompt({
  userPrompt: 'Hello {name}',
  data: {},
  responseFormat: z.string(),
});

prompt.render();  // "Hello {name}"
```

### validate()

Validate raw response data against the schema:

```typescript
const prompt = new Prompt({
  userPrompt: 'Generate code',
  responseFormat: z.object({
    code: z.string(),
    language: z.string(),
  }),
});

// Valid data
const result = prompt.validate({ code: 'console.log(1)', language: 'javascript' });
// result.code is typed as string

// Invalid data throws PromptValidationError
try {
  prompt.validate({ code: 123 });  // Wrong type
} catch (error) {
  if (error instanceof PromptValidationError) {
    console.error(error.zodError.issues);
  }
}
```

### with()

Create a new prompt with updated values (immutable update):

```typescript
const base = new Prompt({
  userPrompt: 'Analyze {topic}',
  data: { topic: 'sales' },
  responseFormat: AnalysisSchema,
});

// Create variant with different data
const variant = base.with({
  data: { topic: 'marketing' },
});

// base is unchanged
console.log(base.data.topic);     // "sales"
console.log(variant.data.topic);  // "marketing"
```

```typescript
// Override multiple properties
const overridden = base.with({
  userPrompt: 'Deep analyze {topic}',
  modelOverride: 'anthropic,claude-3-opus',
});
```

## Response Schemas

### Simple Types

```typescript
// String
const stringPrompt = new Prompt({
  userPrompt: 'Generate text',
  responseFormat: z.string(),
});

// Number
const numberPrompt = new Prompt({
  userPrompt: 'Calculate value',
  responseFormat: z.number(),
});

// Boolean
const boolPrompt = new Prompt({
  userPrompt: 'Is this valid?',
  responseFormat: z.boolean(),
});
```

### Objects

```typescript
const objectPrompt = new Prompt({
  userPrompt: 'Analyze code',
  responseFormat: z.object({
    quality: z.number().min(0).max(100),
    issues: z.array(z.string()),
    approved: z.boolean(),
  }),
});
```

### Nested Objects

```typescript
const nestedPrompt = new Prompt({
  userPrompt: 'Generate report',
  responseFormat: z.object({
    summary: z.string(),
    sections: z.array(z.object({
      title: z.string(),
      content: z.string(),
      subsections: z.array(z.object({
        heading: z.string(),
        text: z.string(),
      })).optional(),
    })),
    metadata: z.object({
      author: z.string(),
      date: z.string(),
    }),
  }),
});
```

### Enums and Literals

```typescript
const enumPrompt = new Prompt({
  userPrompt: 'Classify sentiment',
  responseFormat: z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    confidence: z.number(),
  }),
});

const literalPrompt = new Prompt({
  userPrompt: 'Get status',
  responseFormat: z.object({
    type: z.literal('status'),
    value: z.string(),
  }),
});
```

### Arrays

```typescript
const arrayPrompt = new Prompt({
  userPrompt: 'List items',
  responseFormat: z.array(z.object({
    name: z.string(),
    price: z.number(),
  })),
});

// With length constraints
const fixedPrompt = new Prompt({
  userPrompt: 'List exactly 5 items',
  responseFormat: z.array(z.string()).length(5),
});

const boundedPrompt = new Prompt({
  userPrompt: 'List 2-5 items',
  responseFormat: z.array(z.string()).min(2).max(5),
});
```

### Optional and Nullable

```typescript
const optionalPrompt = new Prompt({
  userPrompt: 'Get user info',
  responseFormat: z.object({
    name: z.string(),
    email: z.string().optional(),  // May be undefined
    phone: z.string().nullable(),  // May be null
  }),
});
```

### Unions

```typescript
const unionPrompt = new Prompt({
  userPrompt: 'Classify input',
  responseFormat: z.discriminatedUnion('type', [
    z.object({ type: z.literal('success'), data: z.string() }),
    z.object({ type: z.literal('error'), message: z.string() }),
  ]),
});
```

### Transformations

```typescript
const transformPrompt = new Prompt({
  userPrompt: 'Get date',
  responseFormat: z.object({
    date: z.string().transform((s) => new Date(s)),
    count: z.string().transform(Number),
  }),
});
```

### Refinements

```typescript
const refinedPrompt = new Prompt({
  userPrompt: 'Generate password',
  responseFormat: z.object({
    password: z.string()
      .min(8)
      .refine((p) => /[A-Z]/.test(p), 'Must contain uppercase')
      .refine((p) => /[0-9]/.test(p), 'Must contain number'),
  }),
});
```

## Validation Errors

### PromptValidationError

Thrown when validation fails:

```typescript
class PromptValidationError extends Error {
  readonly zodError: z.ZodError;
}
```

### Handling Validation Errors

```typescript
import { PromptValidationError } from 'laminar';

try {
  const result = prompt.validate(rawResponse);
} catch (error) {
  if (error instanceof PromptValidationError) {
    // Access Zod error details
    for (const issue of error.zodError.issues) {
      console.log(`Path: ${issue.path.join('.')}`);
      console.log(`Message: ${issue.message}`);
    }
  }
}
```

### Error Callback

The `onError` callback is called before the error is thrown:

```typescript
const prompt = new Prompt({
  userPrompt: '...',
  responseFormat: schema,
  onError: (err) => {
    // Log, alert, etc.
    metrics.validationErrors++;
  },
});

// onError is called, then error is thrown
try {
  prompt.validate(invalidData);
} catch (error) {
  // Handle error
}
```

## Data Templating

### Basic Substitution

```typescript
const prompt = new Prompt({
  userPrompt: 'Summarize {document}',
  data: { document: 'the quarterly report' },
  responseFormat: z.object({ summary: z.string() }),
});
```

### Multiple Placeholders

```typescript
const prompt = new Prompt({
  userPrompt: 'As a {role}, review the {artifact} and provide {outputType}',
  data: {
    role: 'senior engineer',
    artifact: 'pull request',
    outputType: 'detailed feedback',
  },
  responseFormat: ReviewSchema,
});
```

### Repeated Placeholders

The same placeholder can appear multiple times:

```typescript
const prompt = new Prompt({
  userPrompt: '{name} likes {thing}. {name} wants more {thing}.',
  data: { name: 'Alice', thing: 'coffee' },
  responseFormat: z.string(),
});

prompt.render();  // "Alice likes coffee. Alice wants more coffee."
```

### Complex Data

Data values are converted to strings:

```typescript
const prompt = new Prompt({
  userPrompt: 'Process: {items}',
  data: { items: ['a', 'b', 'c'] },  // Becomes "a,b,c"
  responseFormat: z.string(),
});
```

## Model Override

Prompts can specify a model override that takes precedence over agent configuration:

```typescript
const prompt = new Prompt({
  userPrompt: 'Complex task requiring best model',
  responseFormat: schema,
  modelOverride: 'anthropic,claude-3-opus',
});
```

Override precedence:
1. Runtime override (`agent.prompt(prompt, { model: '...' })`)
2. Prompt override (`prompt.modelOverride`)
3. Agent default
4. Category routing

## Immutability

Prompts are frozen after construction:

```typescript
const prompt = new Prompt({
  userPrompt: 'test',
  data: { key: 'value' },
  responseFormat: z.string(),
});

// These throw errors:
prompt.userPrompt = 'modified';     // Error
prompt.data.key = 'modified';       // Error
prompt.data.newKey = 'value';       // Error
```

Use `with()` to create modified copies:

```typescript
const updated = prompt.with({
  userPrompt: 'modified',
  data: { key: 'newValue' },
});
```

## Use Cases

### Code Generation

```typescript
const CodeSchema = z.object({
  code: z.string(),
  language: z.string(),
  explanation: z.string(),
});

const codePrompt = new Prompt({
  userPrompt: 'Write a {language} function that {description}',
  data: {
    language: 'TypeScript',
    description: 'sorts an array using quicksort',
  },
  responseFormat: CodeSchema,
});
```

### Analysis

```typescript
const AnalysisSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
});

const analysisPrompt = new Prompt({
  userPrompt: 'Analyze the following text:\n\n{text}',
  data: { text: documentContent },
  responseFormat: AnalysisSchema,
});
```

### Classification

```typescript
const ClassificationSchema = z.object({
  category: z.enum(['bug', 'feature', 'question', 'documentation']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  tags: z.array(z.string()),
});

const classifyPrompt = new Prompt({
  userPrompt: 'Classify this issue:\n\nTitle: {title}\nBody: {body}',
  data: { title: issue.title, body: issue.body },
  responseFormat: ClassificationSchema,
});
```

### Code Review

```typescript
const ReviewSchema = z.object({
  approved: z.boolean(),
  issues: z.array(z.object({
    severity: z.enum(['error', 'warning', 'info']),
    line: z.number().optional(),
    message: z.string(),
    suggestion: z.string().optional(),
  })),
  summary: z.string(),
});

const reviewPrompt = new Prompt({
  userPrompt: `Review this {language} code:

\`\`\`{language}
{code}
\`\`\`

Check for:
- Bugs and errors
- Security issues
- Performance problems
- Code style`,
  data: {
    language: 'typescript',
    code: sourceCode,
  },
  responseFormat: ReviewSchema,
});
```

### Extraction

```typescript
const ContactSchema = z.object({
  contacts: z.array(z.object({
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
  })),
});

const extractPrompt = new Prompt({
  userPrompt: 'Extract contact information from:\n\n{text}',
  data: { text: emailBody },
  responseFormat: ContactSchema,
});
```

### Multi-Step Reasoning

```typescript
const ReasoningSchema = z.object({
  steps: z.array(z.object({
    step: z.number(),
    thought: z.string(),
    action: z.string().optional(),
    result: z.string().optional(),
  })),
  finalAnswer: z.string(),
  confidence: z.number().min(0).max(1),
});

const reasoningPrompt = new Prompt({
  userPrompt: `Solve this problem step by step:

{problem}

Show your reasoning.`,
  data: { problem: mathProblem },
  responseFormat: ReasoningSchema,
});
```

## Best Practices

### Schema Design

1. Use specific types over `z.any()` or `z.unknown()`
2. Add `.describe()` for complex fields
3. Use enums for constrained values
4. Set reasonable min/max constraints

```typescript
const GoodSchema = z.object({
  status: z.enum(['pending', 'active', 'completed']),
  count: z.number().int().min(0).max(1000),
  items: z.array(z.string()).min(1).max(100),
});
```

### Prompt Text

1. Be specific about output format
2. Include examples for complex outputs
3. Use clear, unambiguous language

```typescript
const prompt = new Prompt({
  userPrompt: `Extract entities from the text.

Return a JSON object with:
- "people": array of person names
- "places": array of location names
- "dates": array of dates in ISO format

Text: {text}`,
  data: { text },
  responseFormat: EntitySchema,
});
```

### Error Handling

1. Always handle PromptValidationError
2. Use onError for logging/monitoring
3. Consider reflection for recovery

```typescript
const prompt = new Prompt({
  userPrompt: '...',
  responseFormat: schema,
  onError: (err) => {
    logger.error('Validation failed', { error: err });
  },
});

try {
  const result = await agent.prompt(prompt);
} catch (error) {
  if (error instanceof PromptValidationError) {
    // Try reflection
    const reflected = await agent.reflect(prompt);
  }
}
```
