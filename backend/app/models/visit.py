import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, JSON
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

    # Status: 'draft', 'approved', 'sent'
    status = Column(String(50), default="draft", nullable=False, index=True)
    approved_at = Column(DateTime, nullable=True)
    whatsapp_message_id = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    patient = relationship("Patient", back_populates="visits")
    doctor = relationship("User", back_populates="visits")
