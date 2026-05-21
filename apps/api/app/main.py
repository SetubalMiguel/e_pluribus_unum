"""Unum API — gestão genética e reprodutiva de rebanhos."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import animals, inseminations, predict, recommend, stats

app = FastAPI(
    title="Unum API",
    description="Plataforma de gestão genética e reprodutiva para bovinos, ovinos e caprinos.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(animals.router)
app.include_router(inseminations.router)
app.include_router(predict.router)
app.include_router(recommend.router)
app.include_router(stats.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": "unum-api"}


@app.get("/", tags=["meta"])
def root():
    return {
        "name": "Unum API",
        "version": "0.1.0",
        "docs": "/docs",
    }