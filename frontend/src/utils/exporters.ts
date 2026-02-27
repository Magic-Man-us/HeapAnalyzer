import {
  MemoryBlock,
  MemoryEvent,
  MemoryStats,
  HeapSnapshot,
  Verdict,
  SampleProgram,
} from '../types';
import { LANG_COLORS } from './constants';

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function exportJSON(
  selectedLang: string,
  selectedProgram: string,
  program: SampleProgram,
  events: MemoryEvent[],
  blocks: MemoryBlock[],
  stats: MemoryStats,
  verdict: Verdict | null,
  snapshots: HeapSnapshot[],
) {
  const data = {
    meta: {
      tool: 'Heap Analyzer v2.0',
      exported: new Date().toISOString(),
      language: selectedLang,
      scenario: selectedProgram,
    },
    source: program.code,
    events: events.map((e) => ({ ...e })),
    blocks: blocks.map((b) => ({
      id: b.id,
      label: b.label,
      size: b.size,
      status: b.status,
    })),
    stats: { ...stats, verdict: verdict?.text || 'INCOMPLETE' },
    snapshots: snapshots.map((s, i) => ({
      step: i,
      heapBytes: s.total,
      leakedBytes: s.leaked,
    })),
  };
  downloadFile(
    JSON.stringify(data, null, 2),
    `heap-analysis-${selectedLang.toLowerCase()}-${getTimestamp()}.json`,
    'application/json',
  );
}

export function exportMarkdown(
  selectedLang: string,
  selectedProgram: string,
  program: SampleProgram,
  events: MemoryEvent[],
  blocks: MemoryBlock[],
  stats: MemoryStats,
  verdict: Verdict | null,
) {
  const v = verdict?.text || 'Analysis incomplete — run to end';
  const leakedBlocks = blocks.filter((b) => b.status === 'leaked');
  const dfBlocks = blocks.filter((b) => b.status === 'double_free');
  let md = `# Heap Analysis Report\n\n`;
  md += `**Language:** ${selectedLang}  \n**Scenario:** ${selectedProgram}  \n**Generated:** ${new Date().toISOString()}  \n\n`;
  md += `## Verdict\n\n\`${v}\`\n\n`;
  md += `## Statistics\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Current Heap | ${stats.currentHeap}B |\n`;
  md += `| Peak Memory | ${stats.peakMem}B |\n`;
  md += `| Active Blocks | ${stats.activeCount} |\n`;
  md += `| Freed Blocks | ${stats.freedCount} |\n`;
  md += `| Leaked Blocks | ${stats.leakedCount} (${stats.leakedBytes}B) |\n`;
  md += `| Double Frees | ${stats.doubleFreeCount} |\n`;
  md += `| Total Ops | ${stats.totalOps}/${events.length} |\n\n`;
  if (leakedBlocks.length > 0) {
    md += `## Leaked Allocations\n\n`;
    leakedBlocks.forEach((b) => {
      md += `- **${b.label}** — ${b.size}B (never freed)\n`;
    });
    md += `\n`;
  }
  if (dfBlocks.length > 0) {
    md += `## Double Free Violations\n\n`;
    dfBlocks.forEach((b) => {
      md += `- **${b.label}** — ${b.size}B (freed multiple times)\n`;
    });
    md += `\n`;
  }
  md += `## Source Code\n\n\`\`\`${selectedLang.toLowerCase()}\n${program.code}\n\`\`\`\n\n`;
  md += `## Event Trace\n\n`;
  md += `| Time | Action | Details |\n|------|--------|---------|\n`;
  events
    .filter((e) => e.action !== 'end')
    .forEach((e) => {
      md += `| ${String(e.time).padStart(3, '0')} | ${e.action.toUpperCase()} | ${e.action === 'alloc' ? `${e.label} (${e.size}B)` : e.id} |\n`;
    });
  downloadFile(
    md,
    `heap-analysis-${selectedLang.toLowerCase()}-${getTimestamp()}.md`,
    'text/markdown',
  );
}

