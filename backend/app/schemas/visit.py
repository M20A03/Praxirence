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
    medicines: List[MedicineItem] = Field(default_factory=list)
    reminders: List[ReminderItem] = Field(default_factory=list)


class VisitCreate(BaseModel):
    patient_id: str
    diagnosis: str = "Clinical Assessment"
    medicines: List[MedicineItem] = Field(default_factory=list)
    reminders: List[ReminderItem] = Field(default_factory=list)
    raw_transcription: Optional[str] = None


class VisitUpdate(BaseModel):
    diagnosis: Optional[str] = None
    medicines: Optional[List[MedicineItem]] = None
    reminders: Optional[List[ReminderItem]] = None
    keep_recording: Optional[bool] = None



class VisitResponse(BaseModel):
    id: str
    patient_id: str
    doctor_id: Optional[str] = None
    date: datetime
    audio_file_path: Optional[str] = None
    keep_recording: bool = False
    raw_transcription: Optional[str] = None
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
