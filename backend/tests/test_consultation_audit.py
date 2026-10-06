import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import User
from app.models.patient import Patient
from app.models.doctor_patient_link import DoctorPatientLink
from app.models.visit import Visit
from tests.conftest import TestingSessionLocal

client = TestClient(app)

def setup_test_users():
    db = TestingSessionLocal()
    # 1. Doctor A
    doc_a = db.query(User).filter(User.email == "doc_a@praxirence.com").first()
    if not doc_a:
        doc_a = User(
            email="doc_a@praxirence.com",
            hashed_password=get_password_hash("DocPass123!"),
            name="Dr. Ashish Mehta",
            specialty="Cardiology",
            reg_number="MCI-12345",
            phone="+919811111111"
        )
        db.add(doc_a)
    
    # 2. Doctor B (Unauthorized / Random Doctor)
    doc_b = db.query(User).filter(User.email == "doc_b@praxirence.com").first()
    if not doc_b:
        doc_b = User(
            email="doc_b@praxirence.com",
            hashed_password=get_password_hash("DocPass123!"),
            name="Dr. Random Stranger",
            specialty="Dermatology",
            reg_number="MCI-99999",
            phone="+919822222222"
        )
        db.add(doc_b)
    
    db.commit()
    db.refresh(doc_a)
    db.refresh(doc_b)
    db.close()
    return doc_a.id, doc_b.id

def get_auth_headers(user_id: str, role: str = "doctor"):
    token = create_access_token(subject=user_id, role=role)
    return {"Authorization": f"Bearer {token}"}

