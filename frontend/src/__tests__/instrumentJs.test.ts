import { describe, it, expect } from 'vitest';
import { instrumentJs } from '../sandbox/instrumentJs';
import { runJs } from '../sandbox/jsRuntime';

describe('instrumentJs', () => {
  it('produces alloc events with correct fields', () => {
    const result = runJs('const id = alloc("buf", 1024);');
    expect(result.events).toHaveLength(2); // alloc + end (leaked)
    expect(result.events[0]).toEqual({
      time: 1,
      action: 'alloc',
      id: 'buf_1',
      size: 1024,
      label: 'buf',
    });
  });

  it('produces free events and no end event when all freed', () => {
    const result = runJs(`
      const id = alloc("x", 64);
      free(id);
    `);
    expect(result.events).toHaveLength(2); // alloc + free
    expect(result.events[0].action).toBe('alloc');
    expect(result.events[1].action).toBe('free');
  });

  it('detects double free', () => {
    const result = runJs(`
      const id = alloc("x", 64);
      free(id);
      free(id);
    `);
    expect(result.events).toHaveLength(3); // alloc, free, double_free
    expect(result.events[2].action).toBe('double_free');
  });

  it('appends end event when allocations are leaked', () => {
    const result = runJs('alloc("leak", 512);');
    const last = result.events[result.events.length - 1];
    expect(last.action).toBe('end');
  });

  it('does not append end event when nothing is leaked', () => {
    const result = runJs(`
      const id = alloc("tmp", 32);
      free(id);
    `);
    const actions = result.events.map((e) => e.action);
    expect(actions).not.toContain('end');
  });

  it('captures stdout from print()', () => {
    const result = runJs('print("hello", "world");');
    expect(result.stdout).toBe('hello world');
  });

  it('captures stdout from console.log()', () => {
    const result = runJs('console.log("test output");');
    expect(result.stdout).toBe('test output');
  });

  it('captures stderr from console.error()', () => {
    const result = runJs('console.error("bad stuff");');
    expect(result.stderr).toBe('bad stuff');
  });

  it('throws on alloc with invalid label', () => {
    expect(() => runJs('alloc(123, 64);')).toThrow('label must be a string');
  });

  it('throws on alloc with non-positive size', () => {
    expect(() => runJs('alloc("x", 0);')).toThrow('size must be a positive number');
    expect(() => runJs('alloc("x", -10);')).toThrow('size must be a positive number');
  });

  it('throws on free with non-string id', () => {
    expect(() => runJs('free(42);')).toThrow('id must be a string');
  });

  it('enforces event limit of 10,000', () => {
    expect(() =>
      runJs(`
        for (let i = 0; i < 10001; i++) {
          alloc("item", 1);
        }
      `),
    ).toThrow('Event limit reached');
  });

  it('handles empty code (no events, no crash)', () => {
    const result = runJs('');
    expect(result.events).toHaveLength(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('handles code that only prints (no allocs)', () => {
    const result = runJs('print("just printing");');
    expect(result.events).toHaveLength(0);
    expect(result.stdout).toBe('just printing');
  });

  it('assigns unique ids to allocs with the same label', () => {
    const result = runJs(`
      const a = alloc("buf", 64);
      const b = alloc("buf", 64);
    `);
    const ids = result.events
      .filter((e) => e.action === 'alloc')
      .map((e) => e.id);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('increments time monotonically across operations', () => {
    const result = runJs(`
      const a = alloc("x", 10);
      const b = alloc("y", 20);
      free(a);
    `);
    const times = result.events.map((e) => e.time);
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
