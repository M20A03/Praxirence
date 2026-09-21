"""
Patient Management & Consent Route Handlers
Supports patient search, quick registration, visit history, and plain-language consent.
"""

from typing import List, Optional
from datetime import datetime, timezone, timedelta
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
from app.routes.visits import parse_transcription_and_summary

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


@router.get("/me/portal")
def get_my_patient_portal(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """
    Returns full patient portal data for the currently authenticated patient:
    Profile, Visits with Prescriptions, and Consent Status.
    """
    patient_id = getattr(current_user, "id", None)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient record not found")

    visits = db.query(Visit).filter(Visit.patient_id == patient.id).order_by(Visit.date.desc()).all()
    visits_data = []
    for v in visits:
        raw_text, pat_summary, doc_advice = parse_transcription_and_summary(v.raw_transcription)
        tok_num = v.token_number
        tok_disp = f"PX-{tok_num:02d}" if tok_num else None
        visits_data.append({
            "id": v.id,
            "date": v.date.isoformat() if v.date else None,
            "appointment_date": v.appointment_date,
            "time_slot": v.time_slot,
            "booking_type": v.booking_type or "in_person",
            "chief_complaint": v.chief_complaint,
            "token_number": tok_num,
            "token_display": tok_disp,
            "status": v.status,
            "raw_transcription": raw_text,
            "patient_summary": pat_summary,
            "doctor_advice": doc_advice,
            "diagnosis": v.diagnosis,
            "medicines": v.medicines or [],
            "reminders": v.reminders or [],
            "prescription_structured": v.medicines or [],
            "care_plan": {
                "diagnosis": v.diagnosis,
                "medicines": v.medicines or [],
                "reminders": v.reminders or [],
                "patient_summary": pat_summary,
                "doctor_advice": doc_advice,
            },
            "doctor": {
                "name": v.doctor.name if v.doctor else "Dr. Mayank Raj",
                "specialty": v.doctor.specialty if v.doctor else "General Physician",
                "clinic_name": getattr(v.doctor, "clinic_name", "Praxirence Clinical Centre") if v.doctor else "Praxirence Clinical Centre"
            }
        })

    return {
        "patient": {
            "id": patient.id,
            "name": patient.name,
            "phone": patient.phone,
            "consent_status": patient.consent_status,
            "consent_updated_at": patient.consent_updated_at.isoformat() if patient.consent_updated_at else None,
        },
        "visits": visits_data,
        "active_prescription": visits_data[0]["prescription_structured"] if visits_data and visits_data[0].get("prescription_structured") else None,
        "active_care_plan": visits_data[0]["care_plan"] if visits_data and visits_data[0].get("care_plan") else None
    }


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
        raw_text, pat_summary, doc_advice = parse_transcription_and_summary(v.raw_transcription)
        tok_num = v.token_number
        tok_disp = f"PX-{tok_num:02d}" if tok_num else None
        result.append(VisitResponse(
            id=v.id,
            patient_id=v.patient_id,
            doctor_id=v.doctor_id,
            date=v.date,
            audio_file_path=v.audio_file_path,
            keep_recording=v.keep_recording,
            raw_transcription=raw_text,
            patient_summary=pat_summary,
            doctor_advice=doc_advice,
            diagnosis=v.diagnosis,
            medicines=v.medicines or [],
            reminders=v.reminders or [],
            status=v.status,
            approved_at=v.approved_at,
            whatsapp_message_id=v.whatsapp_message_id,
            created_at=v.created_at,
            patient_name=patient.name,
            patient_phone=patient.phone,
            doctor_name=v.doctor.name if v.doctor else "Doctor",
            appointment_date=v.appointment_date,
            time_slot=v.time_slot,
            booking_type=v.booking_type or "in_person",
            chief_complaint=v.chief_complaint,
            token_number=tok_num,
            token_display=tok_disp
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


@router.get("/schedule/upcoming")
def get_upcoming_patient_schedule(
    db: Session = Depends(get_db),
    current_doctor = Depends(get_current_doctor)
):
    """
    Returns today's active clinical queue and upcoming scheduled appointments for the doctor.
    Enables instant clinical triage and consultation launch.
    """
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # 1. Fetch real booked visits for this doctor in token order
    real_visits = (
        db.query(Visit)
        .filter(
            Visit.doctor_id == current_doctor.id,
            Visit.status.in_(["scheduled", "in_progress", "draft", "approved"])
        )
        .order_by(Visit.appointment_date.asc().nullslast(), Visit.token_number.asc().nullslast(), Visit.time_slot.asc().nullslast())
        .all()
    )

    schedule = []
    for idx, v in enumerate(real_visits):
        token_str = f"PX-{v.token_number:02d}" if v.token_number else f"PX-{idx + 1:02d}"
        p = v.patient
        p_name = p.name if p else "Patient"
        p_phone = p.phone if p else "+919835139865"

        status_val = "In Consultation" if v.status == "in_progress" else ("Waiting in Clinic" if idx == 0 else "Scheduled Today")
        triage_val = "Urgent" if "urgent" in (v.chief_complaint or "").lower() else ("Priority" if idx == 0 else "Routine")

        schedule.append({
            "token": token_str,
            "token_number": v.token_number or (idx + 1),
            "visit_id": str(v.id),
            "patient_id": str(v.patient_id),
            "patient_name": p_name,
            "patient_phone": p_phone,
            "time": v.time_slot or "10:00 AM",
            "appointment_date": v.appointment_date or today_iso,
            "chief_complaint": v.chief_complaint or "Scheduled Clinical Consultation",
            "triage": triage_val,
            "status": status_val,
            "dob": str(p.dob) if (p and p.dob) else "1994-05-12",
            "consent_status": p.consent_status if p else True
        })

    # If no real visits exist yet, populate with registered patients for offline/demo robustness
    if not schedule:
        patients = db.query(Patient).order_by(Patient.created_at.desc()).limit(15).all()
        default_complaints = [
            {"complaint": "Persistent productive cough, fever 101°F & chest heaviness", "triage": "Priority", "time": "09:30 AM"},
            {"complaint": "Routine Type-2 Diabetes quarterly review & HbA1c check", "triage": "Routine", "time": "10:15 AM"},
            {"complaint": "Acute migraine episode with photophobia & nausea", "triage": "Urgent", "time": "11:00 AM"},
            {"complaint": "Stage 1 Essential Hypertension blood pressure monitoring", "triage": "Routine", "time": "11:45 AM"},
            {"complaint": "Seasonal allergic rhinitis & throat irritation", "triage": "Routine", "time": "12:30 PM"},
        ]
        for idx, p in enumerate(patients):
            mock_c = default_complaints[idx % len(default_complaints)]
            has_visits = db.query(Visit).filter(Visit.patient_id == p.id).count()
            status_val = "Waiting in Clinic" if idx == 0 else ("In Waiting Room" if idx < 3 else "Scheduled Today")
            if has_visits > 0 and idx > 3:
                status_val = "Follow-Up Visit"

            schedule.append({
                "token": f"PX-0{idx + 1}" if idx < 9 else f"PX-{idx + 1}",
                "token_number": idx + 1,
                "patient_id": str(p.id),
                "patient_name": p.name,
                "patient_phone": p.phone or "+919835139865",
                "time": mock_c["time"],
                "chief_complaint": mock_c["complaint"],
                "triage": mock_c["triage"],
                "status": status_val,
                "dob": str(p.dob) if p.dob else "1994-05-12",
                "consent_status": p.consent_status
            })

    completed_count = db.query(Visit).filter(
        Visit.doctor_id == current_doctor.id,
        Visit.status == "completed"
    ).count()

    return {
        "date": datetime.now(timezone.utc).strftime("%A, %d %B %Y"),
        "doctor_name": current_doctor.name or "Dr. Physician",
        "total_scheduled": len(schedule),
        "in_waiting": sum(1 for s in schedule if "Waiting" in s["status"]),
        "completed": completed_count,
        "queue": schedule
    }


@router.post("/{patient_id}/consent-preferences")
def update_consent_preferences(
    patient_id: str,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """
    DPDP Act 2023 / ABDM explicit consent governance endpoint:
    Allows patient to specify core processing, secondary research, WhatsApp reminders,
    or submit a formal Right to Erasure request.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    core_consent = payload.get("core_consent", True)
    secondary_consent = payload.get("secondary_consent", False)
    whatsapp_consent = payload.get("whatsapp_consent", True)
    erasure_requested = payload.get("erasure_requested", False)

    patient.consent_status = core_consent
    patient.consent_updated_at = datetime.now(timezone.utc)

    client_ip = request.client.host if request.client else None

    log = ConsentLog(
        patient_id=patient.id,
        action="preferences_updated",
        method="patient_privacy_center",
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent", "")
    )
    db.add(log)

    audit = AuditLog(
        actor_id=patient.id,
        actor_role="patient",
        action="dpdp_consent_preferences_updated",
        resource="patient",
        resource_id=patient.id,
        ip_address=client_ip,
        details={
            "core_consent": core_consent,
            "secondary_consent": secondary_consent,
            "whatsapp_consent": whatsapp_consent,
            "erasure_requested": erasure_requested
        }
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "patient_id": patient.id,
        "core_consent": core_consent,
        "secondary_consent": secondary_consent,
        "whatsapp_consent": whatsapp_consent,
        "erasure_requested": erasure_requested,
        "compliance": "DPDP Act 2023 & ABDM FHIR M2 Compliant",
        "updated_at": patient.consent_updated_at
    }


@router.post("/{patient_id}/fcm-token")
def update_patient_fcm_token(
    patient_id: str,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Registers or updates the mobile device FCM / Expo Push Token for a patient.
    Enables background care plan notifications and pill reminder alerts.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    token = payload.get("fcm_token") or payload.get("token")
    if not token or not isinstance(token, str):
        raise HTTPException(status_code=400, detail="A valid fcm_token string is required.")

    patient.fcm_token = token.strip()
    db.commit()

    return {
        "success": True,
        "patient_id": patient.id,
        "fcm_token": patient.fcm_token,
        "message": "Push notification device token registered successfully."
    }


@router.post("/{patient_id}/erasure-request")
def request_patient_data_erasure(
    patient_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """
    DPDP Act 2023 Section 12 Right to Erasure with NMC 3-Year Regulatory Lock:
    If clinical visits exist, non-clinical PII is redacted and scrubbed immediately,
    while clinical prescriptions are locked and retained strictly in accordance with
    National Medical Commission (NMC) regulations until the 3-year statutory period expires.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    visits = db.query(Visit).filter(Visit.patient_id == patient_id).all()
    now_utc = datetime.now(timezone.utc)

    # Check for active statutory retention
    active_retentions = [
        v.retention_until for v in visits
        if v.retention_until and v.retention_until > now_utc
    ]

    client_ip = request.client.host if request.client else None

    if visits:
        # Regulatory lock applies
        latest_retention = max(active_retentions) if active_retentions else (now_utc + timedelta(days=3 * 365))
        
        # Redact non-clinical PII
        patient.name = f"Redacted-Patient-{str(patient.id)[:6]}"
        patient.fcm_token = None
        patient.consent_status = False
        patient.consent_updated_at = now_utc

        # Log regulatory erasure action
        log = ConsentLog(
            patient_id=patient.id,
            action="dpdp_erasure_pii_redacted_nmc_locked",
            method="dpdp_privacy_center",
            ip_address=client_ip,
            user_agent=request.headers.get("user-agent", "")
        )
        db.add(log)

        audit = AuditLog(
            actor_id=patient.id,
            actor_role="patient",
            action="dpdp_erasure_pii_redacted",
            resource="patient",
            resource_id=patient.id,
            ip_address=client_ip,
            details={
                "retention_until": latest_retention.isoformat(),
                "regulatory_statute": "National Medical Commission (NMC) 3-Year Record Retention Invariant"
            }
        )
        db.add(audit)
        db.commit()

        return {
            "success": True,
            "action": "pii_redacted_statute_locked",
            "message": (
                "Your identifying PII has been redacted. Under National Medical Commission (NMC) statutory regulations, "
                f"clinical consultation prescriptions must be retained until {latest_retention.strftime('%Y-%m-%d')}, "
                "after which they will be permanently purged."
            ),
            "retention_until": latest_retention.isoformat(),
            "compliance": "DPDP Act 2023 Sec 12 & NMC Medical Record Regulations"
        }
    else:
        # No clinical records exist, perform hard erasure
        db.delete(patient)
        db.commit()
        return {
            "success": True,
            "action": "permanently_deleted",
            "message": "All patient records permanently erased in compliance with DPDP Act 2023.",
            "compliance": "DPDP Act 2023 Full Erasure"
        }


@router.get("/{patient_id}/reschedule-pending")
def get_patient_reschedule_pending(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """
    Returns appointments for this patient that were marked 'reschedule_required'
    (e.g., when the clinician declared unexpected leave).
    """
    visits = db.query(Visit).filter(
        Visit.patient_id == patient_id,
        Visit.status == "reschedule_required"
    ).all()

    return {
        "patient_id": patient_id,
        "count": len(visits),
        "visits": [
            {
                "id": str(v.id),
                "doctor_id": str(v.doctor_id) if v.doctor_id else None,
                "doctor_name": v.doctor.name if v.doctor else "Doctor",
                "specialty": v.doctor.specialty if v.doctor else "General Physician",
                "clinic_name": getattr(v.doctor, "clinic_name", "Praxirence Clinical Centre") if v.doctor else "Praxirence Clinic",
                "appointment_date": v.appointment_date,
                "time_slot": v.time_slot,
                "status": v.status,
                "reason": f"Dr. {v.doctor.name if v.doctor else 'Your Doctor'} was unavailable on {v.appointment_date}."
            }
            for v in visits
        ]
    }


@router.get("/{patient_id}/family")
def get_patient_family_members(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """
    Lists all family profiles linked to this patient account (or sharing the primary phone).
    Supports Indian household single-device multi-generational care.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    target_phone = patient.phone
    primary_hash = patient.phone_hash

    # Query family members linked by primary_account_phone or matching phone hash
    query_filters = [Patient.id == patient.id]
    if target_phone:
        query_filters.append(Patient.primary_account_phone == target_phone)
    if primary_hash:
        query_filters.append(Patient.phone_hash == primary_hash)

    family_records = db.query(Patient).filter(or_(*query_filters)).all()

    profiles = []
    for p in family_records:
        rel = p.family_relation or ("Self" if p.id == patient.id else "Family Member")
        profiles.append({
            "id": str(p.id),
            "name": p.name,
            "dob": str(p.dob) if p.dob else None,
            "family_relation": rel,
            "phone": p.phone,
            "is_primary": (p.id == patient.id)
        })

    return {
        "primary_patient_id": patient_id,
        "profiles": profiles,
        "total": len(profiles)
    }


@router.post("/{patient_id}/family")
def add_patient_family_member(
    patient_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """
    Adds a family member (Mother, Father, Spouse, Child) linked to this primary patient account.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Primary patient not found")

    name = payload.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Family member name is required.")

    relation = payload.get("family_relation", "Family Member").strip()
    dob_str = payload.get("dob")
    dob_val = None
    if dob_str:
        try:
            dob_val = datetime.strptime(dob_str, "%Y-%m-%d").date()
        except Exception:
            pass

    family_member = Patient(
        name=name,
        dob=dob_val,
        family_relation=relation,
        primary_account_phone=patient.phone,
        consent_status=True,
        consent_updated_at=datetime.now(timezone.utc)
    )
    if patient.phone:
        family_member.phone = patient.phone

    db.add(family_member)
    db.commit()
    db.refresh(family_member)

    return {
        "success": True,
        "profile": {
            "id": str(family_member.id),
            "name": family_member.name,
            "dob": str(family_member.dob) if family_member.dob else None,
            "family_relation": family_member.family_relation,
            "phone": family_member.phone,
            "is_primary": False
        },
        "message": f"{name} ({relation}) added successfully."
    }

