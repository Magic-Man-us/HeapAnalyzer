from app.models.schemas import AnalyzeRequest, MemoryEvent
from app.services.analyzer import analyze_events


def test_clean_analysis():
    """All blocks properly freed should result in no leaks."""
    events = [
        MemoryEvent(time=0, action="alloc", id="a", size=64, label="block_a"),
        MemoryEvent(time=1, action="alloc", id="b", size=128, label="block_b"),
        MemoryEvent(time=2, action="free", id="a"),
        MemoryEvent(time=3, action="free", id="b"),
        MemoryEvent(time=4, action="end"),
    ]
    result = analyze_events(AnalyzeRequest(events=events))
    assert result.stats.leaked_count == 0
    assert result.stats.freed_count == 2
    assert result.verdict == "ALL CLEAR — NO LEAKS"


def test_leak_detection():
    """Unreleased blocks should be detected as leaks."""
    events = [
        MemoryEvent(time=0, action="alloc", id="a", size=64, label="block_a"),
        MemoryEvent(time=1, action="alloc", id="b", size=128, label="block_b"),
        MemoryEvent(time=2, action="free", id="a"),
        MemoryEvent(time=3, action="end"),
    ]
    result = analyze_events(AnalyzeRequest(events=events))
    assert result.stats.leaked_count == 1
    assert result.stats.leaked_bytes == 128
    assert "LEAK" in result.verdict


def test_double_free_detection():
    """Double free should be detected."""
    events = [
        MemoryEvent(time=0, action="alloc", id="a", size=256, label="shared"),
        MemoryEvent(time=1, action="free", id="a"),
        MemoryEvent(time=2, action="double_free", id="a"),
        MemoryEvent(time=3, action="end"),
    ]
    result = analyze_events(AnalyzeRequest(events=events))
    assert result.stats.double_free_count == 1
    assert result.verdict == "DOUBLE FREE DETECTED"


def test_peak_memory():
    """Peak memory should track the maximum heap usage."""
    events = [
        MemoryEvent(time=0, action="alloc", id="a", size=100, label="a"),
        MemoryEvent(time=1, action="alloc", id="b", size=200, label="b"),
        MemoryEvent(time=2, action="free", id="a"),
        MemoryEvent(time=3, action="alloc", id="c", size=50, label="c"),
        MemoryEvent(time=4, action="free", id="b"),
        MemoryEvent(time=5, action="free", id="c"),
        MemoryEvent(time=6, action="end"),
    ]
    result = analyze_events(AnalyzeRequest(events=events))
    assert result.stats.peak_mem == 300  # a(100) + b(200)
    assert result.stats.leaked_count == 0


def test_snapshots_count():
    """Should have one snapshot per event."""
    events = [
        MemoryEvent(time=0, action="alloc", id="a", size=64, label="a"),
        MemoryEvent(time=1, action="free", id="a"),
        MemoryEvent(time=2, action="end"),
    ]
    result = analyze_events(AnalyzeRequest(events=events))
    assert len(result.snapshots) == 3
