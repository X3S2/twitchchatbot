from datetime import datetime, timedelta, timezone
from typing import Any
from jose import jwt, JWTError
from cryptography.fernet import Fernet
from .config import get_settings

settings = get_settings()


# ── JWT ──────────────────────────────────────────────────────────────────────

def create_access_token(data: dict[str, Any]) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {**data, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(data: dict[str, Any]) -> tuple[str, datetime]:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
    payload = {**data, "exp": expire, "type": "refresh"}
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expire


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None


# ── Fernet-Verschlüsselung für DB-Felder ─────────────────────────────────────

def _get_fernet() -> Fernet | None:
    if not settings.fernet_key:
        return None
    return Fernet(settings.fernet_key.encode())


def encrypt_value(value: str) -> str | None:
    f = _get_fernet()
    if not f or not value:
        return None
    return f.encrypt(value.encode()).decode()


def decrypt_value(encrypted: str | None) -> str | None:
    f = _get_fernet()
    if not f or not encrypted:
        return None
    try:
        return f.decrypt(encrypted.encode()).decode()
    except Exception:
        return None
