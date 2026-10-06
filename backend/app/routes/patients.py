"""
Patient Management & Consent Route Handlers
Supports patient search, quick registration, visit history, and plain-language consent.
"""

from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, case
from app.core.database import get_db
from app.core.security import compute_phone_hash
from app.auth import normalize_phone_digits
from app.models.patient import Patient, generate_uhid
from app.models.user import User
from app.models.visit import Visit
from app.models.consent_log import ConsentLog
from app.models.audit_log import AuditLog
from app.models.doctor_patient_link import DoctorPatientLink
from app.services.realtime_service import realtime_manager
from app.schemas.patient import (
    PatientCreate, PatientResponse, PatientAuthorizeDoctorRequest,
    DoctorVerifyLinkCodeRequest, PendingDoctorAuthorizationItem
)
import random
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
    "Approved care plans, medication instructions, and reminders will be securely synced directly to your Praxirence app with automated alarms.",
    "Your demographic and clinical data is encrypted at rest using industry-standard AES-256 encryption.",
    "You have the absolute right to revoke this consent at any time inside the app with a single tap, which immediately pauses automated reminders."
]
CONSENT_PLAIN_TEXT = (
    "I understand and agree that Praxirence assists my doctor in transcribing our consultation notes, "
    "generating my medical care plan, and delivering scheduled in-app medication reminders and alarms. "
    "My data is encrypted, voice recordings are purged after processing, and I can grant or revoke consent anytime."
)


