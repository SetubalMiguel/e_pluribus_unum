"""Models do Unum. Importados aqui para conveniência e para o Alembic enxergar tudo."""
from app.models.animal import Animal
from app.models.audit_log import AuditLog
from app.models.ciclo_reprodutivo import CicloReprodutivo
from app.models.enums import (
    Especie,
    ResultadoDiagnostico,
    Sexo,
    StatusCiclo,
    Tecnica,
)
from app.models.inseminacao import Inseminacao
from app.models.produtor import Produtor
from app.models.recomendacao_cruzamento import RecomendacaoCruzamento

__all__ = [
    "Animal",
    "AuditLog",
    "CicloReprodutivo",
    "Especie",
    "Inseminacao",
    "Produtor",
    "RecomendacaoCruzamento",
    "ResultadoDiagnostico",
    "Sexo",
    "StatusCiclo",
    "Tecnica",
]