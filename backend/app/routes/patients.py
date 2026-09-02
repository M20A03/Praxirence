"""
Patient Management & Consent Route Handlers
Supports patient search, quick registration, visit history, and plain-language consent.
"""

from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.core.security import compute_phone_hash
from app.models.patient import Patient
from app.models.visit import Visit
from app.models.consent_log import ConsentLog
from app.models.audit_log import AuditLog
from app.schemas.patient import PatientCreate, PatientResponse
from app.schemas.visit import VisitResponse
from app.schemas.consent import (
    ConsentUpdateRequest,
    ConsentDocumentResponse,
    ConsentActionResponse
)
from app.routes.deps import (
    get_current_doctor,
    get_current_user_or_patient
)

router = APIRouter(prefix="/patients", tags=["Patients"])

CONSENT_SUMMARY = "Praxirence Plain-Language Telehealth & Patient Consent Agreement"
CONSENT_BULLET_POINTS = [
    "Your consultation voice recording is converted into clinical notes using fine-tuned open-source clinical AI models.",
    "Voice recordings are permanently and automatically shredded from storage after transcription unless marked for legal retention.",
    "Approved care plans, medication instructions, and reminders will be securely delivered to your WhatsApp via Meta Cloud API.",
    "Your mobile phone number is encrypted at rest using industry-standard AES-256 encryption.",
    "You have the absolute right to revoke this consent at any time inside the app with a single tap, which immediately pauses automated reminders."
]
CONSENT_PLAIN_TEXT = (
    "I understand and agree that Praxirence assists my doctor in transcribing our consultation notes, "
    "generating my medical care plan, and delivering scheduled medication reminders via WhatsApp and push notifications. "
    "My data is encrypted, voice recordings are purged after processing, and I can grant or revoke consent anytime."
)


@router.get("", response_model=List[PatientResponse])
def search_patients(
    query: Optional[str] = Query(None, description="Search by name or exact phone"),
    db: Session = Depends(get_db),
    current_doctor = Depends(get_current_doctor)
):
    """Search existing patients by name or blind index phone hash"""
    q = db.query(Patient)
    if query:
        clean_q = query.strip()
        phone_hash = compute_phone_hash(clean_q)
        q = q.filter(
            or_(
                Patient.name.ilike(f"%{clean_q}%"),
                Patient.phone_hash == phone_hash
            )
        )
    patients = q.order_by(Patient.created_at.desc()).limit(50).all()
    return patients


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    req: PatientCreate,
    db: Session = Depends(get_db),
    current_doctor = Depends(get_current_doctor)
):
    """Create a new patient with minimal fields (name, phone, dob)"""
    clean_phone = req.phone.strip()
    phone_hash = compute_phone_hash(clean_phone)

    existing = db.query(Patient).filter(Patient.phone_hash == phone_hash).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Patient with phone {clean_phone} is already registered."
        )

    patient = Patient(
        name=req.name.strip(),
        dob=req.dob,
        consent_status=False
    )
    patient.phone = clean_phone
    db.add(patient)
    db.commit()
    db.refresh(patient)

    audit = AuditLog(
        actor_id=current_doctor.id,
        actor_role="doctor",
        action="create_patient",
        resource="patient",
        resource_id=patient.id
    )
    db.add(audit)
    db.commit()

    return patient


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """Get patient profile by ID"""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/{patient_id}/visits", response_model=List[VisitResponse])
def get_patient_visits(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """Get consultation visit history for a patient"""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    visits = db.query(Visit).filter(Visit.patient_id == patient_id).order_by(Visit.date.desc()).all()

    result = []
    for v in visits:
        result.append(VisitResponse(
            id=v.id,
            patient_id=v.patient_id,
            doctor_id=v.doctor_id,
            date=v.date,
            audio_file_path=v.audio_file_path,
            keep_recording=v.keep_recording,
            raw_transcription=v.raw_transcription,
            diagnosis=v.diagnosis,
            medicines=v.medicines or [],
            reminders=v.reminders or [],
            status=v.status,
            approved_at=v.approved_at,
            whatsapp_message_id=v.whatsapp_message_id,
            created_at=v.created_at,
            patient_name=patient.name,
            patient_phone=patient.phone,
            doctor_name=v.doctor.name if v.doctor else "Doctor"
        ))

    return result


@router.get("/{patient_id}/consent", response_model=ConsentDocumentResponse)
def get_consent_document(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """Retrieve the plain-language consent agreement document and current status"""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return ConsentDocumentResponse(
        title="Praxirence Plain-Language Patient Telehealth Consent",
        version="v2.0",
        summary=CONSENT_SUMMARY,
        bullet_points=CONSENT_BULLET_POINTS,
        plain_language_text=CONSENT_PLAIN_TEXT,
        consent_status=patient.consent_status,
        consent_updated_at=patient.consent_updated_at
    )


@router.post("/{patient_id}/consent", response_model=ConsentActionResponse)
def update_patient_consent(
    patient_id: str,
    req: ConsentUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """Update patient consent status (granted or revoked)"""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient.consent_status = req.consent_status
    patient.consent_updated_at = datetime.now(timezone.utc)

    action_str = "granted" if req.consent_status else "revoked"
    client_ip = request.client.host if request.client else None

    consent_log = ConsentLog(
        patient_id=patient.id,
        action=action_str,
        method="otp_signed" if req.otp_code else "app_signature",
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent", "")
    )
    db.add(consent_log)

    audit = AuditLog(
        actor_id=getattr(current_user, "id", patient_id),
        actor_role="patient" if hasattr(current_user, "consent_status") else "doctor",
        action=f"consent_{action_str}",
        resource="consent",
        resource_id=patient.id,
        ip_address=client_ip,
        details={"status": req.consent_status}
    )
    db.add(audit)
    db.commit()

    return ConsentActionResponse(
        patient_id=patient.id,
        consent_status=patient.consent_status,
        consent_updated_at=patient.consent_updated_at,
        message=f"Patient consent successfully {action_str}."
    )
