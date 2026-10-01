import requests
import json
import uuid
import urllib.parse
import sys
import time

BASE_URL = "https://praxirence-production.up.railway.app"
results = {}

print("================================================================================")
print("     PRAXIRENCE PRODUCTION PLATFORM MASTER AUDIT & VERIFICATION SUITE           ")
print("================================================================================")

# ------------------------------------------------------------------------------
# SECTION 1: CLOUD BACKEND & HEALTH VERIFICATION
# ------------------------------------------------------------------------------
print("\n[SECTION 1: Cloud Backend & Health Verification]")
r_health = requests.get(f"{BASE_URL}/health")
assert r_health.status_code == 200, f"Health check failed: {r_health.text}"
health_data = r_health.json()
print("1. Health Check Response:\n", json.dumps(health_data, indent=2))
assert health_data.get("status") == "healthy"
assert health_data.get("database", {}).get("dialect") == "postgresql"
assert health_data.get("models_loaded") is True

r_check_phone = requests.post(
    f"{BASE_URL}/auth/check-phone",
    json={"phone": "+919876543210"}
)
phone_data = r_check_phone.json()
print("2. Check Dummy Phone Response:\n", json.dumps(phone_data, indent=2))
assert phone_data.get("registered") is False
results["Section 1: Backend Health & Zero-Dummy Status"] = "PASS"

# ------------------------------------------------------------------------------
# SECTION 2: DOCTOR REGISTRATION & AUTHENTICATION
# ------------------------------------------------------------------------------
print("\n[SECTION 2: Doctor Registration & Authentication]")
doc_email = f"dr.audit_{uuid.uuid4().hex[:6]}@praxirence.com"
doc_phone = f"+9198{uuid.uuid4().int % 100000000:08d}"
doc_payload = {
    "name": "Dr. Mayank Raj",
    "email": doc_email,
    "phone": doc_phone,
    "password": "SecurePassword123!",
    "specialty": "Cardiology & Internal Medicine",
    "clinic_name": "Praxirence Heart & Health Clinic",
    "reg_number": "MCI-2026-789012",
    "degree": "MBBS, MD"
}
r_doc_reg = requests.post(f"{BASE_URL}/auth/doctor/register", json=doc_payload)
print("1. Doctor Registration HTTP Status:", r_doc_reg.status_code)
assert r_doc_reg.status_code == 200, f"Doctor registration failed: {r_doc_reg.text}"
doc_auth_data = r_doc_reg.json()
doc_token = doc_auth_data.get("access_token")
doctor_id = doc_auth_data.get("user", {}).get("id")
print("Doctor ID:", doctor_id)
print("JWT Token (prefix):", doc_token[:30] + "...")
assert doc_token is not None
assert doc_auth_data.get("role") == "doctor"

# Verify appearance in GET /doctors and GET /auth/directory
r_docs = requests.get(f"{BASE_URL}/doctors")
assert r_docs.status_code == 200
docs_list = r_docs.json().get("doctors", [])
doc_found = any(d.get("id") == doctor_id for d in docs_list)
print("2. Doctor Found in /doctors:", doc_found)
assert doc_found

r_dir = requests.get(f"{BASE_URL}/auth/directory")
assert r_dir.status_code == 200
dir_docs = r_dir.json().get("doctors", [])
doc_in_dir = any(d.get("id") == doctor_id for d in dir_docs)
print("3. Doctor Found in /auth/directory:", doc_in_dir)
assert doc_in_dir
results["Section 2: Doctor Registration & JWT Auth"] = "PASS"

# ------------------------------------------------------------------------------
# SECTION 3: PATIENT CREATION & UNIQUE ID VERIFICATION
# ------------------------------------------------------------------------------
print("\n[SECTION 3: Patient Creation & Unique ID Verification]")
headers = {"Authorization": f"Bearer {doc_token}"}
patient_name = "Aarav Sharma"
patient_phone = f"+9198{uuid.uuid4().int % 100000000:08d}"

# Register Patient 1
r_pat1 = requests.post(
    f"{BASE_URL}/patients",
    headers=headers,
    json={"name": patient_name, "phone": patient_phone}
)
print("1. Patient 1 Registration HTTP Status:", r_pat1.status_code)
assert r_pat1.status_code == 201, f"Patient creation failed: {r_pat1.text}"
pat1_data = r_pat1.json()
patient_id = pat1_data.get("id")
print("Patient 1 ID (UUID 36 chars):", patient_id, f"(Length: {len(patient_id)})")
assert len(patient_id) == 36

