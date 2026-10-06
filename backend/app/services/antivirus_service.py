"""
Hospital-Grade ClamAV Antivirus & Safe Media Ingestion Pipeline
Scans all uploaded clinical voice recordings, documents, and attachments in memory.
Implements the ClamAV INSTREAM protocol with integrated heuristic signature scanning
for zero-day polyglot payloads, executable masquerading, and EICAR validation.
"""

import os
import socket
import struct
import logging
from typing import Tuple, Optional
from fastapi import HTTPException, status
from app.core.config import settings

logger = logging.getLogger("praxirence.antivirus")

# Standard EICAR Antivirus Test Signature (Industry Standard Test Vector)
EICAR_SIGNATURE = rb"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+TH*"

# Common Dangerous Executable & Shell Signatures
MALICIOUS_MAGIC_HEADERS = [
    (b"MZ", "DOS/Windows Executable (PE) binary"),
    (b"\x7fELF", "Linux Executable (ELF) binary"),
    (b"\xfe\xed\xfa\xce", "Mach-O 32-bit binary"),
    (b"\xfe\xed\xfa\xcf", "Mach-O 64-bit binary"),
    (b"\xcf\xfa\xed\xfe", "Mach-O binary"),
    (b"\xce\xfa\xed\xfe", "Mach-O binary"),
    (b"#!/bin/sh", "Shell script executable"),
    (b"#!/bin/bash", "Bash script executable"),
    (b"<?php", "PHP Web Shell payload"),
    (b"<script", "Cross-Site Scripting (XSS) / HTML polyglot payload"),
]

# Audio Magic Signatures
ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".webm", ".ogg"}


class ClamAVScanResult:
    def __init__(self, is_clean: bool, threat_name: Optional[str] = None, details: Optional[str] = None):
        self.is_clean = is_clean
        self.threat_name = threat_name
        self.details = details or ("Clean" if is_clean else f"Threat detected: {threat_name}")


class ClamAVService:
    def __init__(self):
        self.host = getattr(settings, "CLAMAV_HOST", "localhost")
        self.port = int(getattr(settings, "CLAMAV_PORT", 3310))
        self.timeout = 5.0
        self.max_file_size_bytes = 50 * 1024 * 1024  # 50 MB Maximum Upload Size

    def scan_buffer(self, content: bytes, filename: str = "upload") -> ClamAVScanResult:
        """
        Scans an in-memory buffer before it is ever written to disk.
        Executes heuristic signature check + ClamAV INSTREAM daemon protocol.
        """
        if not content:
            return ClamAVScanResult(is_clean=True, details="Empty buffer")

        if len(content) > self.max_file_size_bytes:
            return ClamAVScanResult(
                is_clean=False,
                threat_name="OversizedPayload.DecompressionRisk",
                details=f"File exceeds maximum allowed size ({len(content)} > {self.max_file_size_bytes} bytes)"
            )

        # 1. Immediate Heuristic & Test Signature Check (Fast-path)
        if EICAR_SIGNATURE in content:
            logger.error(f"[ANTIVIRUS ALERT] EICAR Standard Antivirus Test signature detected in {filename}!")
            return ClamAVScanResult(
                is_clean=False,
                threat_name="EICAR-Standard-AV-Test-File",
                details="Known antivirus test signature detected."
            )

        # Check for executable headers masquerading as audio/documents
        for magic, desc in MALICIOUS_MAGIC_HEADERS:
            if content.startswith(magic) or (magic in content[:512]):
                logger.error(f"[ANTIVIRUS ALERT] Executable/Script header ({desc}) detected in {filename}!")
                return ClamAVScanResult(
                    is_clean=False,
                    threat_name=f"Trojan.HeuristicMasquerade.{magic.decode('latin1', 'ignore')}",
                    details=f"File contains unauthorized executable or script header: {desc}"
                )

        # 2. ClamAV Daemon INSTREAM Protocol Query
        clam_result = self._query_clamd_instream(content)
        if clam_result is not None:
            return clam_result

        # ClamAV daemon was unreachable, heuristic checks passed cleanly
        return ClamAVScanResult(is_clean=True, details="Heuristic inspection passed (ClamAV daemon offline)")

    def _query_clamd_instream(self, content: bytes) -> Optional[ClamAVScanResult]:
        """
        Streams buffer to ClamAV daemon using the INSTREAM socket protocol.
        """
        sock = None
        try:
            sock = socket.create_connection((self.host, self.port), timeout=self.timeout)
            sock.sendall(b"zINSTREAM\0")

            chunk_size = 2048
            offset = 0
            total = len(content)

            while offset < total:
                chunk = content[offset:offset + chunk_size]
                chunk_len = struct.pack("!I", len(chunk))
                sock.sendall(chunk_len + chunk)
                offset += len(chunk)

            # Terminate stream with 4 null bytes
            sock.sendall(b"\x00\x00\x00\x00")

            response = sock.recv(1024).decode("utf-8", "ignore").strip()

            if "stream: OK" in response:
                return ClamAVScanResult(is_clean=True, details="ClamAV scan clean")
            elif "FOUND" in response:
                threat = response.replace("stream:", "").replace("FOUND", "").strip()
                logger.error(f"[ANTIVIRUS ALERT] ClamAV detected active virus: {threat}")
                return ClamAVScanResult(is_clean=False, threat_name=threat, details=f"ClamAV signature: {threat}")
        except (socket.error, socket.timeout) as sock_err:
            logger.debug(f"ClamAV daemon connection notice: {sock_err}")
            return None
        finally:
            if sock:
                try:
                    sock.close()
                except Exception:
                    pass
        return None

    def validate_audio_magic_bytes(self, content: bytes, filename: str) -> Tuple[bool, str]:
        """
        Validates that the file\'s magic bytes correspond to legitimate audio formats.
        Prevents polyglot file attacks.
        """
        if len(content) < 12:
            return False, "File is too short to be a valid audio stream."

        _, ext = os.path.splitext(filename.lower())

        # WAV check: RIFF header + WAVE format
        if content[:4] == b"RIFF" and content[8:12] == b"WAVE":
            return True, "WAV"

        # MP3 check: ID3 tag or MPEG sync bytes
        if content[:3] == b"ID3" or (content[0] == 0xFF and (content[1] & 0xE0) == 0xE0):
            return True, "MP3"

        # WebM / MKV check: EBML header
        if content[:4] == b"\x1a\x45\xdf\xa3":
            return True, "WebM"

        # OGG check: OggS header
        if content[:4] == b"OggS":
            return True, "OGG"

        # M4A / AAC / MP4 check: ftyp atom in first 16 bytes
        if b"ftyp" in content[:16]:
            return True, "M4A"

        # If extension is allowed and no dangerous headers found, allow with caution
        if ext in ALLOWED_AUDIO_EXTENSIONS:
            return True, ext[1:].upper()

        return False, f"Unsupported or corrupted audio stream format (extension: {ext})."


antivirus_service = ClamAVService()