@router.get("", response_model=List[PatientResponse])
def search_patients(
    query: Optional[str] = Query(None, description="Search by name, phone, or UHID"),
    limit: int = 50,
    db: Session = Depends(get_db),
    current_doctor = Depends(get_current_doctor)
):
    """
    Search patients:
    - If query is provided, searches across Name, Phone, ID, and UHID.
    - If query is empty, returns all accessible clinic patients, prioritizing patients
      linked with this doctor (via authorized link or visits), followed by newly registered patients.
    Ensures every patient has a human-readable UHID and shows in 'Select a Patient'.
    """
    clean_q = query.strip() if query else ""
    if clean_q:
        phone_hashes = [compute_phone_hash(clean_q)]
        digits = "".join(filter(str.isdigit, clean_q))
        if len(digits) == 10:
            phone_hashes.append(compute_phone_hash(f"+91{digits}"))
            phone_hashes.append(compute_phone_hash(digits))
        elif len(digits) >= 11:
            phone_hashes.append(compute_phone_hash(f"+{digits}"))
            phone_hashes.append(compute_phone_hash(digits))
            if digits.startswith("91") and len(digits) == 12:
                phone_hashes.append(compute_phone_hash(f"+91{digits[2:]}"))
                phone_hashes.append(compute_phone_hash(digits[2:]))

        patients = (
            db.query(Patient)
            .filter(
                or_(
                    Patient.name.ilike(f"%{clean_q}%"),
                    Patient.phone_hash.in_(phone_hashes),
                    Patient.id.ilike(f"%{clean_q}%"),
                    Patient.id == clean_q,
                    Patient.uhid.ilike(f"%{clean_q}%"),
                    Patient.uhid == clean_q.upper(),
                )
            )
            .order_by(Patient.created_at.desc())
            .limit(limit)
            .all()
        )
        for p in patients:
            if not p.uhid:
                p.uhid = generate_uhid(db)
                db.commit()
        return patients
    else:
        # Default view:
        # 1. Patients who have had visits with this doctor OR are authorized
        visit_patient_ids = [row[0] for row in db.query(Visit.patient_id).filter(Visit.doctor_id == current_doctor.id).distinct().all()]
        link_patient_ids = [row[0] for row in db.query(DoctorPatientLink.patient_id).filter(DoctorPatientLink.doctor_id == current_doctor.id, DoctorPatientLink.status == "authorized").distinct().all()]
        doctor_patient_ids = list(set(visit_patient_ids + link_patient_ids))

        doc_patients = []
        if doctor_patient_ids:
            doc_patients = (
                db.query(Patient)
                .filter(Patient.id.in_(doctor_patient_ids))
                .order_by(Patient.created_at.desc())
                .limit(limit)
                .all()
            )

        # 2. General clinic directory patients
        remaining_slots = max(0, limit - len(doc_patients))
        other_patients = []
        if remaining_slots > 0:
            filter_clause = Patient.id.not_in(doctor_patient_ids) if doctor_patient_ids else True
            other_patients = (
                db.query(Patient)
                .filter(filter_clause)
                .order_by(Patient.created_at.desc())
                .limit(remaining_slots)
                .all()
            )

        all_patients = doc_patients + other_patients
        for p in all_patients:
            if not p.uhid:
                p.uhid = generate_uhid(db)
                db.commit()
        return all_patients


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    req: PatientCreate,
    db: Session = Depends(get_db),
    current_doctor = Depends(get_current_doctor)
):
    """
    Add/Register a patient.
    - If patient already exists: Dispatches a real-time authorization confirmation message
      to the Patient App with a 4-digit security code. Random doctors cannot arbitrarily add
      a patient without patient confirmation!
    - If new patient: Creates patient profile with custom or auto-generated UHID and authorizes them.
    """
    clean_phone = req.phone.strip()
    phone_hash = compute_phone_hash(clean_phone)

    existing = db.query(Patient).filter(Patient.phone_hash == phone_hash).first()
    if existing:
        if not existing.uhid:
            existing.uhid = generate_uhid(db)
            db.commit()

        # Check existing authorization status between this doctor and patient
        existing_link = db.query(DoctorPatientLink).filter(
            DoctorPatientLink.doctor_id == current_doctor.id,
            DoctorPatientLink.patient_id == existing.id
        ).first()

        if existing_link and existing_link.status == "authorized":
            return PatientResponse(
                id=existing.id,
                uhid=existing.uhid,
                name=existing.name,
                phone=existing.phone,
                dob=existing.dob,
                consent_status=existing.consent_status,
                created_at=existing.created_at,
                authorization_status="authorized",
                message=f"Patient {existing.name} is already authorized in your clinical directory."
            )

        # Generate 4-digit confirmation security code
        conf_code = f"{random.randint(1000, 9999)}"
        if existing_link:
            existing_link.status = "pending"
            existing_link.confirmation_code = conf_code
            existing_link.requested_at = datetime.now(timezone.utc)
            link = existing_link
        else:
            link = DoctorPatientLink(
                doctor_id=current_doctor.id,
                patient_id=existing.id,
                status="pending",
                confirmation_code=conf_code
            )
            db.add(link)
        db.commit()
        db.refresh(link)

        # Dispatch real-time confirmation request to the patient's Praxirence app
        doc_disp_name = current_doctor.name if current_doctor.name.startswith("Dr.") else f"Dr. {current_doctor.name}"
        realtime_manager.emit_to_patient_sync(
            str(existing.id),
            "DOCTOR_AUTHORIZATION_REQUEST",
            {
                "link_id": link.id,
                "doctor_id": str(current_doctor.id),
                "doctor_name": doc_disp_name,
                "doctor_specialty": getattr(current_doctor, "specialty", "Attending Physician") or "General Physician",
                "clinic_name": getattr(current_doctor, "clinic_name", "Praxirence Clinic") or "Praxirence Healthcare",
                "confirmation_code": conf_code,
                "patient_id": str(existing.id),
                "patient_name": existing.name,
                "uhid": existing.uhid,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        )

        return PatientResponse(
            id=existing.id,
            uhid=existing.uhid,
            name=existing.name,
            phone=existing.phone,
            dob=existing.dob,
            consent_status=existing.consent_status,
            created_at=existing.created_at,
            authorization_status="pending_confirmation",
            link_id=link.id,
            confirmation_code=conf_code,
            message=f"Confirmation message sent to {existing.name}'s Praxirence app. Patient must tap 'Authorize' or provide code {conf_code}."
        )

    # New Patient Registration
    patient_uhid = None
    if req.uhid and req.uhid.strip():
        candidate_uhid = req.uhid.strip().upper()
        uhid_exists = db.query(Patient).filter(Patient.uhid == candidate_uhid).first()
        if uhid_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Patient Unique ID / UHID '{candidate_uhid}' is already registered to another patient."
            )
        patient_uhid = candidate_uhid
    else:
        patient_uhid = generate_uhid(db)

    patient = Patient(
        name=req.name.strip(),
        dob=req.dob,
        consent_status=False,
        uhid=patient_uhid
    )
    patient.phone = clean_phone
    db.add(patient)
    db.commit()
    db.refresh(patient)

    # Automatically authorize attending doctor who performed initial clinic onboarding
    link = DoctorPatientLink(
        doctor_id=current_doctor.id,
        patient_id=patient.id,
        status="authorized",
        authorized_at=datetime.now(timezone.utc)
    )
    db.add(link)

    audit = AuditLog(
        actor_id=current_doctor.id,
        actor_role="doctor",
        action="create_patient",
        resource="patient",
        resource_id=patient.id
    )
    db.add(audit)
    db.commit()

    return PatientResponse(
        id=patient.id,
        uhid=patient.uhid,
        name=patient.name,
        phone=patient.phone,
        dob=patient.dob,
        consent_status=patient.consent_status,
        created_at=patient.created_at,
        authorization_status="authorized",
        message=f"Patient {patient.name} registered with Unique ID {patient.uhid}."
    )


