import { describe, it, expect } from 'vitest';
import { instrumentJs } from '../sandbox/instrumentJs';

/**
 * Security-focused tests for the JS sandbox instrumentation.
 *
 * Production code uses Blob URL workers (CSP-safe, no dynamic code paths).
 * Tests use Function constructor ONLY to simulate the Blob worker environment
 * since jsdom doesn't support real Web Workers.
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
  const mockSelf = { postMessage: (msg: SimResult) => { result = msg; } };
  // Test-only: simulate Blob worker execution
  new Function('self', code)(mockSelf); // eslint-disable-line no-new-func
  if (!result) throw new Error('Code did not call postMessage');
  return result;
}

describe('sandbox security', () => {
  it('instrumented code does not inject DOM or browser APIs', () => {
    const code = instrumentJs('');
    expect(code).not.toContain('document');
    expect(code).not.toContain('window');
    expect(code).not.toContain('localStorage');
  });

  it('user code syntax errors throw during construction', () => {
    // In production, Blob worker fires onerror for syntax errors.
    // In test, Function constructor throws SyntaxError at parse time.
    expect(() => simulate('function {')).toThrow(SyntaxError);
  });

  it('user code runtime errors are caught and reported', () => {
    const result = simulate('null.property');
    expect(result.type).toBe('error');
  });

  it('event limit prevents memory bomb via alloc loop', () => {
    const result = simulate('for (let i = 0; i < 20000; i++) alloc("bomb", 1);');
    expect(result.type).toBe('error');
    expect(result.error).toContain('Event limit reached');
  });

  it('event limit prevents memory bomb via free loop', () => {
    const result = simulate(`
      const id = alloc("x", 1);
      for (let i = 0; i < 20000; i++) free("nonexistent_" + i);
    `);
    expect(result.type).toBe('error');
    expect(result.error).toContain('Event limit reached');
  });

  it('console override captures output instead of leaking to real console', () => {
    const result = simulate('console.log("captured");');
    expect(result.stdout).toBe('captured');
  });

  it('alloc returns unique IDs even with same label', () => {
    const result = simulate(`
      const ids = new Set();
      for (let i = 0; i < 100; i++) ids.add(alloc("same", 1));
      print(ids.size);
    `);
    expect(result.stdout).toBe('100');
  });

  it('double free of unknown id produces double_free event', () => {
    const result = simulate('free("never_allocated");');
    expect(result.events[0].action).toBe('double_free');
  });

  it('handles very large size values without crashing', () => {
    const result = simulate('const id = alloc("huge", Number.MAX_SAFE_INTEGER); free(id);');
    expect(result.events[0].size).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('handles special characters in labels', () => {
    const result = simulate('alloc("<script>alert(1)</script>", 10);');
    expect(result.events[0].label).toBe('<script>alert(1)</script>');
  });

  it('handles unicode in labels', () => {
    const result = simulate('alloc("\\u0431\\u0443\\u0444\\u0435\\u0440", 64);');
    expect(result.type).toBe('result');
  });

  it('handles empty string label', () => {
    const result = simulate('alloc("", 10);');
    expect(result.events[0].label).toBe('');
  });
});
