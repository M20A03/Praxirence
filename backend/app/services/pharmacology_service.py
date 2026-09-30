"""
Praxirence Pharmacological Normalization & Drug Safety Engine
Institutional Indian National Formulary (INF) & Jan Aushadhi mapping.
Provides automatic brand-to-generic normalization, food-drug interaction safety,
and standardized missed-dose protocols.
"""

from typing import Dict, Any, List, Optional
import re


class PharmacologyService:
    # Top 50 Prescribed Indian Clinical Brand to Generic & INF Mappings
    BRAND_TO_GENERIC_MAP: Dict[str, Dict[str, Any]] = {
        "dolo": {"generic": "Paracetamol", "strength": "650mg", "form": "Tablet", "class": "Analgesic / Antipyretic"},
        "dolo 650": {"generic": "Paracetamol", "strength": "650mg", "form": "Tablet", "class": "Analgesic / Antipyretic"},
        "calpol": {"generic": "Paracetamol", "strength": "500mg", "form": "Tablet", "class": "Analgesic / Antipyretic"},
        "calpol 650": {"generic": "Paracetamol", "strength": "650mg", "form": "Tablet", "class": "Analgesic / Antipyretic"},
        "crocin": {"generic": "Paracetamol", "strength": "500mg", "form": "Tablet", "class": "Analgesic / Antipyretic"},
        "pan 40": {"generic": "Pantoprazole", "strength": "40mg", "form": "Tablet", "class": "Proton Pump Inhibitor (PPI)"},
        "pantocid": {"generic": "Pantoprazole", "strength": "40mg", "form": "Tablet", "class": "Proton Pump Inhibitor (PPI)"},
        "pantoprazole": {"generic": "Pantoprazole", "strength": "40mg", "form": "Tablet", "class": "Proton Pump Inhibitor (PPI)"},
        "pan-d": {"generic": "Pantoprazole + Domperidone", "strength": "40mg/30mg", "form": "Capsule", "class": "PPI + Prokinetic"},
        "omeez": {"generic": "Omeprazole", "strength": "20mg", "form": "Capsule", "class": "Proton Pump Inhibitor"},
        "rabeprazole": {"generic": "Rabeprazole", "strength": "20mg", "form": "Tablet", "class": "Proton Pump Inhibitor"},
        "telma": {"generic": "Telmisartan", "strength": "40mg", "form": "Tablet", "class": "ARB Antihypertensive"},
        "telma 40": {"generic": "Telmisartan", "strength": "40mg", "form": "Tablet", "class": "ARB Antihypertensive"},
        "telma h": {"generic": "Telmisartan + Hydrochlorothiazide", "strength": "40mg/12.5mg", "form": "Tablet", "class": "Antihypertensive + Diuretic"},
        "telmisartan": {"generic": "Telmisartan", "strength": "40mg", "form": "Tablet", "class": "ARB Antihypertensive"},
        "amlovas": {"generic": "Amlodipine", "strength": "5mg", "form": "Tablet", "class": "Calcium Channel Blocker"},
        "amlodipine": {"generic": "Amlodipine", "strength": "5mg", "form": "Tablet", "class": "Calcium Channel Blocker"},
        "augmentin": {"generic": "Amoxicillin + Clavulanic Acid", "strength": "625mg", "form": "Tablet", "class": "Beta-lactam Antibiotic"},
        "augmentin 625": {"generic": "Amoxicillin + Clavulanic Acid", "strength": "625mg", "form": "Tablet", "class": "Beta-lactam Antibiotic"},
        "moxikind-cv": {"generic": "Amoxicillin + Clavulanic Acid", "strength": "625mg", "form": "Tablet", "class": "Beta-lactam Antibiotic"},
        "azithral": {"generic": "Azithromycin", "strength": "500mg", "form": "Tablet", "class": "Macrolide Antibiotic"},
        "azithral 500": {"generic": "Azithromycin", "strength": "500mg", "form": "Tablet", "class": "Macrolide Antibiotic"},
        "azithromycin": {"generic": "Azithromycin", "strength": "500mg", "form": "Tablet", "class": "Macrolide Antibiotic"},
        "glycomet": {"generic": "Metformin", "strength": "500mg", "form": "Tablet", "class": "Biguanide Antidiabetic"},
        "glycomet 500": {"generic": "Metformin", "strength": "500mg", "form": "Tablet", "class": "Biguanide Antidiabetic"},
        "glycomet-gp": {"generic": "Glimepiride + Metformin", "strength": "1mg/500mg", "form": "Tablet", "class": "Dual Oral Hypoglycemic"},
        "metformin": {"generic": "Metformin", "strength": "500mg", "form": "Tablet", "class": "Biguanide Antidiabetic"},
        "atorva": {"generic": "Atorvastatin", "strength": "10mg", "form": "Tablet", "class": "HMG-CoA Reductase Inhibitor (Statin)"},
        "atorvastatin": {"generic": "Atorvastatin", "strength": "10mg", "form": "Tablet", "class": "Statin"},
        "ecosprin": {"generic": "Aspirin", "strength": "75mg", "form": "Enteric-coated Tablet", "class": "Antiplatelet"},
        "ecosprin 75": {"generic": "Aspirin", "strength": "75mg", "form": "Enteric-coated Tablet", "class": "Antiplatelet"},
        "thyronorm": {"generic": "Levothyroxine Sodium", "strength": "50mcg", "form": "Tablet", "class": "Thyroid Hormone"},
        "thyronorm 50": {"generic": "Levothyroxine Sodium", "strength": "50mcg", "form": "Tablet", "class": "Thyroid Hormone"},
        "eltroxin": {"generic": "Levothyroxine Sodium", "strength": "50mcg", "form": "Tablet", "class": "Thyroid Hormone"},
        "montair lc": {"generic": "Montelukast + Levocetirizine", "strength": "10mg/5mg", "form": "Tablet", "class": "Antileukotriene + Antihistamine"},
        "montek lc": {"generic": "Montelukast + Levocetirizine", "strength": "10mg/5mg", "form": "Tablet", "class": "Antileukotriene + Antihistamine"},
        "allegra": {"generic": "Fexofenadine", "strength": "120mg", "form": "Tablet", "class": "Second-Gen Antihistamine"},
        "levocet": {"generic": "Levocetirizine", "strength": "5mg", "form": "Tablet", "class": "Antihistamine"},
        "cetirizine": {"generic": "Cetirizine", "strength": "10mg", "form": "Tablet", "class": "Antihistamine"},
        "ciplox": {"generic": "Ciprofloxacin", "strength": "500mg", "form": "Tablet", "class": "Fluoroquinolone Antibiotic"},
        "oflox": {"generic": "Ofloxacin", "strength": "200mg", "form": "Tablet", "class": "Fluoroquinolone Antibiotic"},
        "combiflam": {"generic": "Ibuprofen + Paracetamol", "strength": "400mg/325mg", "form": "Tablet", "class": "NSAID + Analgesic"},
        "voveran": {"generic": "Diclofenac Sodium", "strength": "50mg", "form": "Tablet", "class": "NSAID"},
        "meftal spas": {"generic": "Mefenamic Acid + Dicyclomine", "strength": "250mg/10mg", "form": "Tablet", "class": "Antispasmodic + NSAID"},
        "duphaston": {"generic": "Dydrogesterone", "strength": "10mg", "form": "Tablet", "class": "Progestogen"},
        "shelcal": {"generic": "Calcium Carbonate + Vitamin D3", "strength": "500mg/250IU", "form": "Tablet", "class": "Bone Mineral Supplement"},
        "becosules": {"generic": "Vitamin B-Complex with Vitamin C", "strength": "Standard", "form": "Capsule", "class": "Multivitamin"},
        "supradyn": {"generic": "Multivitamin with Essential Minerals", "strength": "Standard", "form": "Tablet", "class": "Multivitamin"},
        "ascoril": {"generic": "Terbutaline + Acebrophylline + Guaiphenesin", "strength": "Syrup", "form": "Syrup", "class": "Bronchodilator Mucolytic"},
        "benadryl": {"generic": "Diphenhydramine + Ammonium Chloride", "strength": "Syrup", "form": "Syrup", "class": "Antitussive Expectorant"}
    }

    # Food-Drug Clinical Rules
    FOOD_RULES: Dict[str, Dict[str, str]] = {
        "levothyroxine": {
            "en": "Take on an empty stomach at least 30-60 minutes before breakfast with a glass of water. Avoid calcium or iron supplements within 4 hours.",
            "hi": "सुबह नाश्ते से 30-60 मिनट पहले खाली पेट पानी के साथ लें। इसके 4 घंटे तक कैल्शियम या आयरन की दवा न लें।"
        },
        "pantoprazole": {
            "en": "Take on an empty stomach 30 minutes before your morning breakfast for maximum acid suppression.",
            "hi": "सुबह नाश्ते से 30 मिनट पहले खाली पेट लें।"
        },
        "omeprazole": {
            "en": "Take on an empty stomach 30 minutes before your morning breakfast.",
            "hi": "सुबह नाश्ते से 30 मिनट पहले खाली पेट लें।"
        },
        "rabeprazole": {
            "en": "Take on an empty stomach 30 minutes before breakfast.",
            "hi": "सुबह नाश्ते से 30 मिनट पहले खाली पेट लें।"
        },
        "metformin": {
            "en": "Take with or immediately after meals to reduce stomach upset and nausea.",
            "hi": "पेट की परेशानी से बचने के लिए भोजन के साथ या तुरंत बाद लें।"
        },
        "aspirin": {
            "en": "Always take after a meal with plenty of water to protect your stomach lining.",
            "hi": "पेट की सुरक्षा के लिए हमेशा भोजन के बाद पानी के साथ लें।"
        },
        "paracetamol": {
            "en": "Can be taken after food or a light snack. Do not exceed 4,000mg in 24 hours.",
            "hi": "हल्के नाश्ते या भोजन के बाद लें। 24 घंटे में 4000 मिग्रा से अधिक न लें।"
        },
        "amoxicillin": {
            "en": "Take at evenly spaced intervals with or without food. Complete the full prescribed course.",
            "hi": "समय पर लें और डॉक्टर द्वारा बताया गया पूरा कोर्स खत्म करें।"
        },
        "azithromycin": {
            "en": "Take once daily at the same time, either 1 hour before or 2 hours after meals. Complete the entire 3 or 5 day course.",
            "hi": "दिन में एक बार निश्चित समय पर लें। पूरा कोर्स अवश्य पूरा करें।"
        },
        "ciprofloxacin": {
            "en": "Do not consume milk, yogurt, or calcium-fortified juices within 2 hours of taking this antibiotic.",
            "hi": "यह दवा लेने के 2 घंटे पहले या बाद तक दूध, दही या कैल्शियम युक्त चीजें न लें।"
        },
        "ibuprofen": {
            "en": "Always take after meals or with milk to prevent gastric irritation or acid reflux.",
            "hi": "पेट की जलन से बचने के लिए हमेशा भोजन या दूध के बाद लें।"
        },
        "diclofenac": {
            "en": "Must be taken after meals. Avoid combining with alcohol.",
            "hi": "हमेशा भोजन के बाद लें।"
        },
        "montelukast": {
            "en": "Best taken in the evening before bedtime as it may cause mild drowsiness.",
            "hi": "शाम को या रात में सोने से पहले लें, क्योंकि इससे हल्की नींद आ सकती है।"
        },
        "atorvastatin": {
            "en": "Best taken at bedtime once daily. Avoid consuming large amounts of grapefruit juice.",
            "hi": "रात को सोने से पहले लें। अंगूर या मौसंबी के रस के अधिक सेवन से बचें।"
        }
    }

    # Standard Missed-Dose Protocols
    MISSED_DOSE_RULE = {
        "en": "If you miss a dose, take it as soon as you remember. However, if it is almost time for your next scheduled dose, skip the missed dose and resume your regular timing. Never double up on pills to make up for a missed dose.",
        "hi": "यदि आप कोई खुराक भूल जाते हैं, तो याद आते ही ले लें। यदि आपकी अगली खुराक का समय हो चुका है, तो छूटी हुई खुराक छोड़ दें और सामान्य समय पर अगली दवा लें। कभी भी एक साथ दो गोलियां न लें।"
    }

    @classmethod
    def normalize_medication(cls, raw_name: str) -> Dict[str, Any]:
        """
        Normalizes transcribed medication brand to official generic name, form, and strength.
        """
        clean = raw_name.lower().strip()
        # Clean common prefixes/suffixes like tab, syp, cap
        clean = re.sub(r'^(tab|tablet|cap|capsule|syp|syrup|inj|injection)\s+', '', clean)
        clean = clean.strip()

        # Check direct or partial match
        matched_key = None
        for brand_key in cls.BRAND_TO_GENERIC_MAP:
            if brand_key == clean or clean.startswith(brand_key) or brand_key in clean:
                matched_key = brand_key
                break

        if matched_key:
            info = cls.BRAND_TO_GENERIC_MAP[matched_key]
            # Extract strength from raw name if provided, else default
            strength_match = re.search(r'(\d+\s*(?:mg|mcg|ml|g|iu))', raw_name, re.IGNORECASE)
            detected_strength = strength_match.group(1).upper() if strength_match else info["strength"]

            return {
                "medicine_name": f"{info['generic']} ({raw_name.strip()})",
                "generic_name": info["generic"],
                "strength": detected_strength,
                "dosage": detected_strength,
                "form": info["form"],
                "class": info["class"],
                "normalized": True
            }

        return {
            "medicine_name": raw_name.strip(),
            "generic_name": raw_name.strip(),
            "strength": "Standard",
            "dosage": "1 unit",
            "form": "Tablet",
            "class": "General Therapeutics",
            "normalized": False
        }

    @classmethod
    def get_food_rule(cls, generic_or_brand: str, language: str = "en") -> str:
        """
        Returns evidence-based food-drug rule for a medication.
        """
        norm = cls.normalize_medication(generic_or_brand)
        generic_lower = norm["generic_name"].lower()
        is_hindi = language.lower() in ["hi", "hindi", "हिन्दी", "bho", "bhojpuri"]

        for rule_key, rule_dict in cls.FOOD_RULES.items():
            if rule_key in generic_lower:
                return rule_dict["hi"] if is_hindi else rule_dict["en"]

        return (
            "भोजन के बाद पानी के साथ लें।" if is_hindi else "Take after meals with water as prescribed by your doctor."
        )

    @classmethod
    def get_missed_dose_guideline(cls, language: str = "en") -> str:
        """
        Returns clinical protocol for missed doses.
        """
        is_hindi = language.lower() in ["hi", "hindi", "हिन्दी", "bho", "bhojpuri"]
        return cls.MISSED_DOSE_RULE["hi"] if is_hindi else cls.MISSED_DOSE_RULE["en"]


pharmacology_service = PharmacologyService()
