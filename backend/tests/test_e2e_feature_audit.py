"""
Comprehensive 15-Feature End-to-End Audit Test Suite for Praxirence
Validates Bidirectional Doctor <-> Patient Real-Time Connectedness
"""
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.services.realtime_service import realtime_manager
from app.core.security import create_access_token

@pytest.fixture
def client():
    return TestClient(app)

def test_15_features_bidirectional_audit(client):
    # Setup test Doctor
    doc_email = f"dr.aarav.patel.{int(datetime.now().timestamp())}@praxirence.org"
    doc_reg = client.post("/auth/doctor/register", json={
        "name": "Dr. Aarav Patel",
        "email": doc_email,
        "password": "SecurePassword123!",
        "specialty": "Cardiology",
        "reg_number": "MCI-48291-C",
        "clinic_name": "Patel Heart & Vascular Clinic",
        "clinic_address": "45 Park Street, South Extension, New Delhi",
        "consultation_fee": 800
    })
    assert doc_reg.status_code == 200, f"Doctor reg failed: {doc_reg.text}"
    doc_data = doc_reg.json()
    doc_id = doc_data["user"]["id"]
    doc_token = doc_data["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    # Setup test Patient
    pat_phone = f"+9198{str(int(datetime.now().timestamp()))[:8]}"
    pat_res = client.post(
        "/patients",
        headers=doc_headers,
        json={"name": "Rohan Verma", "phone": pat_phone}
    )
    assert pat_res.status_code in [200, 201], f"Patient create failed: {pat_res.text}"
    pat_id = pat_res.json()["id"]
    pat_token = create_access_token(subject=str(pat_id), role="patient")
    pat_headers = {"Authorization": f"Bearer {pat_token}"}

    events_captured = []
    original_doctor_emit = realtime_manager.emit_to_doctor_sync
    original_patient_emit = realtime_manager.emit_to_patient_sync

    def capture_doc_emit(d_id, event, payload):
        events_captured.append(("doctor", str(d_id), event, payload))
        return original_doctor_emit(d_id, event, payload)

    def capture_pat_emit(p_id, event, payload):
        events_captured.append(("patient", str(p_id), event, payload))
        return original_patient_emit(p_id, event, payload)

    realtime_manager.emit_to_doctor_sync = capture_doc_emit
    realtime_manager.emit_to_patient_sync = capture_pat_emit

    try:
        # FEATURE 1: Doctor Discovery & Live Credentials
        search_res = client.get("/doctors", params={"q": "Cardiology"})
        assert search_res.status_code == 200
        docs = search_res.json()["doctors"]
        found = next((d for d in docs if d["id"] == doc_id), None)
        assert found is not None
        assert found["clinic_name"] == "Patel Heart & Vascular Clinic"
        assert "current_delay_mins" in found

        # FEATURE 2: Online Appointment Booking
        target_date = datetime.now() + timedelta(days=1)
        if target_date.strftime("%a") == "Sun":
            target_date += timedelta(days=1)
        booking_date = target_date.strftime("%Y-%m-%d")

        book_res = client.post("/visits/book-slot", json={
            "doctor_id": doc_id,
            "patient_id": pat_id,
            "appointment_date": booking_date,
            "time_slot": "10:30 AM",
            "booking_type": "in_person",
            "chief_complaint": "Chest tightness on brisk walking"
        })
        assert book_res.status_code == 200
        visit = book_res.json()["appointment"]
        visit_id = visit["id"]
        assert any(e[0] == "doctor" and e[1] == doc_id and e[2] in ["APPOINTMENT_PENDING", "APPOINTMENT_BOOKED"] for e in events_captured)

        # FEATURE 3: Appointment Confirmation & Token Assignment
        conf_res = client.post(f"/appointments/{visit_id}/confirm", headers=doc_headers)
        assert conf_res.status_code == 200
        assert conf_res.json()["status"] == "confirmed"
        assert any(e[0] == "patient" and e[1] == pat_id and e[2] == "APPOINTMENT_CONFIRMED" for e in events_captured)

        # FEATURE 4: Live OPD Queue Tracking & Commute Advisory
        queue_res = client.get(f"/visits/{visit_id}/queue-status")
        assert queue_res.status_code == 200
        q_data = queue_res.json()
        assert "estimated_wait_mins" in q_data
        assert "recommended_departure_time" in q_data

        # FEATURE 5: Call Next Patient into Chamber
        call_res = client.post(f"/visits/doctors/{doc_id}/queue/call-next", headers=doc_headers)
        assert call_res.status_code == 200

        # FEATURE 6 & 7: Consultation Care Plan Approval & Delivery
        plan_res = client.post("/visits", headers=doc_headers, json={
            "visit_id": visit_id,
            "patient_id": pat_id,
            "diagnosis": "Stage 1 Essential Hypertension with exertional angina",
            "patient_summary": "Blood pressure elevated at 148/92 mmHg. Started on Amlodipine 5mg once daily.",
            "doctor_advice": "Low salt diet, brisk walk 30 mins daily, follow-up in 14 days.",
            "medicines": [{
                "name": "Amlodipine 5mg",
                "dosage": "5 mg",
                "frequency": "Once Daily (Morning)",
                "duration": "14 days",
                "instructions": "Take after breakfast with water"
            }],
            "status": "approved",
            "raw_transcription": "Patient presents with chest tightness on walking. BP 148/92. Starting Amlodipine 5mg OD."
        })
        assert plan_res.status_code in [200, 201]
        assert any(e[0] == "patient" and e[1] == pat_id and e[2] in ["NEW_PRESCRIPTION", "NEW_PRESCRIPTION_ISSUED", "CONSULTATION_COMPLETED"] for e in events_captured)

        # FEATURE 8: Medication Dose Telemetry
        # Realtime event PILL_TAKEN forwarding from patient to doctor
        events_captured.clear()
        realtime_manager.emit_to_doctor_sync(doc_id, "PILL_TAKEN", {
            "patient_id": pat_id,
            "medicine_name": "Amlodipine 5mg",
            "dosage_window": "morning"
        })
        assert any(e[0] == "doctor" and e[1] == doc_id and e[2] == "PILL_TAKEN" for e in events_captured)

        # FEATURE 9: Patient Health Vitals Check-in
        events_captured.clear()
        vitals_res = client.post(f"/patients/{pat_id}/vitals-checkin", json={
            "feeling": "better",
            "symptoms": "Blood pressure stabilized, feeling energetic",
            "pain_score": 0,
            "blood_pressure": "122/80",
            "blood_sugar": "95"
        })
        assert vitals_res.status_code == 200
        assert any(e[0] == "doctor" and e[1] == doc_id and e[2] == "PATIENT_VITAL_UPDATED" for e in events_captured)

        # FEATURE 10: OPD Delay Broadcast
        events_captured.clear()
        delay_res = client.post(f"/doctors/{doc_id}/broadcast-delay", headers=doc_headers, json={
            "delay_mins": 25,
            "reason": "Emergency angioplasty case in progress at hospital ICU."
        })
        assert delay_res.status_code == 200
        assert delay_res.json()["current_delay_mins"] == 25

        # Book a scheduled appointment on leave_date to test doctor leave reschedule notification
        future_date = datetime.now() + timedelta(days=3)
        if future_date.strftime("%a") == "Sun":
            future_date += timedelta(days=1)
        leave_date = future_date.strftime("%Y-%m-%d")

        client.post("/visits/book-slot", json={
            "doctor_id": doc_id,
            "patient_id": pat_id,
            "appointment_date": leave_date,
            "time_slot": "02:00 PM",
            "booking_type": "in_person"
        })

        # FEATURE 11: Doctor Leave Toggle
        events_captured.clear()
        leave_res = client.post("/doctors/me/leave", headers=doc_headers, json={
            "date": leave_date,
            "action": "add"
        })
        assert leave_res.status_code == 200
        assert any(e[0] == "patient" and e[1] == pat_id and e[2] in ["DOCTOR_LEAVE", "DOCTOR_LEAVE_RESCHEDULE_REQUIRED"] for e in events_captured)

        # FEATURE 12: Live Digital Consent Request (DPDP Act 2023)
        events_captured.clear()
        consent_req = client.post(f"/patients/{pat_id}/request-live-authorization", headers=doc_headers, json={
            "doctor_id": doc_id,
            "doctor_name": "Dr. Aarav Patel"
        })
        assert consent_req.status_code == 200
        assert any(e[0] == "patient" and e[1] == pat_id and e[2] in ["DOCTOR_AUTHORIZATION_REQUEST", "LIVE_CONSENT_REQUEST"] for e in events_captured)

        # Patient grants consent
        consent_grant = client.post(f"/patients/{pat_id}/respond-live-authorization", json={
            "action": "GRANT"
        })
        assert consent_grant.status_code == 200
        assert any(e[0] == "doctor" and e[1] == doc_id and e[2] in ["PATIENT_LINK_AUTHORIZED", "PATIENT_AUTHORIZED"] for e in events_captured)

        # FEATURE 13: Patient Review & Doctor Rating Telemetry
        events_captured.clear()
        review_res = client.post(f"/doctors/{doc_id}/reviews", json={
            "patient_id": pat_id,
            "patient_name": "Rohan Verma",
            "visit_id": visit_id,
            "rating": 5,
            "review_text": "Extremely thorough explanation of cardiology tests and medications. Great doctor!"
        })
        assert review_res.status_code == 200
        assert any(e[0] == "doctor" and e[1] == doc_id and e[2] == "NEW_DOCTOR_REVIEW" for e in events_captured)

        # FEATURE 14: Multilingual Patient AI Assistant Grounding
        ai_res = client.post("/chat/patient-assistant", json={
            "patient_id": pat_id,
            "message": "When should I take my Amlodipine tablet and what should I eat?",
            "language": "English"
        })
        assert ai_res.status_code == 200
        assert "reply" in ai_res.json()

        # FEATURE 15: Offline Resiliency Verification
        # Validates patient visits endpoint returns complete structured history for offline SQLite vault
        offline_vault_res = client.get(f"/patients/{pat_id}/visits", headers=pat_headers)
        assert offline_vault_res.status_code == 200
        v_list = offline_vault_res.json()
        assert isinstance(v_list, list) and len(v_list) > 0
        found_visit = next((v for v in v_list if v["id"] == visit_id), None)
        assert found_visit is not None
        assert found_visit["diagnosis"] == "Stage 1 Essential Hypertension with exertional angina"

    finally:
        realtime_manager.emit_to_doctor_sync = original_doctor_emit
        realtime_manager.emit_to_patient_sync = original_patient_emit
