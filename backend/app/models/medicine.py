import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text, JSON
from app.core.database import Base


class Medicine(Base):
    """
    Indian National Formulary & CDSCO Medicine Catalog Model.
    Replaces static in-code drug maps with an indexed, dynamic database formulary.
    """
    __tablename__ = "medicines"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    brand_name = Column(String(255), index=True, nullable=False)
    generic_name = Column(String(255), index=True, nullable=False)
    dosage_form = Column(String(50), nullable=False, default="Tablet")  # Tablet, Capsule, Syrup, Injection, Drops, Inhaler
    strength = Column(String(50), nullable=False, default="Standard")  # e.g., 650mg, 500mg, 40mg
    manufacturer = Column(String(255), nullable=True)  # e.g. Micro Labs, Alkem, Cipla, Sun Pharma
    schedule_type = Column(String(50), default="Schedule H", nullable=False)  # OTC, Schedule H, Schedule H1, Schedule X
    jan_aushadhi_equivalent = Column(String(255), nullable=True)  # PMBI Jan Aushadhi affordable alternative
    food_relation = Column(String(50), default="after_meal", nullable=False)  # before_meal, after_meal, empty_stomach, with_meal
    default_meal_instructions = Column(JSON, nullable=True)  # {"en": "...", "hi": "..."}
    is_banned_or_recalled = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "brand_name": self.brand_name,
            "generic_name": self.generic_name,
            "dosage_form": self.dosage_form,
            "strength": self.strength,
            "manufacturer": self.manufacturer,
            "schedule_type": self.schedule_type,
            "jan_aushadhi_equivalent": self.jan_aushadhi_equivalent,
            "food_relation": self.food_relation,
            "default_meal_instructions": self.default_meal_instructions or {},
            "is_banned_or_recalled": self.is_banned_or_recalled,
        }