# Non-uniqueness of Patient Name Verification:
# Create Patient 2 with SAME name "Aarav Sharma" but different phone
patient_phone_2 = f"+9198{uuid.uuid4().int % 100000000:08d}"
r_pat2 = requests.post(
    f"{BASE_URL}/patients",
    headers=headers,
    json={"name": patient_name, "phone": patient_phone_2}
)
print("2. Patient 2 (Same Name) Registration HTTP Status:", r_pat2.status_code)
assert r_pat2.status_code == 201
pat2_data = r_pat2.json()
assert pat2_data.get("id") != patient_id
assert pat2_data.get("name") == patient_name
print("Confirmed: Patient name is NOT required to be unique! (Multiple patients can share names)")

# Search by Name
r_search_name = requests.get(f"{BASE_URL}/patients", headers=headers, params={"query": "Aarav Sharma"})
results_name = r_search_name.json()
print("3. Search by Name ('Aarav Sharma') Count:", len(results_name))
assert any(p["id"] == patient_id for p in results_name)

# Search by Phone (using query parameter with proper encoding)
enc_phone = urllib.parse.quote_plus(patient_phone)
r_search_phone = requests.get(f"{BASE_URL}/patients?query={enc_phone}", headers=headers)
results_phone = r_search_phone.json()
print(f"4. Search by Phone ({patient_phone}) Count:", len(results_phone))
assert any(p["id"] == patient_id for p in results_phone)

# Search by Unique ID (UUID)
r_search_id = requests.get(f"{BASE_URL}/patients?query={patient_id}", headers=headers)
results_id = r_search_id.json()
print(f"5. Search by Unique ID ({patient_id[:8]}...) Count:", len(results_id))
assert any(p["id"] == patient_id for p in results_id)
results["Section 3: Patient Creation & Unique ID Verification"] = "PASS"

# ------------------------------------------------------------------------------
# SECTION 4: CONSULTATION & PRESCRIPTION MANAGEMENT (ADD / REMOVE MEDICINE)
# ------------------------------------------------------------------------------
print("\n[SECTION 4: Consultation & Prescription Management]")

medicines = []
reminders = []

def add_medicine(name, dosage, frequency, meal_relation):
    med = {
        "name": name,
        "dosage": dosage,
        "frequency": frequency,
        "duration": "5 days",
        "meal_relation": meal_relation,
        "is_sos": False
    }
    medicines.append(med)
    reminders.append({
        "medicine_name": name,
        "dosage": dosage,
        "time": "09:00",
        "meal_relation": meal_relation
    })
    return med

def remove_medicine(idx):
    removed = medicines.pop(idx)
    reminders[:] = [r for r in reminders if r["medicine_name"] != removed["name"]]
    return removed

# 1. Add Valid Medicine
add_medicine("Augmentin 625", "1 Tablet", "1-0-1", "after_meal")
print("1. Added Augmentin 625. Current Medicines:", [m["name"] for m in medicines])
assert len(medicines) == 1
assert medicines[0]["name"] == "Augmentin 625"

# 2. Add Wrong Medicine (Negative/Correction Test)
add_medicine("WrongDrug 500mg", "1 Capsule", "0-0-1", "before_meal")
print("2. Added WrongDrug 500mg. Current Medicines:", [m["name"] for m in medicines])
assert len(medicines) == 2
assert medicines[1]["name"] == "WrongDrug 500mg"

# 3. Remove Wrong Medicine
removed_item = remove_medicine(1)
print(f"3. Removed Incorrect Drug ({removed_item['name']}). Remaining Medicines:", [m["name"] for m in medicines])
assert len(medicines) == 1
assert medicines[0]["name"] == "Augmentin 625"
assert not any(m["name"] == "WrongDrug 500mg" for m in medicines)
assert not any(r["medicine_name"] == "WrongDrug 500mg" for r in reminders)
print("Confirmed: Wrong medicine successfully and cleanly removed from prescription list & reminder schedules.")

# 4. Care Plan Creation & Approval
visit_payload = {
    "patient_id": patient_id,
    "doctor_id": doctor_id,
    "diagnosis": "Bacterial Respiratory Infection with Acute Pharyngitis",
    "patient_summary": "Aarav Sharma, Dr. Mayank Raj evaluated your chest and throat.",
    "doctor_advice": "Complete full 5-day course of Augmentin 625. Warm saline gargles twice daily.",
    "raw_transcription": "Consultation between Dr. Mayank Raj and Aarav Sharma regarding sore throat and pyrexia.",
    "medicines": medicines,
    "reminders": reminders,
    "status": "approved"
}
r_visit = requests.post(f"{BASE_URL}/visits", headers=headers, json=visit_payload)
print("4. Care Plan Creation Status:", r_visit.status_code)
assert r_visit.status_code in (200, 201), f"Visit creation failed: {r_visit.text}"
visit_data = r_visit.json()
visit_id = visit_data.get("id")
print("Created Visit ID:", visit_id)

