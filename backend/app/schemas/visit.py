from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, Field


class MedicineItem(BaseModel):
    name: str = Field(..., description="Name of medication (e.g. Paracetamol)")
    dosage: str = Field(..., description="Dosage amount (e.g. 500mg)")
    frequency: str = Field(..., description="Intake timing (e.g. 1-0-1 or Twice daily)")
    instructions: Optional[str] = Field("After food", description="Specific intake advice")
    duration_days: Optional[int] = Field(5, description="Number of days to take medicine")
    meal_relation: Optional[str] = Field("after_food", description="empty_stomach, before_food, after_food, with_food")
    is_sos: Optional[bool] = Field(False, description="True for PRN / as-needed medicine")


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
    patient_summary: str = Field(..., description="Plain-language explanation of diagnosis and treatment")
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
    appointment_date: Optional[str] = None
    time_slot: Optional[str] = None
    booking_type: Optional[str] = "in_person"
    chief_complaint: Optional[str] = None
    token_number: Optional[int] = None
    token_display: Optional[str] = None
    patients_ahead: Optional[int] = None
    estimated_wait_mins: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class VisitApproveResponse(BaseModel):
    visit_id: str
    status: str
    whatsapp_status: str
    scheduled_reminders_count: int
    message: str
    patient_summary: Optional[str] = None


class BookSlotRequest(BaseModel):
    doctor_id: str
    patient_id: str
    appointment_date: str = Field(..., description="Date in YYYY-MM-DD")
    time_slot: str = Field(..., description="Time slot e.g. 10:30 AM")
    chief_complaint: Optional[str] = None
    booking_type: str = "in_person"


class BookSlotResponse(BaseModel):
    success: bool
    visit_id: str
    message: str
    status: str = "scheduled"
    token_number: int = 1
    token_display: str = "PX-01"
    patients_ahead: int = 0
    estimated_wait_mins: int = 0
    appointment: Dict[str, Any]


class QueueStatusResponse(BaseModel):
    visit_id: str
    doctor_id: str
    doctor_name: str
    patient_id: str
    patient_name: str
    appointment_date: str
    time_slot: str
    token_number: int
    token_display: str
    current_serving_token: Optional[str] = None
    current_serving_token_number: Optional[int] = None
    patients_ahead: int
    estimated_wait_mins: int
    doctor_delay_mins: Optional[int] = 0
    recommended_departure_time: Optional[str] = None
    triage: Optional[str] = "Routine"
    status: str
    clinic_name: Optional[str] = None
    clinic_address: Optional[str] = None


class AdvanceQueueRequest(BaseModel):
    status: str = Field("in_progress", description="New status: in_progress, completed, cancelled, skipped, deferred")


class CallNextPatientResponse(BaseModel):
    success: bool
    message: str
    serving_visit_id: Optional[str] = None
    serving_token: Optional[str] = None
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    chamber: str = "Chamber 1"


class RescheduleRequest(BaseModel):
    appointment_date: str = Field(..., description="YYYY-MM-DD")
    time_slot: str = Field(..., description="e.g. 10:30 AM")



