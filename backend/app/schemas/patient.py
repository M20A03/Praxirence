from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class PatientCreate(BaseModel):
    name: str
    phone: str
    dob: Optional[date] = None


class PatientUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[date] = None
    fcm_token: Optional[str] = None


class PatientResponse(BaseModel):
    id: str
    name: str
    phone: str
    dob: Optional[date] = None
    consent_status: bool
    consent_updated_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
