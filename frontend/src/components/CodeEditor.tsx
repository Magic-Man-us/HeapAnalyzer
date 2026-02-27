import React, { useRef, useCallback, useLayoutEffect, useState } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  langColor: string;
}

const CodeEditor: React.FC<Props> = ({ value, onChange, onRun, langColor }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineCountRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  useLayoutEffect(() => {
    setLineCount(Math.max(value.split('\n').length, 1));
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Tab inserts 2 spaces
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newVal = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newVal);
        // Restore cursor position after React re-render
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
      // Ctrl/Cmd + Enter to run
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onRun();
      }
    },
    [value, onChange, onRun],
  );

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineCountRef.current) {
      lineCountRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        background: 'rgba(0,0,0,0.25)',
        position: 'relative',
      }}
    >
      {/* Line numbers */}
      <div
        ref={lineCountRef}
        style={{
          width: 40,
          flexShrink: 0,
          padding: '12px 0',
          overflow: 'hidden',
          userSelect: 'none',
          textAlign: 'right',
          fontSize: 10,
          lineHeight: '21px',
          color: '#334155',
          fontFamily: "'IBM Plex Mono','Fira Code',monospace",
          borderRight: `1px solid ${langColor}15`,
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} style={{ paddingRight: 8 }}>
            {i + 1}
          </div>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        style={{
          flex: 1,
          background: 'transparent',
          color: '#94a3b8',
          border: 'none',
          outline: 'none',
          resize: 'none',
          padding: '12px 16px',
          fontSize: 12.5,
          lineHeight: '21px',
          fontFamily: "'IBM Plex Mono','Fira Code',monospace",
          tabSize: 2,
          caretColor: langColor,
          overflow: 'auto',
        }}
      />
    </div>
  );
};

export default CodeEditor;
