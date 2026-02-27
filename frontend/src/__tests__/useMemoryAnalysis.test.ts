import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMemoryAnalysis, useAllSnapshots } from '../hooks/useMemoryAnalysis';
import type { MemoryEvent } from '../types';

describe('useMemoryAnalysis', () => {
  const basicEvents: MemoryEvent[] = [
    { time: 1, action: 'alloc', id: 'a', size: 100, label: 'bufA' },
    { time: 2, action: 'alloc', id: 'b', size: 200, label: 'bufB' },
    { time: 3, action: 'free', id: 'a' },
    { time: 4, action: 'end' },
  ];

  it('returns empty state at step -1', () => {
    const { result } = renderHook(() => useMemoryAnalysis(basicEvents, -1));
    expect(result.current.blocks).toHaveLength(0);
    expect(result.current.stats.currentHeap).toBe(0);
    expect(result.current.stats.totalOps).toBe(0);
  });

  it('tracks alloc at step 0', () => {
    const { result } = renderHook(() => useMemoryAnalysis(basicEvents, 0));
    expect(result.current.blocks).toHaveLength(1);
    expect(result.current.blocks[0].status).toBe('active');
    expect(result.current.blocks[0].label).toBe('bufA');
    expect(result.current.stats.currentHeap).toBe(100);
    expect(result.current.stats.activeCount).toBe(1);
  });

  it('tracks two allocs at step 1', () => {
    const { result } = renderHook(() => useMemoryAnalysis(basicEvents, 1));
    expect(result.current.blocks).toHaveLength(2);
    expect(result.current.stats.currentHeap).toBe(300);
    expect(result.current.stats.peakMem).toBe(300);
  });

  it('tracks free at step 2', () => {
    const { result } = renderHook(() => useMemoryAnalysis(basicEvents, 2));
    const blockA = result.current.blocks.find((b) => b.id === 'a');
    expect(blockA?.status).toBe('freed');
    expect(result.current.stats.freedCount).toBe(1);
    expect(result.current.stats.currentHeap).toBe(200);
  });

  it('marks leaked blocks at end event', () => {
    const { result } = renderHook(() => useMemoryAnalysis(basicEvents, 3));
    const blockB = result.current.blocks.find((b) => b.id === 'b');
    expect(blockB?.status).toBe('leaked');
    expect(result.current.stats.leakedCount).toBe(1);
    expect(result.current.stats.leakedBytes).toBe(200);
  });

  it('detects double free', () => {
    const events: MemoryEvent[] = [
      { time: 1, action: 'alloc', id: 'x', size: 50, label: 'x' },
      { time: 2, action: 'free', id: 'x' },
      { time: 3, action: 'double_free', id: 'x' },
    ];
    const { result } = renderHook(() => useMemoryAnalysis(events, 2));
    const block = result.current.blocks.find((b) => b.id === 'x');
    expect(block?.status).toBe('double_free');
    expect(result.current.stats.doubleFreeCount).toBe(1);
  });

  it('computes peak memory correctly', () => {
    const events: MemoryEvent[] = [
      { time: 1, action: 'alloc', id: 'a', size: 100, label: 'a' },
      { time: 2, action: 'alloc', id: 'b', size: 500, label: 'b' },
      { time: 3, action: 'free', id: 'b' },
      { time: 4, action: 'alloc', id: 'c', size: 50, label: 'c' },
    ];
    const { result } = renderHook(() => useMemoryAnalysis(events, 3));
    expect(result.current.stats.peakMem).toBe(600); // 100 + 500
    expect(result.current.stats.currentHeap).toBe(150); // 100 + 50
  });

  it('handles empty events array', () => {
    const { result } = renderHook(() => useMemoryAnalysis([], -1));
    expect(result.current.blocks).toHaveLength(0);
    expect(result.current.stats.totalOps).toBe(0);
  });
});

describe('useAllSnapshots', () => {
  it('returns a snapshot for each event', () => {
    const events: MemoryEvent[] = [
      { time: 1, action: 'alloc', id: 'a', size: 100, label: 'a' },
      { time: 2, action: 'alloc', id: 'b', size: 200, label: 'b' },
      { time: 3, action: 'free', id: 'a' },
      { time: 4, action: 'end' },
    ];
    const { result } = renderHook(() => useAllSnapshots(events));
    expect(result.current).toHaveLength(4);
  });

  it('tracks total heap increasing and decreasing', () => {
    const events: MemoryEvent[] = [
      { time: 1, action: 'alloc', id: 'a', size: 100, label: 'a' },
      { time: 2, action: 'alloc', id: 'b', size: 200, label: 'b' },
      { time: 3, action: 'free', id: 'a' },
    ];
    const { result } = renderHook(() => useAllSnapshots(events));
    expect(result.current[0].total).toBe(100);
    expect(result.current[1].total).toBe(300);
    expect(result.current[2].total).toBe(200);
  });

  it('returns empty array for empty events', () => {
    const { result } = renderHook(() => useAllSnapshots([]));
    expect(result.current).toHaveLength(0);
  });
});
