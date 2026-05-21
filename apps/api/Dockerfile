# syntax=docker/dockerfile:1.7

FROM python:3.11-slim AS base

# Configurações de runtime do Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Dependências do sistema (psycopg precisa de libpq; build-essential ajuda em algumas wheels)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências primeiro (cache de layer eficiente)
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copia o código depois (mudanças no código não invalidam o cache de pip)
COPY . .

# Usuário não-root para segurança
RUN useradd --create-home --shell /bin/bash unum && \
    chown -R unum:unum /app
USER unum

EXPOSE 8000

# Healthcheck simples — bate no endpoint /health do FastAPI
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Comando default — o docker-compose sobrescreve para incluir Alembic
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]