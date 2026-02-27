/**
 * Wraps user Python code with alloc/free tracking API.
 * Returns Python source that produces a JSON string of { events, stdout, stderr }.
 */
export function instrumentPython(userCode: string): string {
  // Indent user code by 4 spaces so it sits inside a function
  const indented = userCode
    .split('\n')
    .map((line) => '    ' + line)
    .join('\n');

  return `
import json as _json
import io as _io
import sys as _sys

_events = []
_allocs = {}
_time = [0]
_MAX_EVENTS = 10000
_stdout_capture = _io.StringIO()
_stderr_capture = _io.StringIO()
_sys.stdout = _stdout_capture
_sys.stderr = _stderr_capture

def alloc(label: str, size: int) -> str:
    if not isinstance(label, str):
        raise TypeError("alloc: label must be a string")
    if not isinstance(size, (int, float)) or size <= 0:
        raise ValueError("alloc: size must be a positive number")
    if len(_events) >= _MAX_EVENTS:
        raise RuntimeError("Event limit reached (10,000). Reduce allocations.")
    _time[0] += 1
    id = f"{label}_{_time[0]}"
    _allocs[id] = {"label": label, "size": int(size)}
    _events.append({"time": _time[0], "action": "alloc", "id": id, "size": int(size), "label": label})
    return id

def free(id: str) -> None:
    if not isinstance(id, str):
        raise TypeError("free: id must be a string returned by alloc()")
    if len(_events) >= _MAX_EVENTS:
        raise RuntimeError("Event limit reached (10,000). Reduce allocations.")
    _time[0] += 1
    if id not in _allocs:
        _events.append({"time": _time[0], "action": "double_free", "id": id})
        return
    del _allocs[id]
    _events.append({"time": _time[0], "action": "free", "id": id})

def _run_user_code():
${indented}

_run_user_code()

if _allocs:
    _time[0] += 1
    _events.append({"time": _time[0], "action": "end"})

_json.dumps({"events": _events, "stdout": _stdout_capture.getvalue(), "stderr": _stderr_capture.getvalue()})
`;
}
