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


client = TestClient(app)

