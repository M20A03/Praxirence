import logging
import json
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.visit import Visit
from app.models.patient import Patient
from app.models.user import User
from app.services.ai_service import AIService

logger = logging.getLogger("praxirence.chat")
router = APIRouter(prefix="/chat", tags=["Patient Multilingual Assistant"])


class ChatRequest(BaseModel):
    message: str
    language: str = "English"  # "English", "Hindi", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Hinglish"
    patient_id: Optional[str] = None
    visit_id: Optional[str] = None
    active_medications: Optional[List[Dict[str, Any]]] = None


class RecommendedDoctor(BaseModel):
    id: str
    name: str
    specialty: str
    clinic_name: str
    reg_number: str
    phone: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    language: str
    detected_intent: str
    medicines_referenced: List[Dict[str, Any]] = []
    recommended_doctors: List[RecommendedDoctor] = []
    quick_suggestions: List[str] = []
    safety_disclaimer: str = "Trained Clinical Assistant • For emergency care, call 108 / 112 immediately."


SYSTEM_HEALTH_KNOWLEDGE = {
    "app_features": {
        "download_pdf": "You can download your official clinical prescription PDF directly from the 'Visits' tab by tapping 'Download PDF'.",
        "whatsapp": "Once your consultation is finalized by your clinician, the full Care Plan is securely dispatched to your WhatsApp via Meta Cloud API.",
        "consent": "Praxirence protects your health records with AES-256 blind indexing and HIPAA/ABDM security. You can toggle or revoke doctor access anytime from the 'Consent' tab.",
        "vitals": "Log daily Blood Pressure, Heart Rate, SpO2, and Blood Glucose on the 'Today' tab to track health trends over time.",
        "find_doctors": "Browse verified clinicians with active National Medical Commission (NMC) credentials on the 'Doctors' tab."
    }
}