export function exportHTML(
  selectedLang: string,
  selectedProgram: string,
  program: SampleProgram,
  events: MemoryEvent[],
  blocks: MemoryBlock[],
  stats: MemoryStats,
  verdict: Verdict | null,
  snapshots: HeapSnapshot[],
) {
  const v = verdict?.text || 'Analysis incomplete';
  const vColor = verdict?.color || '#94a3b8';
  const leakedBlocks = blocks.filter((b) => b.status === 'leaked');
  const dfBlocks = blocks.filter((b) => b.status === 'double_free');
  const activeBlocks = blocks.filter((b) => b.status === 'active');
  const freedBlocks = blocks.filter((b) => b.status === 'freed');

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&quot;');

  const codeLines = program.code
    .split('\n')
    .map((line, i) => {
      const leak =
        /LEAK|never freed|never dropped|prevents GC|never returns|never shrinks/.test(
          line,
        );
      const df = /DOUBLE FREE|USE-AFTER-FREE|dangling/.test(line);
      const cls = leak ? 'line-leak' : df ? 'line-df' : '';
      return `<div class="code-line ${cls}"><span class="ln">${i + 1}</span>${escapeHtml(line)}</div>`;
    })
    .join('\n');

  const blockRows = (arr: MemoryBlock[], status: string) =>
    arr
      .map(
        (b) =>
          `<tr><td><span class="status-dot status-${status}"></span>${escapeHtml(b.label)}</td><td>${b.size}B</td><td class="status-${status}">${status.toUpperCase()}</td></tr>`,
      )
      .join('\n');

  const eventRows = events
    .filter((e) => e.action !== 'end')
    .map(
      (e) =>
        `<tr class="evt-${e.action}"><td>${String(e.time).padStart(3, '0')}</td><td>${e.action.toUpperCase()}</td><td>${e.action === 'alloc' ? `${escapeHtml(e.label || '')} (${e.size}B)` : escapeHtml(e.id || '')}</td></tr>`,
    )
    .join('\n');

  const snapData = JSON.stringify(snapshots.map((s) => s.total));
  const leakData = JSON.stringify(snapshots.map((s) => s.leaked));
  const langColor =
    LANG_COLORS[selectedLang as keyof typeof LANG_COLORS] || '#22d3ee';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Heap Analysis — ${escapeHtml(selectedProgram)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0e17; color: #e2e8f0; font-family: 'IBM Plex Mono', monospace; padding: 32px; max-width: 1200px; margin: 0 auto; }
  h1 { font-size: 18px; font-weight: 600; letter-spacing: 3px; color: #22d3ee; text-transform: uppercase; margin-bottom: 4px; }
  .meta { font-size: 11px; color: #475569; margin-bottom: 24px; }
  .meta span { margin-right: 16px; }
  .meta .lang { color: ${langColor}; font-weight: 600; }
  .verdict { display: inline-block; padding: 8px 20px; border-radius: 4px; border: 1px solid ${vColor}; background: ${vColor}18; color: ${vColor}; font-size: 13px; font-weight: 600; letter-spacing: 1px; margin-bottom: 28px; }
  .section-title { font-size: 10px; letter-spacing: 2px; color: #475569; text-transform: uppercase; margin: 24px 0 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(34,211,238,0.1); }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat-card { background: rgba(34,211,238,0.04); border: 1px solid rgba(34,211,238,0.1); border-radius: 6px; padding: 12px; }
  .stat-card .label { font-size: 8px; letter-spacing: 2px; color: #475569; text-transform: uppercase; }
  .stat-card .value { font-size: 20px; font-weight: 600; color: #22d3ee; margin-top: 2px; }
  .stat-card .value.peak { color: #818cf8; }
  .stat-card .value.freed { color: #4ade80; }
  .stat-card .value.leaked { color: #f87171; }
  .stat-card .value.warn { color: #fbbf24; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  @media (max-width: 800px) { .two-col { grid-template-columns: 1fr; } }
  .code-block { background: rgba(0,0,0,0.3); border: 1px solid rgba(34,211,238,0.08); border-radius: 6px; padding: 16px; overflow-x: auto; font-size: 12px; line-height: 1.7; }
  .code-line { white-space: pre; }
  .code-line .ln { display: inline-block; width: 28px; text-align: right; margin-right: 16px; color: #1e293b; user-select: none; font-size: 10px; }
  .line-leak { background: rgba(248,113,113,0.06); border-left: 2px solid rgba(248,113,113,0.5); color: #f87171; }
  .line-df { background: rgba(251,191,36,0.06); border-left: 2px solid rgba(251,191,36,0.5); color: #fbbf24; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; font-size: 9px; letter-spacing: 1px; color: #475569; text-transform: uppercase; padding: 6px 10px; border-bottom: 1px solid rgba(34,211,238,0.1); }
  td { padding: 5px 10px; border-bottom: 1px solid rgba(34,211,238,0.05); }
  .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 8px; vertical-align: middle; }
  .status-active, .status-dot.status-active { color: #22d3ee; background: #22d3ee; }
  .status-freed, .status-dot.status-freed { color: #4ade80; background: #4ade80; }
  .status-leaked, .status-dot.status-leaked { color: #f87171; background: #f87171; }
  .status-double_free, .status-dot.status-double_free { color: #fbbf24; background: #fbbf24; }
  .evt-alloc td { color: #22d3ee; }
  .evt-free td { color: #4ade80; }
  .evt-double_free td { color: #fbbf24; }
  .table-wrap { background: rgba(0,0,0,0.2); border: 1px solid rgba(34,211,238,0.08); border-radius: 6px; padding: 12px; overflow-x: auto; }
  canvas { width: 100%; height: 180px; display: block; margin-bottom: 8px; }
  .chart-wrap { background: rgba(0,0,0,0.2); border: 1px solid rgba(34,211,238,0.08); border-radius: 6px; padding: 12px 12px 4px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(34,211,238,0.08); font-size: 9px; color: #334155; text-align: center; }
</style>
</head>
<body>
  <h1>⬡ Heap Analysis Report</h1>
  <div class="meta">
    <span class="lang">${escapeHtml(selectedLang)}</span>
    <span>${escapeHtml(selectedProgram)}</span>
    <span>${new Date().toLocaleString()}</span>
  </div>
  <div class="verdict">${verdict?.icon || '○'} ${escapeHtml(v)}</div>
  <div class="section-title">Statistics</div>
  <div class="stats-grid">
    <div class="stat-card"><div class="label">Current Heap</div><div class="value">${stats.currentHeap}B</div></div>
    <div class="stat-card"><div class="label">Peak Memory</div><div class="value peak">${stats.peakMem}B</div></div>
    <div class="stat-card"><div class="label">Active</div><div class="value">${stats.activeCount}</div></div>
    <div class="stat-card"><div class="label">Freed</div><div class="value freed">${stats.freedCount}</div></div>
    <div class="stat-card"><div class="label">Leaked</div><div class="value leaked">${stats.leakedCount} (${stats.leakedBytes}B)</div></div>
    <div class="stat-card"><div class="label">Double Frees</div><div class="value warn">${stats.doubleFreeCount}</div></div>
  </div>
  <div class="section-title">Heap Over Time</div>
  <div class="chart-wrap"><canvas id="heapChart"></canvas></div>
  <div class="two-col">
    <div>
      <div class="section-title">Source Code</div>
      <div class="code-block">${codeLines}</div>
    </div>
    <div>
      <div class="section-title">Memory Blocks (${blocks.length})</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Block</th><th>Size</th><th>Status</th></tr></thead>
          <tbody>
            ${blockRows(leakedBlocks, 'leaked')}
            ${blockRows(dfBlocks, 'double_free')}
            ${blockRows(activeBlocks, 'active')}
            ${blockRows(freedBlocks, 'freed')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <div class="section-title">Event Trace (${events.filter((e) => e.action !== 'end').length} ops)</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Time</th><th>Action</th><th>Details</th></tr></thead>
      <tbody>${eventRows}</tbody>
    </table>
  </div>
  <div class="footer">Generated by Heap Analyzer v2.0</div>
  <script>
    const data = ${snapData};
    const leakD = ${leakData};
    const canvas = document.getElementById("heapChart");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    function draw() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      const w = rect.width, h = rect.height;
      const pad = { top: 16, right: 12, bottom: 24, left: 48 };
      const pw = w - pad.left - pad.right, ph = h - pad.top - pad.bottom;
      const mx = Math.max(...data, 128);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(148,163,184,0.08)"; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) { const y = pad.top + (ph/4)*i; ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(w-pad.right,y); ctx.stroke(); }
      ctx.fillStyle = "rgba(148,163,184,0.35)"; ctx.font = "9px 'IBM Plex Mono',monospace"; ctx.textAlign = "right";
      for (let i = 0; i <= 4; i++) ctx.fillText(Math.round((mx/4)*(4-i))+"B", pad.left-6, pad.top+(ph/4)*i+3);
      if (data.length > 1) {
        const sx = pw / (data.length - 1);
        ctx.beginPath(); ctx.moveTo(pad.left, pad.top+ph);
        data.forEach((v,i) => ctx.lineTo(pad.left+i*sx, pad.top+ph-(v/mx)*ph));
        ctx.lineTo(pad.left+(data.length-1)*sx, pad.top+ph); ctx.closePath();
        const g = ctx.createLinearGradient(0,pad.top,0,pad.top+ph);
        g.addColorStop(0,"rgba(34,211,238,0.2)"); g.addColorStop(1,"rgba(34,211,238,0.01)");
        ctx.fillStyle = g; ctx.fill();
        ctx.beginPath(); data.forEach((v,i) => { const x=pad.left+i*sx, y=pad.top+ph-(v/mx)*ph; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
        ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pad.left, pad.top+ph);
        leakD.forEach((v,i) => ctx.lineTo(pad.left+i*sx, pad.top+ph-(v/mx)*ph));
        ctx.lineTo(pad.left+(leakD.length-1)*sx, pad.top+ph); ctx.closePath();
        const lg = ctx.createLinearGradient(0,pad.top,0,pad.top+ph);
        lg.addColorStop(0,"rgba(248,113,113,0.3)"); lg.addColorStop(1,"rgba(248,113,113,0.02)");
        ctx.fillStyle = lg; ctx.fill();
      }
      ctx.fillStyle="rgba(148,163,184,0.25)"; ctx.font="8px 'IBM Plex Mono',monospace"; ctx.textAlign="center";
      ctx.fillText("TIME →", w/2, h-3);
    }
    draw(); window.addEventListener("resize", () => { ctx.setTransform(1,0,0,1,0,0); draw(); });
  </script>
</body>
</html>`;
  downloadFile(
    html,
    `heap-analysis-${selectedLang.toLowerCase()}-${getTimestamp()}.html`,
    'text/html',
  );
}
