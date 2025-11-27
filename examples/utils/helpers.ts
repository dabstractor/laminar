/**
 * Utility helpers for workflow examples
 */

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Print a section header
 */
export function printHeader(title: string): void {
  const line = '='.repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(`${line}\n`);
}

/**
 * Print a subsection
 */
export function printSection(title: string): void {
  console.log(`\n--- ${title} ---\n`);
}

/**
 * Simulate an API call with random latency
 */
export async function simulateApiCall<T>(data: T, minMs = 50, maxMs = 200): Promise<T> {
  const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
  await sleep(delay);
  return data;
}

/**
 * Simulate a task that might fail
 */
export async function simulateUnreliableTask<T>(
  data: T,
  failureRate = 0.3
): Promise<T> {
  await sleep(100);
  if (Math.random() < failureRate) {
    throw new Error('Simulated random failure');
  }
  return data;
}

/**
 * Format JSON for pretty printing
 */
export function prettyJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}
