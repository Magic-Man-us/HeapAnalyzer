import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Language, Verdict } from './types';
import { SAMPLE_PROGRAMS } from './data/samplePrograms';
import { LANG_COLORS, STATUS_COLORS } from './utils/constants';
import { useMemoryAnalysis, useAllSnapshots } from './hooks/useMemoryAnalysis';
import { exportJSON, exportMarkdown, exportHTML } from './utils/exporters';
import MemoryBlockComponent from './components/MemoryBlock';
import HeapChart from './components/HeapChart';
import EventLog from './components/EventLog';
import SourceViewer from './components/SourceViewer';

const App: React.FC = () => {
  const [selectedLang, setSelectedLang] = useState<Language>('Rust');
  const [selectedProgram, setSelectedProgram] = useState(
    Object.keys(SAMPLE_PROGRAMS['Rust'])[0],
  );
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  const [newBlockIds, setNewBlockIds] = useState<Set<string>>(new Set());
  const [showExport, setShowExport] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const program = SAMPLE_PROGRAMS[selectedLang][selectedProgram];
  const events = program.events;
  const totalSteps = events.length;

  const { blocks, snapshots, stats } = useMemoryAnalysis(events, currentStep);
  const allSnapshots = useAllSnapshots(events);

  const maxBlockSize = useMemo(
    () =>
      Math.max(
        ...events.filter((e) => e.action === 'alloc').map((e) => e.size ?? 1),
        1,
      ),
    [events],
  );

  const animateNewBlock = useCallback((id: string) => {
    setNewBlockIds((s) => new Set([...s, id]));
    const tid = setTimeout(() => {
      setNewBlockIds((s) => {
        const ns = new Set(s);
        ns.delete(id);
        return ns;
      });
    }, 400);
    timeoutRefs.current.push(tid);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          const next = prev + 1;
          if (next >= totalSteps) {
            setIsPlaying(false);
            return totalSteps - 1;
          }
          const ev = events[next];
          if (ev?.action === 'alloc' && ev.id) {
            animateNewBlock(ev.id);
          }
          return next;
        });
      }, speed);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current = [];
    };
  }, [isPlaying, speed, totalSteps, events, animateNewBlock]);

  const reset = () => {
    setIsPlaying(false);
    setCurrentStep(-1);
    setNewBlockIds(new Set());
  };

  const changeLang = (lang: Language) => {
    setSelectedLang(lang);
    setSelectedProgram(Object.keys(SAMPLE_PROGRAMS[lang])[0]);
    reset();
  };

  const changeProg = (name: string) => {
    setSelectedProgram(name);
    reset();
  };

  const step = () => {
    setIsPlaying(false);
    setCurrentStep((prev) => {
      const next = prev + 1;
      if (next >= totalSteps) return prev;
      const ev = events[next];
      if (ev?.action === 'alloc' && ev.id) {
        animateNewBlock(ev.id);
      }
      return next;
    });
  };

  const verdict: Verdict | null =
    currentStep >= totalSteps - 1
      ? stats.doubleFreeCount > 0
        ? { text: 'DOUBLE FREE DETECTED', color: '#fbbf24', icon: '⚠' }
        : stats.leakedCount > 0
          ? {
              text: `LEAK: ${stats.leakedBytes}B IN ${stats.leakedCount} BLOCK(S)`,
              color: '#f87171',
              icon: '✗',
            }
          : { text: 'ALL CLEAR — NO LEAKS', color: '#4ade80', icon: '✓' }
      : null;

  const lc = LANG_COLORS[selectedLang] || '#22d3ee';

  const handleExportJSON = () => {
    exportJSON(
      selectedLang, selectedProgram, program, events, blocks, stats, verdict, snapshots,
    );
    setShowExport(false);
  };

  const handleExportMarkdown = () => {
    exportMarkdown(selectedLang, selectedProgram, program, events, blocks, stats, verdict);
    setShowExport(false);
  };

  const handleExportHTML = () => {
    exportHTML(
      selectedLang, selectedProgram, program, events, blocks, stats, verdict, snapshots,
    );
    setShowExport(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0e17',
        color: '#e2e8f0',
        fontFamily: "'IBM Plex Mono','Fira Code',monospace",
      }}
    >
      {/* Scanline overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 100,
          background:
            'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)',
        }}
      />

      {/* Header */}
      <div
        style={{
          borderBottom: '1px solid rgba(34,211,238,0.15)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(34,211,238,0.02)',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: isPlaying ? '#22d3ee' : '#475569',
              boxShadow: isPlaying
                ? '0 0 12px rgba(34,211,238,0.6)'
                : 'none',
              transition: 'all 0.3s',
            }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 3,
              color: '#22d3ee',
              textTransform: 'uppercase',
            }}
          >
            HEAP ANALYZER
          </span>
          <span style={{ fontSize: 9, color: '#475569', letterSpacing: 1 }}>
            v2.0
          </span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {(Object.keys(SAMPLE_PROGRAMS) as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => changeLang(lang)}
              style={{
                padding: '5px 14px',
                fontSize: 10,
                fontFamily: "'IBM Plex Mono',monospace",
                letterSpacing: 0.5,
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background:
                  selectedLang === lang
                    ? `${LANG_COLORS[lang]}20`
                    : 'transparent',
                border: `1px solid ${selectedLang === lang ? `${LANG_COLORS[lang]}66` : 'rgba(148,163,184,0.1)'}`,
                color:
                  selectedLang === lang ? LANG_COLORS[lang] : '#4a5568',
                fontWeight: selectedLang === lang ? 600 : 400,
              }}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Scenario tabs */}
      <div
        style={{
          padding: '6px 20px',
          borderBottom: '1px solid rgba(34,211,238,0.08)',
          display: 'flex',
          gap: 4,
          background: 'rgba(0,0,0,0.15)',
          overflowX: 'auto',
        }}
      >
        {Object.keys(SAMPLE_PROGRAMS[selectedLang]).map((name) => {
          const short = name.replace(/^(Rust|JS|TS|Go|Python) — /, '');
          return (
            <button
              key={name}
              onClick={() => changeProg(name)}
              style={{
                padding: '4px 12px',
                fontSize: 10,
                fontFamily: "'IBM Plex Mono',monospace",
                background:
                  selectedProgram === name ? `${lc}15` : 'transparent',
                border: `1px solid ${selectedProgram === name ? `${lc}40` : 'rgba(148,163,184,0.08)'}`,
                color: selectedProgram === name ? lc : '#64748b',
                borderRadius: 3,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {short}
            </button>
          );
        })}
        <span
          style={{
            fontSize: 10,
            color: '#334155',
            padding: '4px 8px',
            fontStyle: 'italic',
            flexShrink: 0,
          }}
        >
          {program.description}
        </span>
      </div>

      {/* Main layout */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 93px)',
        }}
      >
        {/* TOP ROW: Source (50%) | Stats + Blocks (50%) */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* LEFT: Source */}
          <SourceViewer
            code={program.code}
            langColor={lc}
            langName={program.lang}
          />

          {/* RIGHT: Stats + Blocks */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Stats bar */}
            <div
              style={{
                padding: '8px 16px',
                borderBottom: '1px solid rgba(34,211,238,0.08)',
                display: 'flex',
                gap: 20,
                alignItems: 'center',
                background: 'rgba(0,0,0,0.15)',
                flexWrap: 'wrap',
              }}
            >
              {[
                { l: 'HEAP', v: `${stats.currentHeap}B`, c: '#22d3ee' },
                { l: 'PEAK', v: `${stats.peakMem}B`, c: '#818cf8' },
                { l: 'ACTIVE', v: stats.activeCount, c: '#22d3ee' },
                { l: 'FREED', v: stats.freedCount, c: '#4ade80' },
                {
                  l: 'LEAKED',
                  v: stats.leakedCount,
                  c: stats.leakedCount > 0 ? '#f87171' : '#475569',
                },
                {
                  l: 'OPS',
                  v: `${stats.totalOps}/${events.length}`,
                  c: '#475569',
                },
              ].map((s) => (
                <div
                  key={s.l}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: 8,
                      letterSpacing: 2,
                      color: '#475569',
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.l}
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: s.c,
                      fontFamily: "'IBM Plex Mono',monospace",
                    }}
                  >
                    {s.v}
                  </span>
                </div>
              ))}
              {verdict && (
                <div
                  style={{
                    marginLeft: 'auto',
                    padding: '4px 12px',
                    borderRadius: 4,
                    border: `1px solid ${verdict.color}`,
                    background: `${verdict.color}11`,
                    color: verdict.color,
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: 1,
                    animation: 'fadeIn 0.4s ease',
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 13 }}>{verdict.icon}</span>
                  {verdict.text}
                </div>
              )}
            </div>

            {/* Blocks */}
            <div style={{ flex: 1, overflow: 'auto', padding: '10px 16px' }}>
              <div
                style={{
                  fontSize: 8,
                  letterSpacing: 2,
                  color: '#334155',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Heap Blocks</span>
                <div style={{ display: 'flex', gap: 12 }}>
                  {(
                    [
                      { l: 'Active', c: STATUS_COLORS.active },
                      { l: 'Freed', c: STATUS_COLORS.freed },
                      { l: 'Leaked', c: STATUS_COLORS.leaked },
                      { l: 'Double Free', c: STATUS_COLORS.double_free },
                    ] as const
                  ).map((x) => (
                    <span
                      key={x.l}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 2,
                          background: x.c,
                          opacity: 0.7,
                        }}
                      />
                      {x.l}
                    </span>
                  ))}
                </div>
              </div>
              {blocks.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 100,
                    color: '#1e293b',
                    fontSize: 11,
                    border: '1px dashed rgba(34,211,238,0.1)',
                    borderRadius: 6,
                  }}
                >
                  ← Press ▶ to begin memory analysis
                </div>
              ) : (
                [...blocks]
                  .sort(
                    (a, b) =>
                      (
                        {
                          leaked: 0,
                          double_free: 1,
                          active: 2,
                          freed: 3,
                        } as Record<string, number>
                      )[a.status] -
                      (
                        {
                          leaked: 0,
                          double_free: 1,
                          active: 2,
                          freed: 3,
                        } as Record<string, number>
                      )[b.status],
                  )
                  .map((b) => (
                    <MemoryBlockComponent
                      key={b.id}
                      block={b}
                      maxSize={maxBlockSize}
                      isNew={newBlockIds.has(b.id)}
                    />
                  ))
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM: Full-width Chart + Log */}
        <div
          style={{
            borderTop: '1px solid rgba(34,211,238,0.12)',
            display: 'flex',
            height: 190,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              borderRight: '1px solid rgba(34,211,238,0.08)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '5px 10px',
                borderBottom: '1px solid rgba(34,211,238,0.06)',
                fontSize: 8,
                letterSpacing: 2,
                color: '#334155',
                textTransform: 'uppercase',
              }}
            >
              Heap Over Time
            </div>
            <div style={{ flex: 1 }}>
              <HeapChart snapshots={snapshots} allSnapshots={allSnapshots} />
            </div>
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '5px 10px',
                borderBottom: '1px solid rgba(34,211,238,0.06)',
                fontSize: 8,
                letterSpacing: 2,
                color: '#334155',
                textTransform: 'uppercase',
              }}
            >
              Event Log
            </div>
            <EventLog events={events} currentStep={currentStep} />
          </div>
        </div>

        {/* Controls */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid rgba(34,211,238,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(0,0,0,0.2)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => {
              if (currentStep >= totalSteps - 1) {
                reset();
                setTimeout(() => setIsPlaying(true), 50);
              } else {
                setIsPlaying(!isPlaying);
              }
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: '1px solid rgba(34,211,238,0.4)',
              background: isPlaying
                ? 'rgba(34,211,238,0.15)'
                : 'transparent',
              color: '#22d3ee',
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={reset}
            style={{
              padding: '5px 12px',
              border: '1px solid rgba(148,163,184,0.15)',
              background: 'transparent',
              color: '#64748b',
              fontSize: 10,
              fontFamily: "'IBM Plex Mono',monospace",
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
          <button
            onClick={step}
            disabled={currentStep >= totalSteps - 1}
            style={{
              padding: '5px 12px',
              border: '1px solid rgba(148,163,184,0.15)',
              background: 'transparent',
              color:
                currentStep >= totalSteps - 1 ? '#1e293b' : '#64748b',
              fontSize: 10,
              fontFamily: "'IBM Plex Mono',monospace",
              borderRadius: 3,
              cursor:
                currentStep >= totalSteps - 1 ? 'default' : 'pointer',
            }}
          >
            Step →
          </button>
          <div style={{ flex: 1 }}>
            <input
              type="range"
              min={-1}
              max={totalSteps - 1}
              value={currentStep}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentStep(parseInt(e.target.value));
              }}
              style={{
                width: '100%',
                height: 3,
                background: `linear-gradient(to right, ${lc} ${((currentStep + 1) / totalSteps) * 100}%, #1e293b ${((currentStep + 1) / totalSteps) * 100}%)`,
                borderRadius: 2,
                outline: 'none',
                cursor: 'pointer',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <span
              style={{ fontSize: 8, color: '#334155', letterSpacing: 1 }}
            >
              SPD
            </span>
            {[
              { l: '1×', v: 800 },
              { l: '2×', v: 400 },
              { l: '4×', v: 200 },
            ].map((s) => (
              <button
                key={s.l}
                onClick={() => setSpeed(s.v)}
                style={{
                  padding: '3px 7px',
                  fontSize: 10,
                  fontFamily: "'IBM Plex Mono',monospace",
                  background:
                    speed === s.v ? `${lc}20` : 'transparent',
                  border: `1px solid ${speed === s.v ? `${lc}50` : 'rgba(148,163,184,0.1)'}`,
                  color: speed === s.v ? lc : '#475569',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                {s.l}
              </button>
            ))}
          </div>

          {/* Export dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowExport(!showExport)}
              style={{
                padding: '5px 12px',
                fontSize: 10,
                fontFamily: "'IBM Plex Mono',monospace",
                background: showExport
                  ? 'rgba(74,222,128,0.15)'
                  : 'transparent',
                border: `1px solid ${showExport ? 'rgba(74,222,128,0.4)' : 'rgba(148,163,184,0.15)'}`,
                color: showExport ? '#4ade80' : '#64748b',
                borderRadius: 3,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                letterSpacing: 0.5,
              }}
            >
              ⬡ Export {showExport ? '▴' : '▾'}
            </button>
            {showExport && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 6px)',
                  right: 0,
                  zIndex: 200,
                  background: '#111827',
                  border: '1px solid rgba(34,211,238,0.15)',
                  borderRadius: 6,
                  padding: 4,
                  minWidth: 180,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                {[
                  {
                    label: 'HTML Report',
                    desc: 'Standalone page with chart',
                    icon: '◉',
                    fn: handleExportHTML,
                    color: '#22d3ee',
                  },
                  {
                    label: 'Markdown',
                    desc: 'Text report with tables',
                    icon: '◇',
                    fn: handleExportMarkdown,
                    color: '#a78bfa',
                  },
                  {
                    label: 'JSON Data',
                    desc: 'Raw events & blocks',
                    icon: '{ }',
                    fn: handleExportJSON,
                    color: '#4ade80',
                  },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={opt.fn}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: '#e2e8f0',
                      cursor: 'pointer',
                      borderRadius: 4,
                      textAlign: 'left',
                      fontFamily: "'IBM Plex Mono',monospace",
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        'rgba(34,211,238,0.08)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <span
                      style={{
                        color: opt.color,
                        fontSize: 12,
                        width: 20,
                        textAlign: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {opt.icon}
                    </span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 500 }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 9, color: '#475569' }}>
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
