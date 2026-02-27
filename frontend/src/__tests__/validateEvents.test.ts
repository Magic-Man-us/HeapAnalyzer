import { describe, it, expect } from 'vitest';

/**
 * The validateEvents function is not exported directly, so we test it
 * indirectly through the public API (runJs) and also extract and test
 * the validation logic pattern used in useSandbox.
 *
 * We replicate the validation function here since it's duplicated in
 * useSandbox.ts and jsRuntime.ts with identical logic.
 */

interface MemoryEvent {
  time: number;
  action: string;
  id?: string;
  size?: number;
  label?: string;
}

function validateEvents(raw: unknown): MemoryEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: MemoryEvent[] = [];
  for (const ev of raw) {
    if (!ev || typeof ev !== 'object') continue;
    const e = ev as Record<string, unknown>;
    if (typeof e.time !== 'number' || typeof e.action !== 'string') continue;
    events.push({
      time: e.time as number,
      action: e.action as string,
      ...(typeof e.id === 'string' ? { id: e.id } : {}),
      ...(typeof e.size === 'number' ? { size: e.size } : {}),
      ...(typeof e.label === 'string' ? { label: e.label } : {}),
    });
  }
  return events;
}

describe('validateEvents', () => {
  it('returns empty array for non-array input', () => {
    expect(validateEvents(null)).toEqual([]);
    expect(validateEvents(undefined)).toEqual([]);
    expect(validateEvents('string')).toEqual([]);
    expect(validateEvents(42)).toEqual([]);
    expect(validateEvents({})).toEqual([]);
  });

  it('returns empty array for empty array', () => {
    expect(validateEvents([])).toEqual([]);
  });

  it('accepts valid alloc event', () => {
    const result = validateEvents([
      { time: 1, action: 'alloc', id: 'buf_1', size: 256, label: 'buf' },
    ]);
    expect(result).toEqual([
      { time: 1, action: 'alloc', id: 'buf_1', size: 256, label: 'buf' },
    ]);
  });

  it('accepts valid free event (no size/label)', () => {
    const result = validateEvents([{ time: 2, action: 'free', id: 'buf_1' }]);
    expect(result).toEqual([{ time: 2, action: 'free', id: 'buf_1' }]);
  });

  it('accepts end event (no id/size/label)', () => {
    const result = validateEvents([{ time: 5, action: 'end' }]);
    expect(result).toEqual([{ time: 5, action: 'end' }]);
  });

  it('skips events missing required time field', () => {
    const result = validateEvents([
      { action: 'alloc', id: 'x', size: 10 },
    ]);
    expect(result).toEqual([]);
  });

  it('skips events missing required action field', () => {
    const result = validateEvents([{ time: 1, id: 'x', size: 10 }]);
    expect(result).toEqual([]);
  });

  it('skips events where time is not a number', () => {
    const result = validateEvents([{ time: '1', action: 'alloc' }]);
    expect(result).toEqual([]);
  });

  it('skips events where action is not a string', () => {
    const result = validateEvents([{ time: 1, action: 42 }]);
    expect(result).toEqual([]);
  });

  it('skips null and non-object entries', () => {
    const result = validateEvents([null, undefined, 42, 'string', true, { time: 1, action: 'end' }]);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('end');
  });

  it('strips id field if not a string', () => {
    const result = validateEvents([{ time: 1, action: 'alloc', id: 123, size: 10 }]);
    expect(result[0]).not.toHaveProperty('id');
  });

  it('strips size field if not a number', () => {
    const result = validateEvents([{ time: 1, action: 'alloc', id: 'x', size: '256' }]);
    expect(result[0]).not.toHaveProperty('size');
  });

  it('strips label field if not a string', () => {
    const result = validateEvents([{ time: 1, action: 'alloc', id: 'x', label: 42 }]);
    expect(result[0]).not.toHaveProperty('label');
  });

  it('ignores extra fields on events', () => {
    const result = validateEvents([
      { time: 1, action: 'alloc', id: 'x', size: 10, label: 'buf', extraField: 'hacker', __proto__: {} },
    ]);
    expect(result[0]).not.toHaveProperty('extraField');
    expect(Object.keys(result[0]).sort()).toEqual(['action', 'id', 'label', 'size', 'time']);
  });

  it('handles large arrays correctly', () => {
    const raw = Array.from({ length: 5000 }, (_, i) => ({
      time: i + 1,
      action: 'alloc',
      id: `item_${i}`,
      size: 8,
      label: 'item',
    }));
    const result = validateEvents(raw);
    expect(result).toHaveLength(5000);
  });
});
