import React from 'react';
import { MemoryBlock as MemoryBlockType } from '../types';
import { STATUS_COLORS } from '../utils/constants';

interface Props {
  block: MemoryBlockType;
  maxSize: number;
  isNew: boolean;
}

const MemoryBlock: React.FC<Props> = ({ block, maxSize, isNew }) => {
  const color = STATUS_COLORS[block.status];
  const bg = `${color}15`;
  const widthPct = Math.max((block.size / maxSize) * 100, 12);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 0',
        animation: isNew ? 'slideIn 0.35s cubic-bezier(0.16,1,0.3,1)' : undefined,
        opacity: block.status === 'freed' ? 0.3 : 1,
        transition: 'opacity 0.4s ease',
      }}
    >
      <div
        style={{
          width: 160,
          fontSize: 11,
          fontFamily: "'IBM Plex Mono',monospace",
          color,
          textAlign: 'right',
          flexShrink: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={block.label}
      >
        {block.label}
      </div>
      <div style={{ flex: 1, position: 'relative', height: 26 }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${widthPct}%`,
            background: bg,
            border: `1px solid ${color}`,
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
            boxSizing: 'border-box',
            transition: 'width 0.3s ease',
            ...(block.status === 'leaked'
              ? {
                  boxShadow:
                    '0 0 12px rgba(248,113,113,0.3),inset 0 0 20px rgba(248,113,113,0.05)',
                  borderStyle: 'dashed',
                }
              : block.status === 'double_free'
                ? {
                    boxShadow: '0 0 12px rgba(251,191,36,0.3)',
                    animation: 'pulse 1s infinite',
                  }
                : {}),
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontFamily: "'IBM Plex Mono',monospace",
              color,
              opacity: 0.8,
            }}
          >
            {block.size}B
          </span>
          <span
            style={{
              fontSize: 9,
              fontFamily: "'IBM Plex Mono',monospace",
              color,
              opacity: 0.6,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {block.status === 'double_free' ? 'DOUBLE FREE!' : block.status}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MemoryBlock;
