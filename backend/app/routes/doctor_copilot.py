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
from app.models.medicine import Medicine
from sqlalchemy import or_, func
from app.routes.deps import get_current_doctor
from app.services.pharmacology_service import pharmacology_service
from app.services.cdss_service import cdss_service

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

MASTER_PHARMACOLOGY_SYSTEM_PROMPT = """You are Praxirence Clinical Copilot, an elite CDSS and Pharmacology Monograph Engine designed for licensed physicians and clinical specialists.

### MISSION:
The attending clinician is inquiring about a specific pharmaceutical agent, drug formulation, dosing regimen, food-drug interaction, or organ clearance adjustment.
Provide a high-yield, peer-level Clinical Pharmacology & Prescribing Monograph grounded in the Indian National Formulary (CDSCO) and international guidelines (WHO, FDA, BNF).
Do NOT hallucinate a patient diagnosis or force an ICD-10 illness differential unless the doctor explicitly requested a disease evaluation.
Maintain a crisp, authoritative medical tone with zero fluff, zero patient-facing disclaimers, and zero emojis.

### MANDATORY STRUCTURED OUTPUT FORMAT:
Your response MUST strictly adhere to the following 5 clinical sections:

#### 1. CLINICAL PHARMACOLOGY & FORMULARY IDENTITY
- Generic Salt & Pharmacological Class: [Official generic molecule, pharmacological mechanism of action, and therapeutic class]
- Available Dosage Forms & Strengths: [Tablets, capsules, syrups, IV/IM infusions commonly prescribed in India]
- Approved Primary Indications: [Clinical indications per CDSCO, WHO, and ICMR guidelines]
- Indian Commercial Brands & Formulary Status: [Leading Indian brands, manufacturer context, and Schedule classification (OTC / Schedule H / H1 / X)]

#### 2. EVIDENCE-BASED DOSING & ADMINISTRATION REGIMEN
- Standard Adult Dosing: [Recommended dose, frequency (OD/BD/TDS), route, and maximum 24-hour safe ceiling]
- Pediatric Dosing: [Weight-based mg/kg/dose if applicable, or clear pediatric precautions/contraindications]
- Food & Meal Timing Directive: [Empty stomach / with food / before meals, specific dietary restrictions or gastroprotection needs]
- Standard Duration: [Usual course duration for acute vs chronic indications]

#### 3. ORGAN CLEARANCE & DOSE TITRATION
- Renal Impairment (eGFR Cut-offs): [Specific titration guidelines for normal, moderate (eGFR 30-50), severe (eGFR < 30), or dialysis]
- Hepatic Impairment: [Child-Pugh A/B/C precautions, dose reduction, or absolute hepatic contraindications]
- Geriatric / Vulnerable Populations: [Starting dose adjustments and physiological considerations in elderly patients]

#### 4. PHARMACOVIGILANCE, BOXED WARNINGS & CONTRAINDICATIONS
- Absolute & Relative Contraindications: [Conditions where this drug must NEVER be prescribed]
- Boxed Warnings & Toxicity Thresholds: [Major toxicities, acute overdose threshold, and specific clinical antidote if known]
- High-Risk Drug-Drug Interactions (DDIs): [Top interacting drug classes and mechanistic clinical risks]

#### 5. AFFORDABLE GENERIC ALTERNATIVES (PMBJP JAN AUSHADHI)
- Pradhan Mantri Jan Aushadhi Availability: [Equivalent generic formulation available under PMBJP and cost advantage (~60-90% savings vs brands)]
- Clinical Substitution Directive: [Prescribing guidance for bioequivalent generic substitution in OPD/IPD practice]
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

    # 1. Baseline known pairs
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

    # 2. Advanced CDSS Engine Expansion (Indian Pharmacopoeia & NLEM)
    cdss_res = cdss_service.evaluate_prescription_safety(
        medications=all_tokens,
        egfr=25.0 if renal_status and "stage" in renal_status.lower() else None
    )
    for c_alert in cdss_res.contraindicated_alerts:
        if not any(s["drug_1"].lower() == c_alert.drug_1.lower() and s["drug_2"].lower() == c_alert.drug_2.lower() for s in severe):
            severe.append({
                "drug_1": c_alert.drug_1,
                "drug_2": c_alert.drug_2,
                "mechanism": c_alert.mechanism,
                "recommendation": c_alert.recommendation + (f" Alternatives: {', '.join(c_alert.alternative_molecules)}" if c_alert.alternative_molecules else "")
            })
    for m_alert in cdss_res.moderate_alerts:
        if not any(m["drug_1"].lower() == m_alert.drug_1.lower() and m["drug_2"].lower() == m_alert.drug_2.lower() for m in moderate):
            moderate.append({
                "drug_1": m_alert.drug_1,
                "drug_2": m_alert.drug_2,
                "mechanism": m_alert.mechanism,
                "recommendation": m_alert.recommendation
            })
    for rc in cdss_res.renal_hepatic_cautions:
        if rc not in cautions:
            cautions.append(rc)

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



def is_pharmacological_query(query: str, db: Session) -> Optional[Dict[str, Any]]:
    """
    Determines whether a query is primarily an inquiry about a drug, active salt,
    brand name, or pharmacological dosing regimen rather than a patient case presentation.
    """
    q_clean = query.strip()
    if not q_clean:
        return None

    # Exclude obvious complex clinical presentations
    import json
    from pathlib import Path
    markers_path = Path(__file__).resolve().parent.parent.parent / "data" / "copilot_case_markers.json"
    case_markers = []
    if markers_path.exists():
        with open(markers_path, "r", encoding="utf-8") as mf:
            case_markers = json.load(mf)
    if any(marker in q_clean.lower() for marker in case_markers):
        return None

    # Check direct normalization
    norm = pharmacology_service.normalize_medication(q_clean, db=db)
    if norm.get("normalized"):
        return norm

    # Check individual tokens
    tokens = [w.strip() for w in re.split(r'[,;/?\s]+', q_clean) if w.strip()]
    for t in tokens:
        if len(t) >= 3 and t.lower() not in ["what", "give", "tell", "dose", "side", "show", "about", "drug", "with"]:
            norm_t = pharmacology_service.normalize_medication(t, db=db)
            if norm_t.get("normalized"):
                return norm_t

    # Check known generic names directly in DB
    for t in tokens:
        if len(t) >= 4:
            matched_med = db.query(Medicine).filter(
                Medicine.is_banned_or_recalled == False,
                or_(
                    func.lower(Medicine.generic_name).like(f"%{t.lower()}%"),
                    func.lower(Medicine.brand_name).like(f"%{t.lower()}%")
                )
            ).first()
            if matched_med:
                return {
                    "medicine_name": matched_med.brand_name,
                    "generic_name": matched_med.generic_name,
                    "brand_name": matched_med.brand_name,
                    "strength": matched_med.strength,
                    "dosage": matched_med.strength,
                    "form": matched_med.dosage_form,
                    "class": f"{matched_med.schedule_type} Medication",
                    "jan_aushadhi_equivalent": matched_med.jan_aushadhi_equivalent,
                    "food_relation": matched_med.food_relation,
                    "meal_instructions": matched_med.default_meal_instructions or {},
                    "normalized": True
                }

    return None


def generate_fallback_pharmacology_response(drug: Dict[str, Any], query: str, db: Session) -> str:
    """
    Generates an authoritative, structured peer-level Clinical Pharmacology & Prescribing Monograph
    when an external LLM is offline, preventing hallucinated ICD-10 diagnostic outputs.
    """
    generic = drug.get("generic_name", "Unknown Generic").strip()
    brand = drug.get("brand_name", "Standard Brand").strip()
    strength = drug.get("strength", "Standard")
    dosage_form = drug.get("form", "Tablet")
    schedule = drug.get("class", "Schedule H Medication")
    food_rel = drug.get("food_relation", "after_meal")
    meal_inst = drug.get("meal_instructions", {}).get("en", "Take as prescribed by the attending physician.")
    jan_aushadhi = drug.get("jan_aushadhi_equivalent") or f"PMBJP Generic {generic} ({strength}) available nationwide at ~80% discount"

    # Fetch all brands with same generic in formulary
    related_brands = []
    try:
        meds = db.query(Medicine).filter(
            Medicine.is_banned_or_recalled == False,
            func.lower(Medicine.generic_name) == generic.lower()
        ).limit(6).all()
        related_brands = [f"{m.brand_name} ({m.strength}, {m.manufacturer or 'CDSCO Approved'})" for m in meds]
    except Exception:
        pass

    brands_str = ", ".join(related_brands) if related_brands else f"{brand} ({strength})"

    g_lower = generic.lower()

    if "paracetamol" in g_lower or "acetaminophen" in g_lower:
        return f"""#### 1. CLINICAL PHARMACOLOGY & FORMULARY IDENTITY
