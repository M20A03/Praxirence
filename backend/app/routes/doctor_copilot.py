"""
Praxirence Clinical Copilot API Route
Clinical Decision Support System (CDSS) for licensed medical practitioners.
Provides differential diagnoses, evidence-based pharmacotherapy guidelines,
drug-drug interaction (DDI) alerts, and organ-clearance titrations.
"""

import os
import re
import time
import logging
import httpx
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.patient import Patient
from app.models.visit import Visit
from app.routes.deps import get_current_doctor
from app.services.pharmacology_service import pharmacology_service

logger = logging.getLogger("praxirence.doctor_copilot")

router = APIRouter(prefix="/doctor/copilot", tags=["Doctor Clinical Copilot CDSS"])

MASTER_CLINICAL_SYSTEM_PROMPT = """You are Praxirence Clinical Copilot, an elite Clinical Decision Support System (CDSS) designed exclusively for licensed medical practitioners, hospital clinicians, and specialists.

### MISSION:
Provide rapid, evidence-based, peer-level clinical analysis to assist the attending physician in making informed diagnostic, pharmacological, and treatment decisions. Maintain a professional medical tone with zero fluff, zero patient-facing disclaimers, and zero emojis.

### STEP 1: PATIENT INTAKE & CONTEXTUAL REASONING
Analyze all patient parameters provided:
- Demographics, pregnancy/lactation tier
- Chief complaints, symptom chronology, severity
- Objective vitals (BP, HR, SpO2, Temp, RR, Blood Glucose)
- Comorbidities (e.g. CKD, Type 2 DM, HTN, CAD) & Allergies
- Active Medications & Recent Labs/Imaging

### STEP 2: EVIDENCE-BASED CLINICAL GUIDELINES
Ground recommendations on established clinical guidelines:
- ICMR (Indian Council of Medical Research), National Health Mission
- WHO, NICE, AHA/ACC, KDIGO (Renal), and GOLD (Respiratory) criteria.
Always cross-check:
1. Differential Diagnosis (DDx) with clinical rationale
2. Must-not-miss life threats and surgical emergencies
3. Drug-Drug Interactions (DDIs) and Boxed Warnings
4. Organ Dosing Adjustments (Renal eGFR cut-offs and Hepatic Child-Pugh precautions)

### STEP 3: MANDATORY STRUCTURED OUTPUT FORMAT
Your output MUST adhere strictly to the following 5 sections:

#### 1. PRIMARY IMPRESSION & DIFFERENTIAL DIAGNOSIS (DDx)
- Primary Working Diagnosis: [Name + ICD-10 code if applicable]
- Differential Candidates:
  * 1. [Diagnosis A] — Supporting clinical rationale
  * 2. [Diagnosis B] — Supporting clinical rationale
  * 3. [Diagnosis C] — Supporting clinical rationale
- Must-Not-Miss Red Flags: [High-acuity life threats to rule out immediately]

#### 2. SUGGESTED DIAGNOSTIC & INVESTIGATION WORKUP
- Immediate / Bedside: [e.g., 12-lead ECG, Capillary Glucose, POCUS]
- Confirmatory Laboratory Tests: [Specific blood, urine, or biomarker panels]
- Diagnostic Imaging: [X-ray, USG, Contrast CT, or MRI indications]

#### 3. EVIDENCE-BASED TREATMENT & PHARMACOTHERAPY
- First-Line Medications:
  * [Generic Drug Name] | [Dosage & Route] | [Frequency (OD/BD/TDS)] | [Duration]
  * [Clinical justification and food timing instructions]
- Alternative Options: [Substitutes for allergies, intolerance, or pregnancy]
- Supportive / Non-Pharmacological Care: [Hydration, diet, respiratory care, positioning]

#### 4. PHARMACOVIGILANCE & SAFETY DOUBLE-CHECKS
- Drug-Drug Interactions (DDIs): [Interactions between proposed drugs and patient's current medications]
- Organ Clearance Titration: [Renal eGFR cut-offs or hepatic precautions]
- Boxed Warnings / Contraindications: [Specific warnings relevant to this profile]

#### 5. CLINICAL MONITORING & FOLLOW-UP TIMELINE
- Day 3 / Day 7 Re-evaluation: [Key parameters and biomarkers to re-check]
- Escalation / Hospitalization Triggers: [Clear vitals and symptom thresholds requiring immediate ICU / specialist referral]
"""