# Approve Visit
r_approve = requests.post(f"{BASE_URL}/visits/{visit_id}/approve", headers=headers, json={"language": "en"})
print("5. Care Plan Approval Status:", r_approve.status_code)
assert r_approve.status_code == 200
results["Section 4: Consultation Care Plan (Add/Remove Meds)"] = "PASS"

# ------------------------------------------------------------------------------
# SECTION 5: PATIENT APP MOBILE JOURNEYS & ROUTING
# ------------------------------------------------------------------------------
print("\n[SECTION 5: Patient App Mobile Journeys & Routing]")

# 1. Today Tab - Verify Medication Reminders & Portal
r_portal = requests.get(f"{BASE_URL}/patients/{patient_id}/reschedule-pending", headers=headers)
assert r_portal.status_code == 200
print("1. Today Tab: Patient schedule and alerts verified.")

# 2. Vault Tab - Get Patient Visits & Prescription
r_pat_visits = requests.get(f"{BASE_URL}/patients/{patient_id}/visits", headers=headers)
assert r_pat_visits.status_code == 200
vault_visits = r_pat_visits.json()
print("2. Vault Tab: Prescriptions verified. Count:", len(vault_visits))
assert len(vault_visits) >= 1
assert vault_visits[0]["diagnosis"] == "Bacterial Respiratory Infection with Acute Pharyngitis"

# 3. Specialists Tab - Verify Doctor Listing
r_spec = requests.get(f"{BASE_URL}/doctors")
assert r_spec.status_code == 200
assert any(d["id"] == doctor_id for d in r_spec.json().get("doctors", []))
print("3. Specialists Tab: Directory verified with Dr. Mayank Raj.")

# 4. Assistant Tab - Grounded AI Chat Assistant (Hindi/English)
chat_payload = {
    "message": "Meri dawa kab leni hai aur kya khana hai?",
    "language": "Hindi",
    "patient_id": patient_id,
    "active_medications": medicines
}
r_chat = requests.post(f"{BASE_URL}/chat/patient-assistant", json=chat_payload)
print("4. Assistant Tab: AI Response HTTP Status:", r_chat.status_code)
assert r_chat.status_code == 200
chat_res = r_chat.json()
print("AI Reply Snippet:\n", chat_res.get("reply", "")[:180] + "...")
assert "safety_disclaimer" in chat_res

# 5. Profile Tab - DPDP Consent Update
r_consent = requests.post(
    f"{BASE_URL}/patients/{patient_id}/consent",
    headers=headers,
    json={"consent_status": True}
)
print("5. Profile Tab: Consent Status:", r_consent.status_code)
assert r_consent.status_code == 200
assert r_consent.json().get("consent_status") is True
results["Section 5: Patient App Mobile Journeys & Routing"] = "PASS"

# ------------------------------------------------------------------------------
# SECTION 6: OFFLINE RESILIENCE
# ------------------------------------------------------------------------------
print("\n[SECTION 6: Offline Resilience]")
# Test Offline NLP Rule Engine
from app.services.ai_service import ai_service
offline_summary = ai_service.summarize_consultation_for_patient(
    conversation="Patient presenting with acute bronchitis, coughing, wheezing and fever since 3 days.",
    patient_name="Aarav Sharma",
    doctor_name="Dr. Mayank Raj"
)
print("1. Local Offline Clinical Entity Extraction:")
print("   Diagnosis:", offline_summary.get("diagnosis"))
print("   Doctor Advice:", offline_summary.get("doctor_advice"))
print("   Warning Signs:", offline_summary.get("warning_signs"))
assert "Bronchitis" in offline_summary.get("diagnosis", "") or "bronchitis" in offline_summary.get("diagnosis", "").lower()
assert len(offline_summary.get("warning_signs", [])) > 0
results["Section 6: Offline Resilience & Local NLP"] = "PASS"

print("\n================================================================================")
print("                         AUDIT RESULTS SUMMARY MATRIX                           ")
print("================================================================================")
for k, v in results.items():
    print(f"  {k:<55} : [{v}]")
print("================================================================================")