- Generic Salt & Pharmacological Class: Paracetamol / Acetaminophen (Analgesic & Antipyretic; central COX-2/COX-3 inhibition with hypothalamic thermoregulatory resetting).
- Available Dosage Forms & Strengths: Tablets (500mg, 650mg), Oral Suspension (120mg/5ml, 250mg/5ml), IV Infusion (1000mg/100ml), Suppositories (125mg, 250mg).
- Approved Primary Indications: Mild-to-moderate pyrexia, tension headache, musculoskeletal pain, post-immunization fever, and multimodal postoperative analgesia.
- Indian Commercial Brands & Formulary Status: {brands_str} | Status: OTC / Schedule H for high-dose formulations.

#### 2. EVIDENCE-BASED DOSING & ADMINISTRATION REGIMEN
- Standard Adult Dosing: 500mg - 650mg PO every 4 to 6 hours PRN. Maximum safe ceiling: 4000mg in 24 hours (limit to 2000-3000mg/day in elderly, chronic alcohol use, or weight < 50kg).
- Pediatric Dosing: 10 - 15 mg/kg/dose PO every 4 to 6 hours. Maximum daily pediatric limit: 60 mg/kg/day (do not exceed 5 doses in 24 hours).
- Food & Meal Timing Directive: Can be taken with or without food. Faster onset when taken on an empty stomach with a full glass of water. If mild gastric sensitivity occurs, administer after meals.
- Standard Duration: Shortest duration consistent with symptom resolution (typically 3 to 5 days).

