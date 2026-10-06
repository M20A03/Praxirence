import uuid
import random
import string
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Date, DateTime, Text, Integer
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.security import decrypt_phone, encrypt_phone, compute_phone_hash


def generate_uhid(db_session=None) -> str:
    """
    Generates a unique human-friendly patient identifier like PRX-PAT-1082
    """
    prefix = "PRX-PAT"
    for _ in range(50):
        num = random.randint(1001, 99999)
        candidate = f"{prefix}-{num:04d}"
        if db_session:
            existing = db_session.query(Patient).filter(Patient.uhid == candidate).first()
            if not existing:
                return candidate
        else:
            return candidate
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"{prefix}-{suffix}"


class Patient(Base):
    """Patient model with encrypted contact info and consent status"""
    __tablename__ = "patients"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    uhid = Column(String(50), unique=True, index=True, nullable=True)
    name = Column(String(255), index=True, nullable=False)
    # Encrypted phone number at rest (Fernet ciphertext)
    phone_encrypted = Column(Text, nullable=False)
    # Deterministic blind index for fast exact-match lookups
    phone_hash = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(255), nullable=True, index=True)
    primary_account_phone = Column(String(32), nullable=True, index=True)
    family_relation = Column(String(30), default="Self", nullable=False)  # Self, Mother, Father, Child, Spouse, Other
    dob = Column(Date, nullable=True)
    abha_id = Column(String(50), nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    emergency_contact = Column(String(50), nullable=True)
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
