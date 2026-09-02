import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.visit import Visit
from app.models.patient import Patient
from app.models.audit_log import AuditLog
from app.schemas.visit import (
    VisitResponse,
    VisitUpdate,
    VisitApproveResponse
)
from app.services.storage_service import storage_service
from app.services.ai_service import ai_service
from app.workers.queue import enqueue_task
from app.workers.tasks import send_whatsapp_care_plan_task, schedule_visit_reminders_task
from app.api.deps import get_current_doctor, get_current_user_or_patient

router = APIRouter(prefix="/visits", tags=["Visits & Consultations"])
logger = logging.getLogger("praxirence.api.visits")


@router.post("/upload-audio", response_model=VisitResponse)
async def upload_consultation_audio(
    patient_id: str = Form(...),
    keep_recording: bool = Form(False),
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_doctor = Depends(get_current_doctor)
):
    """
    1. Uploads consultation voice recording (MP3/WAV).
    2. Transcribes speech using OpenAI Whisper.
    3. Extracts structured Care Plan (Diagnosis, Medicines, Reminders) using GPT-4.
    4. Automatically deletes audio unless keep_recording is True.
    5. Returns draft visit for doctor editing and review.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Save audio temporarily
    saved_path, filename = await storage_service.save_upload_audio(audio_file)

    try:
        # Step 1: Whisper transcription
        logger.info(f"Transcribing audio from {saved_path}...")
        transcription = ai_service.transcribe_audio(saved_path)

        # Step 2: GPT-4 structured clinical extraction
        logger.info("Extracting structured care plan with GPT-4...")
        care_plan = ai_service.generate_care_plan(transcription)

        # Step 3: Handle voice recording deletion policy
        stored_path = None
        if keep_recording:
            stored_path = saved_path
            logger.info(f"Audio file retained for medical records: {saved_path}")
        else:
            storage_service.delete_audio_file(saved_path)
            logger.info("Audio file automatically purged after successful AI extraction.")

        # Create draft visit in database
        visit = Visit(
            patient_id=patient.id,
            doctor_id=current_doctor.id,
            audio_file_path=stored_path,
            keep_recording=keep_recording,
            raw_transcription=transcription,
            diagnosis=care_plan.diagnosis,
            medicines=[m.model_dump() for m in care_plan.medicines],
            reminders=[r.model_dump() for r in care_plan.reminders],
            status="draft"
        )
        db.add(visit)
        db.commit()
        db.refresh(visit)

        # Audit log
        audit = AuditLog(
            actor_id=current_doctor.id,
            actor_role="doctor",
            action="upload_audio_extract_care_plan",
            resource="visit",
            resource_id=visit.id,
            details={
                "medicines_count": len(care_plan.medicines),
                "reminders_count": len(care_plan.reminders),
                "audio_deleted": not keep_recording
            }
        )
        db.add(audit)
        db.commit()

        return VisitResponse(
            id=visit.id,
            patient_id=visit.patient_id,
            doctor_id=visit.doctor_id,
            date=visit.date,
            audio_file_path=visit.audio_file_path,
            keep_recording=visit.keep_recording,
            raw_transcription=visit.raw_transcription,
            diagnosis=visit.diagnosis,
            medicines=visit.medicines,
            reminders=visit.reminders,
            status=visit.status,
            approved_at=visit.approved_at,
            whatsapp_message_id=visit.whatsapp_message_id,
            created_at=visit.created_at,
            patient_name=patient.name,
            patient_phone=patient.phone,
            doctor_name=current_doctor.name
        )

    except Exception as e:
        # Cleanup audio on error if still exists
        if not keep_recording and saved_path:
            storage_service.delete_audio_file(saved_path)
        logger.error(f"Failed to process consultation recording: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Audio processing and AI care plan extraction failed: {str(e)}"
        )


@router.get("/{visit_id}", response_model=VisitResponse)
def get_visit_details(
    visit_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """Retrieve visit details and care plan"""
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    patient = db.query(Patient).filter(Patient.id == visit.patient_id).first()
    patient_name = patient.name if patient else "Unknown"
    patient_phone = patient.phone if patient else ""
    doctor_name = visit.doctor.name if visit.doctor else "Doctor"

    return VisitResponse(
        id=visit.id,
        patient_id=visit.patient_id,
        doctor_id=visit.doctor_id,
        date=visit.date,
        audio_file_path=visit.audio_file_path,
        keep_recording=visit.keep_recording,
        raw_transcription=visit.raw_transcription,
        diagnosis=visit.diagnosis,
        medicines=visit.medicines or [],
        reminders=visit.reminders or [],
        status=visit.status,
        approved_at=visit.approved_at,
        whatsapp_message_id=visit.whatsapp_message_id,
        created_at=visit.created_at,
        patient_name=patient_name,
        patient_phone=patient_phone,
        doctor_name=doctor_name
    )


@router.put("/{visit_id}", response_model=VisitResponse)
def update_visit(
    visit_id: str,
    req: VisitUpdate,
    db: Session = Depends(get_db),
    current_doctor = Depends(get_current_doctor)
):
    """
    Doctor updates diagnosis, medicines, or reminders before approving.
    """
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    if req.diagnosis is not None:
        visit.diagnosis = req.diagnosis
    if req.medicines is not None:
        visit.medicines = [m.model_dump() for m in req.medicines]
    if req.reminders is not None:
        visit.reminders = [r.model_dump() for r in req.reminders]
    if req.keep_recording is not None:
        visit.keep_recording = req.keep_recording

    db.commit()
    db.refresh(visit)

    patient = db.query(Patient).filter(Patient.id == visit.patient_id).first()
    patient_name = patient.name if patient else "Unknown"
    patient_phone = patient.phone if patient else ""

    # Audit log
    audit = AuditLog(
        actor_id=current_doctor.id,
        actor_role="doctor",
        action="update_visit_care_plan",
        resource="visit",
        resource_id=visit.id
    )
    db.add(audit)
    db.commit()

    return VisitResponse(
        id=visit.id,
        patient_id=visit.patient_id,
        doctor_id=visit.doctor_id,
        date=visit.date,
        audio_file_path=visit.audio_file_path,
        keep_recording=visit.keep_recording,
        raw_transcription=visit.raw_transcription,
        diagnosis=visit.diagnosis,
        medicines=visit.medicines or [],
        reminders=visit.reminders or [],
        status=visit.status,
        approved_at=visit.approved_at,
        whatsapp_message_id=visit.whatsapp_message_id,
        created_at=visit.created_at,
        patient_name=patient_name,
        patient_phone=patient_phone,
        doctor_name=current_doctor.name
    )


@router.post("/{visit_id}/approve", response_model=VisitApproveResponse)
def approve_and_send_care_plan(
    visit_id: str,
    db: Session = Depends(get_db),
    current_doctor = Depends(get_current_doctor)
):
    """
    Doctor approves the care plan.
    - Sets visit status to 'approved'.
    - Dispatches WhatsApp delivery via background worker.
    - Schedules patient medication reminders via background worker.
    """
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    visit.status = "approved"
    visit.approved_at = datetime.now(timezone.utc)
    db.commit()

    # Enqueue background task to send formatted WhatsApp message
    enqueue_task("praxirence_whatsapp", send_whatsapp_care_plan_task, visit_id=visit.id)

    # Enqueue background task to schedule reminders
    reminders_count = len(visit.reminders or [])
    if reminders_count > 0:
        enqueue_task("praxirence_reminders", schedule_visit_reminders_task, visit_id=visit.id)

    # Audit log
    audit = AuditLog(
        actor_id=current_doctor.id,
        actor_role="doctor",
        action="approve_care_plan",
        resource="visit",
        resource_id=visit.id,
        details={"reminders_count": reminders_count}
    )
    db.add(audit)
    db.commit()

    return VisitApproveResponse(
        visit_id=visit.id,
        status="approved",
        whatsapp_status="queued",
        scheduled_reminders_count=reminders_count,
        message="Care plan approved successfully. WhatsApp delivery and medication reminders enqueued."
    )
