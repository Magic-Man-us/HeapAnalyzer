/**
 * Wraps user JavaScript code with alloc/free tracking API.
 * The instrumented code runs as a standalone script inside a Blob worker.
 * It posts its result back via postMessage (no eval required).
 */
export function instrumentJs(userCode: string): string {
  return `
'use strict';
const __events = [];
const __allocs = new Map();
const __stdout = [];
const __stderr = [];
let __time = 0;
const MAX_EVENTS = 10000;

function alloc(label, size) {
  if (typeof label !== 'string') throw new Error('alloc: label must be a string');
  if (typeof size !== 'number' || size <= 0) throw new Error('alloc: size must be a positive number');
  if (__events.length >= MAX_EVENTS) throw new Error('Event limit reached (10,000). Reduce allocations.');
  __time++;
  const id = label + '_' + __time;
  __allocs.set(id, { label, size });
  __events.push({ time: __time, action: 'alloc', id, size, label });
  return id;
}

function free(id) {
  if (typeof id !== 'string') throw new Error('free: id must be a string returned by alloc()');
  if (__events.length >= MAX_EVENTS) throw new Error('Event limit reached (10,000). Reduce allocations.');
  __time++;
  if (!__allocs.has(id)) {
    __events.push({ time: __time, action: 'double_free', id });
    return;
  }
  __allocs.delete(id);
  __events.push({ time: __time, action: 'free', id });
}

function print(...args) {
  __stdout.push(args.map(String).join(' '));
}

function log(...args) {
  __stdout.push(args.map(String).join(' '));
}

const console = {
  log: (...args) => __stdout.push(args.map(String).join(' ')),
  error: (...args) => __stderr.push(args.map(String).join(' ')),
  warn: (...args) => __stderr.push(args.map(String).join(' ')),
};

try {
  // --- User code ---
  ${userCode}
  // --- End user code ---

  // Mark remaining allocations as leaked
  if (__allocs.size > 0) {
    __time++;
    __events.push({ time: __time, action: 'end' });
  }

  self.postMessage({
    type: 'result',
    events: __events,
    stdout: __stdout.join('\\n'),
    stderr: __stderr.join('\\n'),
  });
} catch (err) {
  self.postMessage({
    type: 'error',
    error: err instanceof Error ? err.message : String(err),
    stdout: __stdout.join('\\n'),
    stderr: __stderr.join('\\n'),
  });
}
`;
}