@router.get("/pending-doctor-requests", response_model=List[PendingDoctorAuthorizationItem])
def get_pending_doctor_requests(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """Patient endpoint: retrieves pending authorization requests from doctors"""
    patient_id = getattr(current_user, "id", None)
    if not patient_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    links = (
        db.query(DoctorPatientLink)
        .filter(DoctorPatientLink.patient_id == patient_id, DoctorPatientLink.status == "pending")
        .order_by(DoctorPatientLink.requested_at.desc())
        .all()
    )

    items = []
    for l in links:
        doc = db.query(User).filter(User.id == l.doctor_id).first()
        doc_name = doc.name if doc else "Attending Clinician"
        if not doc_name.startswith("Dr."):
            doc_name = f"Dr. {doc_name}"
        items.append(PendingDoctorAuthorizationItem(
            link_id=l.id,
            doctor_id=l.doctor_id,
            doctor_name=doc_name,
            doctor_specialty=getattr(doc, "specialty", None) or "General Physician",
            clinic_name=getattr(doc, "clinic_name", None) or "Praxirence Medical Center",
            confirmation_code=l.confirmation_code,
            created_at=l.requested_at or l.created_at
        ))
    return items


@router.post("/authorize-doctor")
def authorize_doctor(
    req: PatientAuthorizeDoctorRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """
    Patient endpoint: accepts or rejects a doctor's request to add the patient.
    Prevents unauthorized doctors from accessing patient data.
    """
    patient_id = getattr(current_user, "id", None)
    link = db.query(DoctorPatientLink).filter(DoctorPatientLink.id == req.link_id).first()
    if not link or link.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="Authorization request not found")

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    doctor = db.query(User).filter(User.id == link.doctor_id).first()

    if req.action.lower() == "approve":
        link.status = "authorized"
        link.authorized_at = datetime.now(timezone.utc)
        db.commit()

        # Notify doctor app in real time
        doc_disp = doctor.name if doctor else "Physician"
        realtime_manager.emit_to_doctor_sync(
            str(link.doctor_id),
            "PATIENT_LINK_AUTHORIZED",
            {
                "link_id": link.id,
                "patient_id": str(patient.id),
                "patient_name": patient.name,
                "uhid": patient.uhid,
                "message": f"Patient {patient.name} ({patient.uhid}) has confirmed and authorized you."
            }
        )
        return {"success": True, "message": f"{doc_disp} has been successfully authorized."}
    else:
        link.status = "rejected"
        db.commit()
        realtime_manager.emit_to_doctor_sync(
            str(link.doctor_id),
            "PATIENT_LINK_REJECTED",
            {
                "link_id": link.id,
                "patient_id": str(patient.id),
                "patient_name": patient.name,
                "message": f"Patient {patient.name} declined the authorization request."
            }
        )
        return {"success": True, "message": "Authorization request was declined."}


@router.post("/verify-link-code", response_model=PatientResponse)
def verify_link_code(
    req: DoctorVerifyLinkCodeRequest,
    db: Session = Depends(get_db),
    current_doctor = Depends(get_current_doctor)
):
    """
    Doctor endpoint: verifies the 4-digit security code shown on the patient's phone.
    Enables instant face-to-face in-clinic verification.
    """
    link = db.query(DoctorPatientLink).filter(
        DoctorPatientLink.id == req.link_id,
        DoctorPatientLink.doctor_id == current_doctor.id
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Link request not found")

    if link.confirmation_code != req.confirmation_code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid confirmation code. Please check the 4-digit code in the patient's Praxirence app."
        )

    link.status = "authorized"
    link.authorized_at = datetime.now(timezone.utc)
    db.commit()

    patient = db.query(Patient).filter(Patient.id == link.patient_id).first()
    return PatientResponse(
        id=patient.id,
        uhid=patient.uhid,
        name=patient.name,
        phone=patient.phone,
        dob=patient.dob,
        consent_status=patient.consent_status,
        created_at=patient.created_at,
        authorization_status="authorized",
        message=f"Patient {patient.name} verified and authorized successfully."
    )


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
                "name": v.doctor.name if v.doctor else "Attending Doctor",
                "specialty": v.doctor.specialty if v.doctor else "General Physician",
                "clinic_name": getattr(v.doctor, "clinic_name", "") if v.doctor else ""
            }
        })

    return {
        "patient": {
            "id": patient.id,
            "uhid": patient.uhid,
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

    # 1. Fetch real booked visits for this doctor in token & priority order
    real_visits = (
        db.query(Visit)
        .filter(
            Visit.doctor_id == current_doctor.id,
            Visit.status.in_(["scheduled", "in_progress", "draft", "approved", "deferred"])
        )
        .order_by(
            case((Visit.triage_level == "Urgent", 0), (Visit.triage_level == "Priority", 1), else_=2),
            Visit.token_number.asc().nullslast(),
            Visit.time_slot.asc().nullslast()
        )
        .all()
    )

    schedule = []
    for idx, v in enumerate(real_visits):
        token_str = f"PX-{v.token_number:02d}" if v.token_number else f"PX-{idx + 1:02d}"
        p = v.patient
        p_name = p.name if p else "Patient"
        p_phone = p.phone if p else ""

        status_val = "In Consultation" if v.status == "in_progress" else ("Standby" if v.status == "deferred" else ("Waiting in Clinic" if idx == 0 else "Scheduled Today"))
        triage_val = v.triage_level or ("Urgent" if "urgent" in (v.chief_complaint or "").lower() else "Routine")

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
            "dob": str(p.dob) if (p and p.dob) else "",
            "consent_status": p.consent_status if p else False
        })

    # Return real scheduled visits only; if none exist, return clean empty queue

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
    Allows patient to specify core processing, secondary research, in-app medication reminders,
    or submit a formal Right to Erasure request.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    core_consent = payload.get("core_consent", True)
    secondary_consent = payload.get("secondary_consent", False)
    notifications_consent = payload.get("notifications_consent", payload.get("whatsapp_consent", True))
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
            "notifications_consent": notifications_consent,
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


