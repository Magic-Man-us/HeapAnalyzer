from __future__ import annotations

from ..models.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    BlockStatus,
    HeapSnapshot,
    MemoryBlock,
    MemoryStats,
)


def analyze_events(request: AnalyzeRequest) -> AnalyzeResponse:
    """Process a list of memory events and produce analysis results."""
    blocks: dict[str, MemoryBlock] = {}
    snapshots: list[HeapSnapshot] = []
    peak = 0

    for step, event in enumerate(request.events):
        if event.action == "alloc" and event.id and event.label and event.size is not None:
            blocks[event.id] = MemoryBlock(
                id=event.id,
                label=event.label,
                size=event.size,
                status=BlockStatus.active,
            )
        elif event.action == "free" and event.id and event.id in blocks:
            blocks[event.id].status = BlockStatus.freed
        elif event.action == "double_free" and event.id and event.id in blocks:
            blocks[event.id].status = BlockStatus.double_free
        elif event.action == "end":
            for block in blocks.values():
                if block.status == BlockStatus.active:
                    block.status = BlockStatus.leaked

        active_blocks = [
            b for b in blocks.values()
            if b.status in (BlockStatus.active, BlockStatus.leaked)
        ]
        total = sum(b.size for b in active_blocks)
        leaked = sum(
            b.size for b in blocks.values() if b.status == BlockStatus.leaked
        )
        peak = max(peak, total)
        snapshots.append(
            HeapSnapshot(step=step, heap_bytes=total, leaked_bytes=leaked)
        )

    all_blocks = list(blocks.values())
    active = [b for b in all_blocks if b.status == BlockStatus.active]
    leaked_blocks = [b for b in all_blocks if b.status == BlockStatus.leaked]
    freed = [b for b in all_blocks if b.status == BlockStatus.freed]
    double_freed = [b for b in all_blocks if b.status == BlockStatus.double_free]

    leaked_bytes = sum(b.size for b in leaked_blocks)
    current_heap = sum(b.size for b in active) + leaked_bytes

    stats = MemoryStats(
        current_heap=current_heap,
        peak_mem=peak,
        leaked_bytes=leaked_bytes,
        leaked_count=len(leaked_blocks),
        freed_count=len(freed),
        active_count=len(active),
        double_free_count=len(double_freed),
        total_ops=len(request.events),
    )

    if double_freed:
        verdict = "DOUBLE FREE DETECTED"
    elif leaked_blocks:
        verdict = f"LEAK: {leaked_bytes}B IN {len(leaked_blocks)} BLOCK(S)"
    else:
        verdict = "ALL CLEAR — NO LEAKS"

    return AnalyzeResponse(
        blocks=all_blocks,
        stats=stats,
        snapshots=snapshots,
        verdict=verdict,
    )
