import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class ConsentLog(Base):
    """Audit trail of all patient consent changes"""
    __tablename__ = "consent_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # 'granted' or 'revoked'
    method = Column(String(50), default="otp_signed", nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    patient = relationship("Patient", back_populates="consent_logs")
