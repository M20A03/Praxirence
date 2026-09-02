from typing import Optional, Union, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.models.patient import Patient

security_bearer = HTTPBearer(auto_error=False)


def get_token_payload(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)
) -> Dict[str, Any]:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def get_current_doctor(
    payload: Dict[str, Any] = Depends(get_token_payload),
    db: Session = Depends(get_db)
) -> User:
    role = payload.get("role")
    if role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires doctor privilege"
        )
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Doctor user not found"
        )
    return user


def get_current_patient(
    payload: Dict[str, Any] = Depends(get_token_payload),
    db: Session = Depends(get_db)
) -> Patient:
    role = payload.get("role")
    if role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires patient privilege"
        )
    patient_id = payload.get("sub")
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Patient not found"
        )
    return patient


def get_current_user_or_patient(
    payload: Dict[str, Any] = Depends(get_token_payload),
    db: Session = Depends(get_db)
) -> Union[User, Patient]:
    role = payload.get("role")
    sub_id = payload.get("sub")

    if role == "doctor":
        user = db.query(User).filter(User.id == sub_id).first()
        if user:
            return user
    elif role == "patient":
        patient = db.query(Patient).filter(Patient.id == sub_id).first()
        if patient:
            return patient

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="User entity not found"
    )
