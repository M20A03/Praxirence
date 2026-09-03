"""
Authentication and Authorization Module
Handles Doctor Email/Password Auth, Fast2SMS Patient OTP, and JWT Tokens.
"""

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
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
from app.models.patient import Patient
from app.models.audit_log import AuditLog
from app.schemas.auth import (
    DoctorLoginRequest,
    DoctorRegisterRequest,
    PatientOTPRequest,
    PatientOTPVerifyRequest,
    TokenResponse,
)
from app.services.fast2sms_service import fast2sms_service

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger("praxirence.auth")


@router.post("/doctor/login", response_model=TokenResponse)
def login_doctor(req: DoctorLoginRequest, db: Session = Depends(get_db)):
    """Authenticate doctor via email & password and return JWT"""
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    token = create_access_token(
        subject=user.id,
        role="doctor",
        extra_claims={"name": user.name, "email": user.email}
    )

    audit = AuditLog(
        actor_id=user.id,
        actor_role="doctor",
        action="doctor_login",
        resource="auth",
        resource_id=user.id
    )
    db.add(audit)
    db.commit()

    return TokenResponse(
        access_token=token,
        role="doctor",
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "specialty": user.specialty,
        }
    )


@router.post("/doctor/register", response_model=TokenResponse)
def register_doctor(req: DoctorRegisterRequest, db: Session = Depends(get_db)):
    """Register a new doctor account"""
    existing = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    user = User(
        email=req.email.lower().strip(),
        hashed_password=get_password_hash(req.password),
        name=req.name,
        specialty=req.specialty or "General Physician"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        subject=user.id,
        role="doctor",
        extra_claims={"name": user.name, "email": user.email}
    )

    return TokenResponse(
        access_token=token,
        role="doctor",
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "specialty": user.specialty,
        }
    )


@router.post("/otp/request")
async def request_patient_otp(req: PatientOTPRequest, db: Session = Depends(get_db)):
    """
    Patient requests OTP for passwordless login via Fast2SMS.
    Auto-provisions patient record if first time.
    """
    clean_phone = req.phone.strip()
    if not clean_phone:
        raise HTTPException(status_code=400, detail="Phone number is required")

    phone_hash = compute_phone_hash(clean_phone)
    patient = db.query(Patient).filter(Patient.phone_hash == phone_hash).first()

    if not patient:
        patient = Patient(
            name=f"Patient {clean_phone[-4:]}",
            consent_status=False
        )
        patient.phone = clean_phone
        db.add(patient)
        db.commit()
        db.refresh(patient)
        logger.info(f"Auto-created new patient profile for {clean_phone}")

    # Dispatch OTP via WhatsApp (default) or Fast2SMS
    channel = (req.channel or "whatsapp").lower()
    otp_code = "123456"

    if channel == "whatsapp":
        from app.services.meta_whatsapp_service import meta_whatsapp_service
        # Store in verification cache
        digits = "".join(c for c in clean_phone if c.isdigit())
        local_phone = digits[-10:] if len(digits) >= 10 else digits
        from app.services.fast2sms_service import _otp_cache
        _otp_cache[clean_phone] = otp_code
        _otp_cache[local_phone] = otp_code

        result = await meta_whatsapp_service.send_otp_whatsapp(clean_phone, otp_code)
        return {
            "success": True,
            "message": f"Verification OTP sent to WhatsApp (+{clean_phone})",
            "phone": clean_phone,
            "channel": "whatsapp",
            "demo_code": otp_code,
            "provider": result.get("provider", "Meta WhatsApp Cloud API")
        }
    else:
        result = await fast2sms_service.send_otp(clean_phone)
        return {
            "success": True,
            "message": f"OTP sent to {clean_phone} via SMS",
            "phone": clean_phone,
            "channel": "sms",
            "demo_code": result.get("demo_code", "123456"),
            "provider": result.get("provider", "Fast2SMS")
        }


@router.post("/otp/verify", response_model=TokenResponse)
def verify_patient_otp(req: PatientOTPVerifyRequest, db: Session = Depends(get_db)):
    """
    Verify OTP for patient phone and issue patient JWT token.
    """
    clean_phone = req.phone.strip()
    is_valid = fast2sms_service.verify_otp(clean_phone, req.code.strip())

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code"
        )

    phone_hash = compute_phone_hash(clean_phone)
    patient = db.query(Patient).filter(Patient.phone_hash == phone_hash).first()

    if not patient:
        patient = Patient(
            name=f"Patient {clean_phone[-4:]}",
            consent_status=False
        )
        patient.phone = clean_phone
        db.add(patient)
        db.commit()
        db.refresh(patient)

    token = create_access_token(
        subject=patient.id,
        role="patient",
        extra_claims={"name": patient.name, "phone_hash": phone_hash}
    )

    audit = AuditLog(
        actor_id=patient.id,
        actor_role="patient",
        action="patient_otp_login",
        resource="auth",
        resource_id=patient.id
    )
    db.add(audit)
    db.commit()

    return TokenResponse(
        access_token=token,
        role="patient",
        user={
            "id": patient.id,
            "name": patient.name,
            "phone": patient.phone,
            "consent_status": patient.consent_status,
            "consent_updated_at": patient.consent_updated_at.isoformat() if patient.consent_updated_at else None
        }
    )
