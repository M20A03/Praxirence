import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import User
from app.models.patient import Patient
from app.models.visit import Visit
from app.core.database import Base, engine, SessionLocal, get_db

client = TestClient(app)


def get_test_db():
    if get_db in app.dependency_overrides:
        return next(app.dependency_overrides[get_db]())
    return SessionLocal()


def setup_module():
    Base.metadata.create_all(bind=engine)
    from app.main import auto_migrate_schema
    auto_migrate_schema()
    db = get_test_db()
    lko_doc = db.query(User).filter(User.city == "Lucknow").first()
    if not lko_doc:
        lko_doc = User(
            email="dr.aarav.test@praxirence.com",
            hashed_password="mock",
            name="Dr. Aarav Mehta",
            phone="+919820011223",
            specialty="Pediatrics & Child Specialist",
            clinic_name="Apollo Clinic Indira Nagar",
            reg_number="UPMC-2021-49201",
            city="Lucknow",
            state="Uttar Pradesh",
            pincode="226016",
            clinic_address="Sector 14, Indira Nagar, Lucknow",
            latitude=26.8833,
            longitude=80.9984,
            available_days=["Mon", "Tue", "Wed", "Thu", "Fri"],
            working_hours_start="10:00",
            working_hours_end="17:00",
            consultation_fee=600
        )
        db.add(lko_doc)

    blr_doc = db.query(User).filter(User.city == "Bangalore").first()
    if not blr_doc:
        blr_doc = User(
            email="dr.mayank.test@praxirence.com",
            hashed_password="mock",
            name="Dr. Mayank Raj",
            phone="+919876543210",
            specialty="Chief Medical Officer",
            clinic_name="Praxirence Clinical Centre",
            reg_number="NMC-2024-84920",
            city="Bangalore",
            state="Karnataka",
            pincode="560038",
            clinic_address="12th Main, Indiranagar, Bangalore",
            latitude=12.9716,
            longitude=77.5946,
            available_days=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            working_hours_start="09:00",
            working_hours_end="18:00",
            consultation_fee=500
        )
        db.add(blr_doc)

    pat = db.query(Patient).first()
    if not pat:
        pat = Patient(name="Mayank", phone="+919835139865", consent_status=True)
        db.add(pat)

    db.commit()
    db.close()


def test_doctor_discovery_geolocation():
    setup_module()
    """Verify geolocation discovery, city filter, and Haversine distance"""
    # 1. City Filter: Lucknow
    res_lko = client.get("/doctors?city=Lucknow")
    assert res_lko.status_code == 200
    data_lko = res_lko.json()
    assert len(data_lko["doctors"]) >= 1
    assert any(d["city"] == "Lucknow" for d in data_lko["doctors"])

    # 2. Geolocation proximity: User in Bangalore (lat=12.9716, lng=77.5946)
    res_near = client.get("/doctors?lat=12.9716&lng=77.5946&radius_km=50")
    assert res_near.status_code == 200
    data_near = res_near.json()
    assert len(data_near["doctors"]) >= 1
    closest = data_near["doctors"][0]
    assert closest["city"] == "Bangalore"
    assert closest["distance_km"] is not None
    assert closest["distance_km"] < 10.0


