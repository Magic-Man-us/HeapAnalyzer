import { useMemo } from 'react';
import { MemoryEvent, MemoryBlock, HeapSnapshot, AnalysisResult } from '../types';

export function useMemoryAnalysis(
  events: MemoryEvent[],
  currentStep: number,
): AnalysisResult {
  return useMemo(() => {
    const bm = new Map<string, MemoryBlock>();
    const snaps: HeapSnapshot[] = [];
    let peak = 0;

    for (let i = 0; i <= Math.min(currentStep, events.length - 1); i++) {
      const e = events[i];
      if (e.action === 'alloc' && e.id && e.label && e.size != null) {
        bm.set(e.id, { id: e.id, label: e.label, size: e.size, status: 'active' });
      } else if (e.action === 'free' && e.id && bm.has(e.id)) {
        bm.get(e.id)!.status = 'freed';
      } else if (e.action === 'double_free' && e.id && bm.has(e.id)) {
        bm.get(e.id)!.status = 'double_free';
      } else if (e.action === 'end') {
        bm.forEach((b) => {
          if (b.status === 'active') b.status = 'leaked';
        });
      }

      const act = [...bm.values()].filter(
        (b) => b.status === 'active' || b.status === 'leaked',
      );
      const tot = act.reduce((s, b) => s + b.size, 0);
      const lk = [...bm.values()]
        .filter((b) => b.status === 'leaked')
        .reduce((s, b) => s + b.size, 0);
      peak = Math.max(peak, tot);
      snaps.push({ total: tot, leaked: lk });
    }

    const all = [...bm.values()];
    const a = all.filter((b) => b.status === 'active');
    const l = all.filter((b) => b.status === 'leaked');
    const f = all.filter((b) => b.status === 'freed');
    const d = all.filter((b) => b.status === 'double_free');

    return {
      blocks: all,
      snapshots: snaps,
      stats: {
        currentHeap:
          a.reduce((s, b) => s + b.size, 0) + l.reduce((s, b) => s + b.size, 0),
        peakMem: peak,
        leakedBytes: l.reduce((s, b) => s + b.size, 0),
        leakedCount: l.length,
        freedCount: f.length,
        activeCount: a.length,
        doubleFreeCount: d.length,
        totalOps: Math.min(currentStep + 1, events.length),
      },
    };
  }, [currentStep, events]);
}

export function useAllSnapshots(events: MemoryEvent[]): HeapSnapshot[] {
  const analysis = useMemoryAnalysis(events, events.length - 1);
  return analysis.snapshots;
}
