import os
from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Praxirence"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security & Auth
    SECRET_KEY: str = "praxirence-super-secret-jwt-key-change-in-production-32bytes-min"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Data Encryption at Rest (AES-256 via Fernet)
    # Generated with: cryptography.fernet.Fernet.generate_key().decode()
    ENCRYPTION_KEY: str = "rV8_NqjH6_t5z9oEwM11x2_4pX-9yK0Z7Q_3uI6v8w0="
    PHONE_HASH_SALT: str = "praxirence-phone-blind-index-salt-v1"

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/praxirence"
    # Fallback SQLite DB for local unit tests without postgres
    SQLITE_FALLBACK: bool = False

    # Redis & Background Tasks
    REDIS_URL: str = "redis://localhost:6379/0"

    # OpenAI API (Whisper & GPT-4)
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_WHISPER_MODEL: str = "whisper-1"
    OPENAI_GPT_MODEL: str = "gpt-4o"

    # Twilio (WhatsApp & Verify OTP)
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"  # Standard Twilio sandbox number
    TWILIO_VERIFY_SERVICE_SID: Optional[str] = None

    # Meta WhatsApp Cloud API
    META_WHATSAPP_TOKEN: Optional[str] = None
    META_PHONE_NUMBER_ID: Optional[str] = None
    META_WABA_ID: Optional[str] = None

    # Firebase Cloud Messaging
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None

    # Audio Recording Storage
    AUDIO_UPLOAD_DIR: str = "/tmp/praxirence_recordings"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:19006",
        "http://localhost:8081",
        "*"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

# Ensure audio upload dir exists
os.makedirs(settings.AUDIO_UPLOAD_DIR, exist_ok=True)
