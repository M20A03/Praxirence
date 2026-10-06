import os
import uuid
import logging
from typing import Tuple
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings
from app.services.antivirus_service import antivirus_service, ALLOWED_AUDIO_EXTENSIONS

logger = logging.getLogger("praxirence.storage")


class StorageService:
    def __init__(self):
        self.upload_dir = settings.AUDIO_UPLOAD_DIR
        os.makedirs(self.upload_dir, exist_ok=True)

    async def save_upload_audio(self, file: UploadFile) -> Tuple[str, str]:
        """
        Saves an uploaded audio file to disk after rigorous in-memory ClamAV scanning
        and magic byte signature verification.
        Returns: (saved_file_path, filename)
        """
        filename = file.filename or "recording.wav"
        _, ext = os.path.splitext(filename.lower())
        if ext not in ALLOWED_AUDIO_EXTENSIONS:
            ext = ".wav"

        try:
            content = await file.read()

            # ------------------------------------------------------------------
            # Phase 2: In-Memory Antivirus & Malware Scanning (ClamAV Sandbox)
            # ------------------------------------------------------------------
            scan_result = antivirus_service.scan_buffer(content, filename=filename)
            if not scan_result.is_clean:
                logger.critical(
                    f"SECURITY INCIDENT: Malware detected in upload '{filename}' - "
                    f"Threat: {scan_result.threat_name}. File rejected."
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Security Violation: Malicious payload detected by Antivirus Scan ({scan_result.threat_name})"
                )

            # ------------------------------------------------------------------
            # Phase 2: Magic Byte Signature Verification
            # ------------------------------------------------------------------
            valid_magic, magic_detail = antivirus_service.validate_audio_magic_bytes(content, filename=filename)
            if not valid_magic:
                logger.warning(f"SECURITY INCIDENT: Invalid audio magic bytes in '{filename}': {magic_detail}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Security Violation: Invalid file signature. {magic_detail}"
                )

            unique_filename = f"{uuid.uuid4()}{ext}"
            destination = os.path.join(self.upload_dir, unique_filename)

            with open(destination, "wb") as f:
                f.write(content)

            logger.info(f"Verified & clean audio saved: {destination} ({len(content)} bytes)")
            return destination, unique_filename
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error processing audio upload: {e}")
            raise HTTPException(status_code=500, detail="Failed to safely process uploaded audio file")

    def delete_audio_file(self, file_path_or_name: str) -> bool:
        """
        Securely removes an audio file from storage (Zero-Audio-Retention).
        """
        if not file_path_or_name:
            return False

        if not os.path.isabs(file_path_or_name):
            target_path = os.path.join(self.upload_dir, os.path.basename(file_path_or_name))
        else:
            target_path = file_path_or_name

        # Prevent directory traversal attacks
        norm_target = os.path.abspath(target_path)
        norm_dir = os.path.abspath(self.upload_dir)
        if not norm_target.startswith(norm_dir) and not norm_target.startswith("/tmp"):
            logger.warning(f"Prevented unauthorized file deletion outside target directory: {norm_target}")
            return False

        if os.path.exists(norm_target):
            try:
                os.remove(norm_target)
                logger.info(f"Deleted audio file: {norm_target}")
                return True
            except Exception as e:
                logger.error(f"Failed to delete audio file {norm_target}: {e}")
                return False
        else:
            logger.warning(f"Audio file does not exist: {norm_target}")
            return False


storage_service = StorageService()
