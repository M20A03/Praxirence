import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    """Doctor / Healthcare Provider model"""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(32), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    specialty = Column(String(255), nullable=True, default="General Physician")
    clinic_name = Column(String(255), nullable=True, default="Praxirence Clinical Centre")
    reg_number = Column(String(64), nullable=True, default="NMC-2024-84920")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    visits = relationship("Visit", back_populates="doctor", cascade="all, delete-orphan")
