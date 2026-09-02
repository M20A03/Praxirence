import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.models.visit import Visit
from app.models.audit_log import AuditLog
from app.services.storage_service import storage_service
from app.api.deps import get_current_doctor

router = APIRouter(prefix="/recordings", tags=["Recordings & Retention"])


@router.delete("/{filename}")
def delete_recording(
    filename: str,
    db: Session = Depends(get_db),
    current_doctor = Depends(get_current_doctor)
):
    """
    Manually delete an audio recording file from storage.
    Updates any corresponding Visit record to remove the reference.
    """
    deleted = storage_service.delete_audio_file(filename)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recording {filename} not found or could not be removed."
        )

    # Clear audio_file_path from any visit matching this file
    visits = db.query(Visit).filter(Visit.audio_file_path.ilike(f"%{filename}%")).all()
    for v in visits:
        v.audio_file_path = None
        v.keep_recording = False

    audit = AuditLog(
        actor_id=current_doctor.id,
        actor_role="doctor",
        action="manual_delete_recording",
        resource="recording",
        resource_id=filename
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "filename": filename,
        "message": f"Recording {filename} securely deleted."
    }