def test_patient_uhid_generation_and_custom_id():
    doc_a_id, _ = setup_test_users()
    headers_a = get_auth_headers(doc_a_id)

    # 1. Register with auto-generated UHID
    res = client.post(
        "/patients/",
        json={"name": "Vikram Malhotra", "phone": "+919876500001", "dob": "1988-05-10"},
        headers=headers_a
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert "PRX-PAT-" in data["uhid"]
    assert data["authorization_status"] == "authorized"
    pat_id_1 = data["id"]
    pat_uhid_1 = data["uhid"]

    # 2. Register with custom UHID
    res2 = client.post(
        "/patients/",
        json={"name": "Kavita Rao", "phone": "+919876500002", "uhid": "AIIMS-DEL-4042"},
        headers=headers_a
    )
    assert res2.status_code == 201
    data2 = res2.json()
    assert data2["uhid"] == "AIIMS-DEL-4042"

    # 3. Duplicate custom UHID must return 400 Bad Request
    res3 = client.post(
        "/patients/",
        json={"name": "Duplicate Tester", "phone": "+919876500003", "uhid": "AIIMS-DEL-4042"},
        headers=headers_a
    )
    assert res3.status_code == 400
    assert "already registered" in res3.json()["detail"]

def test_doctor_linking_authorization_workflow():
    doc_a_id, doc_b_id = setup_test_users()
    headers_a = get_auth_headers(doc_a_id)
    headers_b = get_auth_headers(doc_b_id)

    # Patient registered under clinic
    res_orig = client.post(
        "/patients/",
        json={"name": "Rohan Gupta", "phone": "+919876599999", "dob": "1992-04-12"},
        headers=headers_a
    )
    patient = res_orig.json()
    patient_id = patient["id"]

    # Doctor B (different doctor) tries to add existing patient Rohan
    res_b = client.post(
        "/patients/",
        json={"name": "Rohan Gupta", "phone": "+919876599999"},
        headers=headers_b
    )
    assert res_b.status_code == 201
    link_data = res_b.json()
    assert link_data["authorization_status"] == "pending_confirmation"
    assert link_data["link_id"] is not None
    assert link_data["confirmation_code"] is not None
    link_id = link_data["link_id"]
    code = link_data["confirmation_code"]

    # Patient views pending doctor requests
    res_pending = client.get(
        f"/patients/pending-doctor-requests?patient_id={patient_id}",
        headers=headers_a
    )
    assert res_pending.status_code == 200
    pending_list = res_pending.json()
    assert any(p["link_id"] == link_id for p in pending_list)

    # Doctor B tries to access patient records before authorization -> 403 Forbidden
    res_visits_unauth = client.get(
        f"/patients/{patient_id}/visits",
        headers=headers_b
    )
    assert res_visits_unauth.status_code == 403
    assert "Patient authorization required" in res_visits_unauth.json()["detail"]

    # Doctor B attempts in-person verification with WRONG code -> 400 Bad Request
    res_wrong_code = client.post(
        "/patients/verify-link-code",
        json={"link_id": link_id, "confirmation_code": "0000"},
        headers=headers_b
    )
    assert res_wrong_code.status_code == 400

    # Doctor B attempts in-person verification with CORRECT code -> 200 OK
    res_correct_code = client.post(
        "/patients/verify-link-code",
        json={"link_id": link_id, "confirmation_code": code},
        headers=headers_b
    )
    assert res_correct_code.status_code == 200
    assert res_correct_code.json()["authorization_status"] == "authorized"

    # Now Doctor B can access patient records
    res_visits_auth = client.get(
        f"/patients/{patient_id}/visits",
        headers=headers_b
    )
    assert res_visits_auth.status_code == 200

def test_consultation_lifecycle_clean_vault_and_pdf():
    doc_a_id, _ = setup_test_users()
    headers_a = get_auth_headers(doc_a_id)

    # 1. Register Patient
    p_res = client.post(
        "/patients/",
        json={"name": "Aarav Sharma", "phone": "+919876543219", "dob": "1995-11-20"},
        headers=headers_a
    )
    patient = p_res.json()
    patient_id = patient["id"]

    # 2. Book walk-in consultation
    walk_res = client.post(
        "/visits/walk-in",
        json={"patient_id": patient_id, "doctor_id": doc_a_id, "triage": "Routine", "chief_complaint": "Persistent mild cough"},
        headers=headers_a
    )
    assert walk_res.status_code == 200
    visit = walk_res.json()
    visit_id = visit.get("visit_id") or visit.get("id")
    assert visit.get("status") in ("scheduled", "Waiting in Clinic")

    # 3. Patient views vault prior to doctor consultation
    pre_consult_visits = client.get(
        f"/patients/{patient_id}/visits",
        headers=headers_a
    ).json()
    active_visit = next(v for v in pre_consult_visits if v["id"] == visit_id)
    assert active_visit["diagnosis"] is None
    assert active_visit["medicines"] == []
    assert active_visit["status"] == "scheduled"

    # 4. Doctor conducts consultation & creates structured visit
    struct_res = client.post(
        "/visits",
        json={
            "visit_id": visit_id,
            "patient_id": patient_id,
            "diagnosis": "Acute Upper Respiratory Tract Infection",
            "patient_summary": "Viral throat infection with cough. Warm water gargles advised.",
            "doctor_advice": "Hydrate well and rest. Review if fever exceeds 101F.",
            "medicines": [
                {"name": "Paracetamol 650mg", "dosage": "1 tablet", "frequency": "TDS", "duration_days": 3, "instructions": "After meals"},
                {"name": "Cetirizine 10mg", "dosage": "1 tablet", "frequency": "HS", "duration_days": 5, "instructions": "At bedtime"}
            ],
            "reminders": []
        },
        headers=headers_a
    )
    assert struct_res.status_code == 200

    # 5. Doctor approves consultation
    appr_res = client.post(
        f"/visits/{visit_id}/approve",
        headers=headers_a
    )
    assert appr_res.status_code == 200
    assert appr_res.json()["status"] == "approved"

    # 6. Patient views vault post-approval
    post_consult_visits = client.get(
        f"/patients/{patient_id}/visits",
        headers=headers_a
    ).json()
    approved_visit = next(v for v in post_consult_visits if v["id"] == visit_id)
    assert approved_visit["status"] == "approved"
    assert approved_visit["diagnosis"] == "Acute Upper Respiratory Tract Infection"
    assert len(approved_visit["medicines"]) == 2

    # 7. Download Prescription PDF
    pdf_res = client.get(f"/visits/{visit_id}/prescription/pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert len(pdf_res.content) > 1000, "PDF content must be valid non-empty document"

