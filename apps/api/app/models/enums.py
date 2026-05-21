"""Enums usados nos models. Ficam centralizados para reuso e migrations limpas."""
from enum import Enum


class Especie(str, Enum):
    BOVINO = "bovino"
    OVINO = "ovino"
    CAPRINO = "caprino"


class Sexo(str, Enum):
    MACHO = "M"
    FEMEA = "F"


class Tecnica(str, Enum):
    IATF = "IATF"
    CONVENCIONAL = "convencional"
    IA_REPASSE = "IA_repasse"
    IA_CERVICAL = "IA_cervical"
    IA_LAPAROSCOPICA = "IA_laparoscopica"


class ResultadoDiagnostico(str, Enum):
    PRENHE = "prenhe"
    VAZIA = "vazia"
    AGUARDANDO = "aguardando"


class StatusCiclo(str, Enum):
    ATIVO = "ativo"
    CONCLUIDO_SUCESSO = "concluido_sucesso"
    CONCLUIDO_FALHA = "concluido_falha"