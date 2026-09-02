import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.models.user import User
from app.models.patient import Patient

from sqlalchemy.pool import StaticPool

# Use SQLite in-memory for testing with StaticPool so all connections share the DB
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

# Seed doctor
db = TestingSessionLocal()
demo_doc = User(
    email="testdoc@praxirence.com",
    hashed_password=get_password_hash("DocPass123!"),
    name="Dr. Test",
    specialty="Cardiology"
)
db.add(demo_doc)
db.commit()
db.close()

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_doctor_login_and_token():
    response = client.post(
        "/auth/doctor/login",
        json={"email": "testdoc@praxirence.com", "password": "DocPass123!"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "doctor"


def test_create_and_search_patient():
    # Login doctor
    login_res = client.post(
        "/auth/doctor/login",
        json={"email": "testdoc@praxirence.com", "password": "DocPass123!"}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create patient
    create_res = client.post(
        "/patients",
        headers=headers,
        json={"name": "Alice Wonderland", "phone": "+15554443322", "dob": "1990-05-15"}
    )
    assert create_res.status_code == 201
    patient_data = create_res.json()
    assert patient_data["name"] == "Alice Wonderland"
    assert patient_data["phone"] == "+15554443322"
    patient_id = patient_data["id"]

    # Search patient
    search_res = client.get("/patients?query=Alice", headers=headers)
    assert search_res.status_code == 200
    results = search_res.json()
    assert len(results) >= 1
    assert results[0]["name"] == "Alice Wonderland"


def test_patient_otp_flow_and_consent():
    # 1. Request OTP
    otp_req = client.post("/auth/otp/request", json={"phone": "+15558889900"})
    assert otp_req.status_code == 200

    # 2. Verify OTP with simulated code 123456
    otp_ver = client.post(
        "/auth/otp/verify",
        json={"phone": "+15558889900", "code": "123456"}
    )
    assert otp_ver.status_code == 200
    token_data = otp_ver.json()
    patient_token = token_data["access_token"]
    patient_id = token_data["user"]["id"]
    headers = {"Authorization": f"Bearer {patient_token}"}

    # 3. Get consent document
    doc_res = client.get(f"/patients/{patient_id}/consent", headers=headers)
    assert doc_res.status_code == 200
    doc = doc_res.json()
    assert "bullet_points" in doc
    assert len(doc["bullet_points"]) > 0

    # 4. Grant consent
    grant_res = client.post(
        f"/patients/{patient_id}/consent",
        headers=headers,
        json={"consent_status": True, "otp_code": "123456"}
    )
    assert grant_res.status_code == 200
    assert grant_res.json()["consent_status"] is True


def test_visit_audio_upload_ai_extraction_and_auto_purge():
    # Login doctor
    login_res = client.post(
        "/auth/doctor/login",
        json={"email": "testdoc@praxirence.com", "password": "DocPass123!"}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create patient
    p_res = client.post(
        "/patients",
        headers=headers,
        json={"name": "Marcus Brown", "phone": "+15559998877", "dob": "1985-11-20"}
    )
    patient_id = p_res.json()["id"]

    # Upload consultation audio (simulated WAV bytes)
    simulated_audio = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    files = {
        "audio_file": ("consult.wav", simulated_audio, "audio/wav")
    }
    data = {
        "patient_id": patient_id,
        "keep_recording": "false"
    }

    upload_res = client.post(
        "/visits/upload-audio",
        headers=headers,
        data=data,
        files=files
    )
    assert upload_res.status_code == 200
    visit = upload_res.json()
    assert "diagnosis" in visit
    assert len(visit["medicines"]) >= 1
    assert len(visit["reminders"]) >= 1
    assert visit["keep_recording"] is False
    # Recording was automatically purged
    assert visit["audio_file_path"] is None or not os.path.exists(visit.get("audio_file_path") or "")

    visit_id = visit["id"]

    # Doctor edits care plan
    update_res = client.put(
        f"/visits/{visit_id}",
        headers=headers,
        json={
            "diagnosis": "Acute Bronchitis (Confirmed)",
            "medicines": [
                {
                    "name": "Azithromycin",
                    "dosage": "500mg",
                    "frequency": "Once daily after breakfast",
                    "instructions": "Take after food for 3 days",
                    "duration_days": 3
                }
            ],
            "reminders": [
                {
                    "medicine_name": "Azithromycin",
                    "dosage": "500mg",
                    "time": "08:30",
                    "frequency": "daily",
                    "instructions": "Take 1 tablet after breakfast"
                }
            ]
        }
    )
    assert update_res.status_code == 200
    assert update_res.json()["diagnosis"] == "Acute Bronchitis (Confirmed)"

    # Doctor approves and sends via Meta WhatsApp
    approve_res = client.post(
        f"/visits/{visit_id}/approve",
        headers=headers
    )
    assert approve_res.status_code == 200
    app_data = approve_res.json()
    assert app_data["status"] == "approved"
    assert "whatsapp_status" in app_data


def test_model_loader_resilience():
    from ml.inference import model_loader
    # Test fallback extraction with arbitrary consultation text
    text = "Patient has severe migraine headache. Prescribed Sumatriptan 50mg at onset and Ondansetron 4mg."
    plan = model_loader.extract_care_plan(text)
    assert "Migraine" in plan["diagnosis"]
    assert any(m["name"] == "Sumatriptan" for m in plan["medicines"])
    assert len(plan["reminders"]) >= 1

