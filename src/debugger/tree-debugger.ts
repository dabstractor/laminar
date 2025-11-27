import type {
  WorkflowNode,
  WorkflowEvent,
  WorkflowObserver,
  LogEntry,
} from '../types/index.js';
import { Observable } from '../utils/observable.js';
import type { Workflow } from '../core/workflow.js';

/**
 * Status symbols for tree visualization
 */
const STATUS_SYMBOLS: Record<string, string> = {
  idle: '○',
  running: '◐',
  completed: '✓',
  failed: '✗',
  cancelled: '⊘',
};

/**
 * Tree debugger for real-time workflow visualization
 * Implements WorkflowObserver to receive all events
 */
export class WorkflowTreeDebugger implements WorkflowObserver {
  /** Root node of the workflow tree */
  private root: WorkflowNode;

  /** Observable stream of workflow events */
  public readonly events: Observable<WorkflowEvent>;

  /** Node lookup map for quick access */
  private nodeMap: Map<string, WorkflowNode> = new Map();

  /**
   * Create a tree debugger attached to a workflow
   * @param workflow The root workflow to debug
   */
  constructor(workflow: Workflow) {
    this.root = workflow.getNode();
    this.events = new Observable<WorkflowEvent>();

    // Build initial node map
    this.buildNodeMap(this.root);

    // Register as observer on the workflow
    workflow.addObserver(this);
  }

  /**
   * Build node lookup map recursively
   */
  private buildNodeMap(node: WorkflowNode): void {
    this.nodeMap.set(node.id, node);
    for (const child of node.children) {
      this.buildNodeMap(child);
    }
  }

  // WorkflowObserver implementation

  onLog(_entry: LogEntry): void {
    // Events are forwarded through the event stream
  }

  onEvent(event: WorkflowEvent): void {
    // Rebuild node map on structural changes
    if (event.type === 'childAttached') {
      this.buildNodeMap(event.child);
    }

    // Forward to event stream
    this.events.next(event);
  }

  onStateUpdated(_node: WorkflowNode): void {
    // State updates are available through the node
  }

  onTreeChanged(root: WorkflowNode): void {
    this.root = root;
    this.nodeMap.clear();
    this.buildNodeMap(root);
  }

  // Public API

  /**
   * Get the current tree root
   */
  getTree(): WorkflowNode {
    return this.root;
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): WorkflowNode | undefined {
    return this.nodeMap.get(id);
  }

  /**
   * Render tree as ASCII string
   * @param node Starting node (defaults to root)
   */
  toTreeString(node?: WorkflowNode): string {
    return this.renderTree(node ?? this.root, '', true, true);
  }

  /**
   * Recursive tree rendering
   */
  private renderTree(
    node: WorkflowNode,
    prefix: string,
    isLast: boolean,
    isRoot: boolean
  ): string {
    let result = '';

    // Status symbol and color indicator
    const statusSymbol = STATUS_SYMBOLS[node.status] || '?';
    const nodeInfo = `${statusSymbol} ${node.name} [${node.status}]`;

    if (isRoot) {
      result += nodeInfo + '\n';
    } else {
      const connector = isLast ? '└── ' : '├── ';
      result += prefix + connector + nodeInfo + '\n';
    }

    // Render children
    const childCount = node.children.length;
    node.children.forEach((child, index) => {
      const isLastChild = index === childCount - 1;
      const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
      result += this.renderTree(child, childPrefix, isLastChild, false);
    });

    return result;
  }

  /**
   * Render logs as formatted string
   * @param node Starting node (defaults to root, includes descendants)
   */
  toLogString(node?: WorkflowNode): string {
    const logs = this.collectLogs(node ?? this.root);

    // Sort by timestamp
    logs.sort((a, b) => a.timestamp - b.timestamp);

    return logs
      .map((log) => {
        const time = new Date(log.timestamp).toISOString();
        const level = log.level.toUpperCase().padEnd(5);
        const nodeRef = this.nodeMap.get(log.workflowId);
        const nodeName = nodeRef?.name ?? log.workflowId;
        return `[${time}] ${level} [${nodeName}] ${log.message}`;
      })
      .join('\n');
  }

  /**
   * Collect all logs from a node and its descendants
   */
  private collectLogs(node: WorkflowNode): LogEntry[] {
    const logs: LogEntry[] = [...node.logs];

    for (const child of node.children) {
      logs.push(...this.collectLogs(child));
    }

    return logs;
  }

  /**
   * Get summary statistics for the tree
   */
  getStats(): {
    totalNodes: number;
    byStatus: Record<string, number>;
    totalLogs: number;
    totalEvents: number;
  } {
    const stats = {
      totalNodes: 0,
      byStatus: {} as Record<string, number>,
      totalLogs: 0,
      totalEvents: 0,
    };

    this.collectStats(this.root, stats);
    return stats;
  }

  private collectStats(
    node: WorkflowNode,
    stats: ReturnType<typeof this.getStats>
  ): void {
    stats.totalNodes++;
    stats.byStatus[node.status] = (stats.byStatus[node.status] || 0) + 1;
    stats.totalLogs += node.logs.length;
    stats.totalEvents += node.events.length;

    for (const child of node.children) {
      this.collectStats(child, stats);
    }
  }
}
