from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel


class MemoryAction(str, Enum):
    alloc = "alloc"
    free = "free"
    double_free = "double_free"
    end = "end"


class BlockStatus(str, Enum):
    active = "active"
    freed = "freed"
    leaked = "leaked"
    double_free = "double_free"


class MemoryEvent(BaseModel):
    time: int
    action: MemoryAction
    id: Optional[str] = None
    size: Optional[int] = None
    label: Optional[str] = None


class MemoryBlock(BaseModel):
    id: str
    label: str
    size: int
    status: BlockStatus


class HeapSnapshot(BaseModel):
    step: int
    heap_bytes: int
    leaked_bytes: int


class MemoryStats(BaseModel):
    current_heap: int
    peak_mem: int
    leaked_bytes: int
    leaked_count: int
    freed_count: int
    active_count: int
    double_free_count: int
    total_ops: int


class AnalyzeRequest(BaseModel):
    events: list[MemoryEvent]
    source_code: Optional[str] = None
    language: Optional[str] = None


class AnalyzeResponse(BaseModel):
    blocks: list[MemoryBlock]
    stats: MemoryStats
    snapshots: list[HeapSnapshot]
    verdict: str
