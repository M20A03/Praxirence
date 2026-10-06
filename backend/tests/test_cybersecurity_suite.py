"""
Hospital-Grade Cybersecurity, WAF & Antivirus Threat-Mitigation Verification Suite
Tests:
1. WAF Automated Scanner & Malicious Bot User-Agent Blocking (403 Forbidden)
2. OWASP Security Headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)
3. Sliding-Window Rate Limiting on Auth/OTP Endpoints (429 Too Many Requests)
4. ClamAV & Antivirus EICAR Malware Ingestion Protection
5. Executable Binary Masquerading & Magic Byte Neutralization
6. Anti-Replay Timestamp Skew & Cryptographic Nonce Deduplication (400/409)
7. JWT Token Revocation & Immediate Blacklisting
8. Zero Disruption to Legitimate Healthcare Consultations & Workflows
"""

import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.services.antivirus_service import antivirus_service, EICAR_SIGNATURE
from app.services.token_blacklist import token_blacklist
from app.services.replay_protection import verify_anti_replay_headers, REPLAY_TOLERANCE_SECONDS


@pytest.fixture
def client():
    return TestClient(app)


# ------------------------------------------------------------------------------
# 1. WAF Scanner & Bot Defense Tests
# ------------------------------------------------------------------------------

def test_waf_blocks_sqlmap_scanner(client):
    """Verifies automated SQL injection scanner fingerprints are dropped with 403 Forbidden"""
    headers = {"User-Agent": "sqlmap/1.5#dev (http://sqlmap.org)"}
    response = client.get("/auth/directory", headers=headers)
    assert response.status_code == 403
    data = response.json()
    assert "Automated security scanner" in data["detail"]
    assert data["error_code"] == "BOT_FINGERPRINT_REJECTED"


def test_waf_blocks_nikto_and_masscan(client):
    """Verifies Nikto web scanner and Masscan probes are dropped with 403 Forbidden"""
    for bad_ua in ["Nikto/2.1.6", "masscan/1.0", "Acunetix-Web-Vulnerability-Scanner", "censys/1.0"]:
        res = client.get("/auth/directory", headers={"User-Agent": bad_ua})
        assert res.status_code == 403, f"Expected 403 for User-Agent: {bad_ua}"


def test_waf_allows_legitimate_clients(client):
    """Verifies legitimate mobile apps and medical browsers pass WAF inspection"""
    legit_uas = [
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36",
        "Praxirence-Doctor-Mobile/1.0.6 (Android)",
        "Praxirence-Patient-Mobile/1.0.6 (Android)",
    ]
    for ua in legit_uas:
        res = client.get("/auth/directory", headers={"User-Agent": ua})
        assert res.status_code == 200, f"Expected 200 for legitimate User-Agent: {ua}"


# ------------------------------------------------------------------------------
# 2. OWASP Security Headers Tests
# ------------------------------------------------------------------------------

def test_owasp_security_headers_enforced(client):
    """Verifies hospital-grade defense-in-depth security headers are present on all responses"""
    res = client.get("/auth/directory")
    assert res.status_code == 200
    headers = res.headers
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("X-XSS-Protection") == "1; mode=block"
    assert "max-age=63072000" in headers.get("Strict-Transport-Security", "")
    assert "default-src 'self'" in headers.get("Content-Security-Policy", "")
    assert headers.get("X-DPDP-Compliance") == "India-DPDP-Act-2023-Aligned"


# ------------------------------------------------------------------------------
# 3. Sliding-Window Rate Limiting Tests
# ------------------------------------------------------------------------------

def test_sliding_window_rate_limiting_auth(client):
    """Simulates volumetric credential stuffing/flood against sensitive auth routes"""
    auth_endpoint = "/auth/doctor/login"
    hit_rate_limit = False

    # Send rapid requests until 429 triggered
    for i in range(16):
        res = client.post(
            auth_endpoint,
            json={"email": "attacker@flood.com", "password": "WrongPassword!"},
            headers={"X-Test-Rate-Limit": "true"}
        )
        if res.status_code == 429:
            hit_rate_limit = True
            assert "Too many requests" in res.json()["detail"]
            assert "Retry-After" in res.headers
            break

    assert hit_rate_limit is True, "Rate limit should be triggered after exceeding threshold."


# ------------------------------------------------------------------------------
# 4. Antivirus & ClamAV Sandbox Tests
# ------------------------------------------------------------------------------

