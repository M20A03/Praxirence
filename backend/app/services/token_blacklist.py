"""
Hospital-Grade JWT Token Blacklist & Revocation Service
Provides immediate session termination on logout, password changes, or breach alerts.
Uses in-memory cache with automatic expiration matching token TTL.
"""

import time
import logging
from typing import Optional

logger = logging.getLogger("praxirence.security.blacklist")

_BLACKLISTED_TOKENS: dict[str, float] = {}  # token_hash -> expiry_timestamp


class TokenBlacklistService:
    def blacklist_token(self, token: str, expiry_timestamp: Optional[float] = None) -> None:
        """
        Adds a token to the blacklist until its natural expiration.
        """
        if not token:
            return
        now = time.time()
        # Default expiry: 24 hours if not parsed from JWT
        exp = expiry_timestamp or (now + 86400)
        _BLACKLISTED_TOKENS[token] = exp
        self._prune_expired()
        logger.info(f"JWT Token revoked and blacklisted until {exp}")

    def is_blacklisted(self, token: str) -> bool:
        """
        Returns True if the token has been revoked.
        """
        if not token:
            return False
        exp = _BLACKLISTED_TOKENS.get(token)
        if exp is None:
            return False
        if time.time() > exp:
            _BLACKLISTED_TOKENS.pop(token, None)
            return False
        return True

    def _prune_expired(self) -> None:
        """Removes expired entries to prevent memory bloat"""
        now = time.time()
        expired_keys = [k for k, exp in _BLACKLISTED_TOKENS.items() if now > exp]
        for k in expired_keys:
            _BLACKLISTED_TOKENS.pop(k, None)


token_blacklist = TokenBlacklistService()
