"""
Praxirence Tier-1 Hospital-Grade Clinical Intelligence Benchmark Test Suite
Validates:
1. Drug entity extraction & normalization accuracy >= 99%
2. Chat grounding accuracy 100% against clinical consultation records (Zero-hallucination, Doctor & Date citations)
3. Emergency ESI Red-Flag Triage Triggering with 0% False-Negative Rate
4. Zero-Emoji Compliance across all clinical outputs
"""

import pytest
import re
from datetime import datetime
from app.services.triage_service import triage_service
from app.services.pharmacology_service import pharmacology_service
from app.services.ai_service import ai_service
from app.routes.chat import strip_emojis, generate_grounded_fallback
from app.models.visit import Visit
from app.models.user import User


# ==================== 1. EMERGENCY TRIAGE ZERO FALSE-NEGATIVE BENCHMARK ====================

CRITICAL_EMERGENCY_QUERIES = [
    # Acute Coronary Syndrome / Myocardial Infarction
    ("I have crushing chest pain radiating to my left jaw and arm", "en"),
    ("Severe chest pain and heavy pressure in chest", "en"),
    ("Mujhe seene me bahut tez dard ho raha hai aur paseena aa raha hai", "hi"),
    ("Chhati me dard hai aur ghabrahat ho rahi hai", "hi"),
    ("Doctor, I think I am having a heart attack right now", "en"),

    # Acute Respiratory Compromise
    ("Patient cannot breathe and lips are turning blue", "en"),
    ("Severe shortness of breath, choking feeling", "en"),
    ("Saans lene me bahut takleef ho rahi hai saans phool rahi hai", "hi"),
    ("Saans nahi aa rahi hai dam ghut raha hai", "hi"),

    # Acute Neurological / Stroke (FAST)
    ("Sudden slurred speech and right side facial droop", "en"),
    ("Sudden weakness on one side and loss of consciousness", "en"),
    ("Achanak se lakwa mar gaya aur bolne me dikkat ho rahi hai", "hi"),
    ("Patient behosh ho gaye hain aur uth nahi rahe", "hi"),

    # Hemorrhagic Emergency
    ("Patient is coughing blood continuously", "en"),
    ("Severe vomiting blood since last two hours", "en"),
    ("Khoon ki ulti ho rahi hai bahut jyada", "hi"),

    # Anaphylactic Shock
    ("Severe allergic reaction with swollen throat and tongue", "en"),
    ("Anaphylaxis after bee sting and throat swelling", "en"),

    # Pediatric / Hyperpyrexia
    ("Baby has fever 105 and convulsion with seizure", "en"),
    ("Bachhe ko tej bukhar ke sath daura ya jhatke aa rahe hain", "hi"),
]

ROUTINE_NON_EMERGENCY_QUERIES = [
    ("When should I take my blood pressure medicine?", "en"),
    ("Dawa khane ke kitni der baad pani peena chahiye?", "hi"),
    ("Can I get an appointment with an orthopedic specialist?", "en"),
    ("What did the doctor advise regarding my low sodium diet?", "en"),
    ("Mild common cold since yesterday", "en"),
]


def test_emergency_triage_zero_false_negatives():
    """Validates 0% false negative rate on critical life-threatening conditions."""
    total = len(CRITICAL_EMERGENCY_QUERIES)
    detected = 0

    for query, lang in CRITICAL_EMERGENCY_QUERIES:
        res = triage_service.evaluate_emergency(query, lang)
        assert res is not None, f"FALSE NEGATIVE: Failed to trigger emergency for query: '{query}'"
        assert res["is_emergency"] is True
        assert res["triage_category"] == "ESI-1 / ESI-2 Critical"
        # Must include ambulance quick action
        actions = res.get("actions", [])
        assert any(a.get("action") == "tel:108" for a in actions), f"Missing 108 action in {query}"
        assert any(a.get("action") == "tel:112" for a in actions), f"Missing 112 action in {query}"
        detected += 1

    sensitivity = (detected / total) * 100
    assert sensitivity == 100.0, f"Expected 100% sensitivity, got {sensitivity}%"


def test_emergency_triage_specificity():
    """Validates that routine non-emergencies do not trigger false alarms."""
    for query, lang in ROUTINE_NON_EMERGENCY_QUERIES:
        res = triage_service.evaluate_emergency(query, lang)
        assert res is None, f"FALSE POSITIVE: Triggered emergency on routine query: '{query}'"


# ==================== 2. PHARMACOLOGICAL NORMALIZATION BENCHMARK ====================

BRAND_TO_GENERIC_BENCHMARKS = [
    ("Dolo 650", "Paracetamol", "4000mg"),
    ("Calpol 500", "Paracetamol", "4000mg"),
    ("Crocin", "Paracetamol", "4000mg"),
    ("Pan 40", "Pantoprazole", "empty stomach"),
    ("Pantocid", "Pantoprazole", "empty stomach"),
    ("Telma 40", "Telmisartan", "ARB"),
    ("Amlovas 5", "Amlodipine", "Calcium"),
    ("Augmentin 625", "Amoxicillin + Clavulanic Acid", "full prescribed course"),
    ("Azithral 500", "Azithromycin", "course"),
    ("Glycomet 500", "Metformin", "meals"),
    ("Atorva 10", "Atorvastatin", "bedtime"),
    ("Ecosprin 75", "Aspirin", "after a meal"),
    ("Thyronorm 50", "Levothyroxine Sodium", "empty stomach"),
    ("Montair LC", "Montelukast + Levocetirizine", "bedtime"),
    ("Shelcal 500", "Calcium Carbonate + Vitamin D3", "Mineral"),
]