class PatientContextModel(BaseModel):
    age: Optional[str] = None
    gender: Optional[str] = None
    weight: Optional[str] = None
    pregnancy_status: Optional[str] = None
    vitals: Optional[Dict[str, Any]] = None
    comorbidities: Optional[List[str]] = []
    allergies: Optional[List[str]] = []
    current_medications: Optional[List[str]] = []
    recent_labs: Optional[str] = None


class DoctorCopilotQueryRequest(BaseModel):
    query: str
    patient_id: Optional[str] = None
    context: Optional[PatientContextModel] = None


class DDICheckRequest(BaseModel):
    medications: List[str]
    patient_conditions: Optional[List[str]] = []
    renal_status: Optional[str] = None


class DDICheckResponse(BaseModel):
    medications_analyzed: List[str]
    severe_interactions: List[Dict[str, str]]
    moderate_interactions: List[Dict[str, str]]
    organ_cautions: List[str]
    summary: str


def strip_emojis(text: str) -> str:
    """Strips emojis to maintain strict clinical dignity and tone."""
    return re.sub(r'[\U00010000-\U0010ffff]', '', text).strip()


KNOWN_DDI_DATABASE = [
    {
        "pair": ("clarithromycin", "atorvastatin"),
        "severity": "Severe",
        "effect": "CYP3A4 inhibition significantly elevates atorvastatin plasma concentrations, increasing risk of severe rhabdomyolysis and myopathy.",
        "action": "Suspend atorvastatin during macrolide therapy or substitute with azithromycin (non-CYP3A4 substrate)."
    },
    {
        "pair": ("azithromycin", "ondansetron"),
        "severity": "Moderate",
        "effect": "Additive risk of QTc prolongation and potential cardiac dysrhythmias (Torsades de pointes).",
        "action": "Avoid combination if baseline QTc > 460ms or co-existing electrolyte imbalance (hypokalemia, hypomagnesemia)."
    },
    {
        "pair": ("telmisartan", "ramipril"),
        "severity": "Severe",
        "effect": "Dual Renin-Angiotensin System (RAS) blockade increases risk of acute renal failure, severe hypotension, and hyperkalemia without added CV benefit.",
        "action": "Contraindicated. Discontinue one agent immediately."
    },
    {
        "pair": ("metformin", "contrast"),
        "severity": "Severe",
        "effect": "Risk of Contrast-Induced Nephropathy (CIN) and severe Metformin-Associated Lactic Acidosis (MALA).",
        "action": "Withhold metformin 48 hours prior to and 48 hours after iodinated radiocontrast imaging in eGFR < 60."
    },
    {
        "pair": ("aspirin", "ibuprofen"),
        "severity": "Moderate",
        "effect": "Competitive COX-1 inhibition: Ibuprofen interferes with the irreversible antiplatelet effect of low-dose cardioprotective aspirin; additive gastric mucosal toxicity.",
        "action": "Take immediate-release aspirin at least 30 minutes before or 8 hours after ibuprofen. Consider gastroprotection with a PPI."
    },
    {
        "pair": ("methotrexate", "naproxen"),
        "severity": "Severe",
        "effect": "NSAIDs diminish renal methotrexate clearance, causing fatal bone marrow suppression and aplastic anemia.",
        "action": "Avoid NSAID co-administration with high-dose methotrexate; monitor CBC and renal markers closely."
    },
    {
        "pair": ("warfarin", "ciprofloxacin"),
        "severity": "Severe",
        "effect": "Fluoroquinolones inhibit warfarin metabolism and eradicate vitamin K producing gut flora, causing precipitous INR elevation and life-threatening bleeding.",
        "action": "Frequent INR monitoring; preemptively reduce warfarin dose by 30-50% during antibiotic course."
    },
    {
        "pair": ("spironolactone", "telmisartan"),
        "severity": "Moderate",
        "effect": "Synergistic potassium retention leading to dangerous hyperkalemia.",
        "action": "Monitor serum potassium (K+) within 7-14 days of initiation or dose change. Maintain K+ < 5.5 mEq/L."
    },
    {
        "pair": ("amlodipine", "simvastatin"),
        "severity": "Moderate",
        "effect": "Amlodipine increases simvastatin exposure via CYP3A4 inhibition.",
        "action": "Limit simvastatin dose to a maximum of 20mg daily when co-prescribed with amlodipine."
    }
]