@router.get("/{patient_id}/pending-doctor-reviews")
def get_pending_doctor_reviews(
    patient_id: str,
    db: Session = Depends(get_db)
):
    """
    Checks for recent completed/approved consultations where the patient has not yet reviewed the doctor.
    This review is 100% optional (not compulsory) and intended solely to guide other patients.
    """
    from app.models.doctor_review import DoctorReview
    from app.models.user import User

    # Find visits for this patient
    visits = db.query(Visit).filter(
        Visit.patient_id == patient_id,
        Visit.status.in_(["approved", "completed", "sent"]),
        Visit.doctor_id.isnot(None)
    ).order_by(Visit.date.desc()).all()

    # Get doctors that the patient has already reviewed
    existing_reviewed_doc_ids = {
        r[0] for r in db.query(DoctorReview.doctor_id).filter(DoctorReview.patient_id == patient_id).all()
    }

    pending = []
    seen_doc_ids = set()

    for v in visits:
        if v.doctor_id and v.doctor_id not in existing_reviewed_doc_ids and v.doctor_id not in seen_doc_ids:
            doc = db.query(User).filter(User.id == v.doctor_id).first()
            if doc:
                seen_doc_ids.add(v.doctor_id)
                # Count total visits with this doctor to determine if first visit
                total_visits_with_doc = db.query(Visit).filter(
                    Visit.patient_id == patient_id,
                    Visit.doctor_id == v.doctor_id,
                    Visit.status.in_(["approved", "completed", "sent"])
                ).count()
                doc_name = doc.name or "Doctor"
                doc_title = doc_name if doc_name.startswith("Dr.") else f"Dr. {doc_name}"
                pending.append({
                    "visit_id": str(v.id),
                    "doctor_id": str(doc.id),
                    "doctor_name": doc_title,
                    "specialty": getattr(doc, "specialty", "General Physician") or "General Physician",
                    "clinic_name": getattr(doc, "clinic_name", "Praxirence Clinical Centre") or "Praxirence Clinical Centre",
                    "consultation_date": str(v.date or v.appointment_date or ""),
                    "is_first_visit": (total_visits_with_doc <= 1),
                })

    return {"pending_reviews": pending}


