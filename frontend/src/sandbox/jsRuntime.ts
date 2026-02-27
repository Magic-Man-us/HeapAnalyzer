import { instrumentJs } from './instrumentJs';
import type { MemoryEvent } from '../types';

export interface JsResult {
  events: MemoryEvent[];
  stdout: string;
  stderr: string;
}

/**
 * Executes instrumented JavaScript inside a Blob URL worker.
 * This is CSP-safe — no dynamic code evaluation on the main thread or parent worker.
 * GitHub Pages sets script-src 'self' which forbids dynamic evaluation,
 * but Blob URLs are treated as same-origin and can run as worker scripts.
 *
 * The instrumented code runs as a standalone script that posts its result
 * back via postMessage.
 */
export function runJs(userCode: string): Promise<JsResult> {
  return new Promise((resolve, reject) => {
    const instrumented = instrumentJs(userCode);
    const blob = new Blob([instrumented], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    const worker = new Worker(url);

    const cleanup = () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };

    worker.onmessage = (e: MessageEvent) => {
      cleanup();
      const msg = e.data;

      if (msg.type === 'error') {
        reject(new Error(msg.error));
        return;
      }

      resolve(validateResult(msg));
    };

    worker.onerror = (err) => {
      cleanup();
      reject(new Error(err.message || 'JavaScript execution failed'));
    };
  });
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
