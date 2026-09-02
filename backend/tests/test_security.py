import pytest
from app.core.security import (
    encrypt_phone,
    decrypt_phone,
    compute_phone_hash,
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
)


def test_password_hashing():
    pwd = "SecurePassword123!"
    hashed = get_password_hash(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_phone_encryption_and_decryption():
    raw_phone = "+15559876543"
    encrypted = encrypt_phone(raw_phone)
    assert encrypted != raw_phone
    decrypted = decrypt_phone(encrypted)
    assert decrypted == raw_phone


def test_phone_blind_index_consistency():
    phone1 = "+15551112233"
    phone2 = "+1 555 111 2233"  # Normalized format
    hash1 = compute_phone_hash(phone1)
    hash2 = compute_phone_hash(phone2)
    assert hash1 == hash2
    assert len(hash1) == 64  # SHA256 hex length


def test_jwt_generation_and_decoding():
    token = create_access_token(subject="user-uuid-123", role="doctor")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload.get("sub") == "user-uuid-123"
    assert payload.get("role") == "doctor"