def test_antivirus_detects_eicar_test_signature():
    """Validates that the standard EICAR test virus is detected and flagged as non-clean"""
    eicar_payload = EICAR_SIGNATURE + b" extra clinical bytes"
    scan_result = antivirus_service.scan_buffer(eicar_payload, filename="suspicious_audio.wav")
    assert scan_result.is_clean is False
    assert scan_result.threat_name == "EICAR-Standard-AV-Test-File"


def test_antivirus_blocks_executable_masquerading():
    """Detects Windows PE and Linux ELF binaries masquerading as audio recordings"""
    # Windows PE header (MZ)
    fake_pe = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff" + b"\x00" * 100
    scan_pe = antivirus_service.scan_buffer(fake_pe, filename="trojan.wav")
    assert scan_pe.is_clean is False
    assert "Trojan.HeuristicMasquerade" in scan_pe.threat_name

    # Linux ELF header
    fake_elf = b"\x7fELF\x02\x01\x01\x00" + b"\x00" * 100
    scan_elf = antivirus_service.scan_buffer(fake_elf, filename="payload.mp3")
    assert scan_elf.is_clean is False
    assert "Trojan.HeuristicMasquerade" in scan_elf.threat_name

    # PHP Web Shell
    fake_php = b"<?php system($_GET['cmd']); ?>"
    scan_php = antivirus_service.scan_buffer(fake_php, filename="shell.webm")
    assert scan_php.is_clean is False


def test_antivirus_validates_clean_audio_magic_bytes():
    """Verifies valid clean WAV audio headers pass validation"""
    # Minimum valid WAV header: RIFF + 4 bytes size + WAVE + fmt + ...
    clean_wav = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    is_valid, fmt = antivirus_service.validate_audio_magic_bytes(clean_wav, "consult.wav")
    assert is_valid is True
    assert fmt == "WAV"

    scan_clean = antivirus_service.scan_buffer(clean_wav, "consult.wav")
    assert scan_clean.is_clean is True


def test_antivirus_rejects_corrupted_or_disguised_file():
    """Verifies random garbage pretending to be audio is rejected by magic byte inspection"""
    garbage = b"RANDOM_NON_AUDIO_BYTES_HERE_12345678"
    is_valid, err_msg = antivirus_service.validate_audio_magic_bytes(garbage, "fake.pdf")
    assert is_valid is False
    assert "Unsupported or corrupted" in err_msg


# ------------------------------------------------------------------------------
# 5. Anti-Replay & Nonce Deduplication Tests
# ------------------------------------------------------------------------------

def test_anti_replay_blocks_expired_timestamps(client):
    """Verifies requests with timestamps older than 5 minutes are rejected"""
    expired_time_ms = str(int((time.time() - 400) * 1000))  # 400s in past (> 300s window)
    headers = {
        "X-Praxirence-Timestamp": expired_time_ms,
        "X-Praxirence-Nonce": f"nonce-{time.time()}",
    }
    res = client.put("/visits/test-visit-123/status", json={"status": "approved"}, headers=headers)
    assert res.status_code == 400
    assert "timestamp expired" in res.json()["detail"].lower()


def test_anti_replay_blocks_duplicate_nonces(client):
    """Verifies that replaying the identical cryptographic nonce triggers 409 Conflict"""
    fresh_time_ms = str(int(time.time() * 1000))
    replayed_nonce = f"unique-nonce-{time.time()}"
    headers = {
        "X-Praxirence-Timestamp": fresh_time_ms,
        "X-Praxirence-Nonce": replayed_nonce,
    }

    # First attempt: passes replay check (fails later on 404/401 because visit doesn't exist, which is expected)
    res1 = client.put("/visits/test-visit-123/status", json={"status": "approved"}, headers=headers)
    assert res1.status_code != 409, "First nonce attempt should pass replay verification"

    # Second attempt with same nonce: must be rejected with 409 Conflict
    res2 = client.put("/visits/test-visit-123/status", json={"status": "approved"}, headers=headers)
    assert res2.status_code == 409
    assert "nonce collision/replay detected" in res2.json()["detail"].lower()


# ------------------------------------------------------------------------------
# 6. JWT Token Revocation & Immediate Blacklist Tests
# ------------------------------------------------------------------------------

def test_jwt_token_revocation_on_logout(client):
    """Verifies that logging out immediately blacklists the JWT token"""
    token = create_access_token(subject="doc-sec-test-01", role="doctor")
    assert token_blacklist.is_blacklisted(token) is False

    # Perform logout with Bearer token
    res = client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["success"] is True

    # Token must now be blacklisted
    assert token_blacklist.is_blacklisted(token) is True

    # Subsequent access attempt with revoked token must fail with 401
    protected_res = client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert protected_res.status_code == 401
    assert "Token has been revoked" in protected_res.json()["detail"]
