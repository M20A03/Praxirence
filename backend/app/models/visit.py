import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, JSON, Integer
from sqlalchemy.orm import relationship
from app.core.database import Base


class Visit(Base):
    """Clinical consultation visit containing audio, AI extracted care plan and reminders"""
    __tablename__ = "visits"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    date = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Audio recording tracking
    audio_file_path = Column(String(512), nullable=True)
    keep_recording = Column(Boolean, default=False, nullable=False)
    raw_transcription = Column(Text, nullable=True)

    # Clinical Care Plan
    diagnosis = Column(Text, nullable=True)
    # JSON list of medicine objects: [{name, dosage, frequency, instructions, duration_days}]
    medicines = Column(JSON, default=list, nullable=False)
    # JSON list of reminder objects: [{medicine_name, dosage, time, frequency, instructions}]
    reminders = Column(JSON, default=list, nullable=False)

    # Scheduling & Slot Booking Metadata
    appointment_date = Column(String(20), nullable=True, index=True)  # "YYYY-MM-DD"
    time_slot = Column(String(20), nullable=True, index=True)         # "10:30 AM"
    booking_type = Column(String(30), default="in_person", nullable=False)  # in_person, video, chat
    chief_complaint = Column(Text, nullable=True)
    token_number = Column(Integer, nullable=True, index=True)         # Sequential OPD token per doctor per date (1, 2, 3...)

    # Status: 'scheduled', 'in_progress', 'draft', 'approved', 'sent', 'completed', 'cancelled', 'skipped', 'deferred', 'reschedule_required'
    status = Column(String(50), default="draft", nullable=False, index=True)
    triage_level = Column(String(30), default="Routine", nullable=False)  # Routine, Priority, Urgent
    skip_count = Column(Integer, default=0, nullable=False)
    deferred_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    signature_hash = Column(String(64), nullable=True, index=True)  # SHA-256 tamper-evident digest
    retention_until = Column(DateTime, nullable=True)  # Statutory NMC 3-year retention lock
    whatsapp_message_id = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    patient = relationship("Patient", back_populates="visits")
    doctor = relationship("User", back_populates="visits")
