
# **PRODUCT REQUIREMENTS DOCUMENT (PRD)**

## **Workflow Engine + Agent Orchestrator (Anthropic Agent SDK, Model-Strings Only)**

**Version: 1.0 — Clean-Spec Baseline**

---

# **1. OVERVIEW**

This system is a **hierarchical workflow and agent orchestration framework** built directly on top of:

* **Anthropic’s Agent SDK (first-class)**
* **Your custom workflow/agent/prompt abstractions**
* **Unified logging, streaming, caching, and event capture**
* **Tool + MCP event integration**

It provides:

* A **Workflow** containing multiple **Steps**
* A **Step** containing one or more **Agents**
* An **Agent** executing one or more immutable **PromptInstances**
* Each **PromptInstance** may call **tools**, may emit **MCP events**, may stream tokens, may raise/recover from errors, and may trigger **reflection** when needed

It emphasizes:

* extreme transparency
* extreme debuggability
* strict hierarchical ordering
* stable references for logs
* minimal configuration surface
* simple model definition
* max runtime observability

There is **no** routing, no category selection, no CCR, no adapters. The user specifies **model: "claude-3-x-model-name"** directly.

---

# **2. CORE OBJECT MODEL**

## **2.1 Workflow**

A workflow represents a complete hierarchical run.

### **Fields**

```ts
interface WorkflowConfig {
  id?: string;  
  name?: string;
  steps: WorkflowStepConfig[];
  defaultModel?: string;     // fallback if step->agent->prompt doesn't specify
  enableCache?: boolean;     // workflow-level default
  logLevel?: LogLevel;       // debug|info|warn|error|silent
}
```

```ts
class Workflow {
  id: string;
  config: WorkflowConfig;
  state: WorkflowRunState;
  logger: Logger;
  cache: Cache;

  constructor(config: WorkflowConfig);
  run(input: any): Promise<WorkflowRunResult>;
}
```

### **Execution Behavior**

* Creates a **WorkflowRun** object with timestamps + metadata.
* For each step:

  * runs agents in given order
  * aggregates results
* All events are logged in hierarchical order:
  workflow → step → agent → prompt → tool/MCP

---

## **2.2 Workflow Step**

A step encapsulates one or more agents.

### **Fields**

```ts
interface WorkflowStepConfig {
  id?: string;
  name?: string;
  agents: AgentConfig[];
}
```

Execution:

```
for agent in step.agents:
    result = await agent.run(stepInput)
    collect results
```

---

## **2.3 Agent**

An agent represents one single **repeatable run** with:

* tools
* model
* reflection
* retry logic
* hooks
* streaming support

### **Fields**

```ts
interface AgentConfig {
  id?: string;
  name: string;

  model?: string;           // direct model name, e.g. "claude-3-7-sonnet-latest"
  prompts: PromptConfig[];  // immutable ordered list

  tools?: ToolDefinition[];
  enableReflection?: boolean;
  maxRetries?: number;
  enableCache?: boolean;
  hooks?: AgentHooks;
}
```

```ts
class Agent {
  id: string;
  config: AgentConfig;
  anthropicClient: Anthropic;

  run(input: any): Promise<AgentRunResult>;
}
```

### **Agent Behavior**

* Binds model = prompt.model || agent.model || workflow.defaultModel
* Executes each prompt in sequence as its own **PromptInstance**
* Captures:

  * token usage
  * total duration
  * tool invocations
  * MCP events
  * retries
  * errors
  * reflection runs

---

## **2.4 Prompt (Immutable)**

A prompt is a template containing instructions + message content.

### **Fields**

```ts
interface PromptConfig {
  id?: string;
  name: string;
  system?: string;
  user: string;
  model?: string;    // optional override
  cacheable?: boolean;
  jsonSchema?: any;  // optional validation schema
  hooks?: PromptHooks;
}
```

A **PromptInstance** is created per execution:

```ts
class PromptInstance {
  promptConfig: PromptConfig;
  resolvedModel: string;
  input: any;
  result: PromptResult;

  run(): Promise<PromptResult>;
}
```

---

# **3. MODEL SELECTION RULES**

**Strict and simple:**

```
resolvedModel =
  prompt.model
  || agent.model
  || workflow.defaultModel
  || error("No model configured")
```

No categories.
No arrays.
No priorities.
No CCR.
No routing.
Direct string only.

---

# **4. REFLECTION SYSTEM**

