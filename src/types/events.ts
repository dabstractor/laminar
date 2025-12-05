import type { WorkflowNode } from './workflow.js';
import type { WorkflowError } from './error.js';
import type { ToolCallEvent } from './tool.js';
import type { MCPEvent } from './mcp.js';
import type { TokenUsage } from './token-usage.js';
import type { PromptResult } from './prompt-config.js';
import type { AgentRunResult } from './agent-config.js';

/**
 * Discriminated union of all workflow events
 */
export type WorkflowEvent =
  // Existing events
  | { type: 'childAttached'; parentId: string; child: WorkflowNode }
  | { type: 'stateSnapshot'; node: WorkflowNode }
  | { type: 'stepStart'; node: WorkflowNode; step: string }
  | { type: 'stepEnd'; node: WorkflowNode; step: string; duration: number }
  | { type: 'error'; node: WorkflowNode; error: WorkflowError }
  | { type: 'taskStart'; node: WorkflowNode; task: string }
  | { type: 'taskEnd'; node: WorkflowNode; task: string }
  | { type: 'treeUpdated'; root: WorkflowNode }
  // New agent events
  | { type: 'agentRunStart'; agentId: string; agentName: string; input: unknown; timestamp: number }
  | { type: 'agentRunEnd'; agentId: string; agentName: string; result: AgentRunResult; duration: number; tokenUsage: TokenUsage }
  // New prompt events
  | { type: 'promptInstanceStart'; promptId: string; promptName: string; input: unknown; timestamp: number }
  | { type: 'promptInstanceEnd'; promptId: string; promptName: string; result: PromptResult; duration: number; tokenUsage: TokenUsage }
  // Token streaming event
  | { type: 'promptTokenReceived'; promptId: string; token: string; timestamp: number }
  // Tool events
  | { type: 'toolCallStart'; toolId: string; toolName: string; input: unknown; parentPromptId: string; timestamp: number }
  | { type: 'toolCallEnd'; toolId: string; toolName: string; output: unknown; error: unknown; duration: number; parentPromptId: string }
  // MCP events
  | { type: 'mcpEventReceived'; event: MCPEvent; parentPromptId: string }
  // Reflection events
  | { type: 'reflectionStart'; agentId: string; originalError: unknown; timestamp: number }
  | { type: 'reflectionEnd'; agentId: string; result: PromptResult; timestamp: number };
