import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.models.user import User

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
Base.metadata.create_all(bind=test_engine)

# Seed standard test doctor for unit testing
_db = TestingSessionLocal()
if not _db.query(User).filter(User.email == "testdoc@praxirence.com").first():
    demo_doc = User(
        email="testdoc@praxirence.com",
        hashed_password=get_password_hash("DocPass123!"),
        name="Dr. Test",
        specialty="Cardiology",
        reg_number="TEST-REG-101",
        phone="+919876543210"
    )
    _db.add(demo_doc)
    _db.commit()
_db.close()



# Seed standard test medicines from Indian Formulary into test db
from scripts.seed_indian_formulary import INDIAN_FORMULARY_CATALOG
from app.models.medicine import Medicine

_med_db = TestingSessionLocal()
for item in INDIAN_FORMULARY_CATALOG:
    if not _med_db.query(Medicine).filter(Medicine.brand_name == item["brand_name"]).first():
        med = Medicine(
            brand_name=item["brand_name"],
            generic_name=item["generic_name"],
            dosage_form=item["dosage_form"],
            strength=item["strength"],
            manufacturer=item.get("manufacturer"),
            schedule_type=item.get("schedule_type", "Schedule H"),
            jan_aushadhi_equivalent=item.get("jan_aushadhi_equivalent"),
            food_relation=item.get("food_relation", "after_meal"),
            default_meal_instructions=item.get("default_meal_instructions"),
            is_banned_or_recalled=False
        )
        _med_db.add(med)
_med_db.commit()
_med_db.close()

client = TestClient(app)

