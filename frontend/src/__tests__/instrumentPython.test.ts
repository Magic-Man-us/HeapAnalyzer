import { describe, it, expect } from 'vitest';
import { instrumentPython } from '../sandbox/instrumentPython';

describe('instrumentPython', () => {
  it('produces valid Python with wrapper function', () => {
    const code = instrumentPython('x = alloc("buf", 64)');
    expect(code).toContain('def _run_user_code()');
    expect(code).toContain('    x = alloc("buf", 64)');
    expect(code).toContain('_run_user_code()');
  });

  it('indents all user code lines by 4 spaces', () => {
    const userCode = 'a = 1\nb = 2\nc = a + b';
    const result = instrumentPython(userCode);
    const lines = result.split('\n');
    const userLines = lines.filter((l) => l.includes('a = 1') || l.includes('b = 2') || l.includes('c = a + b'));
    for (const line of userLines) {
      expect(line.startsWith('    ')).toBe(true);
    }
  });

  it('includes alloc and free function definitions', () => {
    const code = instrumentPython('');
    expect(code).toContain('def alloc(label: str, size: int) -> str:');
    expect(code).toContain('def free(id: str) -> None:');
  });

  it('includes event limit constant of 10,000', () => {
    const code = instrumentPython('');
    expect(code).toContain('_MAX_EVENTS = 10000');
  });

  it('includes stdout/stderr capture via StringIO', () => {
    const code = instrumentPython('');
    expect(code).toContain('_stdout_capture = _io.StringIO()');
    expect(code).toContain('_stderr_capture = _io.StringIO()');
    expect(code).toContain('_sys.stdout = _stdout_capture');
  });

  it('includes end event for leaked allocations', () => {
    const code = instrumentPython('');
    expect(code).toContain('if _allocs:');
    expect(code).toContain('"action": "end"');
  });

  it('outputs json.dumps as the final expression', () => {
    const code = instrumentPython('');
    const lastNonEmpty = code.split('\n').filter((l) => l.trim()).pop();
    expect(lastNonEmpty).toContain('_json.dumps(');
  });

  it('includes double_free detection in free function', () => {
    const code = instrumentPython('');
    expect(code).toContain('"action": "double_free"');
    expect(code).toContain('if id not in _allocs:');
  });

  it('handles multiline user code with varying indentation', () => {
    const userCode = 'if True:\n  x = alloc("a", 1)\n  free(x)';
    const code = instrumentPython(userCode);
    // Each line should get an additional 4 spaces
    expect(code).toContain('    if True:');
    expect(code).toContain('      x = alloc("a", 1)');
    expect(code).toContain('      free(x)');
  });
});
