import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Date, DateTime, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.security import decrypt_phone, encrypt_phone, compute_phone_hash


class Patient(Base):
    """Patient model with encrypted contact info and consent status"""
    __tablename__ = "patients"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), index=True, nullable=False)
    # Encrypted phone number at rest (Fernet ciphertext)
    phone_encrypted = Column(Text, nullable=False)
    # Deterministic blind index for fast exact-match lookups
    phone_hash = Column(String(64), unique=True, index=True, nullable=False)
    dob = Column(Date, nullable=True)
    consent_status = Column(Boolean, default=False, nullable=False)
    consent_updated_at = Column(DateTime, nullable=True)
    fcm_token = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    visits = relationship("Visit", back_populates="patient", cascade="all, delete-orphan", order_by="desc(Visit.date)")
    consent_logs = relationship("ConsentLog", back_populates="patient", cascade="all, delete-orphan", order_by="desc(ConsentLog.timestamp)")

    @property
    def phone(self) -> str:
        """Returns the decrypted plain text phone number"""
        if not self.phone_encrypted:
            return ""
        return decrypt_phone(self.phone_encrypted)

    @phone.setter
    def phone(self, value: str):
        """Sets both the encrypted phone and its blind index hash"""
        self.phone_encrypted = encrypt_phone(value)
        self.phone_hash = compute_phone_hash(value)
