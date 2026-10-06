from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class PatientCreate(BaseModel):
    name: str
    phone: str
    dob: Optional[date] = None
    uhid: Optional[str] = None


class PatientUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[date] = None
    fcm_token: Optional[str] = None
    uhid: Optional[str] = None


class PatientResponse(BaseModel):
    id: str
    uhid: Optional[str] = None
    name: str
    phone: str
    dob: Optional[date] = None
    consent_status: bool
    consent_updated_at: Optional[datetime] = None
    created_at: datetime
    authorization_status: Optional[str] = "authorized"
    link_id: Optional[str] = None
    confirmation_code: Optional[str] = None
    message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PatientAuthorizeDoctorRequest(BaseModel):
    link_id: str
    action: str  # approve or reject


class DoctorVerifyLinkCodeRequest(BaseModel):
    link_id: str
    confirmation_code: str


class PendingDoctorAuthorizationItem(BaseModel):
    link_id: str
    doctor_id: str
    doctor_name: str
    doctor_specialty: Optional[str] = None
    clinic_name: Optional[str] = None
    confirmation_code: Optional[str] = None
    created_at: datetime
