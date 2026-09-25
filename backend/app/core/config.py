import os
import base64
from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Praxirence"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security & Auth
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "praxirence-dev-jwt-secret-key-at-least-32-chars")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)))

    # Data Encryption at Rest (AES-256 via Fernet)
    ENCRYPTION_KEY: str = os.environ.get("ENCRYPTION_KEY", "rV8_NqjH6_t5z9oEwM11x2_4pX-9yK0Z7Q_3uI6v8w0=")
    PHONE_HASH_SALT: str = os.environ.get("PHONE_HASH_SALT", "praxirence-phone-blind-index-salt-v1")

    # Database
    DATABASE_URL: str = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/praxirence")
    # Fallback SQLite DB for local unit tests without postgres
    SQLITE_FALLBACK: bool = os.environ.get("SQLITE_FALLBACK", "False").lower() in ("true", "1")

    # Redis & Background Tasks
    REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    # In-House Local ML Engine (Zero API Dependency, 100% On-Premise)
    USE_LOCAL_ML: bool = os.environ.get("USE_LOCAL_ML", "True").lower() in ("true", "1")

    # HTTPS Email REST APIs (Port 443 - 100% immune to cloud firewall SMTP port blocks)
    GMAIL_WEBHOOK_URL: Optional[str] = os.environ.get("GMAIL_WEBHOOK_URL")
    RESEND_API_KEY: Optional[str] = os.environ.get("RESEND_API_KEY")
    BREVO_API_KEY: Optional[str] = os.environ.get("BREVO_API_KEY")

    # SMTP / Noreply Email Configuration (Email OTP Verification)
    SMTP_HOST: Optional[str] = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.environ.get("SMTP_PORT", 587))
    SMTP_USER: Optional[str] = os.environ.get("SMTP_USER")
    SMTP_PASSWORD: Optional[str] = os.environ.get("SMTP_PASSWORD")
    SMTP_FROM_EMAIL: str = os.environ.get("SMTP_FROM_EMAIL", "noreply@praxirence.com")
    SMTP_FROM_NAME: str = os.environ.get("SMTP_FROM_NAME", "Praxirence")

    # Audio Recording Storage
    AUDIO_UPLOAD_DIR: str = "/tmp/praxirence_recordings"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "https://www.praxirence.com",
        "https://praxirence.com",
        "https://praxirence-production.up.railway.app",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:19006",
        "http://localhost:8081",
        "*"
    ]

    model_config = SettingsConfigDict(
        env_file=(
            os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
            ".env"
        ),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

# Ensure audio upload dir exists
os.makedirs(settings.AUDIO_UPLOAD_DIR, exist_ok=True)
