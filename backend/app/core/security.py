import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union
from cryptography.fernet import Fernet
from jose import jwt
import bcrypt
from app.core.config import settings

def get_fernet_cipher() -> Fernet:
    key = settings.ENCRYPTION_KEY.encode()
    return Fernet(key)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        plain_bytes = plain_password.encode("utf-8")[:72]
        hashed_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    plain_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_bytes, salt).decode("utf-8")


def create_access_token(
    subject: Union[str, Any],
    role: str = "doctor",
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "role": role,
    }
    if extra_claims:
        to_encode.update(extra_claims)

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except Exception:
        return None


def encrypt_phone(raw_phone: str) -> str:
    """
    Encrypts a phone number at rest using AES-256 (Fernet).
    Returns a base64 encoded encrypted string.
    """
    cipher = get_fernet_cipher()
    cleaned = raw_phone.strip()
    return cipher.encrypt(cleaned.encode("utf-8")).decode("utf-8")


def decrypt_phone(encrypted_phone: str) -> str:
    """
    Decrypts an encrypted phone number.
    """
    try:
        cipher = get_fernet_cipher()
        return cipher.decrypt(encrypted_phone.encode("utf-8")).decode("utf-8")
    except Exception:
        return encrypted_phone


def compute_phone_hash(raw_phone: str) -> str:
    """
    Creates a deterministic cryptographic HMAC-SHA256 blind index
    for fast exact-match lookups without exposing plaintext phone numbers.
    """
    # Normalize phone: remove non-digits, keep leading '+' if present
    normalized = "".join(c for c in raw_phone.strip() if c.isdigit() or c == "+")
    salt = settings.PHONE_HASH_SALT.encode("utf-8")
    h = hmac.new(salt, normalized.encode("utf-8"), hashlib.sha256)
    return h.hexdigest()
