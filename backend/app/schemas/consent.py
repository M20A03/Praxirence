from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class ConsentUpdateRequest(BaseModel):
    consent_status: bool
    otp_code: Optional[str] = None  # Optional OTP signature confirmation


class ConsentDocumentResponse(BaseModel):
    title: str
    version: str
    summary: str
    bullet_points: List[str]
    plain_language_text: str
    consent_status: bool
    consent_updated_at: Optional[datetime] = None


class ConsentActionResponse(BaseModel):
    patient_id: str
    consent_status: bool
    consent_updated_at: datetime
    message: str
