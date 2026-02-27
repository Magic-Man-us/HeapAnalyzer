import { instrumentPython } from './instrumentPython';
import type { MemoryEvent } from '../types';

interface PyResult {
  events: MemoryEvent[];
  stdout: string;
  stderr: string;
}

interface PyodideInterface {
  runPython(code: string): unknown;
}

/**
 * Loads Pyodide from CDN (cached after first load), then runs instrumented Python.
 * Accepts importScripts as a parameter because the worker deletes it from global scope
 * before user code runs (to prevent user JS from loading arbitrary scripts).
 */
export async function runPython(
  userCode: string,
  onStatus: (status: string) => void,
  importScriptsFn: ((...urls: string[]) => void) | undefined,
): Promise<PyResult> {
  // Pyodide is loaded fresh each run since we create a fresh worker per run
  onStatus('loading-pyodide');

  if (!importScriptsFn) {
    throw new Error('importScripts not available — cannot load Pyodide.');
  }

  importScriptsFn('https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.js');

  const loadPyodide = (self as unknown as Record<string, unknown>).loadPyodide as
    (config: Record<string, string>) => Promise<PyodideInterface>;
  const pyodide = await loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.4/full/',
  });

  const instrumented = instrumentPython(userCode);
  const rawResult = pyodide.runPython(instrumented);

  if (typeof rawResult !== 'string') {
    throw new Error('Python code did not produce a JSON result string.');
  }

  const parsed = JSON.parse(rawResult) as unknown;
  return validateResult(parsed);
}

function validateResult(raw: unknown): PyResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Python code did not produce a valid result.');
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
