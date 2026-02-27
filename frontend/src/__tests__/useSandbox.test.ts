import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSandbox } from '../sandbox/useSandbox';

// Mock Worker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  private _terminated = false;

  postMessage(data: unknown) {
    // Store for test inspection
    MockWorker.lastMessage = data;
    MockWorker.instances.push(this);
  }

  terminate() {
    this._terminated = true;
    MockWorker.terminateCount++;
  }

  get terminated() {
    return this._terminated;
  }

  // Simulate receiving a message from the worker
  simulateMessage(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }

  simulateError(message: string) {
    this.onerror?.({ message } as ErrorEvent);
  }

  static lastMessage: unknown = null;
  static instances: MockWorker[] = [];
  static terminateCount = 0;
  static reset() {
    MockWorker.lastMessage = null;
    MockWorker.instances = [];
    MockWorker.terminateCount = 0;
  }
}

// Install mock
const OriginalWorker = globalThis.Worker;

beforeEach(() => {
  MockWorker.reset();
  vi.useFakeTimers();
  globalThis.Worker = MockWorker as unknown as typeof Worker;
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.Worker = OriginalWorker;
});

describe('useSandbox', () => {
  it('starts in idle state with empty data', () => {
    const { result } = renderHook(() => useSandbox());
    expect(result.current.status).toBe('idle');
    expect(result.current.events).toEqual([]);
    expect(result.current.stdout).toBe('');
    expect(result.current.stderr).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('transitions to running on run()', () => {
    const { result } = renderHook(() => useSandbox());
    act(() => {
      result.current.run('JavaScript', 'alloc("x", 1);');
    });
    expect(result.current.status).toBe('running');
  });

  it('sends run message to worker', () => {
    const { result } = renderHook(() => useSandbox());
    act(() => {
      result.current.run('JavaScript', 'alloc("x", 1);');
    });
    expect(MockWorker.lastMessage).toEqual({
      type: 'run',
      language: 'JavaScript',
      code: 'alloc("x", 1);',
    });
  });

  it('updates state on successful result', () => {
    const { result } = renderHook(() => useSandbox());
    act(() => {
      result.current.run('JavaScript', 'alloc("x", 1);');
    });

    const worker = MockWorker.instances[0];
    act(() => {
      worker.simulateMessage({
        type: 'result',
        events: [{ time: 1, action: 'alloc', id: 'x_1', size: 1, label: 'x' }],
        stdout: 'hello',
        stderr: '',
      });
    });

    expect(result.current.status).toBe('success');
    expect(result.current.events).toHaveLength(1);
    expect(result.current.stdout).toBe('hello');
    expect(result.current.error).toBeNull();
  });

  it('updates state on error result', () => {
    const { result } = renderHook(() => useSandbox());
    act(() => {
      result.current.run('JavaScript', 'bad code');
    });

    const worker = MockWorker.instances[0];
    act(() => {
      worker.simulateMessage({
        type: 'error',
        error: 'SyntaxError: unexpected token',
        stdout: '',
        stderr: '',
      });
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('SyntaxError: unexpected token');
    expect(result.current.events).toEqual([]);
  });

  it('handles status messages (loading-pyodide)', () => {
    const { result } = renderHook(() => useSandbox());
    act(() => {
      result.current.run('Python', 'alloc("x", 1)');
    });

    const worker = MockWorker.instances[0];
    act(() => {
      worker.simulateMessage({ type: 'status', status: 'loading-pyodide' });
    });

    expect(result.current.status).toBe('loading-pyodide');
  });

  it('times out after 10 seconds', () => {
    const { result } = renderHook(() => useSandbox());
    act(() => {
      result.current.run('JavaScript', 'while(true){}');
    });

    expect(result.current.status).toBe('running');

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.status).toBe('timeout');
    expect(result.current.error).toContain('timed out');
    expect(MockWorker.terminateCount).toBeGreaterThanOrEqual(1);
  });

  it('terminates worker on stop()', () => {
    const { result } = renderHook(() => useSandbox());
    act(() => {
      result.current.run('JavaScript', 'alloc("x", 1);');
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.status).toBe('idle');
    expect(MockWorker.terminateCount).toBeGreaterThanOrEqual(1);
  });

  it('terminates previous worker when run() called again', () => {
    const { result } = renderHook(() => useSandbox());
    act(() => {
      result.current.run('JavaScript', 'first run');
    });

    act(() => {
      result.current.run('JavaScript', 'second run');
    });

    // First worker should have been terminated
    expect(MockWorker.terminateCount).toBeGreaterThanOrEqual(1);
    // Two workers should have been created
    expect(MockWorker.instances).toHaveLength(2);
  });

  it('shows error for empty code', () => {
    const { result } = renderHook(() => useSandbox());
    act(() => {
      result.current.run('JavaScript', '   ');
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('No code to run');
  });

  it('handles worker onerror', () => {
    const { result } = renderHook(() => useSandbox());
    act(() => {
      result.current.run('JavaScript', 'alloc("x", 1);');
    });

    const worker = MockWorker.instances[0];
    act(() => {
      worker.simulateError('Worker crashed');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Worker crashed');
  });

  it('terminates worker after receiving result', () => {
    const { result } = renderHook(() => useSandbox());
    act(() => {
      result.current.run('JavaScript', 'alloc("x", 1);');
    });

    const worker = MockWorker.instances[0];
    act(() => {
      worker.simulateMessage({
        type: 'result',
        events: [{ time: 1, action: 'alloc', id: 'x_1', size: 1, label: 'x' }],
        stdout: '',
        stderr: '',
      });
    });

    expect(worker.terminated).toBe(true);
  });

  it('shows hint when result has zero events', () => {
    const { result } = renderHook(() => useSandbox());
    act(() => {
      result.current.run('JavaScript', 'console.log("hi")');
    });

    const worker = MockWorker.instances[0];
    act(() => {
      worker.simulateMessage({
        type: 'result',
        events: [],
        stdout: 'hi',
        stderr: '',
      });
    });

    expect(result.current.status).toBe('success');
    expect(result.current.error).toContain('no memory events');
  });

  it('validates events from worker — strips invalid entries', () => {
    const { result } = renderHook(() => useSandbox());
    act(() => {
      result.current.run('JavaScript', 'alloc("x", 1)');
    });

    const worker = MockWorker.instances[0];
    act(() => {
      worker.simulateMessage({
        type: 'result',
        events: [
          { time: 1, action: 'alloc', id: 'x_1', size: 1, label: 'x' }, // valid
          { bad: 'event' }, // invalid — missing time/action
          null, // invalid
          { time: 2, action: 'free', id: 'x_1' }, // valid
        ],
        stdout: '',
        stderr: '',
      });
    });

    expect(result.current.events).toHaveLength(2);
  });
});