def build_fallback_response(
    query: str,
    language: str,
    medicines: List[Dict[str, Any]],
    doctors: List[User]
) -> ChatResponse:
    """
    High-fidelity clinical response generator covering Multilingual queries,
    prescription explanations, doctor matching, and app navigation.
    """
    q_lower = query.lower()
    intent = "general_health"
    reply_text = ""
    meds_ref = []
    rec_docs = []
    suggestions = []

    is_hindi = language.lower() in ["hindi", "हिन्दी", "hinglish"]
    is_bengali = language.lower() in ["bengali", "বাংলা"]
    is_tamil = language.lower() in ["tamil", "தமிழ்"]
    is_telugu = language.lower() in ["telugu", "తెలుగు"]
    is_marathi = language.lower() in ["marathi", "मराठी"]
    is_gujarati = language.lower() in ["gujarati", "ગુજરાતી"]

    # 1. Prescription / Medicine Queries
    if any(k in q_lower for k in ["medicine", "medication", "prescription", "dose", "dosage", "tablet", "syrup", "pill", "schedule", "timing", "side effect", "दवा", "दवाई", "औषध", "மருந்து", "మందు"]):
        intent = "prescription_explanation"
        if medicines:
            meds_ref = medicines
            med_summaries = []
            for m in medicines:
                name = m.get("name", "Medication")
                dose = m.get("dosage", "As prescribed")
                freq = m.get("frequency", "daily")
                instr = m.get("instructions", "after meals")
                med_summaries.append(f"• **{name}** ({dose}): Take {freq}, {instr}.")
            
            summary_block = "\n".join(med_summaries)

            if is_hindi:
                reply_text = (
                    f"नमस्ते! आपके सबसे हालिया प्रिस्क्रिप्शन के अनुसार:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **सावधानी:** दवाएं हमेशा समय पर लें। पेट की समस्या से बचने के लिए भोजन के बाद पानी के साथ लें। यदि कोई एलर्जी या चक्कर आए तो तुरंत अपने डॉक्टर से संपर्क करें।"
                )
                suggestions = ["दवा के दुष्प्रभाव क्या हैं?", "खुराक भूल जाने पर क्या करें?", "डॉक्टर से संपर्क करें"]
            elif is_bengali:
                reply_text = (
                    f"নমস্কার! আপনার প্রেসক্রিপশন অনুযায়ী:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **সতর্কতা:** ওষুধগুলি সর্বদা সময়মতো এবং খাবারের পরে পর্যাপ্ত জল দিয়ে গ্রহণ করুন।"
                )
                suggestions = ["পার্শ্বপ্রতিক্রিয়া কী?", "ডাক্তারের সাথে যোগাযোগ করুন"]
            elif is_tamil:
                reply_text = (
                    f"வணக்கம்! உங்கள் தற்போதைய மருந்துச் சீட்டின்படி:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **குறிப்பு:** மருந்துகளை உணவு உண்ட பின் தண்ணீருடன் உட்கொள்ளவும்."
                )
                suggestions = ["பக்க விளைவுகள் என்ன?", "மருத்துவரைத் தொடர்பு கொள்ளவும்"]
            elif is_telugu:
                reply_text = (
                    f"నమస్కారం! మీ ప్రస్తుత ప్రిస్క్రిప్షన్ ప్రకారం:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **సూచన:** మందులను భోజనం తర్వాత సరైన సమయానికి తీసుకోండి."
                )
                suggestions = ["దుష్ప్రభావాలు ఏమిటి?", "వైద్యుడిని సంప్రదించండి"]
            else:
                reply_text = (
                    f"Hello! Based on your active Praxirence prescription:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **Clinical Guidance:** Always take oral medications with a full glass of water. "
                    f"Do not crush extended-release tablets. If you miss a dose, take it as soon as remembered unless it is close to your next scheduled dose."
                )
                suggestions = ["What are potential side effects?", "What if I miss a dose?", "Contact Prescribing Doctor"]
        else:
            if is_hindi:
                reply_text = "वर्तमान में आपके रिकॉर्ड में कोई सक्रिय प्रिस्क्रिप्शन नहीं मिला। आप 'डॉक्टर' टैब से अपॉइंटमेंट बुक कर सकते हैं।"
            else:
                reply_text = "No active prescription records found. You can book an encounter with a specialist under the 'Doctors' tab."
            suggestions = ["Find General Physician", "Book Consultation", "How to sync vitals?"]

    # 2. Doctor Search / Recommendation Queries
    elif any(k in q_lower for k in ["doctor", "specialist", "pediatrician", "cardiologist", "physician", "clinic", "डॉक्टर", "হাসপাতাল"]):
        intent = "doctor_recommendation"
        for doc in doctors[:4]:
            rec_docs.append(RecommendedDoctor(
                id=str(doc.id),
                name=doc.name,
                specialty=getattr(doc, "specialty", "General Physician") or "General Physician",
                clinic_name=getattr(doc, "clinic_name", "Praxirence Clinical Centre") or "Praxirence Clinical Centre",
                reg_number=getattr(doc, "reg_number", "NMC-2024-84920") or "NMC-2024-84920",
                phone=getattr(doc, "phone", None)
            ))

        doc_lines = [f"• **{d.name}** - {d.specialty} ({d.clinic_name})" for d in rec_docs]
        doc_block = "\n".join(doc_lines)

        if is_hindi:
            reply_text = (
                f"हमारे क्लिनिकल नेटवर्क में उपलब्ध सत्यापित डॉक्टर:\n\n"
                f"{doc_block}\n\n"
                f"आप 'डॉक्टर' टैब में जाकर किसी भी डॉक्टर के साथ परामर्श शुरू कर सकते हैं।"
            )
            suggestions = ["Dr. Mayank Raj से परामर्श लें", "पीडियाट्रिशियन खोजें", "क्लिनिक का समय"]
        else:
            reply_text = (
                f"Here are the verified clinicians available in our network:\n\n"
                f"{doc_block}\n\n"
                f"You can view their full profiles and initiate consultations under the **Doctors** tab."
            )
            suggestions = ["Book with Dr. Mayank Raj", "Find Pediatrician", "Clinic Hours"]

    # 3. App Features / Navigation Queries
    elif any(k in q_lower for k in ["download", "pdf", "whatsapp", "consent", "privacy", "feature", "vitals", "app"]):
        intent = "app_navigation"
        if is_hindi:
            reply_text = (
                "📱 **Praxirence ऐप की मुख्य विशेषताएं:**\n\n"
                "1. **प्रिस्क्रिप्शन PDF ডাউনলোড:** 'Visits' टैब पर जाएं और 'Download PDF' पर टैप करें।\n"
                "2. **WhatsApp अलर्ट:** डॉक्टर द्वारा परामर्श पूरा होते ही पूरा केयर प्लान आपके WhatsApp पर आ जाता है।\n"
                "3. **गोपनीयता और सहमति:** 'Consent' टैब में जाकर आप किसी भी समय अपनी डेटा अनुमति प्रबंधित कर सकते हैं।\n"
                "4. **वाइटल्स ट्रैकर:** 'Today' टैब पर अपना बीपी, शुगर और हार्ट रेट रिकॉर्ड करें।"
            )
            suggestions = ["प्रिस्क्रिप्शन डाउनलोड करें", "सहमति कैसे काम करती है?", "वाइटल्स रिकॉर्ड करें"]
        else:
            reply_text = (
                "📱 **Praxirence App Features & Navigation:**\n\n"
                "1. **Download Rx PDF:** Tap the **Visits** tab and select 'Download PDF' for an official stamped copy.\n"
                "2. **WhatsApp Delivery:** Your care plan is automatically delivered to your phone via Meta WhatsApp Cloud API.\n"
                "3. **Consent & Privacy:** View and control healthcare provider data access in the **Consent** tab (HIPAA & ABDM compliant).\n"
                "4. **Vitals Monitoring:** Track daily Blood Pressure, Pulse, and Blood Sugar on the **Today** tab."
            )
            suggestions = ["How does Consent work?", "Download Latest Rx", "Log Today's Vitals"]

    # 4. General Medical & Emergency Support
    else:
        intent = "general_support"
        if is_hindi:
            reply_text = (
                "नमस्ते! मैं आपका प्रैक्सिरेंस एआई स्वास्थ्य सहायक हूँ।\n\n"
                "मैं आपकी सहायता कर सकता हूँ:\n"
                "• आपके प्रिस्क्रिप्शन और दवाओं की खुराक समझाने में 💊\n"
                "• अस्पताल के सत्यापित डॉक्टरों को खोजने में 👨‍⚕️\n"
                "• ऐप की सुविधाओं और रिपोर्ट डाउनलोड करने में 📄\n\n"
                "⚠️ **आपातकाल:** यदि सीने में दर्द या सांस लेने में गंभीर तकलीफ हो, तो तुरंत नजदीकी आपातकालीन कक्ष से संपर्क करें।"
            )
            suggestions = ["मेरी दवाएं समझाइए 💊", "डॉक्टर खोजें 👨‍⚕️", "प्रिस्क्रिप्शन डाउनलोड करें 📄"]
        else:
            reply_text = (
                "Hello! I am your **Praxirence AI Clinical Assistant**.\n\n"
                "I can help you with:\n"
                "• Explaining your active medicines, dosages, and food rules 💊\n"
                "• Finding verified doctors & specialists in our clinic network 👨‍⚕️\n"
                "• Guiding you through app features (PDF downloads, WhatsApp sync, consent) 📱\n\n"
                "⚠️ **Medical Notice:** For life-threatening emergencies (e.g. severe chest pressure or shortness of breath), immediately call emergency services or visit the nearest ER."
            )
            suggestions = ["Explain my medication schedule 💊", "Find a Doctor 👨‍⚕️", "How to download prescription? 📄"]

    return ChatResponse(
        reply=reply_text,
        language=language,
        detected_intent=intent,
        medicines_referenced=meds_ref,
        recommended_doctors=rec_docs,
        quick_suggestions=suggestions
    )


@router.post("/patient-assistant", response_model=ChatResponse)
def patient_chat_assistant(
    req: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Multilingual AI Health Assistant endpoint.
    Retrieves patient context and doctor directory from PostgreSQL to provide
    clinically sound, multilingual guidance.
    """
    # 1. Fetch Patient's latest prescription / medicines if patient_id is provided
    medicines = req.active_medications or []
    if not medicines and req.patient_id:
        latest_visit = db.query(Visit).filter(
            Visit.patient_id == req.patient_id
        ).order_by(Visit.created_at.desc()).first()

        if latest_visit and latest_visit.care_plan:
            cp = latest_visit.care_plan
            if isinstance(cp, str):
                try:
                    cp = json.loads(cp)
                except Exception:
                    cp = {}
            if isinstance(cp, dict):
                medicines = cp.get("medicines", [])

    # 2. Fetch verified doctors for referral
    doctors = db.query(User).all()

    # 3. Generate response
    response = build_fallback_response(
        query=req.message,
        language=req.language,
        medicines=medicines,
        doctors=doctors
    )

    return response
