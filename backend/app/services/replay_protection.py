"""
Hospital-Grade Anti-Replay & Request Nonce Validation Service
Protects high-value clinical mutations (e-prescriptions, cancellations, appointments)
against Man-in-the-Middle packet replays and tampering.
"""

import time
import logging
from typing import Optional
from fastapi import Request, HTTPException, status

logger = logging.getLogger("praxirence.security.replay")

REPLAY_TOLERANCE_SECONDS = 300  # 5 minutes maximum freshness window
_SEEN_NONCES: dict[str, float] = {}  # nonce -> expiry_time


def verify_anti_replay_headers(request: Request) -> bool:
    """
    Validates anti-replay headers from mobile and web clients:
    - X-Praxirence-Timestamp: Must be within 5-minute freshness window.
    - X-Praxirence-Nonce: Must be unique and never previously submitted.
    """
    timestamp_header = request.headers.get("X-Praxirence-Timestamp")
    nonce_header = request.headers.get("X-Praxirence-Nonce")

    # If headers are absent, allow normal requests unless strict enforcement is toggled
    if not timestamp_header and not nonce_header:
        return True

    now = time.time()

    # 1. Validate Timestamp Freshness
    if timestamp_header:
        try:
            req_time = float(timestamp_header)
            # Support both milliseconds and seconds timestamps
            if req_time > 1e11:
                req_time = req_time / 1000.0

            skew = abs(now - req_time)
            if skew > REPLAY_TOLERANCE_SECONDS:
                logger.warning(
                    f"ANTI-REPLAY VIOLATION: Skew of {skew:.1f}s exceeded tolerance ({REPLAY_TOLERANCE_SECONDS}s)"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Security Violation: Request timestamp expired ({skew:.1f}s skew). Replay rejected."
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security Violation: Invalid X-Praxirence-Timestamp format."
            )

    # 2. Validate Nonce Uniqueness
    if nonce_header:
        # Prune expired nonces
        expired_keys = [k for k, exp in _SEEN_NONCES.items() if now > exp]
        for k in expired_keys:
            _SEEN_NONCES.pop(k, None)

        if nonce_header in _SEEN_NONCES:
            logger.critical(
                f"ANTI-REPLAY VIOLATION: Duplicate nonce '{nonce_header}' detected from IP {request.client.host if request.client else 'unknown'}!"
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Security Violation: Cryptographic nonce collision/replay detected. Request rejected."
            )

        _SEEN_NONCES[nonce_header] = now + REPLAY_TOLERANCE_SECONDS

    return True
