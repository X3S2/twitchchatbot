from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Datenbank
    database_url: str = "postgresql+asyncpg://tcb_user:password@tcb-postgres:5432/tcb"

    # Redis
    redis_url: str = "redis://tcb-redis:6379/0"

    # Sicherheit
    jwt_secret_key: str = "changeme"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 30
    fernet_key: str = ""

    # App
    app_public_url: str = "http://localhost:3080"

    # Bot-Manager (intern)
    bot_manager_url: str = "http://tcb-botmanager:8001"

    # CORS
    @property
    def cors_origins(self) -> list[str]:
        return [self.app_public_url, "http://localhost:3080", "http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
