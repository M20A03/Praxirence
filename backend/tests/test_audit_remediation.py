import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.patient import Patient
from app.models.visit import Visit
from app.services.email_service import _email_otp_cache

client = TestClient(app)

def test_audit_remediation_security_and_logic():
    db = SessionLocal()
    # Clean test state
    db.query(Visit).delete()
    db.query(Patient).delete()
    db.query(User).delete()
    db.commit()

    # 1. Register a Doctor
    doc_res = client.post(
        "/auth/doctor/register",
        json={
            "name": "Dr. Audit Clinician",
            "email": "audit.doctor@praxirence.org",
            "password": "Password123!",
            "phone": "+919988776655",
            "specialty": "Cardiology",
            "clinic_name": "Audit Clinic",
            "reg_number": "NMC-AUDIT-101"
        }
    )
    assert doc_res.status_code == 200
    doc_data = doc_res.json()
    doc_id = doc_data["user"]["id"]
    doc_token = doc_data["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    # 2. Verify Task 1: Staff PIN is NOT leaked in public profile
    pub_profile = client.get(f"/doctors/{doc_id}/profile")
    assert pub_profile.status_code == 200
    assert "staff_pin" not in pub_profile.json()

    # 3. Verify Doctor can access private staff PIN endpoint
    pin_res = client.get("/doctors/me/staff-pin", headers=doc_headers)
    assert pin_res.status_code == 200
    assert pin_res.json()["staff_pin"] == "123456"
    assert pin_res.json()["pin_version"] == 1

    # 4. Verify Task 2: "123456" OTP does NOT bypass email verification
    bad_verify = client.post(
        "/auth/doctor/email-otp/verify",
        json={"email": "nobody@praxirence.com", "code": "123456"}
    )
    assert bad_verify.status_code == 400

    # 5. Verify Task 6: Receptionist login & session invalidation on PIN rotation
    staff_login_res = client.post(
        "/auth/staff/login",
        json={"doctor_identifier": "audit.doctor@praxirence.org", "staff_pin": "123456"}
    )
    assert staff_login_res.status_code == 200
    staff_token = staff_login_res.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Staff can access pending appointments
    staff_access = client.get("/visits/appointments/pending", headers=staff_headers)
    assert staff_access.status_code == 200

    # Doctor rotates PIN to "654321"
    update_pin = client.put(
        f"/doctors/{doc_id}/profile",
        headers=doc_headers,
        json={"staff_pin": "654321"}
    )
    assert update_pin.status_code == 200

    # Old staff token must now be rejected (401 Unauthorized)
    staff_revoked = client.get("/visits/appointments/pending", headers=staff_headers)
    assert staff_revoked.status_code == 401
    assert "PIN was updated" in staff_revoked.json()["detail"]

    # Staff logs in with NEW PIN "654321"
    staff_new_login = client.post(
        "/auth/staff/login",
        json={"doctor_identifier": "audit.doctor@praxirence.org", "staff_pin": "654321"}
    )
    assert staff_new_login.status_code == 200
    staff_new_token = staff_new_login.json()["access_token"]
    staff_new_headers = {"Authorization": f"Bearer {staff_new_token}"}

    # 6. Verify Task 3: Patient-to-Patient IDOR Protection
    # Create Patient A
    pat_a_res = client.post(
        "/patients",
        headers=doc_headers,
        json={"name": "Patient Alpha", "phone": "+919111111111"}
    )
    pat_a_id = pat_a_res.json()["id"]

    # Create Patient B
    pat_b_res = client.post(
        "/patients",
        headers=doc_headers,
        json={"name": "Patient Beta", "phone": "+919222222222"}
    )
    pat_b_id = pat_b_res.json()["id"]

    # Generate token for Patient A
    from app.core.security import create_access_token
    token_a = create_access_token(subject=str(pat_a_id), role="patient")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Patient A can access Patient A
    pat_self = client.get(f"/patients/{pat_a_id}", headers=headers_a)
    assert pat_self.status_code == 200

    # Patient A CANNOT access Patient B (IDOR Blocked -> 403 Forbidden)
    pat_idor = client.get(f"/patients/{pat_b_id}", headers=headers_a)
    assert pat_idor.status_code == 403

    pat_idor_visits = client.get(f"/patients/{pat_b_id}/visits", headers=headers_a)
    assert pat_idor_visits.status_code == 403

    # 7. Verify Task 5 & Task 9: Booking, Status State Machine & Batch Confirmation
    target_date = datetime.now() + timedelta(days=1)
    if target_date.strftime("%a") == "Sun":
        target_date += timedelta(days=1)
    booking_date = target_date.strftime("%Y-%m-%d")
    book_res = client.post(
        "/visits/book-slot",
        json={
            "doctor_id": doc_id,
            "patient_id": pat_a_id,
            "appointment_date": booking_date,
            "time_slot": "11:00 AM",
            "booking_type": "in_person"
        }
    )
    assert book_res.status_code == 200
    visit_id = book_res.json()["appointment"]["id"]

    # Confirm visit with staff_new_headers
    conf_res = client.post(f"/appointments/{visit_id}/confirm", headers=staff_new_headers)
    assert conf_res.status_code == 200
    assert conf_res.json()["status"] == "confirmed"

    # Trying to re-confirm already confirmed visit -> Task 5 guard (400 Bad Request)
    re_conf = client.post(f"/appointments/{visit_id}/confirm", headers=staff_new_headers)
    assert re_conf.status_code == 400
    assert "Only 'pending_confirmation' visits can be confirmed" in re_conf.json()["detail"]

    # Clean DB after test
    db.query(Visit).delete()
    db.query(Patient).delete()
    db.query(User).delete()
    db.commit()
    db.close()
