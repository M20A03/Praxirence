import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class DoctorReview(Base):
    """
    Patient Review & Experience Rating for Clinicians.
    Optional for patients (not compulsory), purely for reference to help prospective patients.
    Enforces a minimum of 10 words for submitted reviews to ensure constructive clinical feedback.
    """
    __tablename__ = "doctor_reviews"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    doctor_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="SET NULL"), nullable=True, index=True)
    visit_id = Column(String(36), ForeignKey("visits.id", ondelete="SET NULL"), nullable=True, index=True)

    patient_name = Column(String(255), nullable=False)
    rating = Column(Integer, nullable=False)  # 1 to 5 stars
    review_text = Column(Text, nullable=False)  # Verified >= 10 words on submission
    word_count = Column(Integer, nullable=False, default=0)
    is_first_visit = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    doctor = relationship("User", backref="reviews")
    patient = relationship("Patient", backref="reviews")
    visit = relationship("Visit", backref="reviews")
