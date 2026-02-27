import { describe, it, expect } from 'vitest';
import { DEFAULT_CODE } from '../sandbox/defaultCode';
import { runJs } from '../sandbox/jsRuntime';

describe('defaultCode', () => {
  it('has templates for JavaScript and Python', () => {
    expect(DEFAULT_CODE).toHaveProperty('JavaScript');
    expect(DEFAULT_CODE).toHaveProperty('Python');
  });

  it('JavaScript template contains alloc and free calls', () => {
    expect(DEFAULT_CODE.JavaScript).toContain('alloc(');
    expect(DEFAULT_CODE.JavaScript).toContain('free(');
  });

  it('Python template contains alloc and free calls', () => {
    expect(DEFAULT_CODE.Python).toContain('alloc(');
    expect(DEFAULT_CODE.Python).toContain('free(');
  });

  it('JavaScript template includes a deliberate leak', () => {
    expect(DEFAULT_CODE.JavaScript).toMatch(/never freed|leak/i);
  });

  it('Python template includes a deliberate leak', () => {
    expect(DEFAULT_CODE.Python).toMatch(/never freed|leak/i);
  });

  it('JavaScript template is valid and produces events when run', () => {
    const result = runJs(DEFAULT_CODE.JavaScript);
    expect(result.events.length).toBeGreaterThan(0);
    // Should have at least one alloc and one leak (end event)
    const actions = result.events.map((e) => e.action);
    expect(actions).toContain('alloc');
    expect(actions).toContain('end');
  });

  it('templates are non-empty strings', () => {
    expect(DEFAULT_CODE.JavaScript.trim().length).toBeGreaterThan(0);
    expect(DEFAULT_CODE.Python.trim().length).toBeGreaterThan(0);
  });
});
