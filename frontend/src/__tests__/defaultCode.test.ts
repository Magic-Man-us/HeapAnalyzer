import { describe, it, expect } from 'vitest';
import { DEFAULT_CODE } from '../sandbox/defaultCode';
import { instrumentJs } from '../sandbox/instrumentJs';

/**
 * Tests for default code templates.
 * Test-only: uses Function constructor to simulate Blob worker execution.
 * Production code uses Blob URL workers (CSP-safe).
 */

interface SimResult {
  type: string;
  events: Array<Record<string, unknown>>;
  stdout: string;
  stderr: string;
}

function simulate(userCode: string): SimResult {
  const code = instrumentJs(userCode);
  let result: SimResult | null = null;
  const mockSelf = { postMessage: (msg: SimResult) => { result = msg; } };
  // eslint-disable-next-line no-new-func
  new Function('self', code)(mockSelf);
  if (!result) throw new Error('Code did not call postMessage');
  return result;
}

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
    const result = simulate(DEFAULT_CODE.JavaScript);
    expect(result.type).toBe('result');
    expect(result.events.length).toBeGreaterThan(0);
    const actions = result.events.map((e) => e.action);
    expect(actions).toContain('alloc');
    expect(actions).toContain('end');
  });

  it('templates are non-empty strings', () => {
    expect(DEFAULT_CODE.JavaScript.trim().length).toBeGreaterThan(0);
    expect(DEFAULT_CODE.Python.trim().length).toBeGreaterThan(0);
  });
});
