from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class BotManagerSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Backend-API
    api_url: str = "http://tcb-backend:8000"
    internal_api_key: str = "changeme"

    # Redis
    redis_url: str = "redis://tcb-redis:6379/0"

    # Logging
    log_level: str = "INFO"


@lru_cache
def get_settings() -> BotManagerSettings:
    return BotManagerSettings()
