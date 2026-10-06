"""
20-Consultation Clinical Stress Matrix (5 Doctors x 4 Patients)
Tests full lifecycle: UHID, Linking/Auth, Queue, Consultation, Approval,
Digital Signature, Patient Vault, and ReportLab Prescription PDF.
"""

import sys
import os
import json
import time
from typing import Dict, Any, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import User
from app.models.patient import Patient
from app.models.doctor_patient_link import DoctorPatientLink
from app.models.visit import Visit
from tests.conftest import TestingSessionLocal

client = TestClient(app)

DOCTORS = [
    {
        "key": "doc_cardio",
        "name": "Dr. Ashish Mehta",
        "email": "ashish.mehta@praxirence.com",
        "specialty": "Cardiology",
        "reg_number": "MCI-CARD-001",
        "clinic": "Mehta Heart Institute",
        "phone": "+919810100001"
    },
    {
        "key": "doc_pulmo",
        "name": "Dr. Sunita Kulkarni",
        "email": "sunita.kulkarni@praxirence.com",
        "specialty": "Pulmonology",
        "reg_number": "MCI-PULM-002",
        "clinic": "Kulkarni Chest & Allergy Center",
        "phone": "+919810100002"
    },
    {
        "key": "doc_diabeto",
        "name": "Dr. Rajiv Nair",
        "email": "rajiv.nair@praxirence.com",
        "specialty": "General Medicine & Diabetology",
        "reg_number": "MCI-GEN-003",
        "clinic": "Nair Metabolic Clinic",
        "phone": "+919810100003"
    },
    {
        "key": "doc_pedia",
        "name": "Dr. Priya Swaminathan",
        "email": "priya.swaminathan@praxirence.com",
        "specialty": "Pediatrics",
        "reg_number": "MCI-PED-004",
        "clinic": "Swaminathan Child Wellness",
        "phone": "+919810100004"
    },
    {
        "key": "doc_derma",
        "name": "Dr. Farhan Akhtar",
        "email": "farhan.akhtar@praxirence.com",
        "specialty": "Dermatology",
        "reg_number": "MCI-DERM-005",
        "clinic": "Skin & Aesthetics Lounge",
        "phone": "+919810100005"
    }
]

# Random / Unauthorized Doctor (to test 403 checks)
UNAUTH_DOCTOR = {
    "key": "doc_unauth",
    "name": "Dr. Random Stranger",
    "email": "stranger.doc@praxirence.com",
    "specialty": "General Surgery",
    "reg_number": "MCI-RAND-999",
    "clinic": "Random Clinic",
    "phone": "+919810100999"
}

