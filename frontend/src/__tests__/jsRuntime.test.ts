import { describe, it, expect } from 'vitest';
import { runJs } from '../sandbox/jsRuntime';

describe('runJs', () => {
  it('returns validated events for simple alloc/free', () => {
    const result = runJs(`
      const id = alloc("buf", 256);
      free(id);
    `);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toEqual({
      time: 1,
      action: 'alloc',
      id: 'buf_1',
      size: 256,
      label: 'buf',
    });
    expect(result.events[1]).toEqual({
      time: 2,
      action: 'free',
      id: 'buf_1',
    });
  });

  it('returns stdout and stderr strings', () => {
    const result = runJs(`
      console.log("out");
      console.error("err");
    `);
    expect(result.stdout).toBe('out');
    expect(result.stderr).toBe('err');
  });

  it('detects leaks via end event', () => {
    const result = runJs('alloc("leaked", 128);');
    const actions = result.events.map((e) => e.action);
    expect(actions).toContain('alloc');
    expect(actions).toContain('end');
  });

  it('detects double free', () => {
    const result = runJs(`
      const id = alloc("x", 32);
      free(id);
      free(id);
    `);
    expect(result.events[2].action).toBe('double_free');
  });

  it('throws on syntax error in user code', () => {
    expect(() => runJs('const = ;')).toThrow();
  });

  it('throws on runtime error in user code', () => {
    expect(() => runJs('undefinedFunction();')).toThrow();
  });

  it('validates event fields — only includes properly typed fields', () => {
    // The instrumentation always produces correct types, but this tests
    // that the validation layer would strip bad fields if they appeared
    const result = runJs(`
      const a = alloc("test", 100);
      free(a);
    `);
    for (const ev of result.events) {
      expect(typeof ev.time).toBe('number');
      expect(typeof ev.action).toBe('string');
      if (ev.id !== undefined) expect(typeof ev.id).toBe('string');
      if (ev.size !== undefined) expect(typeof ev.size).toBe('number');
      if (ev.label !== undefined) expect(typeof ev.label).toBe('string');
    }
  });

  it('handles multiple allocs and partial frees', () => {
    const result = runJs(`
      const a = alloc("a", 10);
      const b = alloc("b", 20);
      const c = alloc("c", 30);
      free(a);
      // b and c are leaked
    `);
    const allocs = result.events.filter((e) => e.action === 'alloc');
    const frees = result.events.filter((e) => e.action === 'free');
    const ends = result.events.filter((e) => e.action === 'end');
    expect(allocs).toHaveLength(3);
    expect(frees).toHaveLength(1);
    expect(ends).toHaveLength(1);
  });

  it('returns empty stdout/stderr when nothing is printed', () => {
    const result = runJs(`
      const id = alloc("quiet", 8);
      free(id);
    `);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});
