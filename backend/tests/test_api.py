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

from tests.conftest import test_engine, TestingSessionLocal, client


def test_health_check():
    response = client.get("/health")
    assert response.json()["status"] in ["healthy", "degraded"]


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
    from app.services.fast2sms_service import _otp_cache
    # 1. Request OTP
    otp_req = client.post("/auth/otp/request", json={"phone": "+15558889900"})
    assert otp_req.status_code == 200

    digits = "".join(c for c in "+15558889900" if c.isdigit())[-10:]
    code = _otp_cache[digits]["code"]

    # 2. Verify OTP with real cryptographically generated code
    otp_ver = client.post(
        "/auth/otp/verify",
        json={"phone": "+15558889900", "code": code}
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
        json={"consent_status": True, "otp_code": code}
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


def test_check_phone_number_endpoint():
    # Doctor phone check
    res = client.post("/auth/check-phone", json={"phone": "+919876543210"})
    assert res.status_code == 200
    data = res.json()
    assert data["registered"] is True
    assert data["role"] == "doctor"

    # Patient phone check
    res_pat = client.post("/auth/check-phone", json={"phone": "+919835139865"})
    assert res_pat.status_code == 200
    pat_data = res_pat.json()
    assert pat_data["registered"] is True
    assert pat_data["role"] == "patient"


def test_doctor_google_auth_and_register():
    # Google OAuth doctor login
    res = client.post(
        "/auth/doctor/google",
        json={"email": "dr.google@hospital.org", "name": "Dr. Google Test", "google_id": "goog-12345"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "doctor"
    assert "access_token" in data

    # Doctor register
    reg_res = client.post(
        "/auth/doctor/register",
        json={
            "name": "Dr. Sarah Connor",
            "email": "sarah.connor@clinics.org",
            "password": "Password123!",
            "phone": "+919811122233",
            "specialty": "Neurologist",
            "clinic_name": "Apex Neuro Clinic",
            "reg_number": "NMC-998877"
        }
    )
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert reg_data["role"] == "doctor"
    assert reg_data["user"]["name"] == "Dr. Sarah Connor"


def test_auth_directory_and_me():
    # Directory inspection
    res = client.get("/auth/directory")
    assert res.status_code == 200
    d = res.json()
    assert "doctors" in d
    assert "patients" in d
    assert len(d["doctors"]) >= 1

    # /auth/me for doctor
    login_res = client.post(
        "/auth/doctor/login",
        json={"email": "testdoc@praxirence.com", "password": "DocPass123!"}
    )
    token = login_res.json()["access_token"]
    me_res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["role"] == "doctor"


def test_doctor_whatsapp_otp():
    # 1. Doctor WhatsApp OTP Request
    otp_req = client.post(
        "/auth/doctor/otp/request",
        json={"phone": "+919876543210", "channel": "whatsapp"}
    )
    assert otp_req.status_code == 200
    data = otp_req.json()
    assert data["success"] is True
    assert data["channel"] == "whatsapp"

    from app.services.fast2sms_service import _otp_cache
    code1 = _otp_cache["9876543210"]["code"]

    # 2. Doctor WhatsApp OTP Verify
    otp_verify = client.post(
        "/auth/doctor/otp/verify",
        json={"phone": "+919876543210", "code": code1}
    )
    assert otp_verify.status_code == 200
    v_data = otp_verify.json()
    assert v_data["role"] == "doctor"
    assert "access_token" in v_data
    assert v_data["user"]["name"] is not None

    # 3. New doctor phone WhatsApp OTP request & verify (auto-provisioning)
    new_phone = "+919899887766"
    new_req = client.post(
        "/auth/doctor/otp/request",
        json={"phone": new_phone, "channel": "whatsapp"}
    )
    assert new_req.status_code == 200
    code2 = _otp_cache["9899887766"]["code"]
    new_verify = client.post(
        "/auth/doctor/otp/verify",
        json={"phone": new_phone, "code": code2}
    )
    assert new_verify.status_code == 200
    nv_data = new_verify.json()
    assert nv_data["role"] == "doctor"
    assert "access_token" in nv_data


def test_summarize_consultation():
    # Login doctor
    login_res = client.post(
        "/auth/doctor/login",
        json={"email": "testdoc@praxirence.com", "password": "DocPass123!"}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Summarize conversation
    conversation = (
        "Doctor: Hello Ramesh, what brings you here today? "
        "Patient: Doctor, I have had high fever, dry cough and body ache for 3 days. "
        "Doctor: Your temperature is 101.4F and throat is congested. You have Acute Viral Bronchitis. "
        "I am prescribing Paracetamol 650mg three times daily after food for fever, and Azithromycin 500mg once daily for 5 days. "
        "Drink plenty of warm water, take steam inhalation twice daily, and avoid cold beverages. "
        "Patient: When should I worry? "
        "Doctor: If you feel breathlessness or fever stays above 102F after 3 days, visit emergency immediately. "
        "Come back in 5 days for a checkup."
    )
    res = client.post(
        "/visits/summarize",
        headers=headers,
        json={"conversation": conversation, "patient_name": "Ramesh Kumar"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "patient_summary" in data
    assert "doctor_advice" in data
    assert len(data["patient_summary"]) > 20
    assert len(data["doctor_advice"]) > 10
    assert "diagnosis" in data
    assert "medicines" in data


def test_visit_with_patient_summary_and_portal():
    # 1. Login doctor
    login_res = client.post(
        "/auth/doctor/login",
        json={"email": "testdoc@praxirence.com", "password": "DocPass123!"}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create patient
    p_res = client.post(
        "/patients",
        headers=headers,
        json={"name": "Suresh Patel", "phone": "+919988776655", "dob": "1985-11-20"}
    )
    assert p_res.status_code == 201
    patient_id = p_res.json()["id"]

    # 3. Create structured visit with patient summary & doctor advice
    summary_text = "Doctor confirmed Acute Bronchitis after observing throat congestion and mild fever. You were advised to complete your 5-day antibiotic course."
    advice_text = "Drink warm fluids, perform steam inhalation twice daily, and rest adequately."
    v_res = client.post(
        "/visits",
        headers=headers,
        json={
            "patient_id": patient_id,
            "diagnosis": "Acute Bronchitis",
            "patient_summary": summary_text,
            "doctor_advice": advice_text,
            "raw_transcription": "Doctor and patient conversation transcript here",
            "medicines": [
                {
                    "name": "Paracetamol",
                    "dosage": "650mg",
                    "frequency": "TID",
                    "timing": "After food",
                    "duration_days": 3,
                    "purpose": "Fever and body ache"
                }
            ],
            "reminders": [
                {
                    "medicine_name": "Paracetamol",
                    "dosage": "650mg",
                    "time": "08:00",
                    "frequency": "daily",
                    "instructions": "Take after breakfast"
                }
            ]
        }
    )
    assert v_res.status_code == 200
    visit_data = v_res.json()
    assert visit_data["patient_summary"] == summary_text
    assert visit_data["doctor_advice"] == advice_text

    # 4. Check get patient visits
    pv_res = client.get(f"/patients/{patient_id}/visits", headers=headers)
    assert pv_res.status_code == 200
    visits = pv_res.json()
    assert len(visits) >= 1
    assert visits[0]["patient_summary"] == summary_text
    assert visits[0]["doctor_advice"] == advice_text

    # 5. Patient OTP login & check portal
    from app.services.fast2sms_service import _otp_cache
    client.post("/auth/otp/request", json={"phone": "+919988776655"})
    p_code = _otp_cache["9988776655"]["code"]
    p_login = client.post("/auth/otp/verify", json={"phone": "+919988776655", "code": p_code})
    p_token = p_login.json()["access_token"]
    p_headers = {"Authorization": f"Bearer {p_token}"}

    portal_res = client.get("/patients/me/portal", headers=p_headers)
    assert portal_res.status_code == 200
    p_portal = portal_res.json()
    assert "visits" in p_portal
    assert len(p_portal["visits"]) >= 1
    assert p_portal["visits"][0]["patient_summary"] == summary_text
    assert p_portal["visits"][0]["doctor_advice"] == advice_text


def test_doctor_email_otp_flow():
    from app.services.email_service import _email_otp_cache
    # 1. Request verification code for email
    email = "dr.sharma@apollohospital.org"
    req_res = client.post(
        "/auth/doctor/email-otp/request",
        json={"email": email, "name": "Dr. Ramesh Sharma"}
    )
    assert req_res.status_code == 200
    assert req_res.json()["success"] is True

    # 2. Verify with actual generated OTP
    code = _email_otp_cache[email.lower()]["code"]
    verify_res = client.post(
        "/auth/doctor/email-otp/verify",
        json={"email": email, "code": code}
    )
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["role"] == "doctor"
    assert "access_token" in data
    assert data["user"]["email"] == email


def test_patient_email_otp_flow():
    from app.services.email_service import _email_otp_cache
    # 1. Request verification code for patient email
    email = "aarav.care@gmail.com"
    req_res = client.post(
        "/auth/patient/email-otp/request",
        json={"email": email, "name": "Aarav Sharma"}
    )
    assert req_res.status_code == 200
    assert req_res.json()["success"] is True

    # 2. Verify with actual generated OTP
    code = _email_otp_cache[email.lower()]["code"]
    verify_res = client.post(
        "/auth/patient/email-otp/verify",
        json={"email": email, "code": code}
    )
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["role"] == "patient"
    assert "access_token" in data
    assert data["user"]["name"] == "Aarav Sharma"


