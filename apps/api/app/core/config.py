"""Configurações da aplicação, lidas de variáveis de ambiente."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurações centrais da Unum API."""

    # Banco de dados
    database_url: str = "postgresql+psycopg://unum:unum_dev@db:5432/unum"

    # Autenticação JWT
    jwt_secret: str = "dev_secret_change_in_production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 15

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Ambiente
    environment: str = "development"
    log_level: str = "info"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Converte a string de CORS_ORIGINS em lista."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()