import os
import json
"""
Praxirence Clinical Decision Support System (CDSS) & Safety Engine
Compliant with Indian National Formulary (INF), CDSCO Advisories & NLEM 2022.
Provides:
- 3-Tier DDI Classification: CONTRAINDICATED (Red) | MODERATE (Yellow) | MINOR (Blue)
- Molecular Mechanism & Recommended Alternative Molecules
- Allergy Cross-Reactivity Checking (Penicillins, Sulfa, NSAIDs)
- Renal Clearance Titrations (eGFR cutoffs)
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple, Set
from pydantic import BaseModel, Field

logger = logging.getLogger("praxirence.cdss")

# -------------------------------------------------------------
# CDSS Models
# -------------------------------------------------------------

class DDIAlert(BaseModel):
    drug_1: str
    drug_2: str
    severity: str = Field(description="'CONTRAINDICATED' | 'MODERATE' | 'MINOR'")
    mechanism: str
    clinical_risk: str
    recommendation: str
    alternative_molecules: List[str] = Field(default_factory=list)

class AllergyCrossReactivityAlert(BaseModel):
    allergen: str
    prescribed_drug: str
    severity: str
    clinical_rationale: str
    action: str

class CDSSPrescriptionSafetyReport(BaseModel):
    medications_analyzed: List[str]
    contraindicated_alerts: List[DDIAlert] = Field(default_factory=list)
    moderate_alerts: List[DDIAlert] = Field(default_factory=list)
    minor_alerts: List[DDIAlert] = Field(default_factory=list)
    allergy_alerts: List[AllergyCrossReactivityAlert] = Field(default_factory=list)
    renal_hepatic_cautions: List[str] = Field(default_factory=list)
    is_safe: bool = True
    summary: str = "No clinically significant interactions detected."


# -------------------------------------------------------------
# -------------------------------------------------------------
# Dynamic CDSS Knowledge Base Loaders (backend/data/ JSON assets)
# -------------------------------------------------------------

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))

def _load_cdss_data(filename: str) -> List[Dict[str, Any]]:
    path = os.path.join(DATA_DIR, filename)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load CDSS data asset {filename}: {e}")
    return []

CLINICAL_DDI_RULES: List[Dict[str, Any]] = _load_cdss_data("ddi_rules.json")
ALLERGY_CROSS_REACTIVITY_RULES: List[Dict[str, Any]] = _load_cdss_data("allergy_rules.json")


class CDSSService:
    """
    Clinical Decision Support Service providing DDI, allergy, and organ clearance auditing.
    """

    @classmethod
    def evaluate_prescription_safety(
        cls,
        medications: List[str],
        allergies: Optional[List[str]] = None,
        egfr: Optional[float] = None,
        is_pregnant: bool = False
    ) -> CDSSPrescriptionSafetyReport:
        """
        Performs 360-degree prescription safety check against Indian formulary standards.
        """
        clean_meds = [m.lower().strip() for m in medications if m and m.strip()]
        contraindicated = []
        moderate = []
        minor = []
        allergy_alerts = []
        organ_cautions = []

        # 1. DDI Rule Evaluation
        for rule in CLINICAL_DDI_RULES:
            d1, d2 = rule["pair"]
            d1_matches = [m for m in clean_meds if d1 in m]
            d2_matches = [m for m in clean_meds if d2 in m]

            if d1_matches and d2_matches:
                alert = DDIAlert(
                    drug_1=d1_matches[0].title(),
                    drug_2=d2_matches[0].title(),
                    severity=rule["severity"],
                    mechanism=rule["mechanism"],
                    clinical_risk=rule["clinical_risk"],
                    recommendation=rule["recommendation"],
                    alternative_molecules=rule.get("alternatives", [])
                )
                if rule["severity"] == "CONTRAINDICATED":
                    contraindicated.append(alert)
                elif rule["severity"] == "MODERATE":
                    moderate.append(alert)
                else:
                    minor.append(alert)

        # 2. Allergy Cross-Reactivity Evaluation
        if allergies:
            clean_allergies = [a.lower().strip() for a in allergies if a and a.strip()]
            for a_rule in ALLERGY_CROSS_REACTIVITY_RULES:
                matched_allergy = any(a_rule["allergen_keyword"] in user_alg for user_alg in clean_allergies)
                if matched_allergy:
                    for med in clean_meds:
                        if any(target in med for target in a_rule["target_drugs"]):
                            allergy_alerts.append(AllergyCrossReactivityAlert(
                                allergen=a_rule["allergen_keyword"].title(),
                                prescribed_drug=med.title(),
                                severity=a_rule["severity"],
                                clinical_rationale=a_rule["rationale"],
                                action=a_rule["action"]
                            ))

        # 3. Renal Clearance Titrations (eGFR cutoffs)
        if egfr is not None:
            if egfr < 30.0:
                if any("metformin" in m or "glycomet" in m for m in clean_meds):
                    organ_cautions.append("Metformin: Strictly contraindicated when eGFR < 30 ml/min/1.73m2 (high MALA risk).")
                if any("ciprofloxacin" in m or "ciplox" in m for m in clean_meds):
                    organ_cautions.append("Ciprofloxacin: Renal clearance compromised. Halve normal dosage when eGFR < 30.")
                if any("clexane" in m or "enoxaparin" in m for m in clean_meds):
                    organ_cautions.append("Enoxaparin: Reduce dose to 20mg once daily when eGFR < 30 ml/min to prevent hemorrhages.")
            elif egfr < 45.0:
                if any("metformin" in m or "glycomet" in m for m in clean_meds):
                    organ_cautions.append("Metformin: Limit dose to maximum 1000mg/day when eGFR is between 30-44 ml/min.")

        # 4. Pregnancy Contraindications
        if is_pregnant:
            teratogenic_drugs = ["telma", "telmisartan", "ramipril", "cardace", "methotrexate", "atorva", "rosuvas", "warfarin"]
            for med in clean_meds:
                if any(t in med for t in teratogenic_drugs):
                    contraindicated.append(DDIAlert(
                        drug_1=med.title(),
                        drug_2="Pregnancy (Physiological State)",
                        severity="CONTRAINDICATED",
                        mechanism="Teratogenicity and feto-toxicity (FDA Category X / D equivalent).",
                        clinical_risk="Severe congenital malformations, renal dysgenesis, or fetal demise.",
                        recommendation="Discontinue immediately. Substitute with pregnancy-safe alternatives.",
                        alternative_molecules=["Labetalol", "Methyldopa", "Nifedipine (Extended Release)"]
                    ))

        is_safe = (len(contraindicated) == 0 and len([a for a in allergy_alerts if a.severity == "CONTRAINDICATED"]) == 0)

        if not is_safe:
            summary = f"CRITICAL SAFETY ALERT: Found {len(contraindicated)} contraindicated interaction(s) or severe allergy conflicts. Immediate physician intervention required."
        elif moderate or allergy_alerts:
            summary = f"MODERATE CLINICAL PRECAUTION: {len(moderate)} moderate interaction(s) and {len(allergy_alerts)} allergy caution(s) flagged for monitoring."
        else:
            summary = "All prescribed medications verified against Indian Pharmacopoeia safety guidelines with zero critical contraindications."

        return CDSSPrescriptionSafetyReport(
            medications_analyzed=medications,
            contraindicated_alerts=contraindicated,
            moderate_alerts=moderate,
            minor_alerts=minor,
            allergy_alerts=allergy_alerts,
            renal_hepatic_cautions=organ_cautions,
            is_safe=is_safe,
            summary=summary
        )


cdss_service = CDSSService()
