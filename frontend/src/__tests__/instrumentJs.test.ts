import { describe, it, expect } from 'vitest';
import { instrumentJs } from '../sandbox/instrumentJs';

/**
 * Since runJs now uses Blob Workers (not available in jsdom), we test
 * the instrumentation output directly by simulating what the Blob worker does:
 * running the instrumented code and capturing the postMessage call.
 *
 * NOTE: We use new Function() here ONLY in tests to simulate the Blob worker
 * environment. The production code never uses Function() — it creates
 * a Blob URL worker instead, which is CSP-safe.
 */

interface SimResult {
  type: string;
  events: Array<Record<string, unknown>>;
  stdout: string;
  stderr: string;
  error?: string;
}

/** Simulate running instrumented code in a worker-like environment */
function simulate(userCode: string): SimResult {
  const code = instrumentJs(userCode);
  let result: SimResult | null = null;

  // Mock self.postMessage — mirrors what happens inside the Blob worker
  const mockSelf = {
    postMessage: (msg: SimResult) => { result = msg; },
  };

  // Test-only: execute the instrumented code with a mock self
  // (production uses a Blob URL worker, not Function)
  const executor = new Function('self', code); // eslint-disable-line no-new-func
  executor(mockSelf);

  if (!result) throw new Error('Code did not call postMessage');
  return result;
}

describe('instrumentJs', () => {
  it('produces alloc events with correct fields', () => {
    const result = simulate('const id = alloc("buf", 1024);');
    expect(result.type).toBe('result');
    expect(result.events).toHaveLength(2); // alloc + end (leaked)
    expect(result.events[0]).toMatchObject({
      action: 'alloc', label: 'buf', size: 1024, id: 'buf_1', time: 1,
    });
  });

  it('produces free events and no end event when all freed', () => {
    const result = simulate(`
      const id = alloc("x", 64);
      free(id);
    `);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].action).toBe('alloc');
    expect(result.events[1].action).toBe('free');
  });

  it('detects double free', () => {
    const result = simulate(`
      const id = alloc("x", 64);
      free(id);
      free(id);
    `);
    expect(result.events).toHaveLength(3);
    expect(result.events[2].action).toBe('double_free');
  });

  it('appends end event when allocations are leaked', () => {
    const result = simulate('alloc("leak", 512);');
    const last = result.events[result.events.length - 1];
    expect(last.action).toBe('end');
  });

  it('does not append end event when nothing is leaked', () => {
    const result = simulate(`
      const id = alloc("tmp", 32);
      free(id);
    `);
    const actions = result.events.map((e) => e.action);
    expect(actions).not.toContain('end');
  });

  it('captures stdout from print()', () => {
    const result = simulate('print("hello", "world");');
    expect(result.stdout).toBe('hello world');
  });

  it('captures stdout from console.log()', () => {
    const result = simulate('console.log("test output");');
    expect(result.stdout).toBe('test output');
  });

  it('captures stderr from console.error()', () => {
    const result = simulate('console.error("bad stuff");');
    expect(result.stderr).toBe('bad stuff');
  });

  it('posts error for alloc with invalid label', () => {
    const result = simulate('alloc(123, 64);');
    expect(result.type).toBe('error');
    expect(result.error).toContain('label must be a string');
  });

  it('posts error for alloc with non-positive size', () => {
    const r1 = simulate('alloc("x", 0);');
    expect(r1.type).toBe('error');
    expect(r1.error).toContain('size must be a positive number');
  });

  it('posts error for free with non-string id', () => {
    const result = simulate('free(42);');
    expect(result.type).toBe('error');
    expect(result.error).toContain('id must be a string');
  });

  it('posts error when event limit reached', () => {
    const result = simulate(`
      for (let i = 0; i < 10001; i++) {
        alloc("item", 1);
      }
    `);
    expect(result.type).toBe('error');
    expect(result.error).toContain('Event limit reached');
  });

  it('handles empty code (no events, no crash)', () => {
    const result = simulate('');
    expect(result.type).toBe('result');
    expect(result.events).toHaveLength(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('handles code that only prints (no allocs)', () => {
    const result = simulate('print("just printing");');
    expect(result.type).toBe('result');
    expect(result.events).toHaveLength(0);
    expect(result.stdout).toBe('just printing');
  });

  it('assigns unique ids to allocs with the same label', () => {
    const result = simulate(`
      const a = alloc("buf", 64);
      const b = alloc("buf", 64);
    `);
    const ids = result.events
      .filter((e) => e.action === 'alloc')
      .map((e) => e.id);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('increments time monotonically across operations', () => {
    const result = simulate(`
      const a = alloc("x", 10);
      const b = alloc("y", 20);
      free(a);
    `);
    const times = result.events.map((e) => e.time as number);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });

  it('wraps code in strict mode', () => {
    const code = instrumentJs('');
    expect(code).toContain("'use strict'");
  });

  it('includes the user code verbatim in the output', () => {
    const userCode = 'const myVar = alloc("test", 42);';
    const code = instrumentJs(userCode);
    expect(code).toContain(userCode);
  });
});
