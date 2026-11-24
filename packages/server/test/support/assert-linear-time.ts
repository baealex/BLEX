import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

const SIZE_STEP = 16;
// With a 16 times larger input, linear work takes about 16 times the CPU time and quadratic work about 256 times.
const GROWTH_LIMIT = 64;
const ROUNDS = 3;
// Below a millisecond, fixed costs and timer resolution outweigh the input size.
const NOISE_FLOOR_MS = 1;

function cpuMs(run: () => unknown): number {
  const before = process.threadCpuUsage();
  // The timeout stops input that would never finish.
  runInNewContext('run()', { run }, { timeout: 30_000 });
  const { user, system } = process.threadCpuUsage(before);
  return (user + system) / 1_000;
}

/**
 * Fails when the work grows faster than its input. CPU time is not stretched by a busy machine, and comparing
 * two sizes on the same machine does not depend on how fast that machine is.
 */
export function assertLinearTime<Input>(
  label: string,
  run: (input: Input) => unknown,
  input: (size: number) => Input,
  size: number,
) {
  const small = input(size / SIZE_STEP);
  const large = input(size);
  // Keeps compilation out of the first measurement.
  run(small);
  const smallRuns: number[] = [];
  const largeRuns: number[] = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    smallRuns.push(cpuMs(() => run(small)));
    largeRuns.push(cpuMs(() => run(large)));
  }
  // The fastest round leaves out garbage collection pauses and moves between CPU cores.
  const smallMs = Math.min(...smallRuns);
  const largeMs = Math.min(...largeRuns);
  const growth = largeMs / Math.max(smallMs, NOISE_FLOOR_MS);
  assert.ok(
    growth < GROWTH_LIMIT,
    `${label}: ${SIZE_STEP}x the input used ${growth.toFixed(1)}x the CPU time (${smallMs.toFixed(1)}ms, ${largeMs.toFixed(1)}ms)`,
  );
}