def test_drug_normalization_accuracy():
    """Validates brand-to-generic normalization accuracy >= 99%."""
    correct = 0
    total = len(BRAND_TO_GENERIC_BENCHMARKS)

    for brand, expected_generic, _ in BRAND_TO_GENERIC_BENCHMARKS:
        norm = pharmacology_service.normalize_medication(brand)
        if norm["generic_name"] == expected_generic:
            correct += 1
        else:
            print(f"Mismatch: {brand} -> Got {norm['generic_name']}, Expected {expected_generic}")

    accuracy = (correct / total) * 100
    assert accuracy >= 99.0, f"Drug normalization accuracy below 99%: {accuracy}%"


def test_food_drug_rules_and_missed_dose():
    """Validates pharmacological food rules and missed-dose protocols."""
    # Thyroid empty stomach rule
    thyroid_rule = pharmacology_service.get_food_rule("thyronorm", "en")
    assert "empty stomach" in thyroid_rule.lower()

    # Pantoprazole empty stomach rule
    ppi_rule = pharmacology_service.get_food_rule("pantoprazole", "en")
    assert "empty stomach" in ppi_rule.lower()

    # Aspirin after meal rule
    aspirin_rule = pharmacology_service.get_food_rule("aspirin", "en")
    assert "after a meal" in aspirin_rule.lower()

    # Missed dose protocol: never double up
    missed_en = pharmacology_service.get_missed_dose_guideline("en")
    assert "never double up" in missed_en.lower()

    missed_hi = pharmacology_service.get_missed_dose_guideline("hi")
    assert "दो गोलियां न लें" in missed_hi


# ==================== 3. CHAT GROUNDING & CITATION BENCHMARK ====================

class MockDoctor:
    def __init__(self, name="Dr. Anita Sharma", specialty="Cardiologist", clinic="Praxirence Heart Center"):
        self.id = "doc_101"
        self.name = name
        self.specialty = specialty
        self.clinic_name = clinic
        self.reg_number = "KMC-48291"
        self.phone = "+919876543210"
        self.role = "doctor"


class MockVisit:
    def __init__(self):
        self.id = "vis_201"
        self.created_at = datetime(2026, 9, 20, 10, 30)
        self.doctor = MockDoctor()
        self.diagnosis = "Essential Hypertension Stage 1"
        self.raw_transcription = (
            "Doctor: Good morning. Your blood pressure today is 148/92 mmHg.\n"
            "Patient: Doctor, I have mild morning headaches.\n"
            "Doctor: Prescribing Telma 40 once daily in the morning.\n"
            "Patient Summary: Stage 1 Hypertension evaluated.\n"
            "Doctor's Advice: Reduce dietary salt to under 5g daily and monitor BP weekly."
        )
        self.medicines = [
            {"name": "Telma 40", "dosage": "40mg", "frequency": "1-0-0", "instructions": "Take in morning after breakfast"}
        ]


def test_chat_grounding_with_doctor_and_date_citation():
    """Validates 100% grounding with explicit doctor name and visit date citations."""
    mock_visit = MockVisit()
    doctors = [MockDoctor()]

    reply, intent, meds, _, sugg = generate_grounded_fallback(
        query="What did the doctor advise me?",
        language="English",
        visits=[mock_visit],
        patient_name="Rajesh Kumar",
        doctors=doctors
    )

    # Must cite Dr. Anita Sharma and the consultation date
    assert "Dr. Anita Sharma" in reply, "Attending clinician not cited in response"
    assert "20 Sep 2026" in reply, "Consultation date not cited in response"
    assert "Essential Hypertension" in reply, "Diagnosis not grounded in visit record"
    assert intent == "consultation_explanation"


def test_unrecorded_condition_guardrail():
    """Validates that unrecorded diseases (e.g. Cancer, Asthma) are never hallucinated."""
    mock_visit = MockVisit()  # Only has Essential Hypertension
    doctors = [MockDoctor()]

    reply, intent, _, _, _ = generate_grounded_fallback(
        query="Do I have cancer or diabetes according to my doctor?",
        language="English",
        visits=[mock_visit],
        patient_name="Rajesh Kumar",
        doctors=doctors
    )

    # Must refuse to fabricate unrecorded condition
    assert "This was not part of your recorded consultation" in reply
    assert intent == "unrecorded_condition_inquiry"


def test_zero_emoji_compliance():
    """Validates zero emoji policy across all clinical outputs."""
    raw_with_emojis = "Your blood pressure is normal 👍! Keep up the good work ❤️🩺."
    cleaned = strip_emojis(raw_with_emojis)
    assert "👍" not in cleaned
    assert "❤️" not in cleaned
    assert "🩺" not in cleaned
    # Ensure no unicode emoji ranges remain
    emoji_check = re.search(r'[\U00010000-\U0010ffff\u2600-\u26ff\u2700-\u27bf]', cleaned)
    assert emoji_check is None, f"Found remaining emoji: {cleaned}"


# ==================== 4. AMBIENT OPD DIALOGUE PARSER & VITALS ====================

def test_ambient_opd_vitals_and_icd10():
    sample_dialogue = (
        "Doctor: Let me check your vitals. Your BP is 130/80 mmHg, pulse is 72 bpm, SpO2 is 99%, and temperature is 98.6 F.\n"
        "Patient: Thank you doctor.\n"
        "Doctor: You have Essential Hypertension."
    )
    vitals = ai_service.extract_vitals_from_dialogue(sample_dialogue)
    assert vitals.get("bp") == "130/80"
    assert "72" in vitals.get("pulse")
    assert "99" in vitals.get("spo2")

    icd = ai_service.map_icd10_diagnosis("Essential Hypertension")
    assert icd["code"] == "I10"