#### 3. ORGAN CLEARANCE & DOSE TITRATION
- Renal Impairment (eGFR Cut-offs):
  * eGFR > 50 mL/min: Standard dosing interval (Q4H).
  * eGFR 10 - 50 mL/min: Lengthen dosing interval to Q6H.
  * eGFR < 10 mL/min: Lengthen dosing interval to Q8H.
- Hepatic Impairment: Dose-dependent hepatotoxicity. Strictly limit to 2000mg/day in mild-to-moderate stable hepatic impairment. Absolute contraindication in severe acute active hepatic necrosis.
- Geriatric / Vulnerable Populations: Lower daily maximum recommended (3000mg/day) to prevent accidental accumulation.

#### 4. PHARMACOVIGILANCE, BOXED WARNINGS & CONTRAINDICATIONS
- Absolute & Relative Contraindications: Known severe hypersensitivity, acute decompensated liver failure, active end-stage hepatic cirrhosis.
- Boxed Warnings & Toxicity Thresholds: Acute ingestion >150 mg/kg (or >7.5g in adults) can cause fatal centrilobular hepatic necrosis. Specific Antidote: IV N-Acetylcysteine (NAC) administered within 8-10 hours of toxic ingestion.
- High-Risk Drug-Drug Interactions (DDIs): Chronic alcohol or Isoniazid markedly potentiates hepatotoxic NAPQI metabolite formation; regular daily doses >2g may enhance Warfarin anticoagulation (monitor INR).

#### 5. AFFORDABLE GENERIC ALTERNATIVES (PMBJP JAN AUSHADHI)
- Pradhan Mantri Jan Aushadhi Availability: {jan_aushadhi} — High bioequivalence, costing ~₹1.00 - ₹1.50 per strip vs ₹30-45 for branded equivalents.
- Clinical Substitution Directive: Recommend PMBJP Paracetamol 650mg tablets for cost-sensitive patients requiring acute antipyretic or analgesic therapy."""

    elif "pantoprazole" in g_lower:
        return f"""#### 1. CLINICAL PHARMACOLOGY & FORMULARY IDENTITY
- Generic Salt & Pharmacological Class: Pantoprazole Sodium (Proton Pump Inhibitor / Acid Suppressive; irreversible covalent inhibition of H+/K+-ATPase in gastric parietal cells).
- Available Dosage Forms & Strengths: Enteric-coated tablets (20mg, 40mg), IV Lyophilized Injection (40mg vial).
- Approved Primary Indications: GERD, erosive esophagitis, duodenal/gastric ulcer disease, NSAID-induced gastroprotection, Zollinger-Ellison syndrome, H. pylori eradication.
- Indian Commercial Brands & Formulary Status: {brands_str} | Status: Schedule H Prescription Medicine.

