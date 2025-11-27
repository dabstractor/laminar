/**
 * Configuration options for @Step decorator
 */
export interface StepOptions {
  /** Custom step name (defaults to method name) */
  name?: string;
  /** If true, capture state snapshot after step completion */
  snapshotState?: boolean;
  /** If true, track and emit step duration */
  trackTiming?: boolean;
  /** If true, log message at step start */
  logStart?: boolean;
  /** If true, log message at step end */
  logFinish?: boolean;
}

/**
 * Configuration options for @Task decorator
 */
export interface TaskOptions {
  /** Custom task name (defaults to method name) */
  name?: string;
  /** If true, run returned workflows concurrently */
  concurrent?: boolean;
}
