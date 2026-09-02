from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr


class DoctorLoginRequest(BaseModel):
    email: EmailStr
    password: str


class DoctorRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    specialty: Optional[str] = "General Physician"


class PatientOTPRequest(BaseModel):
    phone: str


class PatientOTPVerifyRequest(BaseModel):
    phone: str
    code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user: Dict[str, Any]
