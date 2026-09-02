import os
import uuid
import logging
from typing import Tuple
from fastapi import UploadFile, HTTPException
from app.core.config import settings

logger = logging.getLogger("praxirence.storage")

ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".webm", ".ogg"}


class StorageService:
    def __init__(self):
        self.upload_dir = settings.AUDIO_UPLOAD_DIR
        os.makedirs(self.upload_dir, exist_ok=True)

    async def save_upload_audio(self, file: UploadFile) -> Tuple[str, str]:
        """
        Saves an uploaded audio file to disk with a secure unique filename.
        Returns: (saved_file_path, filename)
        """
        filename = file.filename or "recording.wav"
        _, ext = os.path.splitext(filename.lower())
        if ext not in ALLOWED_AUDIO_EXTENSIONS:
            # If webm or blob without extension, default to .wav
            ext = ".wav"

        unique_filename = f"{uuid.uuid4()}{ext}"
        destination = os.path.join(self.upload_dir, unique_filename)

        try:
            content = await file.read()
            with open(destination, "wb") as f:
                f.write(content)
            logger.info(f"Audio file saved: {destination} ({len(content)} bytes)")
            return destination, unique_filename
        except Exception as e:
            logger.error(f"Error saving audio file: {e}")
            raise HTTPException(status_code=500, detail="Failed to save uploaded audio file")

    def delete_audio_file(self, file_path_or_name: str) -> bool:
        """
        Securely removes an audio file from storage.
        """
        if not file_path_or_name:
            return False

        # If only filename passed, join with upload dir
        if not os.path.isabs(file_path_or_name):
            target_path = os.path.join(self.upload_dir, os.path.basename(file_path_or_name))
        else:
            target_path = file_path_or_name

        # Prevent directory traversal
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
