# PRP Template: {Feature Name}

> **PRP**: Product Requirements Package - A comprehensive implementation guide enabling one-pass success

## Pre-Implementation Checklist

Before implementing, verify you have:
- [ ] Read and understood this entire PRP
- [ ] Access to all referenced files and documentation
- [ ] Development environment properly configured
- [ ] Understanding of existing codebase patterns

---

## 1. Goal

### Feature Goal
{One clear sentence describing what this feature accomplishes}

### Deliverable
{Concrete, measurable output - what files/functionality will exist when done}

### Success Definition
{How to verify the feature works correctly - specific criteria}

---

## 2. Context

### External Documentation
```yaml
primary_docs:
  - url: "{documentation_url}#specific-section"
    purpose: "{what to learn from this}"
    key_sections:
      - "{section name}"

reference_implementations:
  - url: "{github_url}"
    purpose: "{what patterns to follow}"
    files_to_study:
      - "{specific file path}"
```

### Codebase Context
```yaml
existing_patterns:
  - file: "{path/to/file.ts}"
    pattern: "{pattern name}"
    follow_for: "{what aspect to replicate}"

related_files:
  - path: "{path/to/related.ts}"
    relationship: "{how it relates to this feature}"

naming_conventions:
  files: "{convention description}"
  classes: "{convention description}"
  functions: "{convention description}"
```

### Technical Constraints
```yaml
typescript:
  version: "{minimum version}"
  config_requirements:
    - "{specific tsconfig setting}"

dependencies:
  required:
    - name: "{package name}"
      version: "{version range}"
      purpose: "{why needed}"
  avoid:
    - name: "{package to avoid}"
      reason: "{why to avoid}"

runtime:
  node_version: "{minimum version}"
  target: "{ES target}"
```

### Known Gotchas
```yaml
pitfalls:
  - issue: "{description of common mistake}"
    solution: "{how to avoid/fix}"

  - issue: "{another common mistake}"
    solution: "{how to avoid/fix}"
```

---

## 3. Implementation Tasks

> Tasks are ordered by dependency. Complete each task fully before moving to the next.

### Task 1: {Task Name}
**Depends on**: None (or list dependencies)

**Input**: {What you need before starting}

**Steps**:
1. {Specific action with exact file names}
2. {Next action}
3. {Continue...}

**Output**: {What should exist when done}

**Validation**: {How to verify this task is complete}

---

### Task 2: {Task Name}
**Depends on**: Task 1

**Input**: {What you need}

**Steps**:
1. {Actions}

**Output**: {Results}

**Validation**: {Verification steps}

---

{Continue with additional tasks...}

---

## 4. Implementation Details

### Code Patterns to Follow

```typescript
// Example pattern with annotations
{code example showing the pattern to follow}
```

### File Structure
```
{directory structure showing where files should be created}
```

### Interface Definitions
```typescript
// Key interfaces that must be implemented
{interface definitions}
```

---

## 5. Testing Strategy

### Unit Tests
```yaml
test_files:
  - path: "{test file path}"
    covers:
      - "{what it tests}"

test_patterns:
  - "{describe the testing pattern to follow}"
```

### Integration Tests
```yaml
scenarios:
  - name: "{test scenario}"
    validates: "{what it validates}"
```

### Manual Validation
```yaml
steps:
  - action: "{what to do}"
    expected: "{expected result}"
```

---

## 6. Final Validation Checklist

### Code Quality
- [ ] All TypeScript compiles without errors
- [ ] No linting warnings
- [ ] Follows existing code patterns
- [ ] Proper error handling

### Functionality
- [ ] {Specific functional requirement}
- [ ] {Another requirement}

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual validation complete

### Documentation
- [ ] Code is self-documenting with clear names
- [ ] Complex logic has comments
- [ ] Public APIs have JSDoc

---

## 7. "No Prior Knowledge" Test

**Validation**: If someone knew nothing about this codebase, would they have everything needed to implement this successfully using only this PRP?

- [ ] All file paths are absolute and specific
- [ ] All patterns have concrete examples
- [ ] All dependencies are explicitly listed
- [ ] All validation steps are executable
- [ ] No assumed knowledge of codebase internals

---

## Confidence Score: {X}/10

**Rationale**: {Brief explanation of confidence level and any remaining uncertainties}
