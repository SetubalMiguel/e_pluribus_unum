"""Unum API — gestão genética e reprodutiva de rebanhos."""
from fastapi import FastAPI

app = FastAPI(
    title="Unum API",
    description="Plataforma de gestão genética e reprodutiva para bovinos, ovinos e caprinos.",
    version="0.1.0",
)


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