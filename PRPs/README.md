# PRPs (Product Requirements Packages)

> PRPs are comprehensive implementation guides designed for **one-pass implementation success**.

## What is a PRP?

A PRP is more than a requirements document—it's a complete implementation package that provides everything an AI agent (or developer) needs to successfully implement a feature without additional context gathering.

## Core Principle

**"No Prior Knowledge" Test**: If someone knew nothing about this codebase, would they have everything needed to implement this feature successfully using only the PRP?

## PRP Structure

Each PRP contains:

1. **Goal** - Clear feature goal, deliverable, and success criteria
2. **Context** - External documentation URLs, codebase patterns, technical constraints, and known gotchas
3. **Implementation Tasks** - Dependency-ordered tasks with specific file names and code patterns
4. **Implementation Details** - Code examples, file structure, and interface definitions
5. **Testing Strategy** - Unit tests, integration tests, and manual validation steps
6. **Final Validation Checklist** - Comprehensive checklist for quality assurance
7. **Confidence Score** - Rating of expected one-pass success likelihood

## Using PRPs

### For AI Agents
1. Read the entire PRP before starting
2. Follow tasks in order (they have dependencies)
3. Use the validation steps after each task
4. Consult external URLs for additional context when needed
5. Reference local research docs in project root for patterns

### For Developers
1. Use PRPs as detailed implementation guides
2. The task breakdown serves as a sprint plan
3. Code patterns show exactly how to implement each component
4. Tests provide immediate validation

## Directory Structure

```
PRPs/
├── README.md                      # This file
├── templates/
│   └── prp_base.md               # Template for creating new PRPs
├── ai_docs/                       # Research documents for AI reference
└── XXX-feature-name.md           # Individual PRPs (numbered)
```

## Creating a New PRP

1. Copy `templates/prp_base.md`
2. Number it sequentially (e.g., `002-next-feature.md`)
3. Fill in all sections with specific, actionable content
4. Apply the "No Prior Knowledge" test
5. Rate your confidence score honestly

## Quality Standards

A good PRP:
- Has **specific file paths**, not generic references
- Includes **working code examples** for each pattern
- Lists **exact dependencies** with versions
- Provides **executable validation commands**
- Covers **error cases** and edge conditions
- Uses **information-dense keywords** from codebase analysis

## Current PRPs

| Number | Name | Status | Confidence |
|--------|------|--------|------------|
| 001 | Hierarchical Workflow Engine | Implementation-Ready | 9/10 |

## Research Materials

Detailed research documents are stored in the project root:
- `DECORATOR_QUICK_REFERENCE.md` - TypeScript decorator patterns
- `DECORATOR_EXAMPLES.ts` - Production-ready decorator code
- `TREE_VISUALIZATION_QUICK_REF.md` - ASCII tree rendering
- `TREE_DEBUG_EXAMPLES.ts` - Tree debugger implementation

These are referenced by PRPs and contain deep technical research.