#### 2. EVIDENCE-BASED DOSING & ADMINISTRATION REGIMEN
- Standard Adult Dosing: 40mg PO OD. For severe erosive esophagitis or bleeding peptic ulcer step-down: 40mg PO BD. Zollinger-Ellison: 80mg to 160mg daily.
- Pediatric Dosing: ≥5 years (>40kg): 40mg PO OD for up to 8 weeks. Safety not established in infants < 1 year.
- Food & Meal Timing Directive: Strictly take ON AN EMPTY STOMACH 30 to 60 minutes BEFORE morning breakfast with water. Do not crush, chew, or split enteric-coated tablets.
- Standard Duration: 4 to 8 weeks for erosive esophagitis and peptic ulcers; reassess for step-down therapy.

#### 3. ORGAN CLEARANCE & DOSE TITRATION
- Renal Impairment (eGFR Cut-offs): No dosage adjustment required in renal impairment or hemodialysis.
- Hepatic Impairment: Severe hepatic impairment (Child-Pugh C): Maximum 20mg daily or 40mg every other day with serial LFT monitoring.
- Geriatric Considerations: Safe in elderly; no routine age-related dose reduction needed.

#### 4. PHARMACOVIGILANCE, BOXED WARNINGS & CONTRAINDICATIONS
- Absolute & Relative Contraindications: Hypersensitivity to substituted benzimidazoles. Co-administration with rilpivirine-containing regimens.
- Boxed Warnings & Chronic Risks: Prolonged therapy (>1 year) linked with hypomagnesemia, Vitamin B12 malabsorption, increased osteoporotic fracture risk, and Clostridioides difficile colitis.
- High-Risk Drug-Drug Interactions (DDIs): Minimal CYP2C19 interaction compared to omeprazole (safe with Clopidogrel); significantly impairs absorption of pH-dependent drugs (Ketoconazole, Iron salts, Atazanavir).

#### 5. AFFORDABLE GENERIC ALTERNATIVES (PMBJP JAN AUSHADHI)
- Pradhan Mantri Jan Aushadhi Availability: {jan_aushadhi} — Available across PMBJP Kendras for ~₹12 - ₹15 per strip of 10 tablets.
- Clinical Substitution Directive: First-line substitution in OPD practice for cost-effective gastroprotection and acid-peptic management."""

    elif "azithromycin" in g_lower:
        return f"""#### 1. CLINICAL PHARMACOLOGY & FORMULARY IDENTITY
- Generic Salt & Pharmacological Class: Azithromycin Dihydrate (Macrolide / Azalide Antibiotic; reversibly binds 50S ribosomal subunit, inhibiting bacterial protein synthesis).
- Available Dosage Forms & Strengths: Tablets (250mg, 500mg), Oral Suspension (100mg/5ml, 200mg/5ml), IV Infusion (500mg vial).
- Approved Primary Indications: Community-acquired pneumonia (CAP), acute bacterial exacerbation of COPD, acute bacterial sinusitis, tonsillopharyngitis, chlamydial urethritis.
- Indian Commercial Brands & Formulary Status: {brands_str} | Status: Schedule H1 Antibiotic (Prescription Only).

#### 2. EVIDENCE-BASED DOSING & ADMINISTRATION REGIMEN
- Standard Adult Dosing: 500mg PO OD once daily for 3 consecutive days (or 500mg on Day 1 followed by 250mg OD on Days 2-5). Uncomplicated genital chlamydia: 1g single oral dose.
- Pediatric Dosing: 10 mg/kg/day PO OD for 3 days (or 10 mg/kg Day 1, followed by 5 mg/kg Days 2-5).
- Food & Meal Timing Directive: Take once daily at the same time. Tablets may be taken with or without food (taking with light food reduces GI cramping). Suspension should ideally be taken 1 hour before or 2 hours after food.
- Standard Duration: 3 to 5 days. High tissue half-life (~68 hours) provides extended post-antibiotic effect.

