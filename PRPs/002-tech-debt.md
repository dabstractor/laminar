# Tech Debt: PRP-002 Agent & Prompt Orchestration

> Items that lacked clarity during PRP creation and require future attention.

**Created**: 2025-12-05
**Related PRP**: `/home/dustin/projects/laminar/PRPs/002-agent-prompt-orchestration.md`
**Source PRD**: `/home/dustin/projects/laminar/PRPs/PRDs/002-agents-prompts.md`

---

## High Priority

### 1. MCP (Model Context Protocol) Integration
**Status**: Placeholder implementation only

**What's unclear**:
- Full MCP event specification not documented in PRD
- How MCP interrupts should pause/resume prompt execution
- Whether MCP events come from Anthropic SDK or external source
- Integration pattern with existing event system

**Current state**: Types defined (`MCPEvent`, `MCPInterrupt`), but `MCPHandler` class is minimal stub

**Action needed**: Research MCP specification, determine if Anthropic SDK supports it natively, or if it requires separate integration

**PRD reference**: Section 5.2

---

### 2. Streaming with Tool Calls
**Status**: Not implemented

**What's unclear**:
- How to handle `tool_use` content blocks mid-stream
- Whether to pause streaming during tool execution
- How to resume and continue yielding tokens after tool completion
- Token usage tracking during streaming tool loops

**Current state**: `PromptInstance.runStreaming()` only handles simple text streaming, no tool loop

**Action needed**: Implement streaming tool loop following Anthropic SDK streaming patterns for tool use

**PRD reference**: Section 9

---

### 3. Cache Integration into PromptInstance
**Status**: Infrastructure ready, not wired

**What's unclear**:
- How cache enable flag cascades: `prompt.cacheable ?? agent.enableCache ?? workflow.enableCache`
- Whether to cache tool call results separately
- Cache invalidation strategy for prompt template changes
- How to handle cache for streaming responses

**Current state**: `Cache` interface, `MemoryCache`, and `generateCacheKey` exist but `PromptInstance.run()` doesn't check cache

**Action needed**: Add cache lookup before API call, cache storage after successful response

**PRD reference**: Section 7

---

## Medium Priority

### 4. JSON Schema Validation
**Status**: Types defined, validation not implemented

**What's unclear**:
- Which JSON Schema draft to support (draft-07 mentioned)
- Whether to use external validator or implement inline
- How validation errors should trigger reflection
- What happens when response isn't valid JSON but has jsonSchema defined

**Current state**: `PromptConfig.jsonSchema` field exists, `PromptHooks.onValidationError` defined, no actual validation

**Action needed**: Implement `SchemaValidator` utility, integrate into `PromptInstance.run()` after getting response

**PRD reference**: Section 2.4, tasks.json P3.M2.T1

---

### 5. File-Based NDJSON Logging
**Status**: Not in PRP scope

**What's unclear**:
- Log file rotation strategy (by size mentioned)
- Log path configuration
- Whether to support async file writes for performance
- How to handle write errors gracefully

**Current state**: Only console-based logging via existing `WorkflowLogger`

**Action needed**: Create `FileLogger` adapter per PRD Section 6

**PRD reference**: Section 6, tasks.json P3.M1.T1

---

### 6. Error Merge Strategy
**Status**: Type defined, not implemented

**What's unclear**:
- When error merging applies (concurrent operations only?)
- Default behavior when `enabled: false`
- How `maxMergeDepth` should work
- What the default `combine` function should do

**Current state**: `ErrorMergeStrategy` interface exists in types

**Action needed**: Implement error aggregation for concurrent agent execution

**PRD reference**: Section 8 (implied by hooks)

---

## Low Priority

### 7. Concurrent Agent Execution in Steps
**Status**: Not implemented

**What's unclear**:
- Whether agents in a step should run sequentially or concurrently
- How to aggregate results from concurrent agents
- Error handling when multiple agents fail concurrently
- Token usage aggregation order

**Current state**: `AgentWorkflow.executeStep()` runs agents sequentially

**Action needed**: Add `concurrent?: boolean` option to `WorkflowStepConfig`, implement `Promise.all()` execution path

**PRD reference**: Section 2.2 (agents run "in given order" suggests sequential is correct default)

---

### 8. Reflection Model Override
**Status**: Partially implemented

**What's unclear**:
- When to use a different model for reflection vs original
- Whether reflection should inherit tool definitions
- Maximum reflection depth (currently hardcoded to 1)

**Current state**: `Agent.reflect()` accepts `overrideModel` parameter but not exposed in config

**Action needed**: Add `reflectionModel?: string` to `AgentConfig`, consider `maxReflectionDepth`

**PRD reference**: Section 4

---

### 9. Real API Behavior Validation
**Status**: Only mock tests

**What's unclear**:
- Actual rate limit behavior and retry timing
- Real token counts vs estimates
- Error response formats in production
- Streaming event timing characteristics

**Current state**: All tests use mocked `AnthropicClient`

**Action needed**: Create integration test suite that runs against real API (with test API key)

---

### 10. Extended Tree Node Types
**Status**: Types defined, not populated

**What's unclear**:
- When to create 'agent', 'prompt', 'tool' nodes in tree
- How deep the tree should go (workflow → step → agent → prompt → tool?)
- Whether tool nodes should be children of prompt nodes

**Current state**: `WorkflowNodeType` enum added, but `AgentWorkflow`/`Agent`/`PromptInstance` don't create child nodes

**Action needed**: Decide on tree structure, emit `childAttached` events for agent/prompt/tool nodes

**PRD reference**: Section 6 (event hierarchy)

---

## Questions for Product/Design

1. **MCP Priority**: Is MCP integration required for v1.0 or can it be deferred?

2. **Cache Scope**: Should caching be opt-in (default false) or opt-out (default true)?

3. **Streaming Tools**: Is streaming with tool calls a v1.0 requirement?

4. **Validation Library**: Can we use an external JSON Schema validator (e.g., `ajv`) or must it be zero-dep?

5. **Log Persistence**: Is file logging required for v1.0 or is in-memory sufficient?

---

## Implementation Order Recommendation

If addressing tech debt, prioritize in this order:

1. **Cache Integration** (Medium effort, high value) - PRD explicitly requires it
2. **JSON Schema Validation** (Medium effort, medium value) - Enables reflection use case
3. **Streaming Tool Calls** (High effort, medium value) - Complete streaming story
4. **File Logging** (Medium effort, medium value) - Production observability
5. **MCP Integration** (Unknown effort, unclear value) - Pending spec clarity
