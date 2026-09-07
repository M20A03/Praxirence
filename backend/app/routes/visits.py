"""
Visits Route Handlers
Handles speech-to-text with Whisper LoRA, care plan extraction with Mistral QLoRA,
doctor editing, approval, and background WhatsApp delivery via Celery.
"""

import logging
import json
from datetime import datetime, timezone
from typing import Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.visit import Visit
from app.models.patient import Patient
from app.models.audit_log import AuditLog
from app.schemas.visit import (
    VisitCreate,
    VisitResponse,
    VisitUpdate,
    VisitApproveResponse,
    ConsultationSummarizeRequest,
    ConsultationSummarizeResponse,
    MedicineItem,
    ReminderItem
)
from app.services.storage_service import storage_service
from app.services.ai_service import ai_service
from ml.inference import model_loader
from app.tasks import send_whatsapp_care_plan_celery, purge_voice_recording_celery, dispatch_task
from app.routes.deps import get_current_doctor, get_current_user_or_patient

router = APIRouter(prefix="/visits", tags=["Visits & Consultations"])
logger = logging.getLogger("praxirence.routes.visits")


def serialize_transcription_and_summary(
    raw_transcription: Optional[str],
    patient_summary: Optional[str] = None,
    doctor_advice: Optional[str] = None
) -> str:
    payload = {
        "raw": raw_transcription or "",
        "patient_summary": patient_summary or "",
        "doctor_advice": doctor_advice or ""
    }
    return json.dumps(payload)


