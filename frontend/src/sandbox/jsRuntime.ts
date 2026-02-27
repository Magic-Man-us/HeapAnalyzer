import { instrumentJs } from './instrumentJs';
import type { MemoryEvent } from '../types';

interface JsResult {
  events: MemoryEvent[];
  stdout: string;
  stderr: string;
}

/**
 * Executes instrumented JavaScript inside the worker via indirect eval.
 * Returns validated events array plus stdout/stderr.
 */
export function runJs(userCode: string): JsResult {
  const instrumented = instrumentJs(userCode);

  // Indirect eval — runs in global (worker) scope, not in any closure
  // eslint-disable-next-line no-eval
  const indirectEval = eval;
  const result = indirectEval(instrumented) as unknown;

  return validateResult(result);
}

function validateResult(raw: unknown): JsResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Code did not produce a result. Make sure your code uses alloc() and free().');
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.events)) {
    throw new Error('Invalid result: events is not an array');
  }

  const events: MemoryEvent[] = [];
  for (const ev of obj.events) {
    if (!ev || typeof ev !== 'object') continue;
    const e = ev as Record<string, unknown>;
    if (typeof e.time !== 'number' || typeof e.action !== 'string') continue;
    events.push({
      time: e.time as number,
      action: e.action as MemoryEvent['action'],
      ...(typeof e.id === 'string' ? { id: e.id } : {}),
      ...(typeof e.size === 'number' ? { size: e.size } : {}),
      ...(typeof e.label === 'string' ? { label: e.label } : {}),
    });
  }

  return {
    events,
    stdout: typeof obj.stdout === 'string' ? obj.stdout : '',
    stderr: typeof obj.stderr === 'string' ? obj.stderr : '',
  };
}
