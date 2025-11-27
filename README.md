# Laminar

Hierarchical workflow orchestration engine with full observability.

## Install

```bash
npm install laminar
```

## Quick Start

```typescript
import { Workflow, Step, ObservedState } from 'laminar';

class MyWorkflow extends Workflow {
  @ObservedState()
  progress = 0;

  @Step({ trackTiming: true })
  async process(): Promise<void> {
    this.progress = 100;
  }

  async run(): Promise<void> {
    this.setStatus('running');
    await this.process();
    this.setStatus('completed');
  }
}

const workflow = new MyWorkflow('Example');
await workflow.run();
```

## Concepts

- [Workflows](./WORKFLOW.md) - Hierarchical task orchestration with decorators
- Agents - *(coming soon)*
- Prompts - *(coming soon)*

## Requirements

- Node.js 18+
- TypeScript 5.2+

## License

MIT
