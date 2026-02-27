import { describe, it, expect } from 'vitest';
import { runJs } from '../sandbox/jsRuntime';
import { instrumentJs } from '../sandbox/instrumentJs';

/**
 * Security-focused tests for the JS sandbox.
 * These verify that the instrumentation and runtime handle
 * adversarial inputs correctly.
 */
describe('sandbox security', () => {
  it('instrumented code does not inject DOM or browser APIs', () => {
    // In production, Web Workers have no DOM access (browser-enforced).
    // This test verifies our instrumentation wrapper doesn't accidentally
    // provide or reference any DOM/browser globals.
    const code = instrumentJs('');
    expect(code).not.toContain('document');
    expect(code).not.toContain('window');
    expect(code).not.toContain('localStorage');
  });

  it('user code syntax errors are caught and reported', () => {
    expect(() => runJs('function {')).toThrow();
  });

  it('user code runtime errors are caught and reported', () => {
    expect(() => runJs('null.property')).toThrow();
  });

  it('event limit prevents memory bomb via alloc loop', () => {
    expect(() =>
      runJs(`for (let i = 0; i < 20000; i++) alloc("bomb", 1);`),
    ).toThrow('Event limit reached');
  });

  it('event limit prevents memory bomb via free loop', () => {
    // Even free calls count toward the limit
    expect(() =>
      runJs(`
        const id = alloc("x", 1);
        for (let i = 0; i < 20000; i++) free("nonexistent_" + i);
      `),
    ).toThrow('Event limit reached');
  });

  it('console override captures output instead of leaking to real console', () => {
    const result = runJs('console.log("captured");');
    expect(result.stdout).toBe('captured');
  });

  it('alloc returns unique IDs even with same label', () => {
    const result = runJs(`
      const ids = new Set();
      for (let i = 0; i < 100; i++) ids.add(alloc("same", 1));
      print(ids.size);
    `);
    expect(result.stdout).toBe('100');
  });

  it('double free of unknown id produces double_free event', () => {
    const result = runJs('free("never_allocated");');
    expect(result.events[0].action).toBe('double_free');
  });

  it('handles very large size values without crashing', () => {
    const result = runJs('const id = alloc("huge", Number.MAX_SAFE_INTEGER); free(id);');
    expect(result.events[0].size).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('handles special characters in labels', () => {
    const result = runJs(`alloc("<script>alert(1)</script>", 10);`);
    expect(result.events[0].label).toBe('<script>alert(1)</script>');
    // The label is stored as data, not rendered as HTML — React escapes it
  });

  it('handles unicode in labels', () => {
    const result = runJs(`alloc("буфер_🔥", 64);`);
    expect(result.events[0].label).toBe('буфер_🔥');
  });

  it('handles empty string label', () => {
    const result = runJs('alloc("", 10);');
    expect(result.events[0].label).toBe('');
  });
});