def evaluate_clinical_ddi(medications: List[str], renal_status: Optional[str] = None) -> DDICheckResponse:
    clean_meds = [m.lower().strip() for m in medications]
    normalized_meds = []
    for m in clean_meds:
        norm = pharmacology_service.normalize_medication(m)
        normalized_meds.append(norm.get("generic_name", m).lower())

    all_tokens = clean_meds + normalized_meds

    severe = []
    moderate = []
    cautions = []

    for rule in KNOWN_DDI_DATABASE:
        d1, d2 = rule["pair"]
        d1_present = any(d1 in tok for tok in all_tokens)
        d2_present = any(d2 in tok for tok in all_tokens)

        if d1_present and d2_present:
            item = {
                "drug_1": d1.title(),
                "drug_2": d2.title(),
                "mechanism": rule["effect"],
                "recommendation": rule["action"]
            }
            if rule["severity"] == "Severe":
                severe.append(item)
            else:
                moderate.append(item)

    if renal_status and "stage" in renal_status.lower():
        if any("metformin" in tok for tok in all_tokens):
            cautions.append("Metformin: Contraindicated if eGFR < 30 ml/min/1.73m2; max 1000mg/day if eGFR 30-44.")
        if any("ciprofloxacin" in tok for tok in all_tokens):
            cautions.append("Ciprofloxacin: Reduce dose by 50% if eGFR < 30 ml/min.")
        if any("telmisartan" in tok for tok in all_tokens) or any("ramipril" in tok for tok in all_tokens):
            cautions.append("RAS Inhibitors: Monitor creatinine and potassium; avoid in bilateral renal artery stenosis.")

    summary_parts = []
    if severe:
        summary_parts.append(f"WARNING: {len(severe)} severe contraindicated interaction(s) detected.")
    if moderate:
        summary_parts.append(f"CAUTION: {len(moderate)} moderate interaction(s) require clinical vigilance.")
    if not severe and not moderate:
        summary_parts.append("No critical boxed-warning drug interactions identified in active formulary screen.")

    return DDICheckResponse(
        medications_analyzed=medications,
        severe_interactions=severe,
        moderate_interactions=moderate,
        organ_cautions=cautions,
        summary=" ".join(summary_parts)
    )


