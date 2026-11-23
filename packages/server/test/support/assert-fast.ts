import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

const CPU_BUDGET_MS = 1_500;

/** Measures CPU time, because a busy machine stretches the clock. The timeout stops input that would never finish. */
export function assertFast(label: string, run: () => unknown) {
  const before = process.threadCpuUsage();
  runInNewContext('run()', { run }, { timeout: 30_000 });
  const { user, system } = process.threadCpuUsage(before);
  const cpuMs = (user + system) / 1_000;
  assert.ok(cpuMs < CPU_BUDGET_MS, `${label} used ${Math.round(cpuMs)}ms of CPU`);
}
