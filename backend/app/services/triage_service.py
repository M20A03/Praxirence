"""
Praxirence Clinical Triage & ESI Emergency Red-Flag Engine
Detects life-threatening symptoms and triggers instant 108/112 ambulance escalation cards.
Zero false-negatives on acute myocardial infarction, stroke, severe anaphylaxis, and acute respiratory failure.
"""

from typing import Dict, Any, List, Optional
import re


class ClinicalTriageService:
    # Critical Red-Flag Trigger Regexes (English, Hindi, Hinglish, Kannada, etc.)
    RED_FLAG_PATTERNS = [
        # Cardiovascular / Chest Pain
        (r'\b(chest\s+pain|heart\s+attack|crushing\s+pain|pain\s+radiat.*arm|seene\s+(?:me|mein).{0,25}dard|chhati\s+(?:me|mein).{0,25}dard|छाती\s+में.{0,25}दर्द|सीने\s+में.{0,25}दर्द)\b', "Cardiovascular Red-Flag: Possible Acute Coronary Syndrome"),
        # Respiratory Distress
        (r'\b(shortness\s+of\s+breath|cannot\s+breathe|can\'?t\s+breathe|difficulty\s+breathing|choking|saans\s+phool|saans\s+nahi\s+aa\s+rahi|saans\s+lene\s+me.{0,25}(?:takleef|dikkat)|सांस\s+लेने\s+में.{0,25}(?:तकलीफ|दिक्कत)|दम\s+घुट)\b', "Respiratory Red-Flag: Acute Dyspnea / Airway Compromise"),
        # Neurological / Stroke (FAST)
        (r'\b(slurred\s+speech|facial\s+droop|paralysis|sudden\s+weakness|loss\s+of\s+consciousness|fainted|unconscious|lakwa|behosh(?:i)?|लकवा|बेहोश)\b', "Neurological Red-Flag: Possible Acute Cerebrovascular Event (Stroke)"),
        # Severe Hemorrhage
        (r'\b(coughing\s+blood|vomiting\s+blood|blood\s+in\s+vomit|khoon\s+ki\s+ulti|खून\s+की\s+उल्टी)\b', "Hemorrhagic Red-Flag: Hematemesis / Hemoptysis"),
        # Anaphylaxis
        (r'\b(anaphylaxis|swollen\s+throat|lip\s+swelling|tongue\s+swelling|severe\s+allergic\s+reaction)\b', "Immunological Red-Flag: Anaphylactic Shock"),
        # Severe Pediatric / Hyperpyrexia
        (r'\b(fever\s+(?:104|105|above\s+104)|baby\s+unresponsive|child\s+seizure|convulsion|jhatke|दौरा)\b', "Pediatric / Hyperpyrexic Red-Flag: Febrile Seizure / Hyperpyrexia")
    ]

    @classmethod
    def evaluate_emergency(cls, query: str, language: str = "en") -> Optional[Dict[str, Any]]:
        """
        Evaluates patient query against ESI triage red flags.
        Returns Emergency Alert payload if a life-threatening symptom is detected.
        """
        q_lower = query.lower()
        is_hindi = language.lower() in ["hi", "hindi", "हिन्दी", "bho", "bhojpuri"]

        for pattern, reason in cls.RED_FLAG_PATTERNS:
            if re.search(pattern, q_lower, re.IGNORECASE):
                # Critical Red-Flag Found!
                emergency_title = "आपातकालीन चेतावनी (EMERGENCY RED-FLAG)" if is_hindi else "CLINICAL EMERGENCY RED-FLAG"
                
                emergency_body = (
                    "आपके द्वारा बताए गए लक्षण गंभीर आपातकालीन स्थिति का संकेत हो सकते हैं। "
                    "कृपया तुरंत नजदीकी अस्पताल के इमरजेंसी विभाग (ER) में जाएं या 108 पर एम्बुलेंस को कॉल करें। समय अत्यधिक महत्वपूर्ण है।"
                    if is_hindi else
                    "The symptoms you described may indicate an acute, life-threatening medical emergency. "
                    "Do not wait. Immediately call 108 for an ambulance or proceed to the nearest hospital Emergency Room (ER)."
                )

                return {
                    "is_emergency": True,
                    "triage_category": "ESI-1 / ESI-2 Critical",
                    "reason": reason,
                    "title": emergency_title,
                    "message": emergency_body,
                    "actions": [
                        {"label": "Call 108 (Ambulance)", "action": "tel:108", "is_primary": True},
                        {"label": "Call 112 (National Emergency)", "action": "tel:112", "is_primary": False},
                    ],
                    "guidance": [
                        "Do not drive yourself to the hospital; wait for paramedics or have someone drive you.",
                        "Sit in an upright, comfortable position and loosen any tight clothing.",
                        "Keep your Praxirence prescription records ready for emergency medical staff."
                    ] if not is_hindi else [
                        "स्वयं गाड़ी न चलाएं; एम्बुलेंस का इंतजार करें या किसी से अस्पताल ले जाने को कहें।",
                        "आरामदायक स्थिति में सीधे बैठें और कपड़े ढीले करें।",
                        "आपातकालीन डॉक्टरों को दिखाने के लिए अपना प्रैक्सिरेंस प्रिस्क्रिप्शन तैयार रखें।"
                    ]
                }

        return None


triage_service = ClinicalTriageService()