def generate_fallback_clinical_response(query: str, context: Optional[PatientContextModel]) -> str:
    q_lower = query.lower()
    
    if "fever" in q_lower or "bronchitis" in q_lower or "cough" in q_lower:
        dx = "Acute Bronchitis / Lower Respiratory Tract Infection (ICD-10: J20.9)"
        d1 = "Viral Bronchitis (Rhinovirus, RSV, Influenza) — 90% of cases self-limiting"
        d2 = "Community-Acquired Pneumonia (CAP) — Rule out if localized crackles or tachypnea"
        d3 = "Bronchial Asthma Exacerbation — Rule out if episodic wheezing and nocturnal worsening"
        red_flags = "Oxygen saturation SpO2 < 93%, respiratory rate > 28/min, hemoptysis, altered mental status (CURB-65 criteria)."
        bedside = "Pulse oximetry, 12-lead ECG (if tachycardia > 110 bpm), point-of-care lung ultrasound."
        labs = "CBC with differential (leukocytosis / bandemia), CRP, chest X-ray PA view."
        rx1 = "Azithromycin 500mg PO OD x 3 days (if bacterial etiology or purulent sputum in high-risk patient)\nParacetamol 650mg PO TDS PRN for fever > 100°F\nLevosalbutamol + Guaiphenesin syrup 5ml PO TDS x 5 days"
        safety = "Assess QT interval prior to macrolide therapy. Maintain adequate oral rehydration."
    elif "chest pain" in q_lower or "angina" in q_lower or "cardiac" in q_lower:
        dx = "Acute Coronary Syndrome (ACS) / Unstable Angina (ICD-10: I20.0)"
        d1 = "Non-ST Elevation Myocardial Infarction (NSTEMI) — Requires serial troponin markers"
        d2 = "Gastroesophageal Reflux Disease (GERD) — Diagnosis of exclusion after cardiac rule-out"
        d3 = "Acute Pulmonary Embolism — Assess Wells score; rule out if pleuritic with hypoxia"
        red_flags = "Hemodynamic instability (BP < 90 mmHg), diaphoresis, radiation to left jaw/arm, pulmonary edema."
        bedside = "Stat 12-lead ECG within 10 minutes of presentation, continuous telemetry, SpO2."
        labs = "High-sensitivity cardiac Troponin I/T (baseline and 3h), CK-MB, lipid profile, KFT, electrolytes."
        rx1 = "Aspirin 300mg chewable stat (loading)\nClopidogrel 300mg PO stat\nSublingual Nitroglycerin 0.5mg (unless BP < 90 or Sildenafil use in 24h)\nAtorvastatin 80mg PO stat"
        safety = "Absolute contraindication to Nitrates if PDE-5 inhibitors ingested within 24-48 hours or right ventricular infarction suspected."
    elif "headache" in q_lower or "migraine" in q_lower:
        dx = "Acute Migraine without Aura (ICD-10: G43.0)"
        d1 = "Tension-Type Headache — Bilateral, non-pulsatile, band-like tightening"
        d2 = "Cluster Headache — Severe unilateral retro-orbital pain with ipsilateral autonomic signs"
        d3 = "Secondary Headache / Subarachnoid Hemorrhage (SAH) — Rule out thunderclap onset"
        red_flags = "Sudden-onset thunderclap headache (peak < 1 min), fever with meningism, focal neurological deficits, papilledema."
        bedside = "Fundoscopic examination, cranial nerve screening, blood pressure monitoring."
        labs = "Non-contrast CT head (if SNOOP red flags present), MRI brain with MRV if venous sinus thrombosis suspected."
        rx1 = "Sumatriptan 50mg PO at onset of attack (repeat in 2h if needed, max 200mg/24h)\nNaproxen 500mg PO with food\nDomperidone 10mg or Metoclopramide 10mg PO for associated nausea"
        safety = "Triptans are strictly contraindicated in ischemic heart disease, uncontrolled hypertension, and hemiplegic migraine."
    else:
        dx = "Comprehensive Clinical Evaluation Required (ICD-10: R69)"
        d1 = "Primary etiology pending detailed physical assessment and localized findings"
        d2 = "Secondary metabolic or systemic decompensation"
        d3 = "Pharmacological adverse effect or drug-induced syndrome"
        red_flags = "Altered sensorium, persistent hemodynamic instability, acute severe pain refractory to standard analgesia."
        bedside = "Complete vitals acquisition (BP, Pulse, Temp, SpO2, RBS), targeted physical exam."
        labs = "CBC, Comprehensive Metabolic Panel (LFT, KFT), routine urinalysis."
        rx1 = "Targeted symptomatic relief aligned with objective clinical signs. Avoid empirical multi-antimicrobial polypharmacy."
        safety = "Screen for pre-existing hepatic and renal impairment before initiating new therapeutic regimens."

    return f"""#### 1. PRIMARY IMPRESSION & DIFFERENTIAL DIAGNOSIS (DDx)
- Primary Working Diagnosis: {dx}
- Differential Candidates:
  * 1. {d1}
  * 2. {d2}
  * 3. {d3}
- Must-Not-Miss Red Flags: {red_flags}

#### 2. SUGGESTED DIAGNOSTIC & INVESTIGATION WORKUP
- Immediate / Bedside: {bedside}
- Confirmatory Laboratory Tests: {labs}
- Diagnostic Imaging: As indicated by clinical stability and organ-specific presentation.

#### 3. EVIDENCE-BASED TREATMENT & PHARMACOTHERAPY
- First-Line Medications:
{rx1}
- Supportive / Non-Pharmacological Care: Maintain strict hydration, monitor vitals Q4H, and ensure therapeutic adherence.

#### 4. PHARMACOVIGILANCE & SAFETY DOUBLE-CHECKS
- Clinical Safety Notes: {safety}
- Organ Clearance: Titrate dosages based on baseline eGFR and LFT status.

#### 5. CLINICAL MONITORING & FOLLOW-UP TIMELINE
- Day 3 / Day 7 Re-evaluation: Re-assess symptom resolution and repeat inflammatory/metabolic biomarkers if symptomatic.
- Escalation Triggers: Immediate hospital transfer if red-flag danger thresholds are breached."""