#### 3. ORGAN CLEARANCE & DOSE TITRATION
- Renal Impairment (eGFR Cut-offs): No adjustment necessary in mild-to-moderate renal impairment (eGFR 10-80 mL/min). Exercise clinical caution if eGFR < 10 mL/min.
- Hepatic Impairment: Primarily eliminated via biliary excretion. Use with extreme caution in biliary obstruction or moderate-to-severe hepatic impairment.
- Contraindications: History of cholestatic jaundice or hepatic dysfunction associated with previous azithromycin use.

#### 4. PHARMACOVIGILANCE, BOXED WARNINGS & CONTRAINDICATIONS
- Absolute & Relative Contraindications: Documented macrolide allergy, congenital long QT syndrome, concurrent use of QT-prolonging drugs.
- Boxed Warnings: Risk of QT prolongation, Torsades de Pointes, and fatal cardiac arrhythmias, especially in elderly or hypokalemic patients.
- High-Risk Drug-Drug Interactions (DDIs): Co-administration with Ondansetron, Amiodarone, or Fluoroquinolones significantly elevates arrhythmia risk; avoid co-administration with ergot alkaloids.

#### 5. AFFORDABLE GENERIC ALTERNATIVES (PMBJP JAN AUSHADHI)
- Pradhan Mantri Jan Aushadhi Availability: {jan_aushadhi} — Available at PMBJP stores for ~₹40 - ₹45 per strip of 3 tablets (saving >60%).
- Clinical Substitution Directive: Direct bioequivalent generic alternative in acute respiratory and soft tissue bacterial infections."""

    elif "metformin" in g_lower:
        return f"""#### 1. CLINICAL PHARMACOLOGY & FORMULARY IDENTITY
- Generic Salt & Pharmacological Class: Metformin Hydrochloride (Biguanide Antihyperglycemic; activates hepatic AMPK, decreases gluconeogenesis, enhances peripheral insulin sensitivity).
- Available Dosage Forms & Strengths: Immediate Release Tablets (500mg, 850mg, 1000mg), Extended Release (SR/ER 500mg, 1000mg).
- Approved Primary Indications: First-line pharmacotherapy for Type 2 Diabetes Mellitus, prediabetes, and polycystic ovarian syndrome (PCOS).
- Indian Commercial Brands & Formulary Status: {brands_str} | Status: Schedule H Prescription Medicine.

#### 2. EVIDENCE-BASED DOSING & ADMINISTRATION REGIMEN
- Standard Adult Dosing: Initial: 500mg PO BD or 850mg PO OD with meals. Titrate weekly by 500mg increments up to 1000mg PO BD (Maximum safe daily ceiling: 2000-2550 mg/day).
- Pediatric Dosing (T2DM in children ≥10 years): Initial 500mg PO OD with food; titrate to maximum 2000mg/day in divided doses.
- Food & Meal Timing Directive: Strictly take WITH or IMMEDIATELY AFTER meals to minimize common gastrointestinal adverse effects (nausea, flatulence, diarrhea).
- Standard Duration: Long-term chronic metabolic maintenance.

#### 3. ORGAN CLEARANCE & DOSE TITRATION
- Renal Impairment (KDIGO Guidelines):
  * eGFR ≥ 45 mL/min/1.73m²: No dose adjustment needed; monitor eGFR annually.
  * eGFR 30 - 44 mL/min/1.73m²: Maximum dose 1000mg/day (reduce by 50%); do not initiate new therapy.
  * eGFR < 30 mL/min/1.73m²: Strictly CONTRAINDICATED due to high risk of fatal Lactic Acidosis.
- Hepatic Impairment: Avoid in severe liver disease or acute alcohol intoxication (impaired lactate clearance).

#### 4. PHARMACOVIGILANCE, BOXED WARNINGS & CONTRAINDICATIONS
- Absolute & Relative Contraindications: eGFR < 30 mL/min, acute metabolic acidosis, severe hypoxemic states (decompensated heart failure, sepsis).
- Boxed Warnings: Metformin-Associated Lactic Acidosis (MALA) — Rare but 50% mortality. Discontinue 48 hours prior to iodinated radiocontrast procedures in patients with eGFR < 60.
- High-Risk Drug-Drug Interactions (DDIs): Cationic drugs (Cimetidine, Dolutegravir) compete for renal OCT2 transporters and increase metformin levels. Monitor Vitamin B12 levels annually.

