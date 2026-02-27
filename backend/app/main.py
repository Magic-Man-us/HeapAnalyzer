from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import analysis

app = FastAPI(
    title="Heap Analyzer API",
    description="Backend API for the Heap Analyzer memory visualization tool",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Heap Analyzer API v2.0"}