def parse_transcription_and_summary(raw_field: Optional[str]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    if not raw_field:
        return None, None, None
    try:
        data = json.loads(raw_field)
        if isinstance(data, dict) and ("patient_summary" in data or "raw" in data):
            return data.get("raw"), data.get("patient_summary"), data.get("doctor_advice")
    except Exception:
        pass
    return raw_field, raw_field, None


@router.post("/summarize", response_model=ConsultationSummarizeResponse)
def summarize_consultation(
    req: ConsultationSummarizeRequest,
    current_doctor = Depends(get_current_doctor)
):
    """
    Summarize doctor-patient conversation into a clear, plain-language
    explanation for the patient alongside structured medical care plan.
    """
    doc_name = req.doctor_name or (current_doctor.name if current_doctor else "Doctor")
    pat_name = req.patient_name or "Patient"

    result = ai_service.summarize_consultation_for_patient(
        conversation=req.conversation,
        patient_name=pat_name,
        doctor_name=doc_name
    )

    return ConsultationSummarizeResponse(
        patient_summary=result["patient_summary"],
        doctor_advice=result.get("doctor_advice", ""),
        warning_signs=result.get("warning_signs", []),
        diagnosis=result.get("diagnosis", "Clinical Consultation"),
        medicines=[MedicineItem(**m) for m in result.get("medicines", [])],
        reminders=[ReminderItem(**r) for r in result.get("reminders", [])],
        follow_up_days=result.get("follow_up_days", 5)
    )


@router.post("", response_model=VisitResponse)
def create_structured_visit(
    req: VisitCreate,
    db: Session = Depends(get_db),
    current_doctor = Depends(get_current_doctor)
):
    """
    Directly creates a consultation visit with structured care plan
    from doctor mobile app or web interface.
    """
    patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    stored_transcription = serialize_transcription_and_summary(
        raw_transcription=req.raw_transcription or f"Consultation with Dr. {current_doctor.name}",
        patient_summary=req.patient_summary,
        doctor_advice=req.doctor_advice
    )

    visit = Visit(
        patient_id=patient.id,
        doctor_id=current_doctor.id,
        diagnosis=req.diagnosis,
        medicines=[m.model_dump() for m in req.medicines],
        reminders=[r.model_dump() for r in req.reminders],
        raw_transcription=stored_transcription,
        status="draft"
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)

    audit = AuditLog(
        actor_id=current_doctor.id,
        actor_role="doctor",
        action="create_structured_visit",
        resource="visit",
        resource_id=visit.id,
        details={"medicines_count": len(req.medicines)}
    )
    db.add(audit)
    db.commit()

    raw_text, pat_summary, doc_advice = parse_transcription_and_summary(visit.raw_transcription)

    return VisitResponse(
        id=visit.id,
        patient_id=visit.patient_id,
        doctor_id=visit.doctor_id,
        date=visit.date,
        audio_file_path=visit.audio_file_path,
        keep_recording=visit.keep_recording,
        raw_transcription=raw_text,
        patient_summary=pat_summary,
        doctor_advice=doc_advice,
        diagnosis=visit.diagnosis,
        medicines=visit.medicines or [],
        reminders=visit.reminders or [],
        status=visit.status,
        approved_at=visit.approved_at,
        whatsapp_message_id=visit.whatsapp_message_id,
        created_at=visit.created_at,
        patient_name=patient.name,
        patient_phone=patient.phone,
        doctor_name=current_doctor.name
    )


@router.post("/upload-audio", response_model=VisitResponse)

async def upload_consultation_audio(
    patient_id: str = Form(...),
    keep_recording: bool = Form(False),
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_doctor = Depends(get_current_doctor)
):
    """
    1. Accepts doctor's voice recording (MP3/WAV/WebM).
    2. Transcribes dialogue with fine-tuned Whisper LoRA model.
    3. Extracts structured Care Plan (Diagnosis, Medicines, Reminders) with fine-tuned Mistral/Llama QLoRA.
    4. Automatically deletes audio unless keep_recording is True.
    5. Returns draft visit for doctor editing in < 1 second.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    saved_path, filename = await storage_service.save_upload_audio(audio_file)

    try:
        # Step 1: Transcribe with Whisper model loader
        transcription = model_loader.transcribe(saved_path)

        # Step 2: Extract Care Plan with 7B LLM / Resilient Clinical Parser
        care_plan = model_loader.extract_care_plan(transcription)
        summarized = ai_service.summarize_consultation_for_patient(
            conversation=transcription,
            patient_name=patient.name,
            doctor_name=current_doctor.name
        )

        # Step 3: Zero-Audio-Retention & Clinical Privacy Enforcement
        # We permanently erase the voice recording immediately after transcription
        # Only the transcribed text, care plan, diagnosis, and patient summary are retained
        try:
            storage_service.delete_audio_file(saved_path)
            logger.info(f"Zero-Audio-Retention: Audio file {filename} permanently erased from disk after transcription.")
        except Exception as e:
            logger.warning(f"Audio cleanup warning for {filename}: {e}")

        stored_path = None
        retained_recording = False

        stored_transcription = serialize_transcription_and_summary(
            raw_transcription=transcription,
            patient_summary=summarized.get("patient_summary"),
            doctor_advice=summarized.get("doctor_advice")
        )

        # Create draft visit
        visit = Visit(
            patient_id=patient.id,
            doctor_id=current_doctor.id,
            audio_file_path=stored_path,
            keep_recording=retained_recording,
            raw_transcription=stored_transcription,
            diagnosis=care_plan.get("diagnosis", "Clinical Assessment"),
            medicines=care_plan.get("medicines", []),
            reminders=care_plan.get("reminders", []),
            status="draft"
        )
        db.add(visit)
        db.commit()
        db.refresh(visit)

        audit = AuditLog(
            actor_id=current_doctor.id,
            actor_role="doctor",
            action="upload_audio_ai_extract",
            resource="visit",
            resource_id=visit.id,
            details={
                "medicines_count": len(care_plan.get("medicines", [])),
                "audio_purged": not keep_recording
            }
        )
        db.add(audit)
        db.commit()

        raw_text, pat_summary, doc_advice = parse_transcription_and_summary(visit.raw_transcription)

        return VisitResponse(
            id=visit.id,
            patient_id=visit.patient_id,
            doctor_id=visit.doctor_id,
            date=visit.date,
            audio_file_path=visit.audio_file_path,
            keep_recording=visit.keep_recording,
            raw_transcription=raw_text,
            patient_summary=pat_summary,
            doctor_advice=doc_advice,
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
        if not keep_recording and saved_path:
            storage_service.delete_audio_file(saved_path)
        logger.error(f"Error processing consultation audio: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Consultation audio processing failed: {str(e)}"
        )


@router.get("/{visit_id}", response_model=VisitResponse)
def get_visit(
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

    raw_text, pat_summary, doc_advice = parse_transcription_and_summary(visit.raw_transcription)

    return VisitResponse(
        id=visit.id,
        patient_id=visit.patient_id,
        doctor_id=visit.doctor_id,
        date=visit.date,
        audio_file_path=visit.audio_file_path,
        keep_recording=visit.keep_recording,
        raw_transcription=raw_text,
        patient_summary=pat_summary,
        doctor_advice=doc_advice,
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
    """Doctor modifies AI-generated diagnosis, medicines, or reminders"""
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
    if req.patient_summary is not None or req.doctor_advice is not None:
        raw_text, old_summary, old_advice = parse_transcription_and_summary(visit.raw_transcription)
        visit.raw_transcription = serialize_transcription_and_summary(
            raw_transcription=raw_text,
            patient_summary=req.patient_summary if req.patient_summary is not None else old_summary,
            doctor_advice=req.doctor_advice if req.doctor_advice is not None else old_advice
        )

    db.commit()
    db.refresh(visit)

    patient = db.query(Patient).filter(Patient.id == visit.patient_id).first()

    audit = AuditLog(
        actor_id=current_doctor.id,
        actor_role="doctor",
        action="update_visit_care_plan",
        resource="visit",
        resource_id=visit.id
    )
    db.add(audit)
    db.commit()

    raw_text, pat_summary, doc_advice = parse_transcription_and_summary(visit.raw_transcription)

    return VisitResponse(
        id=visit.id,
        patient_id=visit.patient_id,
        doctor_id=visit.doctor_id,
        date=visit.date,
        audio_file_path=visit.audio_file_path,
        keep_recording=visit.keep_recording,
        raw_transcription=raw_text,
        patient_summary=pat_summary,
        doctor_advice=doc_advice,
        diagnosis=visit.diagnosis,
        medicines=visit.medicines or [],
        reminders=visit.reminders or [],
        status=visit.status,
        approved_at=visit.approved_at,
        whatsapp_message_id=visit.whatsapp_message_id,
        created_at=visit.created_at,
        patient_name=patient.name if patient else "Unknown",
        patient_phone=patient.phone if patient else "",
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
    - Dispatches Meta WhatsApp Cloud API delivery via Celery background worker.
    """
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    visit.status = "approved"
    visit.approved_at = datetime.now(timezone.utc)
    db.commit()

    # Trigger Celery background task for Meta WhatsApp Cloud API
    dispatch_task(send_whatsapp_care_plan_celery, visit_id=visit.id)

    audit = AuditLog(
        actor_id=current_doctor.id,
        actor_role="doctor",
        action="approve_care_plan_meta_whatsapp",
        resource="visit",
        resource_id=visit.id
    )
    db.add(audit)
    db.commit()

    raw_text, pat_summary, doc_advice = parse_transcription_and_summary(visit.raw_transcription)

    return VisitApproveResponse(
        visit_id=visit.id,
        status="approved",
        whatsapp_status="dispatched_via_meta_cloud_api",
        scheduled_reminders_count=len(visit.reminders or []),
        message="Care plan & consultation summary approved. Dispatched to patient via Meta WhatsApp Cloud API.",
        patient_summary=pat_summary
    )
