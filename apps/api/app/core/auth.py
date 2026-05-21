"""
Autenticação simplificada para o MVP do hackathon.

Por ora, todas as requisições assumem o produtor demo (criado pelo seed).
Quando implementarmos JWT, basta substituir esta função sem mexer nos routers.
"""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Produtor

DEMO_EMAIL = "demo@unum.test"


def get_current_produtor(db: Session = Depends(get_db)) -> Produtor:
    """
    Retorna o produtor atual. Hoje sempre retorna o produtor demo.
    Quando tivermos JWT, lê o token e busca o produtor real.
    """
    stmt = select(Produtor).where(Produtor.email == DEMO_EMAIL)
    produtor = db.execute(stmt).scalar_one_or_none()
    if produtor is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Produtor demo não encontrado. "
                "Rode: docker compose exec api python -m scripts.seed"
            ),
        )
    return produtor