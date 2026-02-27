import { runJs } from './jsRuntime';
import { runPython } from './pythonRuntime';
import type { WorkerRunMessage, WorkerOutMessage } from '../types';

// Capture references we need before locking down the global scope
const _postMessage = self.postMessage.bind(self);
const _importScripts = (self as unknown as { importScripts: (...urls: string[]) => void }).importScripts?.bind(self);

// Delete network and timer APIs from the worker global to prevent user code from accessing them.
// This runs once at worker init, before any user code executes.
// We use a type-safe wrapper to avoid TS errors on deleting required properties.
const workerSelf = self as unknown as Record<string, unknown>;
for (const api of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'navigator']) {
  delete workerSelf[api];
}

function postMsg(msg: WorkerOutMessage) {
  _postMessage(msg);
}

self.onmessage = async (e: MessageEvent<WorkerRunMessage>) => {
  const { language, code } = e.data;

  if (e.data.type !== 'run') return;

  try {
    if (language === 'JavaScript') {
      const result = runJs(code);
      postMsg({ type: 'result', events: result.events, stdout: result.stdout, stderr: result.stderr });
    } else if (language === 'Python') {
      const result = await runPython(code, (status) => {
        postMsg({ type: 'status', status: status as 'loading-pyodide' });
      }, _importScripts);
      postMsg({ type: 'result', events: result.events, stdout: result.stdout, stderr: result.stderr });
    } else {
      postMsg({ type: 'error', error: `Unsupported language: ${language}`, stdout: '', stderr: '' });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    postMsg({ type: 'error', error: message, stdout: '', stderr: '' });
  }
};
