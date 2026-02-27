import React from 'react';
import CodeEditor from './CodeEditor';
import type { SandboxStatus } from '../types';

interface Props {
  code: string;
  onCodeChange: (code: string) => void;
  onRun: () => void;
  onStop: () => void;
  status: SandboxStatus;
  stdout: string;
  stderr: string;
  error: string | null;
  langColor: string;
  langName: string;
}

const STATUS_LABELS: Record<SandboxStatus, string> = {
  idle: 'Ready',
  running: 'Running...',
  'loading-pyodide': 'Loading Python runtime...',
  success: 'Complete',
  error: 'Error',
  timeout: 'Timed out',
};

const SandboxPanel: React.FC<Props> = ({
  code,
  onCodeChange,
  onRun,
  onStop,
  status,
  stdout,
  stderr,
  error,
  langColor,
  langName,
}) => {
  const isRunning = status === 'running' || status === 'loading-pyodide';
  const hasOutput = stdout || stderr || error;

  return (
    <div
      style={{
        width: '50%',
        borderRight: `1px solid ${langColor}22`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: `1px solid ${langColor}15`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: langColor,
            }}
          />
          <span
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: langColor,
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            {langName} Sandbox
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Status indicator */}
          <span
            style={{
              fontSize: 9,
              color: status === 'error' || status === 'timeout' ? '#f87171'
                : status === 'success' ? '#4ade80'
                : isRunning ? langColor
                : '#475569',
              letterSpacing: 1,
            }}
          >
            {STATUS_LABELS[status]}
          </span>

          {/* Run / Stop button */}
          {isRunning ? (
            <button
              onClick={onStop}
              style={{
                padding: '3px 10px',
                fontSize: 10,
                fontFamily: "'IBM Plex Mono',monospace",
                background: 'rgba(248,113,113,0.15)',
                border: '1px solid rgba(248,113,113,0.4)',
                color: '#f87171',
                borderRadius: 3,
                cursor: 'pointer',
                letterSpacing: 0.5,
              }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={onRun}
              style={{
                padding: '3px 10px',
                fontSize: 10,
                fontFamily: "'IBM Plex Mono',monospace",
                background: `${langColor}15`,
                border: `1px solid ${langColor}40`,
                color: langColor,
                borderRadius: 3,
                cursor: 'pointer',
                letterSpacing: 0.5,
                fontWeight: 600,
              }}
            >
              Run
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      <CodeEditor
        value={code}
        onChange={onCodeChange}
        onRun={onRun}
        langColor={langColor}
      />

      {/* Output console */}
      {hasOutput && (
        <div
          style={{
            borderTop: `1px solid ${langColor}15`,
            maxHeight: 100,
            overflow: 'auto',
            padding: '6px 12px',
            background: 'rgba(0,0,0,0.3)',
            fontSize: 10,
            lineHeight: 1.6,
            fontFamily: "'IBM Plex Mono','Fira Code',monospace",
          }}
        >
          {error && (
            <div style={{ color: '#f87171' }}>{error}</div>
          )}
          {stderr && (
            <div style={{ color: '#fbbf24' }}>{stderr}</div>
          )}
          {stdout && (
            <div style={{ color: '#4ade80' }}>{stdout}</div>
          )}
        </div>
      )}

      {/* API hint */}
      <div
        style={{
          padding: '4px 12px',
          borderTop: '1px solid rgba(34,211,238,0.06)',
          fontSize: 9,
          color: '#334155',
          letterSpacing: 0.5,
        }}
      >
        API: alloc(label, size) → id &nbsp;|&nbsp; free(id) &nbsp;|&nbsp; Ctrl+Enter to run
      </div>
    </div>
  );
};

export default SandboxPanel;
