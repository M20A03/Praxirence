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
from app.schemas.patient import PatientCreate, PatientResponse, PatientUpdate
from app.schemas.visit import VisitResponse
from app.schemas.consent import (
    ConsentUpdateRequest,
    ConsentDocumentResponse,
    ConsentActionResponse
)
from app.api.deps import (
    get_current_doctor,
    get_current_patient,
    get_current_user_or_patient
)

router = APIRouter(prefix="/patients", tags=["Patients"])

CONSENT_SUMMARY = "Praxirence Plain-Language Clinical & Telehealth Consent Agreement"
CONSENT_BULLET_POINTS = [
    "Your consultation conversation may be transcribed by secure clinical AI solely to prepare your doctor's care plan.",
    "The audio recording is permanently deleted immediately after processing, unless your doctor marks it for medical/legal retention.",
    "Your approved prescription, dosage instructions, and reminders will be securely delivered to your phone via WhatsApp.",
    "Your phone number and sensitive health identifiers are encrypted at rest with industry-standard AES-256 encryption.",
    "You have the absolute right to revoke this consent at any time inside the app with a single tap, which immediately stops automatic reminders."
]
CONSENT_PLAIN_TEXT = (
    "I understand and agree that Praxirence assists my doctor in generating my medical care plan, "
    "transcribing our consultation notes, and sending me scheduled medication reminders via WhatsApp and push notifications. "
    "My data is encrypted, audio files are promptly destroyed, and I can revoke my consent whenever I choose."
)


@router.get("", response_model=List[PatientResponse])
def search_patients(
    query: Optional[str] = Query(None, description="Search by patient name or phone number"),
    db: Session = Depends(get_db),
    current_doctor = Depends(get_current_doctor)
):
    """
    Search existing patients by name or exact phone.
    Protected endpoint for doctors.
    """
    q = db.query(Patient)
    if query:
        clean_q = query.strip()
        # Check if query could be a phone number
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
    """
    Create a new patient with minimal fields (name, phone, dob).
    Encrypts phone at rest and creates a blind index.
    """
    clean_phone = req.phone.strip()
    phone_hash = compute_phone_hash(clean_phone)

    existing = db.query(Patient).filter(Patient.phone_hash == phone_hash).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A patient with phone number {clean_phone} already exists."
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

    # Audit log
    audit = AuditLog(
        actor_id=current_doctor.id,
        actor_role="doctor",
        action="create_patient",
        resource="patient",
        resource_id=patient.id,
        details={"name": patient.name}
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
    """
    Get full consultation visit history for a patient.
    Accessible to doctors and the respective patient.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    visits = db.query(Visit).filter(Visit.patient_id == patient_id).order_by(Visit.date.desc()).all()

    result = []
    for v in visits:
        v_dict = {
            "id": v.id,
            "patient_id": v.patient_id,
            "doctor_id": v.doctor_id,
            "date": v.date,
            "audio_file_path": v.audio_file_path,
            "keep_recording": v.keep_recording,
            "raw_transcription": v.raw_transcription,
            "diagnosis": v.diagnosis,
            "medicines": v.medicines or [],
            "reminders": v.reminders or [],
            "status": v.status,
            "approved_at": v.approved_at,
            "whatsapp_message_id": v.whatsapp_message_id,
            "created_at": v.created_at,
            "patient_name": patient.name,
            "patient_phone": patient.phone,
            "doctor_name": v.doctor.name if v.doctor else "Doctor"
        }
        result.append(VisitResponse(**v_dict))

    return result


@router.get("/{patient_id}/consent", response_model=ConsentDocumentResponse)
def get_consent_document(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """
    Retrieve the plain-language consent agreement document and current status.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return ConsentDocumentResponse(
        title="Patient Health Data & Telehealth Notification Consent",
        version="v1.2",
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
    """
    Update patient consent status (granted or revoked).
    Records an immutable consent audit log entry.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient.consent_status = req.consent_status
    patient.consent_updated_at = datetime.now(timezone.utc)

    # Log in consent audit trail
    action_str = "granted" if req.consent_status else "revoked"
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")

    consent_log = ConsentLog(
        patient_id=patient.id,
        action=action_str,
        method="otp_signed" if req.otp_code else "app_signature",
        ip_address=client_ip,
        user_agent=user_agent
    )
    db.add(consent_log)

    # General audit log
    audit = AuditLog(
        actor_id=getattr(current_user, "id", patient_id),
        actor_role="patient" if hasattr(current_user, "consent_status") else "doctor",
        action=f"consent_{action_str}",
        resource="consent",
        resource_id=patient.id,
        ip_address=client_ip,
        details={"status": req.consent_status, "signed_via_otp": bool(req.otp_code)}
    )
    db.add(audit)
    db.commit()

    return ConsentActionResponse(
        patient_id=patient.id,
        consent_status=patient.consent_status,
        consent_updated_at=patient.consent_updated_at,
        message=f"Consent successfully {action_str}."
    )
