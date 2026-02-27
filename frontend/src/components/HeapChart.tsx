import React, { useRef, useEffect } from 'react';
import { HeapSnapshot } from '../types';

interface Props {
  snapshots: HeapSnapshot[];
  allSnapshots: HeapSnapshot[];
}

const HeapChart: React.FC<Props> = ({ snapshots, allSnapshots }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || snapshots.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 16, right: 12, bottom: 24, left: 44 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    const maxHeap = Math.max(...allSnapshots.map((s) => s.total), 128);

    // Grid lines
    ctx.strokeStyle = 'rgba(148,163,184,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = 'rgba(148,163,184,0.35)';
    ctx.font = "9px 'IBM Plex Mono',monospace";
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      ctx.fillText(
        `${Math.round((maxHeap / 4) * (4 - i))}B`,
        pad.left - 6,
        pad.top + (plotH / 4) * i + 3,
      );
    }

    if (snapshots.length > 1) {
      const stepX = plotW / Math.max(allSnapshots.length - 1, 1);

      // Total heap fill
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top + plotH);
      snapshots.forEach((s, i) =>
        ctx.lineTo(pad.left + i * stepX, pad.top + plotH - (s.total / maxHeap) * plotH),
      );
      ctx.lineTo(pad.left + (snapshots.length - 1) * stepX, pad.top + plotH);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      g.addColorStop(0, 'rgba(34,211,238,0.2)');
      g.addColorStop(1, 'rgba(34,211,238,0.01)');
      ctx.fillStyle = g;
      ctx.fill();

      // Total heap line
      ctx.beginPath();
      snapshots.forEach((s, i) => {
        const x = pad.left + i * stepX;
        const y = pad.top + plotH - (s.total / maxHeap) * plotH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Leaked fill
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top + plotH);
      snapshots.forEach((s, i) =>
        ctx.lineTo(pad.left + i * stepX, pad.top + plotH - (s.leaked / maxHeap) * plotH),
      );
      ctx.lineTo(pad.left + (snapshots.length - 1) * stepX, pad.top + plotH);
      ctx.closePath();
      const lg = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      lg.addColorStop(0, 'rgba(248,113,113,0.3)');
      lg.addColorStop(1, 'rgba(248,113,113,0.02)');
      ctx.fillStyle = lg;
      ctx.fill();

      // Current position dot
      const last = snapshots[snapshots.length - 1];
      const cx = pad.left + (snapshots.length - 1) * stepX;
      const cy = pad.top + plotH - (last.total / maxHeap) * plotH;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(34,211,238,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // X-axis label
    ctx.fillStyle = 'rgba(148,163,184,0.25)';
    ctx.font = "8px 'IBM Plex Mono',monospace";
    ctx.textAlign = 'center';
    ctx.fillText('TIME →', w / 2, h - 3);
  }, [snapshots, allSnapshots]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};

export default HeapChart;
