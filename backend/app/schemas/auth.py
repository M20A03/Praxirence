from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr


class DoctorLoginRequest(BaseModel):
    email: EmailStr
    password: str


class DoctorOTPRequest(BaseModel):
    phone: str
    channel: Optional[str] = "whatsapp"  # "whatsapp" or "sms"


class DoctorOTPVerifyRequest(BaseModel):
    phone: str
    code: str


class DoctorRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    specialty: Optional[str] = None
    clinic_name: Optional[str] = None
    reg_number: Optional[str] = None
    degree: Optional[str] = None
    qualifications: Optional[str] = None
    experience_years: Optional[str] = None


class DoctorGoogleAuthRequest(BaseModel):
    id_token: Optional[str] = None
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    google_id: Optional[str] = None


class DoctorEmailOTPRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None


class DoctorEmailOTPVerifyRequest(BaseModel):
    email: EmailStr
    code: str
    name: Optional[str] = None



class PatientOTPRequest(BaseModel):
    phone: str
    channel: Optional[str] = "whatsapp"  # "whatsapp" or "sms"


class PatientOTPVerifyRequest(BaseModel):
    phone: str
    code: str


class PatientRegisterRequest(BaseModel):
    name: str
    phone: str
    dob: Optional[str] = None
    gender: Optional[str] = "Other"


class PatientEmailOTPRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None


class PatientEmailOTPVerifyRequest(BaseModel):
    email: EmailStr
    code: str
    name: Optional[str] = None



class CheckPhoneRequest(BaseModel):
    phone: str


class CheckPhoneResponse(BaseModel):
    registered: bool
    role: Optional[str] = None  # "doctor" | "patient" | None
    name: Optional[str] = None
    message: str



class DirectoryResponse(BaseModel):
    doctors: list[Dict[str, Any]]
    patients: list[Dict[str, Any]]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user: Dict[str, Any]