def test_doctor_availability_and_slot_booking_lifecycle():
    """
    Verify complete booking lifecycle:
    1. Query slots on practicing day
    2. Book available slot
    3. Verify slot is now reserved
    4. Verify double-booking returns 409 Conflict
    5. Mark doctor on leave -> verify availability is false and booking returns 400
    """
    setup_module()
    db = get_test_db()
    doctor = db.query(User).filter(User.city == "Bangalore").first()
    patient = db.query(Patient).first()
    assert doctor is not None
    assert patient is not None
    doc_id = str(doctor.id)
    pat_id = str(patient.id)
    db.close()

    # Target tomorrow
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    # 1. Check availability
    res_avail = client.get(f"/doctors/{doc_id}/availability?date={tomorrow}")
    assert res_avail.status_code == 200
    avail_data = res_avail.json()

    # If tomorrow is a Sunday, test with day after tomorrow
    target_date = tomorrow
    if not avail_data["is_available"] and "Sunday" in avail_data.get("reason", ""):
        target_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        res_avail = client.get(f"/doctors/{doc_id}/availability?date={target_date}")
        avail_data = res_avail.json()

    assert avail_data["is_available"] is True
    assert len(avail_data["slots"]) > 0

    # Ensure clean test state for target_date
    db = get_test_db()
    db.query(Visit).filter(Visit.doctor_id == doctor.id, Visit.appointment_date == target_date).delete()
    db.commit()
    db.close()

    # Re-fetch slots to verify test_slot is available
    res_avail = client.get(f"/doctors/{doc_id}/availability?date={target_date}")
    test_slot = res_avail.json()["slots"][0]["time"]

    # 2. Book the slot
    book_payload = {
        "doctor_id": doc_id,
        "patient_id": pat_id,
        "appointment_date": target_date,
        "time_slot": test_slot,
        "chief_complaint": "Persistent Migraine & Visual Aura",
        "booking_type": "in_person"
    }
    res_book = client.post("/visits/book-slot", json=book_payload)
    assert res_book.status_code == 200
    booked_info = res_book.json()
    assert booked_info["success"] is True
    assert booked_info["status"] == "scheduled"
    assert booked_info["appointment"]["time_slot"] == test_slot

    # 3. Verify double-booking prevention (409 Conflict)
    res_conflict = client.post("/visits/book-slot", json=book_payload)
    assert res_conflict.status_code == 409
    assert "already been reserved" in res_conflict.json()["detail"]

    # 4. Mark doctor on leave for a specific practicing weekday
    leave_offset = 3 if (datetime.now() + timedelta(days=3)).weekday() != 6 else 4
    future_leave_date = (datetime.now() + timedelta(days=leave_offset)).strftime("%Y-%m-%d")
    res_leave = client.post(
        f"/doctors/me/leave?doctor_id={doc_id}",
        json={"date": future_leave_date, "action": "add"}
    )
    assert res_leave.status_code == 200

    # Verify availability returns false on leave date
    res_leave_avail = client.get(f"/doctors/{doc_id}/availability?date={future_leave_date}")
    assert res_leave_avail.status_code == 200
    assert res_leave_avail.json()["is_available"] is False
    assert "leave" in res_leave_avail.json()["reason"].lower()

    # Attempting to book on leave date must return 400 Bad Request
    leave_book_payload = {
        "doctor_id": doc_id,
        "patient_id": pat_id,
        "appointment_date": future_leave_date,
        "time_slot": "10:00 AM",
        "chief_complaint": "Checkup",
        "booking_type": "in_person"
    }
    res_fail_leave = client.post("/visits/book-slot", json=leave_book_payload)
    assert res_fail_leave.status_code == 400
    assert "leave" in res_fail_leave.json()["detail"].lower()