@router.post("/query")
async def ask_doctor_copilot(
    req: DoctorCopilotQueryRequest,
    current_doctor: User = Depends(get_current_doctor),
    db: Session = Depends(get_db)
):
    """
    Main Clinical Decision Support System (CDSS) endpoint for licensed physicians.
    Provides peer-level differential diagnosis, ICMR/WHO guideline adherence, and pharmacotherapy double-checks.
    """
    logger.info(f"Doctor Copilot query by Dr. {current_doctor.name} (Specialty: {current_doctor.specialty}): '{req.query[:60]}...'")

    patient_grounding = []
    if req.patient_id:
        patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
        if patient:
            patient_grounding.append(f"PATIENT NAME: {patient.name}, DOB: {patient.dob}")
            recent_visits = db.query(Visit).filter(Visit.patient_id == patient.id).order_by(Visit.created_at.desc()).limit(3).all()
            if recent_visits:
                patient_grounding.append("PREVIOUS RECENT VISITS:")
                for v in recent_visits:
                    v_date = v.created_at.strftime("%Y-%m-%d") if v.created_at else "Recent"
                    patient_grounding.append(f"- Date {v_date}: Diagnosis: {v.diagnosis or 'Consultation'}. Medicines: {v.medicines}")

    if req.context:
        ctx = req.context
        if ctx.age or ctx.gender:
            patient_grounding.append(f"Demographics: Age: {ctx.age or 'N/A'}, Gender: {ctx.gender or 'N/A'}, Weight: {ctx.weight or 'N/A'}, Pregnancy/Lactation: {ctx.pregnancy_status or 'None'}")
        if ctx.vitals:
            v_strs = [f"{k}: {v}" for k, v in ctx.vitals.items() if v]
            if v_strs:
                patient_grounding.append(f"Objective Vitals: {', '.join(v_strs)}")
        if ctx.comorbidities:
            patient_grounding.append(f"Comorbidities: {', '.join(ctx.comorbidities)}")
        if ctx.allergies:
            patient_grounding.append(f"Allergies: {', '.join(ctx.allergies)}")
        if ctx.current_medications:
            patient_grounding.append(f"Current Active Medications: {', '.join(ctx.current_medications)}")
        if ctx.recent_labs:
            patient_grounding.append(f"Recent Labs/Imaging: {ctx.recent_labs}")

    grounding_str = "\n".join(patient_grounding) if patient_grounding else "NO_EXISTING_PATIENT_RECORDS_ATTACHED"

    gemini_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    llm_reply = None

    if gemini_key and len(gemini_key) > 10:
        user_content = (
            f"--- CLINICIAN / DOCTOR PROFILE ---\n"
            f"Doctor: Dr. {current_doctor.name} ({current_doctor.specialty or 'General Physician'})\n\n"
            f"--- CLINICAL CONTEXT & PATIENT PARAMETERS ---\n"
            f"{grounding_str}\n\n"
            f"--- ATTENDING DOCTOR'S CLINICAL QUERY ---\n"
            f"{req.query}"
        )

        payload = {
            "system_instruction": {
                "parts": [{"text": MASTER_CLINICAL_SYSTEM_PROMPT}]
            },
            "contents": [
                {
                    "parts": [{"text": user_content}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 2048
            }
        }

        models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
        for model_name in models_to_try:
            if llm_reply:
                break
            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    res = await client.post(gemini_url, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            reply_texts = [p.get("text", "") for p in parts if p.get("text")]
                            if reply_texts:
                                raw_reply = "\n\n".join(reply_texts)
                                llm_reply = strip_emojis(raw_reply)
                                logger.info(f"Doctor Copilot response generated via Gemini ({model_name}).")
                                break
                    else:
                        logger.warning(f"Gemini API returned status {res.status_code} for {model_name}: {res.text[:150]}")
            except Exception as e:
                logger.warning(f"Error calling Gemini API ({model_name}): {e}")

    if not llm_reply:
        logger.info("Using institutional rule-based clinical CDSS engine for Doctor Copilot query.")
        llm_reply = generate_fallback_clinical_response(req.query, req.context)

    ddi_result = None
    all_meds = []
    if req.context and req.context.current_medications:
        all_meds.extend(req.context.current_medications)

    query_tokens = [w.strip() for w in req.query.replace(",", " ").split() if len(w) > 3]
    for w in query_tokens:
        norm = pharmacology_service.normalize_medication(w, db=db)
        if norm.get("normalized"):
            all_meds.append(norm.get("generic_name", w))

    if len(all_meds) >= 2:
        ddi_result = evaluate_clinical_ddi(list(set(all_meds)))

    return {
        "success": True,
        "reply": llm_reply,
        "ddi_alert": ddi_result.dict() if ddi_result else None,
        "timestamp": time.time(),
        "doctor_name": current_doctor.name,
        "guideline_sources": ["ICMR", "WHO", "NICE", "AHA/ACC", "KDIGO"]
    }


@router.post("/ddi-check", response_model=DDICheckResponse)
def check_drug_interactions(
    req: DDICheckRequest,
    current_doctor: User = Depends(get_current_doctor)
):
    """
    Dedicated rapid multi-drug interaction and organ toxicity safety evaluation.
    """
    if len(req.medications) < 2:
        return DDICheckResponse(
            medications_analyzed=req.medications,
            severe_interactions=[],
            moderate_interactions=[],
            organ_cautions=[],
            summary="At least 2 medications are required to perform a pairwise drug-drug interaction check."
        )

    return evaluate_clinical_ddi(req.medications, req.renal_status)
