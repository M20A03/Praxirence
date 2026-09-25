import sys
import os
import io

# Add backend to path
backend_dir = os.path.abspath('/home/mayank-raj/Downloads/Praxirence/Praxirence /Praxirence/backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.core.database import Base, engine, SessionLocal
from app.main import auto_migrate_schema, seed_initial_data
from app.models.user import User
from app.models.patient import Patient

Base.metadata.create_all(bind=engine)
auto_migrate_schema()
seed_initial_data()

# Ensure doc_test_123 and pat_test_123 exist in DB
with SessionLocal() as db:
    if not db.query(User).filter(User.id == "doc_test_123").first():
        db.add(User(
            id="doc_test_123",
            email="doc_test_123@praxirence.com",
            hashed_password="dummy_hash_for_test",
            name="Dr. Test User",
            specialty="General Medicine"
        ))
    if not db.query(Patient).filter(Patient.id == "pat_test_123").first():
        pat = Patient(
            id="pat_test_123",
            name="Sarah Test Patient",
            consent_status=True
        )
        pat.phone = "9876543210"
        db.add(pat)
    db.commit()

client = TestClient(app)

def run_tests():
    print("=== STARTING END-TO-END DOCTOR-PATIENT CONVERSATION VERIFICATION ===")

    # 1. Generate Auth Tokens
    doc_token = create_access_token(subject="doc_test_123", role="doctor")
    pat_token = create_access_token(subject="pat_test_123", role="patient")
    offline_doc_token = "prax_doc_offline_1740000000000"
    offline_pat_token = "prax_pat_offline_1740000000000"

    # 2. Test /visits/summarize with standard doc token
    print("\n--- 1. Testing /visits/summarize (Standard Token) ---")
    bronchitis_conv = """Doctor: Good morning. What brings you in today?
Patient: Doctor, I have had a continuous chest cough, whistling sound when breathing, and low fever for 4 days.
Doctor: Let me check your chest... Take a deep breath. There is bilateral bronchial wheezing. You have Acute Bronchitis.
I am prescribing Azithromycin 500mg once daily for 3 days, Levosalbutamol cough syrup 5ml twice daily, and Paracetamol 650mg for fever.
Take steam inhalation twice daily and stay in a warm environment. If breathlessness increases, come to emergency."""

    res = client.post(
        "/visits/summarize",
        headers={"Authorization": f"Bearer {doc_token}"},
        json={
            "conversation": bronchitis_conv,
            "patient_name": "Test Patient",
            "doctor_name": "Dr. Mayank Raj"
        }
    )
    print(f"Status Code: {res.status_code}")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    print(f"Diagnosis: {data.get('diagnosis')}")
    print(f"Patient Summary: {data.get('patient_summary', '')[:80]}...")
    print(f"Doctor Advice: {data.get('doctor_advice', '')[:80]}...")
    print(f"Warning Signs ({len(data.get('warning_signs', []))}): {data.get('warning_signs')}")
    print(f"Medicines ({len(data.get('medicines', []))}): {[m.get('name') for m in data.get('medicines', [])]}")
    print(f"Reminders ({len(data.get('reminders', []))}): {[r.get('medicine_name') for r in data.get('reminders', [])]}")
    assert len(data.get('medicines', [])) > 0, "Expected at least 1 medicine"
    assert len(data.get('warning_signs', [])) > 0, "Expected warning signs"
    print("  ✅ PASSED")

    # 3. Test /visits/summarize with offline token
    print("\n--- 2. Testing /visits/summarize (Offline Session Token) ---")
    res_offline = client.post(
        "/visits/summarize",
        headers={"Authorization": f"Bearer {offline_doc_token}"},
        json={
            "conversation": "Doctor: Blood pressure is 150/95. Stage 1 hypertension. Take Telmisartan 40mg once daily after breakfast. Reduce salt.",
            "patient_name": "Offline Patient",
            "doctor_name": "Dr. Mayank Raj"
        }
    )
    print(f"Status Code: {res_offline.status_code}")
    assert res_offline.status_code == 200, f"Expected 200, got {res_offline.status_code}: {res_offline.text}"
    data_offline = res_offline.json()
    print(f"Offline Diagnosis: {data_offline.get('diagnosis')}")
    print(f"Offline Medicines: {[m.get('name') for m in data_offline.get('medicines', [])]}")
    print("  ✅ PASSED")

    # 4. Test /visits/upload-audio
    print("\n--- 3. Testing /visits/upload-audio ---")
    dummy_wav = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x80>\x00\x00\x01\x00\x08\x00data\x00\x00\x00\x00"
    files = {"audio_file": ("test_consult.wav", io.BytesIO(dummy_wav), "audio/wav")}
    data_form = {
        "patient_id": "pat_test_123",
        "keep_recording": "false",
        "language": "en"
    }
    res_audio = client.post(
        "/visits/upload-audio",
        headers={"Authorization": f"Bearer {doc_token}"},
        data=data_form,
        files=files
    )
    print(f"Audio Upload Status Code: {res_audio.status_code}")
    assert res_audio.status_code == 200, f"Expected 200, got {res_audio.status_code}: {res_audio.text}"
    audio_data = res_audio.json()
    print(f"Audio Diagnosis: {audio_data.get('diagnosis')}")
    print(f"Audio Transcription: {audio_data.get('raw_transcription', '')[:80]}...")
    assert "medicines" in audio_data
    print("  ✅ PASSED")

    # 5. Test /chat/patient-assistant - Consultation Explanation (English)
    # Note: This test user has no visit data in DB, so consultation_explanation
    # won't activate (requires latest_diagnosis/summary). The key validation is
    # that it does NOT fall into doctor_recommendation despite containing "doctor".
    print("\n--- 4. Testing /chat/patient-assistant (Consultation Query - English) ---")
    res_chat_en = client.post(
        "/chat/patient-assistant",
        headers={"Authorization": f"Bearer {pat_token}"},
        json={
            "message": "What did the doctor advise me in our consultation?",
            "language": "English",
            "patient_id": "pat_test_123"
        }
    )
    print(f"Chat (EN) Status Code: {res_chat_en.status_code}")
    assert res_chat_en.status_code == 200, f"Expected 200, got {res_chat_en.status_code}: {res_chat_en.text}"
    chat_en = res_chat_en.json()
    print(f"Intent: {chat_en.get('detected_intent')}")
    print(f"Reply: {chat_en.get('reply', '')[:120]}...")
    # CRITICAL: must NOT be doctor_recommendation (the original bug)
    assert chat_en.get('detected_intent') != 'doctor_recommendation', \
        f"Bug: Consultation query misrouted to doctor_recommendation"
    print("  ✅ PASSED (not misrouted to doctor_recommendation)")

    # 6. Test /chat/patient-assistant - Consultation Explanation (Hindi)
    print("\n--- 5. Testing /chat/patient-assistant (Consultation Query - Hindi) ---")
    res_chat_hi = client.post(
        "/chat/patient-assistant",
        headers={"Authorization": f"Bearer {pat_token}"},
        json={
            "message": "डॉक्टर साहब ने परामर्श में क्या सलाह दी?",
            "language": "Hindi",
            "patient_id": "pat_test_123"
        }
    )
    print(f"Chat (HI) Status Code: {res_chat_hi.status_code}")
    assert res_chat_hi.status_code == 200, f"Expected 200, got {res_chat_hi.status_code}: {res_chat_hi.text}"
    chat_hi = res_chat_hi.json()
    print(f"Intent: {chat_hi.get('detected_intent')}")
    print(f"Reply: {chat_hi.get('reply', '')[:120]}...")
    assert chat_hi.get('detected_intent') != 'doctor_recommendation', \
        f"Bug: Hindi consultation query misrouted to doctor_recommendation"
    print("  ✅ PASSED (not misrouted to doctor_recommendation)")

    # 7. Test /chat/patient-assistant - Offline Patient Token
    print("\n--- 6. Testing /chat/patient-assistant (Offline Token) ---")
    res_chat_offline = client.post(
        "/chat/patient-assistant",
        headers={"Authorization": f"Bearer {offline_pat_token}"},
        json={
            "message": "Explain my medication schedule",
            "language": "English",
            "patient_id": "pat_test_123"
        }
    )
    print(f"Chat Offline Status Code: {res_chat_offline.status_code}")
    assert res_chat_offline.status_code == 200, f"Expected 200, got {res_chat_offline.status_code}: {res_chat_offline.text}"
    print(f"Intent: {res_chat_offline.json().get('detected_intent')}")
    print("  ✅ PASSED")

    # 8. Test /chat/patient-assistant - Direct Doctor Search (should still be doctor_recommendation)
    print("\n--- 7. Testing /chat/patient-assistant (Doctor Search) ---")
    res_chat_doc = client.post(
        "/chat/patient-assistant",
        headers={"Authorization": f"Bearer {pat_token}"},
        json={
            "message": "Find me a good cardiologist nearby",
            "language": "English",
            "patient_id": "pat_test_123"
        }
    )
    print(f"Chat (Doc Search) Status Code: {res_chat_doc.status_code}")
    assert res_chat_doc.status_code == 200
    chat_doc = res_chat_doc.json()
    print(f"Intent: {chat_doc.get('detected_intent')}")
    assert chat_doc.get('detected_intent') == 'doctor_recommendation', \
        f"Expected doctor_recommendation, got {chat_doc.get('detected_intent')}"
    print("  ✅ PASSED")

    # 9. Test /chat/patient-assistant - Prescription Explanation
    print("\n--- 8. Testing /chat/patient-assistant (Prescription Explanation) ---")
    res_chat_med = client.post(
        "/chat/patient-assistant",
        headers={"Authorization": f"Bearer {pat_token}"},
        json={
            "message": "Tell me about my medicine dosage",
            "language": "English",
            "patient_id": "pat_test_123"
        }
    )
    print(f"Chat (Med) Status Code: {res_chat_med.status_code}")
    assert res_chat_med.status_code == 200
    print(f"Intent: {res_chat_med.json().get('detected_intent')}")
    print("  ✅ PASSED")

    print("\n" + "=" * 70)
    print("  ALL 8 E2E TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