Reflection is **top-down**:

* Parent agent decides if reflection is needed.
* Reflection is invoked via:

  ```
  agent.reflect(failedPromptResult, overrideModel?)
  ```
* Reflection prompts:

  * inherit parent’s model unless override is specified
  * run as a separate PromptInstance
  * produce a new result that replaces or augments the failed one

Retries wrap reflection if enabled.

---

# **5. TOOL + MCP INTEGRATION**

## **5.1 Tools**

* A tool call belongs to a **PromptInstance**.
* Tool schema follows Anthropic tool spec.
* Errors are mapped to the calling **PromptInstance**.

Tool call events logged as:

```
workflow/step/agent/prompt/tool-call
```

## **5.2 MCP (Model Context Protocol)**

* All MCP events are attached to the **PromptInstance** event stream.
* Treated similarly to tool calls.
* If MCP supports interrupts, they flow through the PromptInstance.

---

# **6. LOGGING + EVENT HIERARCHY**

Fully structured, hierarchical logging.

### **Event Hierarchy**

```
WorkflowRun
  StepRun
    AgentRun
      PromptInstanceRun
        ToolCallEvents[]
        MCPEvents[]
```

### **Logger Requirements**

* Default: file-based JSON Lines or NDJSON
* Modular adapters:

  * file (default)
  * future: SQL, remote API, UI streaming
* Every event contains:

  * timestamps
  * ids (workflow, step, agent, prompt, tool)
  * duration
  * token counts
  * errors
  * retry counts
  * reflection metadata

---

# **7. CACHING LAYER**

**Parameter-level caching** based on:

```
cacheKey = hash(promptTemplate + resolvedModel + JSON(configOptions) + input)
```

Defaults:

* workflow.enableCache if unset
* agent.enableCache overrides
* prompt.cacheable overrides

Cache can be:

* in-memory (default)
* pluggable future backend (e.g., Redis)

Simple cache busting via:

```ts
cache.clear()
cache.delete(key)
cache.disableForRun()
```

---

# **8. HOOK SYSTEM**

Hooks exist for:

* Agent-level

  * beforeRun
  * afterRun
  * beforePrompt
  * afterPrompt
  * onError
  * onReflection

* Prompt-level

  * beforeCall
  * afterCall
  * onTool
  * onMCP
  * onValidationError

Hooks may modify:

* input
* output
* metadata

Hooks cannot mutate prompt templates (immutable).

---

# **9. STREAMING**

Full streaming support:

* Token-by-token output from Anthropic Agent SDK
* All tool responses
* All MCP events
* All logs can be streamed in real time via event emitter

---

# **10. TYPE + CODE EXAMPLES**

## **10.1 Basic Workflow**

```ts
const wf = new Workflow({
  defaultModel: "claude-3-7-sonnet-latest",

  steps: [
    {
      name: "analysis",
      agents: [
        {
          name: "researcher",
          model: "claude-3-5-haiku-latest",
          prompts: [
            {
              name: "primary",
              user: "Analyze: {{input.text}}",
              cacheable: true,
            }
          ]
        }
      ]
    }
  ]
});

const result = await wf.run({ text: "hello world" });
```

---

## **10.2 Agent with Reflection**

```ts
{
  name: "validator",
  model: "claude-3-7-sonnet-latest",
  enableReflection: true,
  maxRetries: 1,
  prompts: [
    {
      name: "validate",
      user: "Validate JSON: {{input}}",
      jsonSchema: {...}
    }
  ]
}
```

---

## **10.3 PromptInstance Execution (Conceptual)**

```ts
const msg = {
  model: resolvedModel,
  system: prompt.system,
  messages: [{ role: "user", content: prompt.user }],
  tools: agent.tools
};

const result = await anthropic.messages.create(msg, { stream: true });
```

---

# **11. NON-GOALS**

* No CCR
* No category-based model selection
* No multi-provider routing
* No model arrays or fallback chains
* No swarm/council behavior
* No adapter layer required to change between providers

---

# **12. SUMMARY OF WHAT THIS DELTA ADDS**

* Direct model string selection only
* Fully hierarchical logging
* Parameter-level caching
* Strict workflow → step → agent → prompt → tool/MCP hierarchy
* Reflection system retained
* Hooks retained
* Streaming retained
* MCP events integrated cleanly
* No CCR, no categories, no routing logic
* Pure Anthropic Agent SDK

