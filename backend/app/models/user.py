import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Float, Integer, JSON
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

    # Geolocation & Clinic Details
    city = Column(String(100), nullable=True, index=True, default="Bangalore")
    state = Column(String(100), nullable=True, default="Karnataka")
    pincode = Column(String(20), nullable=True, default="560038")
    clinic_address = Column(String(255), nullable=True, default="12th Main, Indiranagar, Bangalore")
    latitude = Column(Float, nullable=True, default=12.9716)
    longitude = Column(Float, nullable=True, default=77.5946)

    # Clinician Schedule & Availability Engine
    available_days = Column(JSON, default=lambda: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])
    working_hours_start = Column(String(10), default="09:00")
    working_hours_end = Column(String(10), default="18:00")
    slot_duration_mins = Column(Integer, default=30)
    unavailable_dates = Column(JSON, default=list)  # ISO strings ["YYYY-MM-DD"] when doctor is on leave
    consultation_fee = Column(Integer, default=500)
    current_delay_mins = Column(Integer, default=0, nullable=False)
    delay_updated_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    visits = relationship("Visit", back_populates="doctor", cascade="all, delete-orphan")

