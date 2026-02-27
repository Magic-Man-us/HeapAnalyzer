import React from 'react';

interface Props {
  code: string;
  langColor: string;
  langName: string;
}

const isAllocKw = (line: string) =>
  /alloc|new |make\(|createElement|Box::new|Vec::|with_capacity|HashMap::new|open\(|bytearray|Node\(|Metric\{|getStream|Subject|connection\(\)/.test(
    line,
  );
const isFreeKw = (line: string) =>
  /free|drop|close|\.clear\(\)|unsubscribe|__exit__|removeChild|\.next\(\)|\.complete\(\)/.test(
    line,
  );
const isLeakComment = (line: string) =>
  /LEAK|never freed|never dropped|prevents GC|never returns|never shrinks/.test(line);
const isDFComment = (line: string) =>
  /DOUBLE FREE|USE-AFTER-FREE|dangling/.test(line);

const SourceViewer: React.FC<Props> = ({ code, langColor, langName }) => {
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
            {langName} Source
          </span>
        </div>
      </div>
      <pre
        style={{
          flex: 1,
          margin: 0,
          padding: 20,
          fontSize: 12.5,
          lineHeight: 1.75,
          color: '#94a3b8',
          overflow: 'auto',
          background: 'rgba(0,0,0,0.25)',
          tabSize: 4,
        }}
      >
        {code.split('\n').map((line, i) => {
          const leak = isLeakComment(line);
          const df = isDFComment(line);
          const alloc = !leak && !df && isAllocKw(line);
          const free = !leak && !df && isFreeKw(line);
          const comment =
            line.trimStart().startsWith('//') || line.trimStart().startsWith('#');
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                margin: '0 -20px',
                padding: '0 20px',
                background: leak
                  ? 'rgba(248,113,113,0.06)'
                  : df
                    ? 'rgba(251,191,36,0.06)'
                    : 'transparent',
                borderLeft: leak
                  ? '2px solid rgba(248,113,113,0.5)'
                  : df
                    ? '2px solid rgba(251,191,36,0.5)'
                    : '2px solid transparent',
              }}
            >
              <span
                style={{
                  width: 32,
                  textAlign: 'right',
                  marginRight: 20,
                  color: '#1e293b',
                  userSelect: 'none',
                  fontSize: 10,
                  lineHeight: 'inherit',
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  color: leak
                    ? '#f87171'
                    : df
                      ? '#fbbf24'
                      : comment
                        ? '#475569'
                        : alloc
                          ? langColor
                          : free
                            ? '#4ade80'
                            : '#94a3b8',
                }}
              >
                {line}
              </span>
            </div>
          );
        })}
      </pre>
    </div>
  );
};

export default SourceViewer;
