import React, { useRef, useEffect } from 'react';
import { MemoryEvent } from '../types';

interface Props {
  events: MemoryEvent[];
  currentStep: number;
}

const EventLog: React.FC<Props> = ({ events, currentStep }) => {
  const logRef = useRef<HTMLDivElement>(null);
  const vis = events.slice(0, currentStep + 1).filter((e) => e.action !== 'end');

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [currentStep]);

  const icon = (a: string) =>
    ({ alloc: '█+', free: '█−', double_free: '⚠!' }[a] || '··');
  const clr = (a: string) =>
    ({ alloc: '#22d3ee', free: '#4ade80', double_free: '#fbbf24' }[a] || '#94a3b8');

  return (
    <div
      ref={logRef}
      style={{
        height: '100%',
        overflowY: 'auto',
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize: 11,
        lineHeight: 1.75,
        padding: '6px 10px',
        scrollBehavior: 'smooth',
      }}
    >
      {vis.map((e, i) => (
        <div
          key={`${e.time}-${e.id}`}
          style={{
            color: clr(e.action),
            opacity: i === vis.length - 1 ? 1 : 0.55,
            display: 'flex',
            gap: 6,
          }}
        >
          <span style={{ opacity: 0.4, width: 24, textAlign: 'right' }}>
            {String(e.time).padStart(3, '0')}
          </span>
          <span style={{ width: 22 }}>{icon(e.action)}</span>
          <span>
            {e.action === 'alloc'
              ? `alloc(${e.size}, "${e.label}") → 0x${(0x7f000000 + i * 0x100).toString(16)}`
              : e.action === 'free'
                ? `free(${e.id})`
                : `DOUBLE_FREE(${e.id}) ← USE-AFTER-FREE`}
          </span>
        </div>
      ))}
      {vis.length === 0 && (
        <div
          style={{
            color: '#475569',
            fontStyle: 'italic',
            padding: 8,
          }}
        >
          Press ▶ to begin analysis...
        </div>
      )}
    </div>
  );
};

export default EventLog;
