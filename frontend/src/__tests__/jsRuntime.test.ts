import { describe, it, expect } from 'vitest';
import { instrumentJs } from '../sandbox/instrumentJs';

/**
 * Tests for the JS runtime behavior. Since runJs now uses Blob Workers
 * (unavailable in jsdom), we test via the same simulate pattern.
 *
 * NOTE: new Function() is used ONLY in tests to simulate Blob worker execution.
 * Production code uses Blob URL workers (CSP-safe, no dynamic code evaluation).
 */

interface SimResult {
  type: string;
  events: Array<Record<string, unknown>>;
  stdout: string;
  stderr: string;
  error?: string;
}

function simulate(userCode: string): SimResult {
  const code = instrumentJs(userCode);
  let result: SimResult | null = null;
  const mockSelf = {
    postMessage: (msg: SimResult) => { result = msg; },
  };
  // Test-only execution (production uses Blob URL worker)
  const executor = new Function('self', code); // eslint-disable-line no-new-func
  executor(mockSelf);
  if (!result) throw new Error('Code did not call postMessage');
  return result;
}

describe('jsRuntime (via instrumentation)', () => {
  it('returns validated events for simple alloc/free', () => {
    const result = simulate(`
      const id = alloc("buf", 256);
      free(id);
    `);
    expect(result.type).toBe('result');
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toMatchObject({ action: 'alloc', id: 'buf_1', size: 256, label: 'buf' });
    expect(result.events[1]).toMatchObject({ action: 'free', id: 'buf_1' });
  });

  it('returns stdout and stderr strings', () => {
    const result = simulate(`
      console.log("out");
      console.error("err");
    `);
    expect(result.stdout).toBe('out');
    expect(result.stderr).toBe('err');
  });

  it('detects leaks via end event', () => {
    const result = simulate('alloc("leaked", 128);');
    const actions = result.events.map((e) => e.action);
    expect(actions).toContain('alloc');
    expect(actions).toContain('end');
  });

  it('detects double free', () => {
    const result = simulate(`
      const id = alloc("x", 32);
      free(id);
      free(id);
    `);
    expect(result.events[2].action).toBe('double_free');
  });

  it('syntax error in user code throws during construction', () => {
    // In production, Blob worker fires onerror for syntax errors.
    // In test, Function constructor throws SyntaxError at parse time.
    expect(() => simulate('const = ;')).toThrow(SyntaxError);
  });

  it('posts error on runtime error in user code', () => {
    const result = simulate('undefinedFunction();');
    expect(result.type).toBe('error');
  });

  it('validates event fields have correct types', () => {
    const result = simulate(`
      const a = alloc("test", 100);
      free(a);
    `);
    for (const ev of result.events) {
      expect(typeof ev.time).toBe('number');
      expect(typeof ev.action).toBe('string');
    }
  });

  it('handles multiple allocs and partial frees', () => {
    const result = simulate(`
      const a = alloc("a", 10);
      const b = alloc("b", 20);
      const c = alloc("c", 30);
      free(a);
    `);
    const allocs = result.events.filter((e) => e.action === 'alloc');
    const frees = result.events.filter((e) => e.action === 'free');
    const ends = result.events.filter((e) => e.action === 'end');
    expect(allocs).toHaveLength(3);
    expect(frees).toHaveLength(1);
    expect(ends).toHaveLength(1);
  });

  it('returns empty stdout/stderr when nothing is printed', () => {
    const result = simulate(`
      const id = alloc("quiet", 8);
      free(id);
    `);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});