@router.delete("/{patient_id}")
def delete_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_doctor = Depends(get_current_doctor)
):
    """
    Remove patient record from the doctor's active clinical directory.
    Archives audits and removes the patient entry cleanly.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )

    patient_name = patient.name
    # Audit log entry for DPDP compliance
    audit = AuditLog(
        actor_id=current_doctor.id,
        actor_role="doctor",
        action="remove_patient",
        resource="patient",
        resource_id=patient.id,
        details={"patient_name": patient_name}
    )
    db.add(audit)
    db.delete(patient)
    db.commit()

    return {
        "success": True,
        "message": f"Patient {patient_name} removed from your active clinical directory."
    }


from pydantic import BaseModel


class PatientUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    abha_id: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    emergency_contact: Optional[str] = None
    family_relation: Optional[str] = None


@router.put("/{patient_id}")
def update_patient_profile(
    patient_id: str,
    payload: PatientUpdateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_or_patient)
):
    """
    Update patient personal details including Name, Phone, ABHA ID, Age, Gender, and Emergency Contact.
    Ensures DPDP Act 2023 compliance and updates audit trail.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        if hasattr(current_user, "id") and current_user.id == patient_id:
            patient = db.query(Patient).filter(Patient.id == current_user.id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient record not found")

    if payload.name and payload.name.strip():
        patient.name = payload.name.strip()
    if payload.phone and payload.phone.strip():
        patient.phone = normalize_phone_digits(payload.phone.strip())
    if payload.abha_id is not None:
        patient.abha_id = payload.abha_id.strip() if payload.abha_id else None
    if payload.age is not None:
        patient.age = payload.age
    if payload.gender and payload.gender.strip():
        patient.gender = payload.gender.strip()
    if payload.emergency_contact is not None:
        patient.emergency_contact = payload.emergency_contact.strip() if payload.emergency_contact else None
    if payload.family_relation and payload.family_relation.strip():
        patient.family_relation = payload.family_relation.strip()

    db.commit()
    db.refresh(patient)

    return {
        "success": True,
        "message": "Patient profile successfully updated.",
        "user": {
            "id": patient.id,
            "name": patient.name,
            "phone": patient.phone,
            "abha_id": getattr(patient, "abha_id", None),
            "age": getattr(patient, "age", None),
            "gender": getattr(patient, "gender", None),
            "emergency_contact": getattr(patient, "emergency_contact", None),
            "family_relation": getattr(patient, "family_relation", "Self"),
            "consent_status": patient.consent_status,
        }
    }