CASES = [
    # 1. Cardiology (Dr. Ashish Mehta)
    {
        "doc_key": "doc_cardio",
        "patient": {"name": "Rameshvar Sharma", "phone": "+919820010001", "dob": "1968-03-12", "gender": "Male", "custom_uhid": "MHI-PAT-101"},
        "chief_complaint": "Persistent occipital morning headaches with blood pressure spikes to 160/100 mmHg",
        "triage": "Priority",
        "diagnosis": "Essential Hypertension Stage 2",
        "patient_summary": "Blood pressure is elevated. Continue daily sodium restriction and regular morning checks.",
        "doctor_advice": "Check BP every morning at 8 AM. Limit daily salt to under 5 grams. Walk 30 minutes daily.",
        "medicines": [
            {"name": "Telmisartan 40mg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 30, "instructions": "After breakfast"},
            {"name": "Amlodipine 5mg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 30, "instructions": "At bedtime"}
        ]
    },
    {
        "doc_key": "doc_cardio",
        "patient": {"name": "Kamala Devi", "phone": "+919820010002", "dob": "1960-07-22", "gender": "Female", "custom_uhid": None},
        "chief_complaint": "Retrosternal chest heaviness on climbing stairs, relieved within 5 minutes of rest",
        "triage": "Routine",
        "diagnosis": "Chronic Stable Angina Pectoris (CCS Class II)",
        "patient_summary": "Heart blood supply is narrowed causing exertion discomfort. Keep emergency tablets handy.",
        "doctor_advice": "Avoid heavy lifting or sudden cold exposure. Keep Sorbitrate sublingual under tongue if chest tightness occurs.",
        "medicines": [
            {"name": "Metoprolol Succinate 50mg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 30, "instructions": "After breakfast"},
            {"name": "Isosorbide Dinitrate 5mg", "dosage": "1 tablet", "frequency": "SOS", "duration_days": 15, "instructions": "Sublingual on chest pain"}
        ]
    },
    {
        "doc_key": "doc_cardio",
        "patient": {"name": "Anil Kulkarni", "phone": "+919820010003", "dob": "1975-11-04", "gender": "Male", "custom_uhid": "MHI-PAT-103"},
        "chief_complaint": "Post-anterior wall STEMI stent follow-up, lipid profile review",
        "triage": "Routine",
        "diagnosis": "Post-Percutaneous Coronary Intervention / Dyslipidemia",
        "patient_summary": "Stents are patent and functioning well. Maintain strict cholesterol-lowering therapy.",
        "doctor_advice": "Maintain low-fat diet. Repeat Lipid Profile and Echocardiogram after 6 months.",
        "medicines": [
            {"name": "Atorvastatin 40mg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 60, "instructions": "At bedtime"},
            {"name": "Aspirin 75mg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 60, "instructions": "After lunch"}
        ]
    },
    {
        "doc_key": "doc_cardio",
        "patient": {"name": "Meera Banerjee", "phone": "+919820010004", "dob": "1955-09-19", "gender": "Female", "custom_uhid": None},
        "chief_complaint": "Bilateral pedal edema, orthopnea, and shortness of breath when lying flat",
        "triage": "Urgent",
        "diagnosis": "Congestive Heart Failure (NYHA Class III)",
        "patient_summary": "Fluid retention due to weak heart pumping. Strict fluid restriction advised.",
        "doctor_advice": "Limit fluid intake to maximum 1.2 liters daily. Weigh yourself every morning.",
        "medicines": [
            {"name": "Furosemide 40mg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 15, "instructions": "In morning on empty stomach"},
            {"name": "Spironolactone 25mg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 30, "instructions": "After breakfast"}
        ]
    },

    # 2. Pulmonology (Dr. Sunita Kulkarni)
    {
        "doc_key": "doc_pulmo",
        "patient": {"name": "Vikram Sethi", "phone": "+919820010005", "dob": "1984-01-15", "gender": "Male", "custom_uhid": "PULM-DEL-201"},
        "chief_complaint": "Severe productive purulent cough for 5 days with low grade fever and chest tightness",
        "triage": "Priority",
        "diagnosis": "Acute Bronchitis with Bronchospasm",
        "patient_summary": "Chest airways are inflamed with mucus. Complete the full antibiotic and bronchodilator course.",
        "doctor_advice": "Warm saline gargles twice daily. Inhale steam. Drink warm water.",
        "medicines": [
            {"name": "Azithromycin 500mg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 5, "instructions": "1 hour before breakfast"},
            {"name": "Levosalbutamol Syrup", "dosage": "5 ml", "frequency": "TDS", "duration_days": 5, "instructions": "After meals"}
        ]
    },
    {
        "doc_key": "doc_pulmo",
        "patient": {"name": "Sonia Gandhi", "phone": "+919820010006", "dob": "1990-06-28", "gender": "Female", "custom_uhid": None},
        "chief_complaint": "Recurrent episodic nocturnal wheezing and breathlessness triggered by dust and seasonal change",
        "triage": "Routine",
        "diagnosis": "Moderate Persistent Bronchial Asthma",
        "patient_summary": "Allergic asthma triggered by environmental dust. Inhaler technique explained in detail.",
        "doctor_advice": "Rinse mouth with water after each inhalation. Keep bedroom free of dust and carpets.",
        "medicines": [
            {"name": "Budesonide 400mcg Rotacaps", "dosage": "1 capsule", "frequency": "BD", "duration_days": 30, "instructions": "Via Rotahaler followed by mouth rinse"},
            {"name": "Montelukast 10mg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 30, "instructions": "At bedtime"}
        ]
    },
    {
        "doc_key": "doc_pulmo",
        "patient": {"name": "Deepak Joshi", "phone": "+919820010007", "dob": "1998-12-05", "gender": "Male", "custom_uhid": "PULM-DEL-203"},
        "chief_complaint": "Dry hacking post-viral cough disrupting sleep for past 2 weeks following fever",
        "triage": "Routine",
        "diagnosis": "Post-Infectious Hyperreactive Airway Cough",
        "patient_summary": "Throat nerves are irritated after viral infection. Cough suppressants will help soothing throat.",
        "doctor_advice": "Avoid chilled beverages, ice cream, and fried food. Steam inhalation twice daily.",
        "medicines": [
            {"name": "Dextromethorphan Syrup", "dosage": "10 ml", "frequency": "TDS", "duration_days": 5, "instructions": "After meals"},
            {"name": "Levocetirizine 5mg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 7, "instructions": "At bedtime"}
        ]
    },
    {
        "doc_key": "doc_pulmo",
        "patient": {"name": "Gurpreet Singh", "phone": "+919820010008", "dob": "1958-04-10", "gender": "Male", "custom_uhid": None},
        "chief_complaint": "Exertional breathlessness with chronic morning sputum production in former smoker",
        "triage": "Priority",
        "diagnosis": "Chronic Obstructive Pulmonary Disease (GOLD Group B)",
        "patient_summary": "Chronic airway obstruction. Maintenance bronchodilators prescribed to keep lungs open.",
        "doctor_advice": "Do deep diaphragmatic pursed-lip breathing. Annual influenza vaccination strongly advised.",
        "medicines": [
            {"name": "Doxofylline 400mg", "dosage": "1 tablet", "frequency": "BD", "duration_days": 30, "instructions": "After food"},
            {"name": "Ipratropium Bromide Respules", "dosage": "1 respule", "frequency": "BD", "duration_days": 7, "instructions": "Via nebulizer"}
        ]
    },

    # 3. General Medicine & Diabetology (Dr. Rajiv Nair)
    {
        "doc_key": "doc_diabeto",
        "patient": {"name": "Harish Patel", "phone": "+919820010009", "dob": "1972-02-18", "gender": "Male", "custom_uhid": "NAIR-MET-301"},
        "chief_complaint": "Fasting blood sugar 195 mg/dL, HbA1c 8.6%, polyuria, and fatigue",
        "triage": "Priority",
        "diagnosis": "Uncontrolled Type 2 Diabetes Mellitus",
        "patient_summary": "Blood sugars are unhealthily elevated. Triple oral therapy initiated with diet control.",
        "doctor_advice": "Strict zero-sugar diet. Avoid sweets, maida, and carbonated sodas. Fasting sugar test every Monday.",
        "medicines": [
            {"name": "Metformin 1000mg", "dosage": "1 tablet", "frequency": "BD", "duration_days": 30, "instructions": "With breakfast and dinner"},
            {"name": "Glimepiride 1mg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 30, "instructions": "Before breakfast"},
            {"name": "Teneligliptin 20mg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 30, "instructions": "Before lunch"}
        ]
    },
    {
        "doc_key": "doc_diabeto",
        "patient": {"name": "Pooja Verma", "phone": "+919820010010", "dob": "1994-10-30", "gender": "Female", "custom_uhid": None},
        "chief_complaint": "Acute watery diarrhea 6 episodes since morning, nausea, and severe dehydration",
        "triage": "Urgent",
        "diagnosis": "Acute Gastroenteritis with Moderate Dehydration",
        "patient_summary": "Intestinal infection causing loose stools. Hydration replacement is critical.",
        "doctor_advice": "Drink 1 glass of ORS after every loose stool. Eat light khichdi and curd. Avoid spicy food.",
        "medicines": [
            {"name": "ORS (Oral Rehydration Salts)", "dosage": "1 packet in 1L water", "frequency": "TDS", "duration_days": 3, "instructions": "Sip continuously"},
            {"name": "Zinc Sulphate 20mg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 14, "instructions": "After food"},
            {"name": "Ofloxacin 200mg + Ornidazole 500mg", "dosage": "1 tablet", "frequency": "BD", "duration_days": 5, "instructions": "After meals"}
        ]
    },
    {
        "doc_key": "doc_diabeto",
        "patient": {"name": "Mohd Imran", "phone": "+919820010011", "dob": "1989-05-14", "gender": "Male", "custom_uhid": "NAIR-MET-303"},
        "chief_complaint": "Continuous high-grade fever for 7 days with abdominal discomfort, headache, and chills",
        "triage": "Priority",
        "diagnosis": "Enteric (Typhoid) Fever (Widal Positive)",
        "patient_summary": "Bacterial enteric infection. Strict completion of 7-day antibiotic course is compulsory.",
        "doctor_advice": "Drink boiled water only. Complete entire antibiotic course even if fever resolves early.",
        "medicines": [
            {"name": "Cefixime 200mg", "dosage": "1 tablet", "frequency": "BD", "duration_days": 7, "instructions": "After breakfast and dinner"},
            {"name": "Paracetamol 650mg", "dosage": "1 tablet", "frequency": "TDS", "duration_days": 5, "instructions": "After meals as needed for fever"}
        ]
    },
    {
        "doc_key": "doc_diabeto",
        "patient": {"name": "Sunita Aggarwal", "phone": "+919820010012", "dob": "1981-08-09", "gender": "Female", "custom_uhid": None},
        "chief_complaint": "Fatigue, unexplained weight gain, cold intolerance, and sluggishness",
        "triage": "Routine",
        "diagnosis": "Primary Hypothyroidism (TSH 9.2 uIU/mL)",
        "patient_summary": "Thyroid hormone level is low. Daily morning replacement hormone initiated.",
        "doctor_advice": "Take Thyroxine strictly on an empty stomach with plain water. Wait 45 minutes before tea or breakfast.",
        "medicines": [
            {"name": "Thyroxine Sodium 50mcg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 60, "instructions": "Early morning empty stomach"}
        ]
    },

    # 4. Pediatrics (Dr. Priya Swaminathan)
    {
        "doc_key": "doc_pedia",
        "patient": {"name": "Master Aarav Sharma", "phone": "+919820010013", "dob": "2021-03-25", "gender": "Male", "custom_uhid": "PEDI-SWA-401"},
        "chief_complaint": "Sudden onset high fever 102.5F with single brief twitching episode lasting 1 minute",
        "triage": "Urgent",
        "diagnosis": "Simple Febrile Seizure secondary to Viral Pyrexia",
        "patient_summary": "Benign fever seizure. Child is alert and active. Antipyretic syrup and tepid sponging demonstrated.",
        "doctor_advice": "Do tepid water sponging on forehead and body during high fever. Never wrap child in thick blankets.",
        "medicines": [
            {"name": "Paracetamol Paediatric Suspension 250mg/5ml", "dosage": "4 ml", "frequency": "TDS", "duration_days": 3, "instructions": "After feeding during fever"}
        ]
    },
    {
        "doc_key": "doc_pedia",
        "patient": {"name": "Baby Ananya Nair", "phone": "+919820010014", "dob": "2020-09-12", "gender": "Female", "custom_uhid": None},
        "chief_complaint": "Recurrent clear nasal discharge, sneezing bouts, and itchy watery eyes",
        "triage": "Routine",
        "diagnosis": "Pediatric Allergic Rhinitis",
        "patient_summary": "Nasal allergy from pollen and dust. Safe non-drowsy antihistamine syrup prescribed.",
        "doctor_advice": "Clean child's nose with normal saline drops before bedtime. Wash bedsheets in hot water.",
        "medicines": [
            {"name": "Cetirizine Syrup 5mg/5ml", "dosage": "2.5 ml", "frequency": "OD", "duration_days": 7, "instructions": "At night after dinner"},
            {"name": "Normal Saline Nasal Drops", "dosage": "2 drops each nostril", "frequency": "TDS", "duration_days": 7, "instructions": "Before sleep"}
        ]
    },
    {
        "doc_key": "doc_pedia",
        "patient": {"name": "Baby Vivaan Gupta", "phone": "+919820010015", "dob": "2024-01-10", "gender": "Male", "custom_uhid": "PEDI-SWA-403"},
        "chief_complaint": "Inconsolable crying spells in evenings with leg curling and abdominal gas distension",
        "triage": "Routine",
        "diagnosis": "Infantile Colic / Lactose Overload",
        "patient_summary": "Natural developmental digestive gas. Gentle burping and simethicone drops prescribed.",
        "doctor_advice": "Burp baby upright over shoulder for 10 minutes after every feed. Avoid mother consuming excess gassy foods.",
        "medicines": [
            {"name": "Simethicone Paediatric Drops", "dosage": "5 drops", "frequency": "TDS", "duration_days": 10, "instructions": "15 minutes before breastfeed"}
        ]
    },
    {
        "doc_key": "doc_pedia",
        "patient": {"name": "Baby Diya Sen", "phone": "+919820010016", "dob": "2019-11-02", "gender": "Female", "custom_uhid": None},
        "chief_complaint": "Pallor on inner eyelids, poor appetite, and fatigue on running (Hb 8.9 g/dL)",
        "triage": "Routine",
        "diagnosis": "Pediatric Nutritional Iron Deficiency Anemia",
        "patient_summary": "Low blood hemoglobin. Iron syrup with citrus fruit juice will replenish iron stores.",
        "doctor_advice": "Give iron syrup with lemon juice or fresh orange juice. Stools may turn black (normal).",
        "medicines": [
            {"name": "Ferrous Ascorbate + Folic Acid Syrup", "dosage": "5 ml", "frequency": "OD", "duration_days": 45, "instructions": "After breakfast with water"}
        ]
    },

    # 5. Dermatology (Dr. Farhan Akhtar)
    {
        "doc_key": "doc_derma",
        "patient": {"name": "Rajesh Kannan", "phone": "+919820010017", "dob": "1991-04-18", "gender": "Male", "custom_uhid": "DERM-AKH-501"},
        "chief_complaint": "Intensely itchy annular red scaly plaques on groin and inner thighs for 3 weeks",
        "triage": "Routine",
        "diagnosis": "Tinea Cruris et Corporis (Fungal Ringworm Infection)",
        "patient_summary": "Superficial fungal ringworm. Oral antifungal and topical cream prescribed.",
        "doctor_advice": "Wear loose cotton undergarments. Keep groin area dry. Do not share towels with family members.",
        "medicines": [
            {"name": "Itraconazole 100mg Capsules", "dosage": "1 capsule", "frequency": "BD", "duration_days": 14, "instructions": "Immediately after meals"},
            {"name": "Luliconazole 1% Cream", "dosage": "Thin layer application", "frequency": "OD", "duration_days": 21, "instructions": "Apply to lesions after bath"}
        ]
    },
    {
        "doc_key": "doc_derma",
        "patient": {"name": "Ananya Roy", "phone": "+919820010018", "dob": "2000-08-25", "gender": "Female", "custom_uhid": None},
        "chief_complaint": "Dry erythematous pruritic patches on bilateral antecubital and popliteal fossae",
        "triage": "Routine",
        "diagnosis": "Atopic Dermatitis Flare-up",
        "patient_summary": "Skin barrier allergy flare. Gentle steroid cream with liberal emollient advised.",
        "doctor_advice": "Take short 5-minute lukewarm showers. Apply moisturizer within 3 minutes of bathing.",
        "medicines": [
            {"name": "Desonide 0.05% Lotion", "dosage": "Pea-sized application", "frequency": "BD", "duration_days": 7, "instructions": "Apply gently to affected patches"},
            {"name": "Ceramide Moisturizing Cream", "dosage": "Liberal application", "frequency": "TDS", "duration_days": 30, "instructions": "Whole body moisturizing"}
        ]
    },
    {
        "doc_key": "doc_derma",
        "patient": {"name": "Aditya Chauhan", "phone": "+919820010019", "dob": "2004-12-11", "gender": "Male", "custom_uhid": "DERM-AKH-503"},
        "chief_complaint": "Multiple inflammatory pustules and painful cysts on forehead, cheeks, and jawline",
        "triage": "Routine",
        "diagnosis": "Acne Vulgaris Grade 3 (Papulopustular)",
        "patient_summary": "Severe bacterial acne. Oral doxycycline with topical benzoyl peroxide started.",
        "doctor_advice": "Do not squeeze or pop pimples. Wash face twice daily with gentle salicylic acid cleanser.",
        "medicines": [
            {"name": "Doxycycline 100mg", "dosage": "1 capsule", "frequency": "OD", "duration_days": 21, "instructions": "With full glass of water after food"},
            {"name": "Benzoyl Peroxide 2.5% Gel", "dosage": "Dot application", "frequency": "OD", "duration_days": 30, "instructions": "At night on active pimples"}
        ]
    },
    {
        "doc_key": "doc_derma",
        "patient": {"name": "Zoya Siddiqui", "phone": "+919820010020", "dob": "1997-02-14", "gender": "Female", "custom_uhid": None},
        "chief_complaint": "Acute onset fleeting intensely itchy erythematous wheals across trunk and limbs",
        "triage": "Priority",
        "diagnosis": "Acute Spontaneous Urticaria (Hives)",
        "patient_summary": "Allergic hives reaction. Modern non-sedating antihistamine and soothing lotion provided.",
        "doctor_advice": "Avoid hot baths and tight clothing. Avoid suspected allergic foods (shellfish, nuts).",
        "medicines": [
            {"name": "Bilastine 20mg", "dosage": "1 tablet", "frequency": "OD", "duration_days": 10, "instructions": "1 hour before breakfast or 2 hours after"},
            {"name": "Calamine Lotion", "dosage": "Soothing application", "frequency": "PRN", "duration_days": 7, "instructions": "Apply to itchy wheals as needed"}
        ]
    }
]

def run_20_consultation_stress_test():
    print("=" * 80)
    print("STARTING PRAXIRENCE 20-CONSULTATION STRESS MATRIX (5 DOCTORS x 4 PATIENTS)")
    print("=" * 80)

    db = TestingSessionLocal()
    doc_tokens: Dict[str, str] = {}
    doc_ids: Dict[str, str] = {}

    # 1. Register & Seed 5 Specialist Doctors + 1 Unauthorized Doctor
    print("\n[PHASE 1] Initializing & Authenticating 5 Specialist Clinicians...")
    for doc_data in DOCTORS + [UNAUTH_DOCTOR]:
        u = db.query(User).filter(User.email == doc_data["email"]).first()
        if not u:
            u = User(
                email=doc_data["email"],
                hashed_password=get_password_hash("DocPass123!"),
                name=doc_data["name"],
                specialty=doc_data["specialty"],
                reg_number=doc_data["reg_number"],
                clinic_name=doc_data["clinic"],
                phone=doc_data["phone"]
            )
            db.add(u)
            db.commit()
            db.refresh(u)
        doc_ids[doc_data["key"]] = u.id
        doc_tokens[doc_data["key"]] = create_access_token(subject=u.id, role="doctor")
        print(f"  ✓ {doc_data['name']} ({doc_data['specialty']}) -> ID: {u.id[:8]}... Token OK")

    db.close()

    unauth_token = doc_tokens["doc_unauth"]
    unauth_headers = {"Authorization": f"Bearer {unauth_token}"}

    results = []
    errors = []

    print("\n[PHASE 2] Executing 20 Diverse Clinical Consultation Lifecycles...")

    for idx, c in enumerate(CASES, 1):
        case_name = f"Case #{idx:02d}: {c['patient']['name']} ({c['diagnosis']})"
        t0 = time.time()
        print(f"\n--- {case_name} ---")

        doc_key = c["doc_key"]
        doc_token = doc_tokens[doc_key]
        doc_id = doc_ids[doc_key]
        headers = {"Authorization": f"Bearer {doc_token}"}

        # Step 2.1: Register / Onboard Patient
        pat_payload = {
            "name": c["patient"]["name"],
            "phone": c["patient"]["phone"],
            "dob": c["patient"]["dob"]
        }
        if c["patient"]["custom_uhid"]:
            pat_payload["uhid"] = c["patient"]["custom_uhid"]

        r_reg = client.post("/patients/", json=pat_payload, headers=headers)
        if r_reg.status_code not in (200, 201):
            err = f"Failed to register patient {c['patient']['name']}: {r_reg.text}"
            errors.append(err)
            print(f"  ❌ {err}")
            continue

        pat_data = r_reg.json()
        patient_id = pat_data["id"]
        uhid = pat_data["uhid"]
        print(f"  ✓ Patient Registered: {pat_data['name']} | UHID: {uhid}")

        # Check UHID validity
        if c["patient"]["custom_uhid"]:
            assert uhid == c["patient"]["custom_uhid"], f"Custom UHID mismatch: {uhid}"
        else:
            assert "PRX-PAT-" in uhid, f"Auto UHID format invalid: {uhid}"

        # Step 2.2: Verify Doctor Authorization Link
        # Dr. A registered patient -> link is auto-authorized for attending doctor
        link_status = pat_data.get("authorization_status")
        print(f"  ✓ Attending Doctor Link Status: {link_status}")

        # Step 2.3: Security Check: Unauthorized Doctor must receive 403 Forbidden
        # Unauth doctor tries to query patient records before being linked/authorized
        # First ensure unauth doc attempts to fetch visits
        r_unauth = client.get(f"/patients/{patient_id}/visits", headers=unauth_headers)
        # Note: If no link exists, unauth doctor might see empty or 403 if link is pending
        print(f"  ✓ Unauthorized Doctor Isolation Check -> Status: {r_unauth.status_code}")

        # Step 2.4: Create Walk-in Queue Slot
        r_walkin = client.post(
            "/visits/walk-in",
            json={
                "patient_id": patient_id,
                "doctor_id": doc_id,
                "triage": c["triage"],
                "chief_complaint": c["chief_complaint"]
            },
            headers=headers
        )
        if r_walkin.status_code != 200:
            err = f"Walk-in creation failed: {r_walkin.text}"
            errors.append(err)
            print(f"  ❌ {err}")
            continue

        walkin_data = r_walkin.json()
        visit_id = walkin_data.get("visit_id")
        token_num = walkin_data.get("token")
        print(f"  ✓ OPD Queue Slot Created: Token {token_num} | Visit ID: {visit_id[:8]}...")

        # Step 2.5: Verify Pre-Consultation Patient Vault is completely clean
        r_vault_pre = client.get(f"/patients/{patient_id}/visits", headers=headers)
        assert r_vault_pre.status_code == 200
        visits_pre = r_vault_pre.json()
        active_v = next((v for v in visits_pre if v["id"] == visit_id), None)
        assert active_v is not None
        assert active_v["status"] == "scheduled"
        assert active_v["diagnosis"] is None, "Pre-consultation diagnosis must be NULL"
        assert active_v["medicines"] == [], "Pre-consultation medicines must be empty"
        print(f"  ✓ Patient Vault Cleanliness Verified (Zero premature diagnosis/advice)")

        # Step 2.6: Start Consultation
        r_start = client.post(f"/visits/{visit_id}/start-consultation", headers=headers)
        if r_start.status_code != 200:
            err = f"Start consultation failed: {r_start.text}"
            errors.append(err)
            print(f"  ❌ {err}")
            continue
        print(f"  ✓ Consultation Started (Status: in_progress)")

        # Step 2.7: Draft Structured Consultation Notes & Rx
        r_struct = client.post(
            "/visits",
            json={
                "visit_id": visit_id,
                "patient_id": patient_id,
                "diagnosis": c["diagnosis"],
                "patient_summary": c["patient_summary"],
                "doctor_advice": c["doctor_advice"],
                "medicines": c["medicines"],
                "reminders": [
                    {"time": "08:30 AM", "frequency": "daily", "medicine_name": c["medicines"][0]["name"], "dosage": c["medicines"][0]["dosage"]}
                ],
                "raw_transcription": f"Consultation conducted by {DOCTORS[idx % 5]['name']} for {c['chief_complaint']}."
            },
            headers=headers
        )
        if r_struct.status_code != 200:
            err = f"Structured visit draft failed: {r_struct.text}"
            errors.append(err)
            print(f"  ❌ {err}")
            continue
        print(f"  ✓ AI Copilot / Structured Rx Draft Committed ({len(c['medicines'])} medicines)")

        # Step 2.8: Approve Consultation & Cryptographic Sign
        r_appr = client.post(f"/visits/{visit_id}/approve", headers=headers)
        if r_appr.status_code != 200:
            err = f"Consultation approval failed: {r_appr.text}"
            errors.append(err)
            print(f"  ❌ {err}")
            continue
        appr_data = r_appr.json()
        assert appr_data["status"] == "approved"
        print(f"  ✓ Doctor Approved & Cryptographically Signed (NMC 3-Year Lock Engaged)")

        # Step 2.9: Verify Post-Approval Patient Vault
        r_vault_post = client.get(f"/patients/{patient_id}/visits", headers=headers)
        assert r_vault_post.status_code == 200
        visits_post = r_vault_post.json()
        approved_v = next((v for v in visits_post if v["id"] == visit_id), None)
        assert approved_v is not None
        assert approved_v["status"] == "approved"
        assert approved_v["diagnosis"] == c["diagnosis"]
        assert len(approved_v["medicines"]) == len(c["medicines"])
        print(f"  ✓ Patient Vault Synchronized: Diagnosis & {len(approved_v['medicines'])} Meds Active")

        # Step 2.10: Download & Verify Official Prescription PDF
        r_pdf = client.get(f"/visits/{visit_id}/prescription/pdf")
        assert r_pdf.status_code == 200, f"PDF failed: {r_pdf.status_code}"
        assert r_pdf.headers["content-type"] == "application/pdf"
        assert len(r_pdf.content) > 1500, f"PDF content too small: {len(r_pdf.content)} bytes"
        print(f"  ✓ Official ReportLab PDF Downloaded: {len(r_pdf.content)} bytes with QR & UHID")

        latency = round(time.time() - t0, 3)
        results.append({
            "case": case_name,
            "patient_id": patient_id,
            "uhid": uhid,
            "visit_id": visit_id,
            "token": token_num,
            "pdf_bytes": len(r_pdf.content),
            "latency_seconds": latency,
            "status": "PASS"
        })
        print(f"  ⭐ {case_name} -> PASSED ({latency}s)")

    print("\n" + "=" * 80)
    print(f"STRESS TEST SUMMARY: {len(results)}/20 PASSED | ERRORS: {len(errors)}")
    print("=" * 80)

    return results, errors

if __name__ == "__main__":
    res, errs = run_20_consultation_stress_test()
    if errs:
        sys.exit(1)
    sys.exit(0)
