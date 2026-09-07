from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, Field


class MedicineItem(BaseModel):
    name: str = Field(..., description="Name of medication (e.g. Paracetamol)")
    dosage: str = Field(..., description="Dosage amount (e.g. 500mg)")
    frequency: str = Field(..., description="Intake timing (e.g. 1-0-1 or Twice daily)")
    instructions: Optional[str] = Field("After food", description="Specific intake advice")
    duration_days: Optional[int] = Field(5, description="Number of days to take medicine")


class ReminderItem(BaseModel):
    medicine_name: str
    dosage: str
    time: str = Field(..., description="24-hour time e.g. 08:00, 14:00, 20:00")
    frequency: str = Field("daily", description="daily, weekly, etc.")
    instructions: Optional[str] = None


class CarePlanStructure(BaseModel):
    diagnosis: str
    patient_summary: Optional[str] = None
    doctor_advice: Optional[str] = None
    warning_signs: List[str] = Field(default_factory=list)
    medicines: List[MedicineItem] = Field(default_factory=list)
    reminders: List[ReminderItem] = Field(default_factory=list)


class ConsultationSummarizeRequest(BaseModel):
    conversation: str = Field(..., description="Dialogue or clinical notes between doctor and patient")
    patient_name: Optional[str] = Field("Patient", description="Name of patient for personalized address")
    doctor_name: Optional[str] = Field("Doctor", description="Name of doctor")


class ConsultationSummarizeResponse(BaseModel):
    patient_summary: str = Field(..., description="Plain-language, easy-to-understand explanation of what doctor told patient")
    doctor_advice: str = Field(..., description="Dietary, lifestyle, hydration, and resting advice")
    warning_signs: List[str] = Field(default_factory=list, description="Red flag symptoms when to contact doctor immediately")
    diagnosis: str = Field(..., description="Clinical diagnostic term")
    medicines: List[MedicineItem] = Field(default_factory=list)
    reminders: List[ReminderItem] = Field(default_factory=list)
    follow_up_days: Optional[int] = Field(5, description="Recommended follow-up days")


class VisitCreate(BaseModel):
    patient_id: str
    diagnosis: str = "Clinical Assessment"
    medicines: List[MedicineItem] = Field(default_factory=list)
    reminders: List[ReminderItem] = Field(default_factory=list)
    raw_transcription: Optional[str] = None
    patient_summary: Optional[str] = None
    doctor_advice: Optional[str] = None


class VisitUpdate(BaseModel):
    diagnosis: Optional[str] = None
    medicines: Optional[List[MedicineItem]] = None
    reminders: Optional[List[ReminderItem]] = None
    keep_recording: Optional[bool] = None
    patient_summary: Optional[str] = None
    doctor_advice: Optional[str] = None


class VisitResponse(BaseModel):
    id: str
    patient_id: str
    doctor_id: Optional[str] = None
    date: datetime
    audio_file_path: Optional[str] = None
    keep_recording: bool = False
    raw_transcription: Optional[str] = None
    patient_summary: Optional[str] = None
    doctor_advice: Optional[str] = None
    diagnosis: Optional[str] = None
    medicines: List[Dict[str, Any]] = Field(default_factory=list)
    reminders: List[Dict[str, Any]] = Field(default_factory=list)
    status: str
    approved_at: Optional[datetime] = None
    whatsapp_message_id: Optional[str] = None
    created_at: datetime
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    doctor_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class VisitApproveResponse(BaseModel):
    visit_id: str
    status: str
    whatsapp_status: str
    scheduled_reminders_count: int
    message: str
    patient_summary: Optional[str] = None

