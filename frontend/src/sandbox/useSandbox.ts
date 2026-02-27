import { useState, useRef, useCallback } from 'react';
import type { SandboxState, SandboxLanguage, MemoryEvent, WorkerOutMessage } from '../types';

const TIMEOUT_MS = 10_000;

const INITIAL_STATE: SandboxState = {
  status: 'idle',
  events: [],
  stdout: '',
  stderr: '',
  error: null,
};

export function useSandbox() {
  const [state, setState] = useState<SandboxState>(INITIAL_STATE);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  const run = useCallback(
    (language: SandboxLanguage, code: string) => {
      // Kill any previous worker
      cleanup();

      if (!code.trim()) {
        setState({ ...INITIAL_STATE, status: 'error', error: 'No code to run.' });
        return;
      }

      setState({ ...INITIAL_STATE, status: 'running' });

      // Create fresh worker for each run (clean sandbox)
      const worker = new Worker(
        new URL('./sandboxWorker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = worker;

      // Hard timeout — kills the worker regardless of what it's doing
      timeoutRef.current = setTimeout(() => {
        cleanup();
        setState((prev) => ({
          ...prev,
          status: 'timeout',
          error: 'Execution timed out after 10 seconds. Check for infinite loops.',
        }));
      }, TIMEOUT_MS);

      worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
        const msg = e.data;

        if (msg.type === 'status') {
          setState((prev) => ({ ...prev, status: msg.status }));
          return;
        }

        // Clear timeout on any terminal message
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        if (msg.type === 'result') {
          const events = validateEvents(msg.events);
          setState({
            status: events.length > 0 ? 'success' : 'success',
            events,
            stdout: msg.stdout,
            stderr: msg.stderr,
            error: events.length === 0 ? 'Code ran but produced no memory events. Use alloc(label, size) to allocate.' : null,
          });
        } else if (msg.type === 'error') {
          setState({
            status: 'error',
            events: [],
            stdout: msg.stdout,
            stderr: msg.stderr,
            error: msg.error,
          });
        }

        // Terminate worker after getting result
        worker.terminate();
        workerRef.current = null;
      };

      worker.onerror = (err) => {
        cleanup();
        setState({
          status: 'error',
          events: [],
          stdout: '',
          stderr: '',
          error: err.message || 'Worker error',
        });
      };

      // Send run message
      worker.postMessage({ type: 'run', language, code });
    },
    [cleanup],
  );

  const stop = useCallback(() => {
    cleanup();
    setState((prev) => ({
      ...prev,
      status: prev.status === 'running' || prev.status === 'loading-pyodide' ? 'idle' : prev.status,
    }));
  }, [cleanup]);

  return { ...state, run, stop };
}

/** Validate events array from worker output */
function validateEvents(raw: unknown): MemoryEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: MemoryEvent[] = [];
  for (const ev of raw) {
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
  return events;
}
