from fastapi import APIRouter

from ..models.schemas import AnalyzeRequest, AnalyzeResponse
from ..services.analyzer import analyze_events

router = APIRouter(prefix="/api", tags=["analysis"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """Analyze a sequence of memory events and return statistics."""
    return analyze_events(request)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": "2.0.0"}