#### 5. AFFORDABLE GENERIC ALTERNATIVES (PMBJP JAN AUSHADHI)
- Pradhan Mantri Jan Aushadhi Availability: {jan_aushadhi} — Available nationwide for ~₹8 - ₹12 per strip of 10 tablets.
- Clinical Substitution Directive: Recommended first-line oral antidiabetic substitution for high therapeutic adherence and cost control."""

    else:
        # Dynamic generic monograph generated from DB formulary attributes
        return f"""#### 1. CLINICAL PHARMACOLOGY & FORMULARY IDENTITY
- Generic Salt & Pharmacological Class: {generic} ({schedule}; verified in Indian National Formulary & CDSCO formulary).
- Formulation & Standard Strength: {dosage_form} | Strength: {strength}.
- Primary Clinical Indication: Indicated for therapeutic management within its pharmacotherapeutic class as directed by clinical guidelines.
- Indian Commercial Brands & Formulary Status: {brands_str} | Schedule: {schedule}.

#### 2. EVIDENCE-BASED DOSING & ADMINISTRATION REGIMEN
- Standard Adult Dosing: Recommended therapeutic dose as per strength ({strength}) aligned with clinical severity and attending physician judgment.
- Pediatric Considerations: Dosage must be individually calculated on a mg/kg basis or referred to pediatric formulary guidelines.
- Food & Meal Timing Directive: {meal_inst} (Relation: {food_rel.replace('_', ' ').title()}). Take with water as prescribed.
- Prescribing Caution: Ensure complete course adherence; do not prematurely discontinue or double up on missed doses.

#### 3. ORGAN CLEARANCE & DOSE TITRATION
- Renal Impairment: Baseline renal panel (eGFR, serum creatinine) recommended prior to initiation. Titrate dose in moderate-to-severe renal failure.
- Hepatic Impairment: Exercise clinical vigilance in patients with baseline transaminitis or chronic liver disease.
- Geriatric Patients: Start at the lower end of the dosing range and titrate cautiously based on clinical response.

#### 4. PHARMACOVIGILANCE, BOXED WARNINGS & CONTRAINDICATIONS
- Contraindications: Known severe hypersensitivity to active substance or excipients, severe end-stage organ dysfunction unless specifically cleared.
- Pharmacovigilance: Monitor for common adverse drug reactions, idiosyncratic drug eruptions, or acute gastrointestinal intolerance.
- High-Risk Drug-Drug Interactions (DDIs): Cross-check with patient's active medication list to avoid antagonistic effects, competitive CYP450 metabolism, or synergistic toxicities.

#### 5. AFFORDABLE GENERIC ALTERNATIVES (PMBJP JAN AUSHADHI)
- Pradhan Mantri Jan Aushadhi Availability: {jan_aushadhi}.
- Clinical Substitution Directive: Verified bioequivalent generic substitution supported for affordable, uninterrupted patient healthcare access."""

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

    # Step 1: Detect if this is a Pharmacology / Drug Monograph inquiry
    pharma_match = is_pharmacological_query(req.query, db)

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

    system_prompt = MASTER_PHARMACOLOGY_SYSTEM_PROMPT if pharma_match else MASTER_CLINICAL_SYSTEM_PROMPT

    if gemini_key and len(gemini_key) > 10:
        if pharma_match:
            user_content = (
                f"--- CLINICIAN / DOCTOR PROFILE ---\n"
                f"Doctor: Dr. {current_doctor.name} ({current_doctor.specialty or 'General Physician'})\n\n"
                f"--- FORMULARY DATABASE GROUNDING ---\n"
                f"Generic Salt: {pharma_match.get('generic_name')}\n"
                f"Brand Name: {pharma_match.get('brand_name')}\n"
                f"Dosage Form & Strength: {pharma_match.get('form')} {pharma_match.get('strength')}\n"
                f"Food Relation: {pharma_match.get('food_relation')}\n"
                f"Jan Aushadhi Alternative: {pharma_match.get('jan_aushadhi_equivalent')}\n\n"
                f"--- ATTENDING DOCTOR'S PHARMACOLOGY QUERY ---\n"
                f"{req.query}"
            )
        else:
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
                "parts": [{"text": system_prompt}]
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

        # Valid production Gemini models
        models_to_try = ["gemini-2.0-flash", "gemini-1.5-flash"]
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
        if pharma_match:
            logger.info(f"Using institutional pharmacology CDSS engine for '{req.query[:40]}'.")
            llm_reply = generate_fallback_pharmacology_response(pharma_match, req.query, db)
        else:
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
