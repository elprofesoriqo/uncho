"""
Lighthouse OS — FastAPI Backend
Production entry point. Registers all routers and configures middleware.
"""
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from backend.routers import chat, crisis, dossier, export, geo, health, narrative, rankings, simulate, timeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.deps import get_db_client, get_config
    logger.info("Lighthouse OS API starting — connecting to Databricks...")
    try:
        client = get_db_client()
        client.connect()
        logger.info(f"Connected: {client._backend} backend")
    except Exception as e:
        logger.warning(f"DB pre-connect failed (will retry on first request): {e}")
    yield
    logger.info("Lighthouse OS API shutting down.")


app = FastAPI(
    title="Lighthouse OS — Humanitarian Intelligence API",
    description=(
        "Production backend for the Lighthouse OS platform. "
        "Provides advanced crisis rankings, multi-mode geospatial data, "
        "funding simulations, CERF dossier generation, and a Claude-powered "
        "AI Co-Pilot with direct Databricks MCP tooling."
    ),
    version="3.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to Vercel URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_timing(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - start) * 1000)
    response.headers["X-Response-Time-Ms"] = str(elapsed_ms)
    return response


# ── Global error handler ──────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url}: {exc}")
    return JSONResponse(status_code=500, content={"detail": str(exc)})


# ── Router registration ───────────────────────────────────────────────────────

app.include_router(rankings.router)
app.include_router(geo.router)
app.include_router(crisis.router)
app.include_router(simulate.router)
app.include_router(dossier.router)
app.include_router(timeline.router)
app.include_router(health.router)
app.include_router(narrative.router)
app.include_router(chat.router)
app.include_router(export.router)


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health_check():
    from backend.deps import get_db_client
    client = get_db_client()
    return {
        "status": "ok",
        "backend": client._backend,
        "version": app.version,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