def test_consecutive_slot_booking_queue_system():
    """
    Verify that when multiple patients book with the same doctor on the same date:
    1. First patient gets Token 1 (PX-01) with 0 patients ahead, 0 wait mins.
    2. Second patient gets Token 2 (PX-02) with 1 patient ahead, 30 wait mins.
    3. GET /visits/{visit_id}/queue-status returns live queue state, currently serving token PX-01.
    4. Advancing queue changes status and advances live queue tracking.
    """
    setup_module()
    db = get_test_db()
    doctor = db.query(User).filter(User.city == "Bangalore").first()
    assert doctor is not None
    doc_id = str(doctor.id)

    # Ensure two patients exist
    patient1 = db.query(Patient).first()
    assert patient1 is not None
    patient2 = db.query(Patient).filter(Patient.id != patient1.id).first()
    if not patient2:
        patient2 = Patient(name="Rohan Sharma", phone="+919876500001", consent_status=True)
        db.add(patient2)
        db.commit()
        db.refresh(patient2)

    pat1_id = str(patient1.id)
    pat2_id = str(patient2.id)

    # Pick a test date (4 days from now, ensuring not Sunday)
    target_date = (datetime.now() + timedelta(days=4)).strftime("%Y-%m-%d")
    target_dt = datetime.strptime(target_date, "%Y-%m-%d")
    if target_dt.strftime("%a") == "Sun":
        target_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")

    # Clear any previous visits for this doctor & target_date
    db.query(Visit).filter(Visit.doctor_id == doctor.id, Visit.appointment_date == target_date).delete()
    db.commit()
    db.close()

    # 1. Patient 1 books 09:30 AM
    book1_res = client.post("/visits/book-slot", json={
        "doctor_id": doc_id,
        "patient_id": pat1_id,
        "appointment_date": target_date,
        "time_slot": "09:30 AM",
        "chief_complaint": "Seasonal Allergy",
        "booking_type": "in_person"
    })
    assert book1_res.status_code == 200
    data1 = book1_res.json()
    assert data1["token_number"] == 1
    assert data1["token_display"] == "PX-01"
    assert data1["patients_ahead"] == 0
    assert data1["estimated_wait_mins"] == 0
    visit1_id = data1["visit_id"]

    # 2. Patient 2 books 10:00 AM with the same doctor on the same date
    book2_res = client.post("/visits/book-slot", json={
        "doctor_id": doc_id,
        "patient_id": pat2_id,
        "appointment_date": target_date,
        "time_slot": "10:00 AM",
        "chief_complaint": "Chest Congestion & Mild Fever",
        "booking_type": "in_person"
    })
    assert book2_res.status_code == 200
    data2 = book2_res.json()
    assert data2["token_number"] == 2
    assert data2["token_display"] == "PX-02"
    assert data2["patients_ahead"] == 1
    assert data2["estimated_wait_mins"] == 30
    visit2_id = data2["visit_id"]

    # 3. Check Live Queue Status for Patient 2
    q_res = client.get(f"/visits/{visit2_id}/queue-status")
    assert q_res.status_code == 200
    q_data = q_res.json()
    assert q_data["token_number"] == 2
    assert q_data["token_display"] == "PX-02"
    assert q_data["current_serving_token"] == "PX-01"
    assert q_data["patients_ahead"] == 1
    assert q_data["estimated_wait_mins"] == 30

    # 4. Advance Patient 1 to 'completed'
    adv_res = client.post(f"/visits/{visit1_id}/advance-queue", json={"status": "completed"})
    assert adv_res.status_code == 200
    assert adv_res.json()["status"] == "completed"

    # Now Patient 2 should have 0 patients ahead and be the serving token!
    q_res2 = client.get(f"/visits/{visit2_id}/queue-status")
    assert q_res2.status_code == 200
    q_data2 = q_res2.json()
    assert q_data2["patients_ahead"] == 0
    assert q_data2["estimated_wait_mins"] == 0
    assert q_data2["current_serving_token"] == "PX-02"


def test_walk_in_encounter_and_fcm_token():
    """
    Verify:
    1. POST /patients/{patient_id}/fcm-token registers device push token.
    2. POST /visits/walk-in creates persistent walk-in visit with sequential token and broadcast.
    """
    setup_module()
    db = get_test_db()
    doctor = db.query(User).first()
    patient = db.query(Patient).first()
    assert doctor is not None
    assert patient is not None
    doc_id = str(doctor.id)
    pat_id = str(patient.id)
    db.close()

    # 1. Test FCM Token Registration
    fcm_res = client.post(f"/patients/{pat_id}/fcm-token", json={"fcm_token": "test_expo_push_token_999"})
    assert fcm_res.status_code == 200
    assert fcm_res.json()["success"] is True

    # 2. Test Persistent Walk-In Creation
    walkin_res = client.post("/visits/walk-in", json={
        "patient_id": pat_id,
        "doctor_id": doc_id,
        "chief_complaint": "Acute Asthma Exacerbation",
        "triage": "Priority"
    })
    assert walkin_res.status_code == 200
    w_data = walkin_res.json()
    assert w_data["success"] is True
    assert "token" in w_data
    assert w_data["chief_complaint"] == "Acute Asthma Exacerbation"
    assert w_data["triage"] == "Priority"
    assert w_data["status"] == "Waiting in Clinic"

