"""
Authentication and Authorization Module
Handles Unified Doctor and Patient WhatsApp/SMS OTP, Email/Password, KYC Registration, Directory Inspection, and JWT Tokens.
"""

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    compute_phone_hash,
    decode_access_token
)
from app.models.user import User
from app.models.patient import Patient, generate_uhid
from app.models.audit_log import AuditLog
from app.routes.deps import get_token_payload
from app.schemas.auth import (
    DoctorLoginRequest,
    DoctorOTPRequest,
    DoctorOTPVerifyRequest,
    DoctorRegisterRequest,
    DoctorGoogleAuthRequest,
    DoctorEmailOTPRequest,
    DoctorEmailOTPVerifyRequest,
    PatientOTPRequest,
    PatientOTPVerifyRequest,
    PatientRegisterRequest,
    PatientEmailOTPRequest,
    PatientEmailOTPVerifyRequest,
    CheckPhoneRequest,
    CheckPhoneResponse,
    DirectoryResponse,
    TokenResponse,
    StaffLoginRequest,
)
from app.services.email_service import (
    email_service,
    generate_email_otp,
    store_email_otp,
    verify_email_otp,
    get_stored_email_otp_name,
    check_otp_rate_limit,
    get_recent_email_otp
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger("praxirence.auth")


def normalize_phone_digits(phone: str) -> str:
    """Extract standard 10-digit or full country-coded phone digits"""
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        return f"+91{digits}"
    elif len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    elif digits.startswith("0") and len(digits) == 11:
        return f"+91{digits[1:]}"
    return f"+{digits}" if digits else phone.strip()


def get_phone_last10(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


@router.get("/directory", response_model=DirectoryResponse)
def get_auth_directory(db: Session = Depends(get_db)):
    """
    Returns registered doctor and patient directory for transparent review and quick-login.
    """
    try:
        doctors = db.query(User).all()

        today_iso = datetime.now().strftime("%Y-%m-%d")
        today_day = datetime.now().strftime("%a")

        doctor_list = []
        for d in doctors:
            phone_display = getattr(d, "phone", "") or ""
            avail_days = getattr(d, "available_days", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) or ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            unavail_dates = getattr(d, "unavailable_dates", []) or []
            is_avail = (today_day in avail_days) and (today_iso not in unavail_dates)

            doctor_list.append({
                "id": str(d.id),
                "name": d.name,
                "email": d.email,
                "phone": getattr(d, "phone", None),
                "degree": getattr(d, "degree", None),
                "qualifications": getattr(d, "qualifications", None),
                "designation": getattr(d, "designation", None),
                "experience_years": getattr(d, "experience_years", None),
                "languages": getattr(d, "languages", None) or ["English", "Hindi"],
                "specialty": getattr(d, "specialty", None),
                "clinic_name": getattr(d, "clinic_name", None),
                "reg_number": getattr(d, "reg_number", None),
                "city": getattr(d, "city", None),
                "state": getattr(d, "state", None),
                "pincode": getattr(d, "pincode", None),
                "clinic_address": getattr(d, "clinic_address", None),
                "latitude": getattr(d, "latitude", 12.9716) or 12.9716,
                "longitude": getattr(d, "longitude", 77.5946) or 77.5946,
                "available_days": avail_days,
                "working_hours_start": getattr(d, "working_hours_start", "09:00") or "09:00",
                "working_hours_end": getattr(d, "working_hours_end", "18:00") or "18:00",
                "slot_duration_mins": getattr(d, "slot_duration_mins", 30) or 30,
                "consultation_fee": getattr(d, "consultation_fee", 500) or 500,
                "is_available_today": is_avail,
                "role": "doctor"
            })

        # DPDP Act 2023 & Zero-Trust Patient Isolation:
        # Patient identities are protected health information (PHI) and must NEVER be
        # broadcasted in an open auth directory. Clinicians only access patients via authorized links.
        return DirectoryResponse(
            doctors=doctor_list,
            patients=[]
        )
    except Exception as e:
        logger.error(f"Error in /auth/directory: {e}", exc_info=True)
        return DirectoryResponse(
            doctors=[],
            patients=[]
        )


@router.get("/check-number", response_model=CheckPhoneResponse)
def check_phone_number(phone: str = Query(..., description="Phone number to check"), db: Session = Depends(get_db)):
    """
    Inspects whether a phone number is registered as a Doctor or a Patient.
    """
    clean = phone.strip()
    if not clean:
        return CheckPhoneResponse(
            registered=False,
            role=None,
            name=None,
            message="Please provide a valid phone number."
        )

    norm = normalize_phone_digits(clean)
    last10 = get_phone_last10(clean)

    # 1. Check if registered as Doctor
    doctor = None
    try:
        if last10:
            doctor = db.query(User).filter(User.phone.like(f"%{last10}%")).first()
        if not doctor and "@" in clean:
            doctor = db.query(User).filter(User.email == clean.lower()).first()
    except Exception as e:
        logger.warning(f"DB lookup notice in check_phone_number (doctor): {e}")
        try:
            db.rollback()
        except Exception:
            pass


    if doctor:
        specialty = getattr(doctor, "specialty", "General Physician") or "General Physician"
        return CheckPhoneResponse(
            registered=True,
            role="doctor",
            name=doctor.name,
            message=f"Verified Clinician: {doctor.name} ({specialty})"
        )

    # 2. Check if registered as Patient
    patient = None
    try:
        for candidate in [norm, clean, f"+91{last10}", last10]:
            h = compute_phone_hash(candidate)
            p = db.query(Patient).filter(Patient.phone_hash == h).first()
            if p:
                patient = p
                break
    except Exception as e:
        logger.warning(f"DB lookup notice in check_phone_number (patient): {e}")
        try:
            db.rollback()
        except Exception:
            pass


    if patient:
        return CheckPhoneResponse(
            registered=True,
            role="patient",
            name=patient.name,
            message=f"Registered Patient: {patient.name}"
        )

    return CheckPhoneResponse(
        registered=False,
        role=None,
        name=None,
        message="Number not found. You can create a new account."
    )


@router.post("/check-phone", response_model=CheckPhoneResponse)
def check_phone_number_post(req: CheckPhoneRequest, db: Session = Depends(get_db)):
    """
    POST alias for phone registration inspection.
    """
    return check_phone_number(phone=req.phone, db=db)


# ==================== DOCTOR AUTHENTICATION ====================

@router.post("/doctor/login", response_model=TokenResponse)
def login_doctor_password(req: DoctorLoginRequest, db: Session = Depends(get_db)):
    """Authenticate doctor via email & password and return JWT"""
    clean_email = req.email.lower().strip()
    user = None
    try:
        user = db.query(User).filter(User.email == clean_email).first()
    except Exception as e:
        logger.error(f"Error querying user {clean_email}: {e}", exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass

    if not user or not user.hashed_password or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    user_id = str(user.id)
    user_name = user.name
    user_specialty = getattr(user, "specialty", None)
    user_clinic = getattr(user, "clinic_name", None)
    user_reg = getattr(user, "reg_number", None)
    user_phone = getattr(user, "phone", None)

    token = create_access_token(
        subject=user_id,
        role="doctor",
        extra_claims={
            "name": user_name,
            "email": clean_email,
            "clinic_name": user_clinic,
            "reg_number": user_reg
        }
    )

    try:
        audit = AuditLog(
            actor_id=user_id,
            actor_role="doctor",
            action="doctor_login_password",
            resource="auth",
            resource_id=user_id
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Audit log write notice: {e}")
        try:
            db.rollback()
        except Exception:
            pass

    return TokenResponse(
        access_token=token,
        role="doctor",
        user={
            "id": user_id,
            "email": clean_email,
            "name": user_name,
            "phone": user_phone,
            "specialty": user_specialty,
            "degree": getattr(user, "degree", None),
            "qualifications": getattr(user, "qualifications", None),
            "experience_years": getattr(user, "experience_years", None),
            "languages": getattr(user, "languages", None),
            "designation": getattr(user, "designation", None),
            "clinic_name": user_clinic,
            "reg_number": user_reg,
            "clinic_address": getattr(user, "clinic_address", None),
            "city": getattr(user, "city", None),
            "state": getattr(user, "state", None),
        }
    )


@router.post("/doctor/google", response_model=TokenResponse)
def google_auth_doctor(req: DoctorGoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Authenticate or verify doctor using Google OAuth Verification.
    Provisions clinician account if first time.
    """
    clean_email = req.email.lower().strip() if req.email else None
    if not clean_email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    clean_name = req.name.strip() if req.name else None
    if not clean_name:
        raise HTTPException(status_code=400, detail="Doctor name is required.")
    if not clean_name.startswith("Dr."):
        clean_name = f"Dr. {clean_name}"

    doctor = None
    try:
        doctor = db.query(User).filter(User.email == clean_email).first()
        if not doctor:
            doctor = User(
                email=clean_email,
                hashed_password=get_password_hash(f"GoogleOAuthVerified_{req.google_id or 'verified'}"),
                name=clean_name,
                specialty=None,
                clinic_name=None,
                reg_number=None,
                phone=None
            )
            db.add(doctor)
            db.commit()
            db.refresh(doctor)
    except Exception as e:
        logger.warning(f"Google doctor DB notice: {e}")
        try:
            db.rollback()
        except Exception:
            pass

    if not doctor:
        raise HTTPException(status_code=500, detail="Failed to create or retrieve doctor profile. Please try again.")

    doc_id = str(doctor.id)
    doc_name = doctor.name or clean_name
    doc_specialty = getattr(doctor, "specialty", None) or ""
    doc_clinic = getattr(doctor, "clinic_name", None) or ""
    doc_reg = getattr(doctor, "reg_number", None) or ""
    doc_phone = getattr(doctor, "phone", None) or ""

    token = create_access_token(
        subject=doc_id,
        role="doctor",
        extra_claims={
            "name": doc_name,
            "email": clean_email,
            "clinic_name": doc_clinic,
            "reg_number": doc_reg,
            "auth_provider": "google"
        }
    )

    try:
        audit = AuditLog(
            actor_id=doc_id,
            actor_role="doctor",
            action="doctor_login_google",
            resource="auth",
            resource_id=doc_id
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Audit log write notice: {e}")
        try:
            db.rollback()
        except Exception:
            pass

    return TokenResponse(
        access_token=token,
        role="doctor",
        user={
            "id": doc_id,
            "email": clean_email,
            "name": doc_name,
            "phone": doc_phone,
            "specialty": doc_specialty,
            "clinic_name": doc_clinic,
            "reg_number": doc_reg,
        }
    )


@router.post("/doctor/email-otp/request")
def request_doctor_email_otp(req: DoctorEmailOTPRequest, background_tasks: BackgroundTasks):
    """
    Dispatches a branded 6-digit verification code to the doctor's institutional/Gmail address
    from noreply@praxirence.com with 10-minute expiry.
    """
    clean_email = req.email.lower().strip()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    if not check_otp_rate_limit(clean_email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification requests for this email. Please wait 10 minutes before requesting another code."
        )

    # Check if a code was already dispatched recently to prevent duplicate sends
    recent_code = get_recent_email_otp(clean_email, cooldown_seconds=15)
    if recent_code:
        return {
            "success": True,
            "email": clean_email,
            "message": f"Verification code sent to {clean_email}. Please check your inbox and spam folder (valid for 10 minutes)."
        }

    code = generate_email_otp()
    store_email_otp(clean_email, code, name=req.name, ttl_minutes=10)

    # Dispatch email asynchronously in background to ensure instant HTTP response (<50ms)
    background_tasks.add_task(
        email_service.send_doctor_verification_otp,
        recipient_email=clean_email,
        otp_code=code,
        recipient_name=req.name
    )

    return {
        "success": True,
        "email": clean_email,
        "message": f"Verification code sent to {clean_email}. Please check your inbox and spam folder (valid for 10 minutes)."
    }


@router.post("/doctor/email-otp/verify", response_model=TokenResponse)
def verify_doctor_email_otp(req: DoctorEmailOTPVerifyRequest, db: Session = Depends(get_db)):
    """
    Verifies the 6-digit email OTP and provisions or signs in the doctor account.
    """
    clean_email = req.email.lower().strip()
    clean_code = req.code.strip()

    stored_name = get_stored_email_otp_name(clean_email)

    valid = verify_email_otp(clean_email, clean_code)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code. Please request a new code."
        )

    # Determine doctor display name from user input (req.name or OTP request name)
    provided_name = (req.name.strip() if getattr(req, "name", None) and req.name.strip() else None) or (stored_name.strip() if stored_name and stored_name.strip() else None)
    if provided_name:
        effective_name = provided_name if provided_name.startswith("Dr.") else f"Dr. {provided_name}"
    else:
        effective_name = None

    # Find or provision doctor record
    doctor = None
    try:
        doctor = db.query(User).filter(User.email == clean_email).first()
        if not doctor:
            # Use provided name if available, otherwise fallback to clean email username
            if effective_name:
                doc_name = effective_name
            else:
                doc_name = ""
            doctor = User(
                email=clean_email,
                hashed_password=get_password_hash(f"EmailOTPVerified_{clean_email}"),
                name=doc_name,
                specialty=None,
                clinic_name=None,
                reg_number=None,
                degree=None,
                qualifications=None,
                designation=None,
                experience_years=None
            )
            db.add(doctor)
            db.commit()
            db.refresh(doctor)
        elif doctor and effective_name:
            # If doctor already exists in DB but was auto-assigned the email prefix as name, update to entered name
            email_user = clean_email.split("@")[0].replace(".", " ").lower()
            current_clean = (doctor.name or "").replace("Dr.", "").strip().lower()
            if not doctor.name or current_clean == email_user:
                doctor.name = effective_name
                db.commit()
                db.refresh(doctor)
    except Exception as e:
        logger.warning(f"Doctor lookup/creation notice: {e}")
        try:
            db.rollback()
        except Exception:
            pass

    if not doctor:
        doctor = db.query(User).filter(User.email == clean_email).first()
        if not doctor:
            raise HTTPException(status_code=500, detail="Failed to retrieve or provision doctor profile.")

    doc_id = str(doctor.id)
    doc_name = doctor.name or ""
    doc_specialty = getattr(doctor, "specialty", None)
    doc_clinic = getattr(doctor, "clinic_name", None)
    doc_reg = getattr(doctor, "reg_number", None)
    doc_phone = getattr(doctor, "phone", None)

    token = create_access_token(
        subject=doc_id,
        role="doctor",
        extra_claims={
            "name": doc_name,
            "email": clean_email,
            "clinic_name": doc_clinic,
            "reg_number": doc_reg,
            "auth_provider": "email_otp"
        }
    )

    try:
        audit = AuditLog(
            actor_id=doc_id,
            actor_role="doctor",
            action="doctor_login_email_otp",
            resource="auth",
            resource_id=doc_id
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Audit log write notice: {e}")

    return TokenResponse(
        access_token=token,
        role="doctor",
        user={
            "id": doc_id,
            "email": clean_email,
            "name": doc_name,
            "phone": doc_phone,
            "degree": getattr(doctor, "degree", None),
            "qualifications": getattr(doctor, "qualifications", None),
            "designation": getattr(doctor, "designation", None),
            "experience_years": getattr(doctor, "experience_years", None),
            "languages": getattr(doctor, "languages", None),
            "specialty": doc_specialty,
            "clinic_name": doc_clinic,
            "reg_number": doc_reg,
            "clinic_address": getattr(doctor, "clinic_address", None),
            "city": getattr(doctor, "city", None),
            "state": getattr(doctor, "state", None),
        }
    )


@router.post("/doctor/register", response_model=TokenResponse)
def register_doctor(req: DoctorRegisterRequest, db: Session = Depends(get_db)):
    """Register a new doctor account with clinical credentials"""
    clean_email = req.email.lower().strip()
    norm_phone = normalize_phone_digits(req.phone) if req.phone else None
    last10 = get_phone_last10(norm_phone) if norm_phone else None

    existing = None
    try:
        existing = db.query(User).filter(User.email == clean_email).first()
        if not existing and last10:
            existing = db.query(User).filter(User.phone.like(f"%{last10}%")).first()
    except Exception as e:
        logger.warning(f"DB lookup notice in register_doctor: {e}")
        try:
            db.rollback()
        except Exception:
            pass

    user = None
    if existing:
        # Seamlessly update doctor credentials and issue session
        existing.name = req.name.strip()
        if req.specialty:
            existing.specialty = req.specialty
        if req.clinic_name:
            existing.clinic_name = req.clinic_name
        if req.reg_number:
            existing.reg_number = req.reg_number
        if norm_phone:
            existing.phone = norm_phone
        try:
            db.commit()
            db.refresh(existing)
        except Exception:
            db.rollback()
        user = existing
    else:
        try:
            user = User(
                email=clean_email,
                phone=norm_phone,
                hashed_password=get_password_hash(req.password),
                name=req.name.strip(),
                specialty=req.specialty.strip() if req.specialty else None,
                clinic_name=req.clinic_name.strip() if req.clinic_name else None,
                reg_number=req.reg_number.strip() if req.reg_number else None,
                degree=getattr(req, "degree", None),
                qualifications=getattr(req, "qualifications", None),
                experience_years=getattr(req, "experience_years", None)
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        except Exception as e:
            logger.error(f"Error persisting new doctor {clean_email}: {e}", exc_info=True)
            try:
                db.rollback()
            except Exception:
                pass

    user_id = str(user.id) if user else str(uuid.uuid4())
    user_name = user.name if user else req.name.strip()
    user_clinic = getattr(user, "clinic_name", None) or (req.clinic_name.strip() if req.clinic_name else None)
    user_reg = getattr(user, "reg_number", None) or (req.reg_number.strip() if req.reg_number else None)
    user_specialty = getattr(user, "specialty", None) or (req.specialty.strip() if req.specialty else None)
    user_phone = getattr(user, "phone", None) or norm_phone

    token = create_access_token(
        subject=user_id,
        role="doctor",
        extra_claims={
            "name": user_name,
            "email": clean_email,
            "clinic_name": user_clinic,
            "reg_number": user_reg
        }
    )

    try:
        audit = AuditLog(
            actor_id=user_id,
            actor_role="doctor",
            action="doctor_registered",
            resource="auth",
            resource_id=user_id
        )
        db.add(audit)
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass

    return TokenResponse(
        access_token=token,
        role="doctor",
        user={
            "id": user_id,
            "email": clean_email,
            "name": user_name,
            "phone": user_phone,
            "specialty": user_specialty,
            "clinic_name": user_clinic,
            "reg_number": user_reg,
        }
    )


# ==================== SESSION VALIDATION ====================

@router.get("/me")
def get_me(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db)
):
    """
    Validates current bearer token and returns current role and user profile.
    Used on client mount to verify and hydrate session.
    """
    role = payload.get("role")
    sub_id = payload.get("sub")

    if role == "doctor":
        doctor = None
        try:
            doctor = db.query(User).filter(User.id == sub_id).first()
        except Exception as e:
            logger.warning(f"Error querying doctor {sub_id} in /me: {e}")
            try:
                db.rollback()
            except Exception:
                pass

        doc_id = str(doctor.id) if doctor else sub_id
        doc_name = doctor.name if doctor else payload.get("name")
        doc_email = doctor.email if doctor else payload.get("email")
        doc_phone = getattr(doctor, "phone", None) if doctor else None
        doc_specialty = getattr(doctor, "specialty", None) if doctor else payload.get("specialty")
        doc_clinic = getattr(doctor, "clinic_name", None) if doctor else payload.get("clinic_name")
        doc_reg = getattr(doctor, "reg_number", None) if doctor else payload.get("reg_number")

        return {
            "role": "doctor",
            "user": {
                "id": doc_id,
                "email": doc_email,
                "name": doc_name,
                "phone": doc_phone,
                "degree": getattr(doctor, "degree", None) if doctor else None,
                "qualifications": getattr(doctor, "qualifications", None) if doctor else None,
                "designation": getattr(doctor, "designation", None) if doctor else None,
                "experience_years": getattr(doctor, "experience_years", None) if doctor else None,
                "languages": getattr(doctor, "languages", None) if doctor else None,
                "specialty": doc_specialty,
                "clinic_name": doc_clinic,
                "reg_number": doc_reg,
                "clinic_address": getattr(doctor, "clinic_address", None) if doctor else None,
                "city": getattr(doctor, "city", None) if doctor else None,
                "state": getattr(doctor, "state", None) if doctor else None,
            }
        }
    elif role == "patient":
        patient = None
        try:
            patient = db.query(Patient).filter(Patient.id == sub_id).first()
        except Exception as e:
            logger.warning(f"Error querying patient {sub_id} in /me: {e}")
            try:
                db.rollback()
            except Exception:
                pass

        if not patient and payload.get("phone"):
            clean_phone = payload.get("phone")
            last10 = get_phone_last10(clean_phone)
            for candidate in [clean_phone, f"+91{last10}", last10]:
                h = compute_phone_hash(candidate)
                try:
                    p = db.query(Patient).filter(Patient.phone_hash == h).first()
                    if p:
                        patient = p
                        break
                except Exception:
                    pass

        pat_id = str(patient.id) if patient else (sub_id or "")
        pat_name = patient.name if patient else payload.get("name", "Patient")
        pat_phone = patient.phone if patient else payload.get("phone", "")
        pat_consent = patient.consent_status if patient else False

        return {
            "role": "patient",
            "user": {
                "id": pat_id,
                "uhid": getattr(patient, "uhid", None) if patient else None,
                "name": pat_name,
                "phone": pat_phone,
                "consent_status": pat_consent,
                "consent_updated_at": patient.consent_updated_at.isoformat() if (patient and patient.consent_updated_at) else None
            }
        }

    raise HTTPException(status_code=401, detail="Unknown or invalid role")


# ==================== PATIENT AUTHENTICATION ====================

@router.post("/patient/email-otp/request")
def request_patient_email_otp(req: PatientEmailOTPRequest, background_tasks: BackgroundTasks):
    """
    Dispatches a branded 6-digit verification code to the patient's email address
    from noreply@praxirence.com with 10-minute expiry.
    """
    clean_email = req.email.lower().strip()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    if not check_otp_rate_limit(clean_email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification requests for this email. Please wait 10 minutes before requesting another code."
        )

    # Check if a code was already dispatched recently to prevent duplicate sends
    recent_code = get_recent_email_otp(clean_email, cooldown_seconds=15)
    if recent_code:
        return {
            "success": True,
            "email": clean_email,
            "message": f"Verification code sent to {clean_email}. Please check your inbox and spam folder (valid for 10 minutes)."
        }

    code = generate_email_otp()
    store_email_otp(clean_email, code, name=req.name, ttl_minutes=10)

    # Dispatch email asynchronously in background to ensure instant HTTP response (<50ms)
    background_tasks.add_task(
        email_service.send_patient_verification_otp,
        recipient_email=clean_email,
        otp_code=code,
        recipient_name=req.name
    )

    return {
        "success": True,
        "email": clean_email,
        "message": f"Verification code sent to {clean_email}. Please check your inbox and spam folder (valid for 10 minutes)."
    }


@router.post("/patient/email-otp/verify", response_model=TokenResponse)
def verify_patient_email_otp(req: PatientEmailOTPVerifyRequest, db: Session = Depends(get_db)):
    """
    Verifies the 6-digit email OTP and provisions or signs in the patient account.
    """
    clean_email = req.email.lower().strip()
    clean_code = req.code.strip()

    stored_name = get_stored_email_otp_name(clean_email)

    valid = verify_email_otp(clean_email, clean_code)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code. Please request a new code."
        )

    # Find or provision patient record
    email_hash = compute_phone_hash(clean_email)
    effective_name = (req.name.strip() if getattr(req, "name", None) and req.name.strip() else None) or (stored_name.strip() if stored_name and stored_name.strip() else "")
    patient = None
    try:
        if hasattr(Patient, "email"):
            patient = db.query(Patient).filter(Patient.email == clean_email).first()
        if not patient:
            patient = db.query(Patient).filter(Patient.phone_hash == email_hash).first()
        if not patient:
            patient = Patient(
                name=effective_name,
                email=clean_email,
                consent_status=False,
                uhid=generate_uhid(db)
            )
            patient.phone = f"email_{clean_email}"
            db.add(patient)
            db.commit()
            db.refresh(patient)
        else:
            changed = False
            if hasattr(patient, "email") and not getattr(patient, "email", None):
                patient.email = clean_email
                changed = True
            if stored_name and patient.name != stored_name:
                patient.name = stored_name
                changed = True
            if changed:
                db.commit()
                db.refresh(patient)
    except Exception as e:
        logger.warning(f"Patient lookup/creation notice: {e}")
        try:
            db.rollback()
        except Exception:
            pass

    if not patient:
        if hasattr(Patient, "email"):
            patient = db.query(Patient).filter(Patient.email == clean_email).first()
        if not patient:
            patient = db.query(Patient).filter(Patient.phone_hash == email_hash).first()
        if not patient:
            raise HTTPException(status_code=500, detail="Failed to retrieve or provision patient profile.")

    pat_id = str(patient.id)
    pat_name = patient.name or ""

    token = create_access_token(
        subject=pat_id,
        role="patient",
        extra_claims={
            "name": pat_name,
            "email": clean_email,
            "auth_provider": "email_otp"
        }
    )

    try:
        audit = AuditLog(
            actor_id=pat_id,
            actor_role="patient",
            action="patient_login_email_otp",
            resource="auth",
            resource_id=pat_id
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Audit log write notice: {e}")

    return TokenResponse(
        access_token=token,
        role="patient",
        user={
            "id": pat_id,
                "uhid": getattr(patient, "uhid", None) if patient else None,
            "name": pat_name,
            "phone": patient.phone if (patient.phone and not patient.phone.startswith("email_") and "@" not in patient.phone) else "",
            "email": clean_email,
            "abha_id": getattr(patient, "abha_id", None),
            "age": getattr(patient, "age", None),
            "gender": getattr(patient, "gender", None),
            "emergency_contact": getattr(patient, "emergency_contact", None),
            "consent_status": patient.consent_status,
            "consent_updated_at": patient.consent_updated_at.isoformat() if patient.consent_updated_at else None
        }
    )


@router.post("/patient/register", response_model=TokenResponse)
def register_patient(req: PatientRegisterRequest, db: Session = Depends(get_db)):
    """
    Directly register a new patient account with name, phone, dob, and gender.
    """
    clean_phone = req.phone.strip()
    if not clean_phone:
        raise HTTPException(status_code=400, detail="Phone number is required")

    norm = normalize_phone_digits(clean_phone)
    last10 = get_phone_last10(clean_phone)

    # Check if patient already exists
    for candidate in [norm, clean_phone, f"+91{last10}", last10]:
        h = compute_phone_hash(candidate)
        existing = db.query(Patient).filter(Patient.phone_hash == h).first()
        if existing:
            # Update name if provided
            existing.name = req.name.strip()
            db.commit()
            db.refresh(existing)
            token = create_access_token(subject=existing.id, role="patient", extra_claims={"name": existing.name})
            return TokenResponse(
                access_token=token,
                role="patient",
                user={
                    "id": existing.id,
                    "uhid": getattr(existing, "uhid", None),
                    "name": existing.name,
                    "phone": existing.phone,
                    "consent_status": existing.consent_status,
                    "consent_updated_at": existing.consent_updated_at.isoformat() if existing.consent_updated_at else None
                }
            )

    dob_val = None
    if req.dob:
        try:
            dob_val = datetime.strptime(req.dob, "%Y-%m-%d").date()
        except Exception:
            pass

    patient = Patient(
        name=req.name.strip(),
        consent_status=False,
        dob=dob_val,
        uhid=generate_uhid(db)
    )
    patient.phone = norm
    db.add(patient)
    db.commit()
    db.refresh(patient)

    token = create_access_token(
        subject=patient.id,
        role="patient",
        extra_claims={"name": patient.name, "phone": patient.phone}
    )

    return TokenResponse(
        access_token=token,
        role="patient",
        user={
            "id": patient.id,
            "uhid": getattr(patient, "uhid", None),
            "name": patient.name,
            "phone": patient.phone,
            "consent_status": patient.consent_status,
            "consent_updated_at": None
        }
    )


# ==================== SESSION VALIDATION ====================

@router.get("/me")
def get_me(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db)
):
    """
    Validates current bearer token and returns current role and user profile.
    Used on client mount to verify and hydrate session.
    """
    role = payload.get("role")
    sub_id = payload.get("sub")

    if role == "doctor":
        doctor = db.query(User).filter(User.id == sub_id).first()
        if not doctor:
            raise HTTPException(status_code=401, detail="Doctor session expired or user removed")
        return {
            "role": "doctor",
            "user": {
                "id": str(doctor.id),
                "email": doctor.email,
                "name": doctor.name,
                "phone": doctor.phone,
                "degree": getattr(doctor, "degree", None),
                "qualifications": getattr(doctor, "qualifications", None),
                "designation": getattr(doctor, "designation", None),
                "experience_years": getattr(doctor, "experience_years", None),
                "languages": getattr(doctor, "languages", None),
                "specialty": doctor.specialty,
                "clinic_name": getattr(doctor, "clinic_name", None),
                "reg_number": getattr(doctor, "reg_number", None),
                "clinic_address": getattr(doctor, "clinic_address", None),
                "city": getattr(doctor, "city", None),
                "state": getattr(doctor, "state", None),
            }
        }
    elif role == "patient":
        patient = db.query(Patient).filter(Patient.id == sub_id).first()
        if not patient:
            raise HTTPException(status_code=401, detail="Patient session expired or profile not found")
        return {
            "role": "patient",
            "user": {
                "id": patient.id,
            "uhid": getattr(patient, "uhid", None),
                "name": patient.name,
                "phone": patient.phone,
                "consent_status": patient.consent_status,
                "consent_updated_at": patient.consent_updated_at.isoformat() if patient.consent_updated_at else None
            }
        }

    raise HTTPException(status_code=401, detail="Unknown or invalid role")



@router.post("/logout")
def logout_user(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db)
):
    """
    Terminates the active session and immediately blacklists the JWT token.
    """
    from app.services.token_blacklist import token_blacklist
    raw_token = payload.get("_raw_token")
    exp = payload.get("exp")
    if raw_token:
        token_blacklist.blacklist_token(raw_token, expiry_timestamp=float(exp) if exp else None)

    sub_id = payload.get("sub")
    role = payload.get("role")
    audit = AuditLog(
        actor_id=str(sub_id),
        actor_role=str(role),
        action="user_logout",
        resource="auth_session",
        details={"status": "revoked"}
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": "Session terminated and token revoked successfully."}

_staff_pin_failed_attempts: dict[str, list[float]] = {}

@router.post("/staff/login", response_model=TokenResponse)
def staff_login(req: StaffLoginRequest, db: Session = Depends(get_db)):
    """
    Dedicated Receptionist / Front-Desk Staff Authentication.
    Validates staff PIN against the attending doctor's clinic configuration.
    Enforces brute-force lockout (max 5 failed attempts per 15 min window)
    and strictly validates doctor role without arbitrary fallbacks.
    """
    raw_ident = req.doctor_identifier.strip()
    clean_digits = "".join(filter(str.isdigit, raw_ident))
    last10 = clean_digits[-10:] if len(clean_digits) >= 10 else clean_digits

    doctor = None
    if "@" in raw_ident:
        doctor = db.query(User).filter(User.email.ilike(raw_ident)).first()
    if not doctor and last10 and len(last10) >= 10:
        doctor = db.query(User).filter(User.phone.like(f"%{last10}%")).first()
    if not doctor:
        doctor = db.query(User).filter(User.id == raw_ident).first()
    if not doctor and len(raw_ident) >= 3:
        doctor = db.query(User).filter(User.reg_number.ilike(raw_ident)).first()

    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active doctor clinic found matching identifier '{raw_ident}'."
        )

    # 1. Rate-Limiting & Anti-Brute Force Protection
    now = time.time()
    doctor_key = str(doctor.id)
    recent_failures = [t for t in _staff_pin_failed_attempts.get(doctor_key, []) if now - t < 900.0]
    _staff_pin_failed_attempts[doctor_key] = recent_failures

    if len(recent_failures) >= 5:
        remaining_lockout = int(900 - (now - recent_failures[0]))
        remaining_mins = max(1, (remaining_lockout + 59) // 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many incorrect PIN attempts. Front-desk login locked for {remaining_mins} min to protect clinic security. Please ask Dr. {doctor.name} to verify or update the Clinic PIN in their app."
        )

    # 2. Verify Doctor has enabled Clinic PIN
    expected_pin = getattr(doctor, "staff_pin", None)
    if not expected_pin or not str(expected_pin).strip():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Front-desk login has not been enabled by the doctor. The attending doctor must set a Clinic PIN in their app profile first."
        )

    # 3. Verify Staff PIN (Must be 6 digits)
    provided_pin = req.staff_pin.strip()
    if len(provided_pin) != 6 or not provided_pin.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Staff PIN must be a 6-digit numeric code."
        )
    if provided_pin != str(expected_pin).strip():
        recent_failures.append(now)
        _staff_pin_failed_attempts[doctor_key] = recent_failures
        attempts_left = max(0, 5 - len(recent_failures))

        try:
            audit = AuditLog(
                actor_id=str(doctor.id),
                actor_role="anonymous_staff",
                action="staff_login_failed",
                resource="front_desk",
                details={"doctor_id": str(doctor.id), "attempts_left": attempts_left}
            )
            db.add(audit)
            db.commit()
        except Exception:
            db.rollback()

        if attempts_left == 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Incorrect Staff PIN. 5 failed attempts reached: front-desk login is now locked for 15 minutes."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Incorrect Staff PIN. {attempts_left} attempt(s) remaining before 15-minute security lockout."
            )

    # Correct PIN authenticated: clear failed attempts
    _staff_pin_failed_attempts.pop(doctor_key, None)

    token = create_access_token(
        subject=str(doctor.id),
        role="receptionist",
        extra_claims={
            "doctor_id": str(doctor.id),
            "doctor_name": doctor.name,
            "clinic_name": getattr(doctor, "clinic_name", None) or "Praxirence Clinical Centre",
            "specialty": getattr(doctor, "specialty", None) or "General Physician",
            "role": "receptionist"
        }
    )

    try:
        audit = AuditLog(
            actor_id=str(doctor.id),
            actor_role="receptionist",
            action="staff_login",
            resource="front_desk",
            resource_id=str(doctor.id)
        )
        db.add(audit)
        db.commit()
    except Exception:
        db.rollback()

    return TokenResponse(
        access_token=token,
        role="receptionist",
        user={
            "id": f"staff-{str(doctor.id)[:8]}",
            "doctor_id": str(doctor.id),
            "doctor_name": doctor.name,
            "clinic_name": getattr(doctor, "clinic_name", None) or "Praxirence Clinical Centre",
            "specialty": getattr(doctor, "specialty", None) or "General Physician",
            "consultation_fee": getattr(doctor, "consultation_fee", 500) or 500,
            "role": "receptionist"
        }
    )

